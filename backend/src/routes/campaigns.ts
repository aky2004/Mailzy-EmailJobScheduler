import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { campaigns, emailJobs, senders } from '../db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { scheduleCampaign } from '../services/schedulerService';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const createCampaignSchema = z.object({
  senderId: z.string().uuid(),
  subject: z.string().min(1).max(998),
  body: z.string().min(1),
  recipients: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
  })).min(1).max(10000),
  scheduledAt: z.string().datetime(),
  delayBetweenMs: z.number().min(0).max(3600000).default(2000),
  hourlyLimit: z.number().min(1).max(1000).default(100),
  hasAttachments: z.boolean().default(false),
});

/**
 * POST /api/campaigns
 * Create a new email campaign and schedule all jobs.
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { senderId, subject, body, recipients, scheduledAt, delayBetweenMs, hourlyLimit, hasAttachments } = parsed.data;

  try {
    // Validate sender exists
    const [sender] = await db.select().from(senders).where(eq(senders.id, senderId)).limit(1);
    if (!sender) {
      res.status(404).json({ error: 'Sender not found' });
      return;
    }

    const idempotencyKey = `campaign_${req.user!.dbId}_${Date.now()}_${uuidv4().slice(0, 8)}`;

    // Create campaign record
    const [campaign] = await db.insert(campaigns).values({
      userId: req.user!.dbId,
      senderId,
      subject,
      body,
      totalRecipients: recipients.length,
      scheduledAt: new Date(scheduledAt),
      delayBetweenMs,
      hourlyLimit,
      status: 'scheduled',
      hasAttachments,
      idempotencyKey,
    }).returning();

    // Schedule all jobs asynchronously (don't await – return immediately)
    scheduleCampaign({
      campaignId: campaign.id,
      senderId,
      subject,
      body,
      recipients,
      scheduledAt: new Date(scheduledAt),
      delayBetweenMs,
      hourlyLimit,
    }).catch((err: Error) => {
      console.error(`Campaign ${campaign.id} scheduling failed:`, err.message);
    });

    res.status(201).json({
      campaign: {
        id: campaign.id,
        subject: campaign.subject,
        totalRecipients: campaign.totalRecipients,
        scheduledAt: campaign.scheduledAt,
        status: campaign.status,
        createdAt: campaign.createdAt,
      },
      message: `Scheduling ${recipients.length} emails starting at ${scheduledAt}`,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create campaign error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

/**
 * GET /api/campaigns
 * List all campaigns for the authenticated user.
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page ?? '1'));
  const limit = parseInt(String(req.query.limit ?? '20'));
  const offset = (page - 1) * limit;

  try {
    const allCampaigns = await db
      .select({
        id: campaigns.id,
        subject: campaigns.subject,
        totalRecipients: campaigns.totalRecipients,
        scheduledAt: campaigns.scheduledAt,
        status: campaigns.status,
        delayBetweenMs: campaigns.delayBetweenMs,
        hourlyLimit: campaigns.hourlyLimit,
        createdAt: campaigns.createdAt,
        completedAt: campaigns.completedAt,
        senderEmail: senders.email,
        senderName: senders.name,
      })
      .from(campaigns)
      .leftJoin(senders, eq(campaigns.senderId, senders.id))
      .where(eq(campaigns.userId, req.user!.dbId))
      .orderBy(desc(campaigns.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(campaigns)
      .where(eq(campaigns.userId, req.user!.dbId));

    res.json({
      campaigns: allCampaigns,
      pagination: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) },
    });
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

/**
 * GET /api/campaigns/:id
 * Get campaign details with job stats.
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const id = String(req.params.id);

  try {
    const [campaign] = await db
      .select({
        id: campaigns.id,
        subject: campaigns.subject,
        body: campaigns.body,
        totalRecipients: campaigns.totalRecipients,
        scheduledAt: campaigns.scheduledAt,
        status: campaigns.status,
        delayBetweenMs: campaigns.delayBetweenMs,
        hourlyLimit: campaigns.hourlyLimit,
        createdAt: campaigns.createdAt,
        completedAt: campaigns.completedAt,
        senderEmail: senders.email,
        senderName: senders.name,
      })
      .from(campaigns)
      .leftJoin(senders, eq(campaigns.senderId, senders.id))
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, req.user!.dbId)))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Get job stats
    const stats = await db
      .select({
        status: emailJobs.status,
        count: sql<number>`count(*)`,
      })
      .from(emailJobs)
      .where(eq(emailJobs.campaignId, id))
      .groupBy(emailJobs.status);

    res.json({ campaign, stats });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

/**
 * GET /api/campaigns/:id/jobs
 * Get all email jobs for a campaign.
 */
router.get('/:id/jobs', authenticate, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const page = parseInt(String(req.query.page ?? '1'));
  const limit = parseInt(String(req.query.limit ?? '50'));
  const offset = (page - 1) * limit;

  try {
    const jobs = await db
      .select()
      .from(emailJobs)
      .where(eq(emailJobs.campaignId, id))
      .orderBy(emailJobs.scheduledAt)
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(emailJobs)
      .where(eq(emailJobs.campaignId, id));

    res.json({
      jobs,
      pagination: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) },
    });
  } catch (error) {
    console.error('Get campaign jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

export default router;
