import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '../config/redis';
import { env } from '../config/env';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from './emailQueue';
import { sendEmail } from '../services/emailService';
import { checkRateLimit } from '../services/rateLimiter';
import { decrypt } from '../utils/crypto';
import { db } from '../db';
import { emailJobs, campaigns } from '../db/schema';
import { eq, sql, and, or } from 'drizzle-orm';
import { esClient, ES_INDEX } from '../config/es';

/**
 * BullMQ Worker for processing email send jobs.
 *
 * Decrypts SMTP credentials at dispatch time and sends via the user's own mailbox.
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

        const hourWindow = Math.floor(Date.now() / (60 * 60 * 1000));
        const retryJobId = `retry-${data.jobId}-h${hourWindow}`;
        await emailQueue.add(
          'send-email',
          { ...data, jobId: data.jobId },
          {
            delay: rateLimitResult.retryAfterMs,
            jobId: retryJobId,
          }
        );

        await db
          .update(emailJobs)
          .set({ status: 'rate_limited', updatedAt: new Date() })
          .where(eq(emailJobs.id, data.jobId));

        return;
      }

      // ── Send email ────────────────────────────────────────────────────
      try {
        // Decrypt the SMTP password at dispatch time
        const smtpPass = decrypt(data.smtpPass);

        const result = await sendEmail({
          to: data.recipientEmail,
          toName: data.recipientName,
          from: data.senderEmail,
          fromName: data.senderName,
          subject: data.subject,
          html: data.body,
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpUser: data.smtpUser,
          smtpPass,
          smtpSecure: data.smtpSecure,
        });

        // ── Update DB: success ─────────────────────────────────────────
        const sentAt = new Date();
        await db
          .update(emailJobs)
          .set({
            status: 'sent',
            sentAt,
            messageId: result.messageId,
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

        throw error;
      }
    },
    {
      connection: createBullMQConnection(),
      concurrency: env.WORKER_CONCURRENCY,
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
 * Check if all jobs in a campaign are done and update campaign status.
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
