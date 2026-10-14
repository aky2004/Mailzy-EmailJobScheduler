/**
 * Database seed script.
 * With per-user SMTP, senders are added by each user from the dashboard.
 * This script is kept as a no-op placeholder for the db:seed npm script.
 */
import * as dotenv from 'dotenv';
dotenv.config();

async function seed() {
  console.log('ℹ️  Senders are now managed per-user from the dashboard.');
  console.log('ℹ️  Sign in and navigate to Configured Senders → Add Sender to configure your SMTP mailbox.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
