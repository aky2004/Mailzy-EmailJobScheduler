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

interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

/**
 * Send a single email via Ethereal SMTP.
 * Returns messageId and Ethereal preview URL.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const transport = nodemailer.createTransport({
    host: opts.smtpHost ?? env.ETHEREAL_SMTP_HOST,
    port: opts.smtpPort ?? env.ETHEREAL_SMTP_PORT,
    secure: false,
    auth: {
      user: opts.smtpUser,
      pass: opts.smtpPass,
    },
  });

  const info = await transport.sendMail({
    from: `"${opts.fromName}" <${opts.from}>`,
    to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  
  console.log(`📧 Email sent: ${info.messageId}`);
  if (previewUrl) {
    console.log(`🔗 Preview URL: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
}

/**
 * Create a default Ethereal test account (used if none configured).
 */
export async function createDefaultEtherealAccount(): Promise<{ user: string; pass: string; email: string }> {
  const account = await nodemailer.createTestAccount();
  console.log(`✅ Created Ethereal account: ${account.user}`);
  return { user: account.user, pass: account.pass, email: account.user };
}
