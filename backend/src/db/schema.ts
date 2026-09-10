import { pgTable, serial, text, timestamp, integer, varchar, uuid, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const campaignStatusEnum = pgEnum('campaign_status', [
  'scheduled',
  'running',
  'completed',
  'failed',
  'paused',
]);

export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'sent',
  'failed',
  'rate_limited',
  'cancelled',
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const senders = pgTable('senders', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  etherealUser: varchar('ethereal_user', { length: 255 }).notNull(),
  etherealPass: varchar('ethereal_pass', { length: 255 }).notNull(),
  smtpHost: varchar('smtp_host', { length: 255 }).default('smtp.ethereal.email').notNull(),
  smtpPort: integer('smtp_port').default(587).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  senderId: uuid('sender_id').references(() => senders.id).notNull(),
  subject: varchar('subject', { length: 998 }).notNull(),
  body: text('body').notNull(),
  totalRecipients: integer('total_recipients').default(0).notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  delayBetweenMs: integer('delay_between_ms').default(2000).notNull(),
  hourlyLimit: integer('hourly_limit').default(100).notNull(),
  status: campaignStatusEnum('status').default('scheduled').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).unique().notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailJobs = pgTable('email_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  recipientName: varchar('recipient_name', { length: 255 }),
  status: jobStatusEnum('status').default('pending').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  bullJobId: varchar('bull_job_id', { length: 512 }).unique(),
  messageId: varchar('message_id', { length: 512 }),
  previewUrl: text('preview_url'),
  retryCount: integer('retry_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  campaigns: many(campaigns),
}));

export const sendersRelations = relations(senders, ({ many }) => ({
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, { fields: [campaigns.userId], references: [users.id] }),
  sender: one(senders, { fields: [campaigns.senderId], references: [senders.id] }),
  jobs: many(emailJobs),
}));

export const emailJobsRelations = relations(emailJobs, ({ one }) => ({
  campaign: one(campaigns, { fields: [emailJobs.campaignId], references: [campaigns.id] }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Sender = typeof senders.$inferSelect;
export type NewSender = typeof senders.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type EmailJob = typeof emailJobs.$inferSelect;
export type NewEmailJob = typeof emailJobs.$inferInsert;
