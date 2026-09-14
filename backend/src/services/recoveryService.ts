import { emailQueue, EmailJobData } from '../jobs/emailQueue';
import { db } from '../db';
import { emailJobs, campaigns, senders } from '../db/schema';
import { eq, inArray, and, or } from 'drizzle-orm';

/**
 * Startup Recovery Service
 *
 * Problem this solves:
 *   BullMQ delayed jobs live in Redis. If Redis is wiped or the container restarts
 *   with ephemeral storage, all delayed jobs disappear — but the DB still shows
 *   them as 'pending'. Without recovery, those emails would never be sent.
 *
 * Solution (no cron, no OS scheduler):
 *   On every server startup, we query the DB for all jobs that are STILL pending
 *   AND scheduled in the future. We re-add each of them to BullMQ using the SAME
 *   bullJobId that was used originally. BullMQ deduplicates by jobId, so if the
 *   job is already in Redis (normal startup where Redis wasn't wiped), it silently
 *   ignores the duplicate — zero double-sends.
 *
 * Guarantees:
 *   - ✅ Future emails still send at the correct time after any restart
 *   - ✅ Emails are NOT re-sent or duplicated (idempotent via bullJobId)
 *   - ✅ Already-sent/failed jobs are skipped entirely
 *   - ✅ No cron jobs anywhere in this flow
 */
export async function recoverPendingJobs(): Promise<void> {
  console.log('🔄 Starting job recovery scan...');

  const now = new Date();

  try {
    // Fetch all jobs that are still pending/rate_limited and scheduled in the future
    // (past-due pending jobs will also be recovered — BullMQ fires them immediately)
    const pendingJobs = await db
      .select({
        id: emailJobs.id,
        campaignId: emailJobs.campaignId,
        recipientEmail: emailJobs.recipientEmail,
        recipientName: emailJobs.recipientName,
        scheduledAt: emailJobs.scheduledAt,
        bullJobId: emailJobs.bullJobId,
        status: emailJobs.status,
        // Campaign fields
        subject: campaigns.subject,
        body: campaigns.body,
        hourlyLimit: campaigns.hourlyLimit,
        // Sender fields
        senderId: senders.id,
        senderEmail: senders.email,
        senderName: senders.name,
        senderEtherealUser: senders.etherealUser,
        senderEtherealPass: senders.etherealPass,
        senderSmtpHost: senders.smtpHost,
        senderSmtpPort: senders.smtpPort,
      })
      .from(emailJobs)
      .leftJoin(campaigns, eq(emailJobs.campaignId, campaigns.id))
      .leftJoin(senders, eq(campaigns.senderId, senders.id))
      .where(
        or(eq(emailJobs.status, 'pending'), eq(emailJobs.status, 'rate_limited'))
      );

    if (pendingJobs.length === 0) {
      console.log('✅ Job recovery: no pending jobs to recover.');
      return;
    }

    console.log(`🔄 Job recovery: found ${pendingJobs.length} pending job(s) to re-sync to BullMQ...`);

    let recovered = 0;
    let skipped = 0;

    for (const job of pendingJobs) {
      // Skip if bullJobId is missing (shouldn't happen, but defensive)
      if (!job.bullJobId) {
        console.warn(`⚠️  Skipping job ${job.id}: missing bullJobId`);
        skipped++;
        continue;
      }

      // Skip if any joined data is null (broken FK — shouldn't happen)
      if (!job.subject || !job.senderEmail) {
        console.warn(`⚠️  Skipping job ${job.id}: missing campaign or sender data`);
        skipped++;
        continue;
      }

      // Calculate how long until the job should fire.
      // If scheduledAt is in the past, delay=0 → BullMQ fires immediately.
      const fireAt = job.scheduledAt.getTime();
      const delay = Math.max(0, fireAt - now.getTime());

      const jobData: EmailJobData = {
        jobId: job.id,
        campaignId: job.campaignId,
        senderId: job.senderId!,
        senderEmail: job.senderEmail!,
        senderName: job.senderName!,
        senderEtherealUser: job.senderEtherealUser!,
        senderEtherealPass: job.senderEtherealPass!,
        senderSmtpHost: job.senderSmtpHost!,
        senderSmtpPort: job.senderSmtpPort!,
        recipientEmail: job.recipientEmail,
        recipientName: job.recipientName ?? undefined,
        subject: job.subject!,
        body: job.body!,
        hourlyLimit: job.hourlyLimit!,
      };

      try {
        // Add with the SAME bullJobId — BullMQ will silently skip if already present.
        // This is the core idempotency guarantee.
        await emailQueue.add('send-email', jobData, {
          delay,
          jobId: job.bullJobId,
        });
        recovered++;
      } catch (err: any) {
        // BullMQ throws if job with same ID already exists in certain states.
        // That's fine — it means it was already in Redis and doesn't need recovery.
        if (err?.message?.includes('already exists') || err?.message?.includes('duplicate')) {
          skipped++;
        } else {
          console.error(`❌ Failed to recover job ${job.id}:`, err?.message);
          skipped++;
        }
      }
    }

    console.log(
      `✅ Job recovery complete: ${recovered} re-queued, ${skipped} already present/skipped.`
    );
  } catch (err) {
    // Recovery failure should NOT crash the server — worst case is delayed jobs
    // miss their window (which is recoverable on next restart).
    console.error('❌ Job recovery scan failed:', err);
  }
}
