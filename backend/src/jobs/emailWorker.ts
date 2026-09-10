import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '../config/redis';
import { env } from '../config/env';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from './emailQueue';
import { sendEmail } from '../services/emailService';
import { checkRateLimit } from '../services/rateLimiter';
import { db } from '../db';
import { emailJobs, campaigns } from '../db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';

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

      // ── Rate limit check ──────────────────────────────────────────────
      const rateLimitResult = await checkRateLimit(data.senderId, data.hourlyLimit);

      if (!rateLimitResult.allowed) {
        console.log(
          `⏳ Rate limit hit for sender ${data.senderEmail}. Requeueing in ${rateLimitResult.retryAfterMs}ms`
        );

        // Re-add job with delay to next hour window (preserving order via jitter)
        await emailQueue.add(
          'send-email',
          data,
          {
            delay: rateLimitResult.retryAfterMs,
            jobId: `retry-${data.jobId}-${Date.now()}`, // new jobId for re-queue
          }
        );

        // Mark as rate_limited in DB
        await db
          .update(emailJobs)
          .set({ status: 'rate_limited', updatedAt: new Date() })
          .where(eq(emailJobs.id, data.jobId));

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
        await db
          .update(emailJobs)
          .set({
            status: 'sent',
            sentAt: new Date(),
            messageId: result.messageId,
            previewUrl: result.previewUrl ? String(result.previewUrl) : null,
            updatedAt: new Date(),
          })
          .where(eq(emailJobs.id, data.jobId));

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
        inArray(emailJobs.status, ['pending', 'rate_limited'])
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
