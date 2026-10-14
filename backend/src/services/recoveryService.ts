import { emailQueue, EmailJobData } from '../jobs/emailQueue';
import { db } from '../db';
import { emailJobs, campaigns, senders } from '../db/schema';
import { eq, or } from 'drizzle-orm';

/**
 * Startup Recovery Service
 *
 * On every server startup, re-syncs any pending/rate_limited DB jobs into BullMQ.
 * BullMQ deduplicates by jobId so existing Redis jobs are silently skipped.
 */
export async function recoverPendingJobs(): Promise<void> {
  console.log('🔄 Starting job recovery scan...');

  const now = new Date();

  try {
    const pendingJobs = await db
      .select({
        id: emailJobs.id,
        campaignId: emailJobs.campaignId,
        recipientEmail: emailJobs.recipientEmail,
        recipientName: emailJobs.recipientName,
        scheduledAt: emailJobs.scheduledAt,
        bullJobId: emailJobs.bullJobId,
        status: emailJobs.status,
        subject: campaigns.subject,
        body: campaigns.body,
        hourlyLimit: campaigns.hourlyLimit,
        senderId: senders.id,
        userId: campaigns.userId,
        senderEmail: senders.email,
        senderName: senders.name,
        smtpHost: senders.smtpHost,
        smtpPort: senders.smtpPort,
        smtpUser: senders.smtpUser,
        smtpPass: senders.smtpPass,
        smtpSecure: senders.smtpSecure,
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
      if (!job.bullJobId || !job.subject || !job.senderEmail) {
        skipped++;
        continue;
      }

      const fireAt = job.scheduledAt.getTime();
      const delay = Math.max(0, fireAt - now.getTime());

      const jobData: EmailJobData = {
        jobId: job.id,
        campaignId: job.campaignId,
        userId: job.userId!,
        senderId: job.senderId!,
        senderEmail: job.senderEmail!,
        senderName: job.senderName!,
        smtpHost: job.smtpHost!,
        smtpPort: job.smtpPort!,
        smtpUser: job.smtpUser!,
        smtpPass: job.smtpPass!,
        smtpSecure: job.smtpSecure!,
        recipientEmail: job.recipientEmail,
        recipientName: job.recipientName ?? undefined,
        subject: job.subject!,
        body: job.body!,
        hourlyLimit: job.hourlyLimit!,
      };

      try {
        await emailQueue.add('send-email', jobData, {
          delay,
          jobId: job.bullJobId,
        });
        recovered++;
      } catch (err: any) {
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
    console.error('❌ Job recovery scan failed:', err);
  }
}
