import nodemailer from 'nodemailer';
import { env } from '../config/env';

interface SendEmailOptions {
  to: string;
  toName?: string;
  from: string;
  fromName: string;
  subject: string;
  html: string;
  smtpUser: string;
  smtpPass: string;
  smtpHost?: string;
  smtpPort?: number;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
  isFallback?: boolean;
  fallbackReason?: string;
}

// Cached fallback account so we don't recreate it repeatedly
let cachedFallbackAccount: { user: string; pass: string; email: string } | null = null;

async function getFallbackAccount(): Promise<{ user: string; pass: string; email: string }> {
  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    return {
      user: env.ETHEREAL_USER,
      pass: env.ETHEREAL_PASS,
      email: env.ETHEREAL_USER,
    };
  }
  if (!cachedFallbackAccount) {
    cachedFallbackAccount = await createDefaultEtherealAccount();
  }
  return cachedFallbackAccount;
}

/**
 * Send a single email strictly using Ethereal (Mock).
 * As per project requirements, real SMTP sending is disabled.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    // Determine the account to use. If valid Ethereal credentials are provided, use them.
    // Otherwise, use the fallback/default test account.
    let user = opts.smtpUser;
    let pass = opts.smtpPass;

    if (!user || !pass || !opts.smtpHost?.includes('ethereal')) {
      const fallback = await getFallbackAccount();
      user = fallback.user;
      pass = fallback.pass;
    }

    const transport = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    const info = await transport.sendMail({
      from: opts.from ? `"${opts.fromName}" <${opts.from}>` : `"${opts.fromName}" <${user}>`,
      to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log(`📧 Email mocked via Ethereal: ${info.messageId}`);
    if (previewUrl) {
      console.log(`🔗 Preview URL: ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      previewUrl,
      isFallback: false,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Ethereal Mock failed for ${opts.to}: ${errorMsg}`);
    throw error;
  }
}

/**
 * Create a default Ethereal test account (used if none configured).
 */
export async function createDefaultEtherealAccount(): Promise<{ user: string; pass: string; email: string }> {
  const account = await nodemailer.createTestAccount();
  console.log(`✅ Created Ethereal account: ${account.user}`);
  return { user: account.user, pass: account.pass, email: account.user };
}
