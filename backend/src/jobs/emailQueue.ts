import { Queue, QueueOptions } from 'bullmq';
import { createBullMQConnection } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-dispatch';

export interface EmailJobData {
  jobId: string;          // DB email_jobs.id
  campaignId: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;       // encrypted — decrypted by worker at dispatch time
  smtpSecure: boolean;
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
      delay: 5000,
    },
    removeOnComplete: { count: 100, age: 3600 },
    removeOnFail: { count: 100, age: 86400 },
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
