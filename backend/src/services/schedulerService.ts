import { emailQueue, EmailJobData } from '../jobs/emailQueue';
import { db } from '../db';
import { emailJobs, campaigns, senders } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { esClient, ES_INDEX } from '../config/es';

export interface Recipient {
  email: string;
  name?: string;
}

export interface ScheduleCampaignOptions {
  campaignId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: Recipient[];
  scheduledAt: Date;
  delayBetweenMs: number;
  hourlyLimit: number;
}

/**
 * Schedules all email jobs for a campaign.
 * Each recipient gets a BullMQ delayed job with:
 *   delay = (scheduledAt + index * delayBetweenMs) - now
 */
export async function scheduleCampaign(opts: ScheduleCampaignOptions): Promise<void> {
  const { campaignId, senderId, subject, body, recipients, scheduledAt, delayBetweenMs, hourlyLimit } = opts;

  const [sender] = await db.select().from(senders).where(eq(senders.id, senderId)).limit(1);
  if (!sender) throw new Error(`Sender ${senderId} not found`);

  const now = Date.now();
  const scheduledAtMs = scheduledAt.getTime();

  await db.update(campaigns)
    .set({ status: 'scheduled', updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const fireAt = scheduledAtMs + i * delayBetweenMs;
    const delay = Math.max(0, fireAt - now);
    const bullJobId = `campaign_${campaignId}_recipient_${recipient.email.replace(/[^a-zA-Z0-9]/g, '_')}_${i}`;

    const dbJobId = uuidv4();

    await db.insert(emailJobs).values({
      id: dbJobId,
      campaignId,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      status: 'pending',
      scheduledAt: new Date(fireAt),
      bullJobId,
    }).onConflictDoNothing();

    const jobData: EmailJobData = {
      jobId: dbJobId,
      campaignId,
      userId: sender.userId,
      senderId,
      senderEmail: sender.email,
      senderName: sender.name,
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      smtpUser: sender.smtpUser,
      smtpPass: sender.smtpPass, // stored encrypted, decrypted in worker
      smtpSecure: sender.smtpSecure,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      subject,
      body,
      hourlyLimit,
    };

    await emailQueue.add('send-email', jobData, {
      delay,
      jobId: bullJobId,
    });

    // Index into Elasticsearch
    try {
      await esClient.index({
        index: ES_INDEX,
        id: dbJobId,
        document: {
          id: dbJobId,
          campaignId,
          subject,
          body,
          recipientEmail: recipient.email,
          senderEmail: sender.email,
          status: 'pending',
          scheduledAt: new Date(fireAt).toISOString(),
        },
      });
    } catch (esErr) {
      console.error(`❌ ES Indexing failed for job ${dbJobId}:`, esErr);
    }
  }

  console.log(
    `📅 Scheduled ${recipients.length} emails for campaign ${campaignId} ` +
    `starting at ${scheduledAt.toISOString()} with ${delayBetweenMs}ms between sends`
  );
}
