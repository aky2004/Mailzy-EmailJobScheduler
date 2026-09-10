import { Queue, QueueOptions } from 'bullmq';
import { createBullMQConnection } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-dispatch';

export interface EmailJobData {
  jobId: string;          // DB email_jobs.id
  campaignId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  senderEtherealUser: string;
  senderEtherealPass: string;
  senderSmtpHost: string;
  senderSmtpPort: number;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  body: string;
  hourlyLimit: number;
}

const queueOptions: QueueOptions = {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s initial backoff
    },
    removeOnComplete: { count: 1000, age: 7 * 24 * 3600 }, // keep 1000 or 7 days
    removeOnFail: { count: 500, age: 30 * 24 * 3600 },    // keep 500 or 30 days
  },
};

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, queueOptions);

export async function getQueueStats() {
  const [waiting, active, delayed, failed, completed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getDelayedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getCompletedCount(),
  ]);
  return { waiting, active, delayed, failed, completed };
}
