/**
 * Database seed script: creates default Ethereal senders.
 * Run with: npm run db:seed
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { db } from './index';
import { senders } from './schema';
import nodemailer from 'nodemailer';

async function createEtherealAccount(): Promise<{ user: string; pass: string; email: string }> {
  const account = await nodemailer.createTestAccount();
  return {
    user: account.user,
    pass: account.pass,
    email: account.user,
  };
}

async function seed() {
  console.log('🌱 Seeding database...');

  // Create 2 Ethereal senders
  const senderData = [
    { name: 'ReachInbox Marketing' },
    { name: 'ReachInbox Outreach' },
  ];

  for (const data of senderData) {
    const account = await createEtherealAccount();
    await db.insert(senders).values({
      name: data.name,
      email: account.email,
      etherealUser: account.user,
      etherealPass: account.pass,
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      isActive: true,
    }).onConflictDoNothing();
    console.log(`✅ Created sender: ${data.name} (${account.email})`);
  }

  console.log('✅ Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
