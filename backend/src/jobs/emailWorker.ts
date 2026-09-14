import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '../config/redis';
import { env } from '../config/env';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from './emailQueue';
import { sendEmail } from '../services/emailService';
import { checkRateLimit } from '../services/rateLimiter';
import { db } from '../db';
import { emailJobs, campaigns, slackConnections } from '../db/schema';
import { eq, sql, and, inArray, or } from 'drizzle-orm';
import { esClient, ES_INDEX } from '../config/es';

/**
 * BullMQ Worker for processing email send jobs.
 *
 * Rate limiting:
 *   - Checks Redis per-sender hourly counter atomically via Lua script.
 *   - If limit exceeded: re-queues job with delay to next hour window (job is never dropped).
 *
 * Idempotency:
 *   - Checks DB job status before sending; skips if already sent.
 *
 * Min delay between sends:
 *   - Enforced via BullMQ's limiter option (max 1 job per MIN_DELAY_MS globally per worker).
 */
export function startEmailWorker(): Worker {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const data = job.data;

      // ── Idempotency check ─────────────────────────────────────────────
      const [existingJob] = await db
        .select()
        .from(emailJobs)
        .where(eq(emailJobs.id, data.jobId))
        .limit(1);

      if (!existingJob) {
        console.warn(`⚠️  DB job not found: ${data.jobId}, skipping`);
        return;
      }

      if (existingJob.status === 'sent') {
        console.log(`✅ Already sent: ${data.jobId}, skipping`);
        return;
      }

      if (existingJob.status === 'cancelled') {
        console.log(`🚫 Job cancelled: ${data.jobId}, skipping`);
        return;
      }

      // ── Flip campaign to 'running' on first job execution ─────────────
      await db
        .update(campaigns)
        .set({ status: 'running', updatedAt: new Date() })
        .where(
          and(
            eq(campaigns.id, data.campaignId),
            eq(campaigns.status, 'scheduled')
          )
        );

      // ── Rate limit check ──────────────────────────────────────────────
      const rateLimitResult = await checkRateLimit(data.senderId, data.hourlyLimit);

      if (!rateLimitResult.allowed) {
        console.log(
          `⏳ Rate limit hit for sender ${data.senderEmail}. Requeueing in ${rateLimitResult.retryAfterMs}ms`
        );

        // Re-add job with delay to next hour window.
        // Use a deterministic jobId based on the original jobId + hour window,
        // so that recovery scans don't create a second copy of the retry.
        const hourWindow = Math.floor(Date.now() / (60 * 60 * 1000));
        const retryJobId = `retry-${data.jobId}-h${hourWindow}`;
        await emailQueue.add(
          'send-email',
          { ...data, jobId: data.jobId }, // preserve original DB jobId
          {
            delay: rateLimitResult.retryAfterMs,
            jobId: retryJobId,
          }
        );

        // Mark as rate_limited in DB
        await db
          .update(emailJobs)
          .set({ status: 'rate_limited', updatedAt: new Date() })
          .where(eq(emailJobs.id, data.jobId));

        // Trigger Slack Notification
        try {
          const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, data.campaignId)).limit(1);
          if (campaign) {
            const [slackConn] = await db.select().from(slackConnections).where(eq(slackConnections.userId, campaign.userId)).limit(1);
            if (slackConn && slackConn.webhookUrl) {
              await fetch(slackConn.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: `⚠️ *Rate Limit Exceeded*\nSender *${data.senderEmail}* has reached the limit of ${data.hourlyLimit} emails/hour.\nJob \`${data.jobId}\` was rescheduled by ${Math.ceil(rateLimitResult.retryAfterMs / 1000)} seconds.`
                })
              }).catch(e => console.error('Slack HTTP error:', e));
            }
          }
        } catch (slackErr) {
          console.error('Failed to send slack notification', slackErr);
        }

        return; // Do NOT throw — this is successful handling
      }

      // ── Send email ────────────────────────────────────────────────────
      try {
        const result = await sendEmail({
          to: data.recipientEmail,
          toName: data.recipientName,
          from: data.senderEmail,
          fromName: data.senderName,
          subject: data.subject,
          html: data.body,
          smtpUser: data.senderEtherealUser,
          smtpPass: data.senderEtherealPass,
          smtpHost: data.senderSmtpHost,
          smtpPort: data.senderSmtpPort,
        });

        // ── Update DB: success ─────────────────────────────────────────
        const sentAt = new Date();
        await db
          .update(emailJobs)
          .set({
            status: 'sent',
            sentAt,
            messageId: result.messageId,
            previewUrl: result.previewUrl ? String(result.previewUrl) : null,
            updatedAt: new Date(),
          })
          .where(eq(emailJobs.id, data.jobId));

        try {
          await esClient.update({
            index: ES_INDEX,
            id: data.jobId,
            doc: { status: 'sent', sentAt: sentAt.toISOString() },
          });
        } catch (e) { console.error('ES update error:', e); }

        // Check if campaign is complete
        await checkAndUpdateCampaignStatus(data.campaignId);

      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to send email to ${data.recipientEmail}: ${errMsg}`);

        await db
          .update(emailJobs)
          .set({
            status: 'failed',
            errorMessage: errMsg,
            updatedAt: new Date(),
          })
          .where(eq(emailJobs.id, data.jobId));

        try {
          await esClient.update({
            index: ES_INDEX,
            id: data.jobId,
            doc: { status: 'failed' },
          });
        } catch (e) { console.error('ES update error:', e); }

        throw error; // Re-throw so BullMQ handles retries
      }
    },
    {
      connection: createBullMQConnection(),
      concurrency: env.WORKER_CONCURRENCY,
      // Rate limiter: minimum delay between individual sends per worker
      limiter: {
        max: 1,
        duration: env.MIN_DELAY_MS,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(
    `🚀 Email worker started (concurrency=${env.WORKER_CONCURRENCY}, minDelay=${env.MIN_DELAY_MS}ms)`
  );

  return worker;
}

/**
 * After a job completes, check if all jobs in the campaign are done
 * and update campaign status accordingly.
 */
async function checkAndUpdateCampaignStatus(campaignId: string): Promise<void> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) return;

  const stillPending = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailJobs)
    .where(
      and(
        eq(emailJobs.campaignId, campaignId),
        or(eq(emailJobs.status, 'pending'), eq(emailJobs.status, 'rate_limited'))
      )
    )
    .then((rows) => Number(rows[0]?.count ?? 0));

  if (stillPending === 0 && (campaign.status === 'running' || campaign.status === 'scheduled')) {
    await db
      .update(campaigns)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
  }
}
