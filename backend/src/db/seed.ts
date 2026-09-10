/**
 * Database seed script: creates default Ethereal senders.
 * Run with: npm run db:seed
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { db } from './index';
import { senders, campaigns } from './schema';
import { eq, notInArray } from 'drizzle-orm';
import nodemailer from 'nodemailer';

async function createEtherealAccount(): Promise<{ user: string; pass: string }> {
  const account = await nodemailer.createTestAccount();
  return {
    user: account.user,
    pass: account.pass,
  };
}

const NEW_SENDERS = [
  {
    name: 'mailZy',
    email: 'team@mailzy.io',
  },
  {
    name: 'OutboxLab',
    email: 'contact@outboxlab.com',
  },
  {
    name: 'Admin @ mailZy',
    email: 'admin@mailzy.io',
  },
];

async function seed() {
  console.log('🌱 Seeding database senders...');

  const createdSenderIds: string[] = [];

  for (const data of NEW_SENDERS) {
    // Check if sender with this email already exists
    const existing = await db
      .select()
      .from(senders)
      .where(eq(senders.email, data.email))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(senders)
        .set({
          name: data.name,
          isActive: true,
        })
        .where(eq(senders.id, existing[0].id));
      createdSenderIds.push(existing[0].id);
      console.log(`🔄 Updated sender: ${data.name} <${data.email}>`);
    } else {
      const account = await createEtherealAccount();
      const [newSender] = await db
        .insert(senders)
        .values({
          name: data.name,
          email: data.email,
          etherealUser: account.user,
          etherealPass: account.pass,
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          isActive: true,
        })
        .returning();
      createdSenderIds.push(newSender.id);
      console.log(`✅ Created sender: ${data.name} <${data.email}> (Ethereal: ${account.user})`);
    }
  }

  // If there's at least one primary sender, re-point existing campaigns to the primary sender before deleting old senders
  const primarySenderId = createdSenderIds[0];
  if (primarySenderId) {
    // Update any campaigns pointing to senders outside our new set
    const oldSenders = await db
      .select()
      .from(senders)
      .where(notInArray(senders.id, createdSenderIds));

    for (const old of oldSenders) {
      console.log(`🧹 Reassigning campaigns from old sender "${old.name}" (${old.email}) to primary sender...`);
      await db
        .update(campaigns)
        .set({ senderId: primarySenderId })
        .where(eq(campaigns.senderId, old.id));

      console.log(`🗑️ Removing old sender "${old.name}" (${old.email})...`);
      await db.delete(senders).where(eq(senders.id, old.id));
    }
  }

  console.log('✅ Senders configured successfully:');
  const allSenders = await db.select().from(senders);
  console.table(
    allSenders.map((s) => ({
      ID: s.id,
      Name: s.name,
      Email: s.email,
      EtherealUser: s.etherealUser,
    }))
  );

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
