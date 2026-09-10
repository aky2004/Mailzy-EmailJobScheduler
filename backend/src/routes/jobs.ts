import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { emailJobs, campaigns, senders } from '../db/schema';
import { eq, desc, inArray, sql, and, ne } from 'drizzle-orm';
import { getQueueStats } from '../jobs/emailQueue';

const router = Router();

/**
 * GET /api/jobs/scheduled
 * Returns all pending / rate_limited / running jobs (scheduled, not yet sent).
 */
router.get('/scheduled', authenticate, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page ?? '1'));
  const limit = parseInt(String(req.query.limit ?? '50'));
  const offset = (page - 1) * limit;

  try {
    // Get campaign IDs belonging to this user
    const userCampaigns = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.userId, req.user!.dbId));

    const campaignIds = userCampaigns.map((c) => c.id);

    if (campaignIds.length === 0) {
      res.json({ jobs: [], pagination: { page, limit, total: 0, pages: 0 } });
      return;
    }

    const jobs = await db
      .select({
        id: emailJobs.id,
        recipientEmail: emailJobs.recipientEmail,
        recipientName: emailJobs.recipientName,
        status: emailJobs.status,
        scheduledAt: emailJobs.scheduledAt,
        createdAt: emailJobs.createdAt,
        campaignSubject: campaigns.subject,
        campaignId: campaigns.id,
        senderEmail: senders.email,
        senderName: senders.name,
      })
      .from(emailJobs)
      .leftJoin(campaigns, eq(emailJobs.campaignId, campaigns.id))
      .leftJoin(senders, eq(campaigns.senderId, senders.id))
      .where(
        and(
          inArray(emailJobs.campaignId, campaignIds),
          inArray(emailJobs.status, ['pending', 'rate_limited'])
        )
      )
      .orderBy(emailJobs.scheduledAt)
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(emailJobs)
      .where(
        and(
          inArray(emailJobs.campaignId, campaignIds),
          inArray(emailJobs.status, ['pending', 'rate_limited'])
        )
      );

    res.json({
      jobs,
      pagination: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) },
    });
  } catch (error) {
    console.error('Get scheduled jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled jobs' });
  }
});

/**
 * GET /api/jobs/sent
 * Returns all sent or failed jobs.
 */
router.get('/sent', authenticate, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page ?? '1'));
  const limit = parseInt(String(req.query.limit ?? '50'));
  const offset = (page - 1) * limit;

  try {
    const userCampaigns = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.userId, req.user!.dbId));

    const campaignIds = userCampaigns.map((c) => c.id);

    if (campaignIds.length === 0) {
      res.json({ jobs: [], pagination: { page, limit, total: 0, pages: 0 } });
      return;
    }

    const jobs = await db
      .select({
        id: emailJobs.id,
        recipientEmail: emailJobs.recipientEmail,
        recipientName: emailJobs.recipientName,
        status: emailJobs.status,
        sentAt: emailJobs.sentAt,
        previewUrl: emailJobs.previewUrl,
        errorMessage: emailJobs.errorMessage,
        messageId: emailJobs.messageId,
        campaignSubject: campaigns.subject,
        campaignId: campaigns.id,
        senderEmail: senders.email,
        senderName: senders.name,
      })
      .from(emailJobs)
      .leftJoin(campaigns, eq(emailJobs.campaignId, campaigns.id))
      .leftJoin(senders, eq(campaigns.senderId, senders.id))
      .where(
        and(
          inArray(emailJobs.campaignId, campaignIds),
          inArray(emailJobs.status, ['sent', 'failed'])
        )
      )
      .orderBy(desc(emailJobs.sentAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(emailJobs)
      .where(
        and(
          inArray(emailJobs.campaignId, campaignIds),
          inArray(emailJobs.status, ['sent', 'failed'])
        )
      );

    res.json({
      jobs,
      pagination: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) },
    });
  } catch (error) {
    console.error('Get sent jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch sent jobs' });
  }
});

/**
 * GET /api/jobs/stats
 * Returns queue stats from BullMQ.
 */
router.get('/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = await getQueueStats();
    res.json({ queue: stats });
  } catch (error) {
    console.error('Get queue stats error:', error);
    res.status(500).json({ error: 'Failed to fetch queue stats' });
  }
});

export default router;
