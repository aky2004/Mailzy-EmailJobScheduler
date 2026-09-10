import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { slackConnections } from '../db/schema';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';

const router = Router();

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${env.PORT}/api/slack/callback`;

// Endpoint to initiate OAuth flow
router.get('/auth', authenticate, (req, res) => {
  if (!SLACK_CLIENT_ID) {
    // Demo mode: mock callback redirect with token
    return res.redirect(`/api/slack/callback?code=mock_code_for_demo&state=${req.query.token || ''}`);
  }

  const state = req.query.token || '';
  const url = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=chat:write,chat:write.public,incoming-webhook&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${encodeURIComponent(state as string)}`;
  res.redirect(url);
});

// Endpoint to handle OAuth callback
router.get('/callback', authenticate, async (req, res) => {
  try {
    const userId = req.user!.dbId;
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    let tokenData: any = {
      ok: true,
      access_token: 'xoxb-mock-token-for-demo',
      team: { id: 'T123MOCK', name: 'ReachInbox Alerts' },
      incoming_webhook: { channel_id: 'C123MOCK', channel: '#email-alerts', url: 'https://hooks.slack.com/services/mock' }
    };

    if (SLACK_CLIENT_ID && SLACK_CLIENT_SECRET) {
      const form = new URLSearchParams({
        code: code as string,
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      });

      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      tokenData = await response.json();
    }

    if (!tokenData.ok) {
      return res.status(400).json({ error: tokenData.error || 'Failed to exchange code' });
    }

    // Save to DB
    await db.insert(slackConnections).values({
      userId,
      accessToken: tokenData.access_token,
      teamId: tokenData.team?.id,
      teamName: tokenData.team?.name,
      webhookUrl: tokenData.incoming_webhook?.url,
      channelId: tokenData.incoming_webhook?.channel_id,
      channelName: tokenData.incoming_webhook?.channel,
    }).onConflictDoUpdate({
      target: slackConnections.userId,
      set: {
        accessToken: tokenData.access_token,
        teamId: tokenData.team?.id,
        teamName: tokenData.team?.name,
        webhookUrl: tokenData.incoming_webhook?.url,
        channelId: tokenData.incoming_webhook?.channel_id,
        channelName: tokenData.incoming_webhook?.channel,
        updatedAt: new Date()
      }
    });

    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_connected=true`);
  } catch (err) {
    console.error('Slack OAuth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Configure custom webhook directly
router.post('/webhook', authenticate, async (req, res) => {
  try {
    const userId = req.user!.dbId;
    const { webhookUrl, channelName } = req.body;

    if (!webhookUrl) {
      res.status(400).json({ error: 'webhookUrl is required' });
      return;
    }

    await db.insert(slackConnections).values({
      userId,
      accessToken: 'custom_webhook',
      teamName: 'Configured Slack Workspace',
      webhookUrl,
      channelName: channelName || '#alerts',
    }).onConflictDoUpdate({
      target: slackConnections.userId,
      set: {
        accessToken: 'custom_webhook',
        teamName: 'Configured Slack Workspace',
        webhookUrl,
        channelName: channelName || '#alerts',
        updatedAt: new Date(),
      }
    });

    res.json({ success: true, message: 'Slack webhook saved' });
  } catch (err) {
    console.error('Slack Webhook save error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test send message to verify live Slack webhook
router.post('/test', authenticate, async (req, res) => {
  try {
    const userId = req.user!.dbId;
    const [conn] = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId)).limit(1);

    if (!conn || !conn.webhookUrl) {
      res.status(400).json({ error: 'No Slack webhook configured. Connect Slack first.' });
      return;
    }

    if (conn.webhookUrl.includes('mock')) {
      res.json({ success: true, message: 'Mock Slack notification verified successfully!' });
      return;
    }

    const resp = await fetch(conn.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🟢 *ReachInbox Slack Integration Verified*\nRate limit alerts and scheduler notifications are active for channel *${conn.channelName || '#general'}*.`
      })
    });

    if (resp.ok) {
      res.json({ success: true, message: 'Test message sent to Slack!' });
    } else {
      res.status(400).json({ error: `Slack webhook responded with status ${resp.status}` });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send test message';
    res.status(500).json({ error: msg });
  }
});

// Endpoint to disconnect
router.delete('/disconnect', authenticate, async (req, res) => {
  try {
    const userId = req.user!.dbId;
    await db.delete(slackConnections).where(eq(slackConnections.userId, userId));
    res.json({ success: true, message: 'Slack disconnected' });
  } catch (err) {
    console.error('Slack Disconnect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get connection status
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.user!.dbId;
    const [conn] = await db.select().from(slackConnections).where(eq(slackConnections.userId, userId)).limit(1);
    
    if (conn) {
      res.json({
        connected: true,
        teamName: conn.teamName,
        channelName: conn.channelName,
        webhookUrl: conn.webhookUrl ? (conn.webhookUrl.includes('mock') ? 'Mock Webhook' : `${conn.webhookUrl.slice(0, 30)}...`) : undefined,
      });
    } else {
      res.json({ connected: false });
    }
  } catch (err) {
    console.error('Slack Status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
