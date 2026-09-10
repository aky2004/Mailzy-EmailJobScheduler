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
 * Send a single email via primary SMTP (e.g. Gmail).
 * If primary SMTP fails and is not already Ethereal, automatically falls back to Ethereal.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const host = opts.smtpHost ?? env.ETHEREAL_SMTP_HOST;
  const port = opts.smtpPort ?? env.ETHEREAL_SMTP_PORT;
  const isEthereal = host.includes('ethereal.email');

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
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

    console.log(`📧 Email sent via ${isEthereal ? 'Ethereal (Mock)' : 'Real SMTP (' + host + ')'}: ${info.messageId}`);
    if (previewUrl) {
      console.log(`🔗 Preview URL: ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      previewUrl,
      isFallback: false,
    };
  } catch (primaryError: unknown) {
    const errorMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);

    // If it was already Ethereal that failed, rethrow
    if (isEthereal) {
      throw primaryError;
    }

    console.warn(
      `⚠️ Primary SMTP (${host}) failed for ${opts.to}: ${errorMsg}. Activating Ethereal fallback...`
    );

    // Fallback to Ethereal
    const fallbackAccount = await getFallbackAccount();
    const fallbackTransport = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: fallbackAccount.user,
        pass: fallbackAccount.pass,
      },
    });

    const fallbackInfo = await fallbackTransport.sendMail({
      from: `"${opts.fromName}" <${fallbackAccount.email}>`,
      to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
      subject: `[FALLBACK] ${opts.subject}`,
      html: `
        <div style="background:#fff3cd;border:1px solid #ffeeba;padding:12px;margin-bottom:16px;border-radius:4px;color:#856404;font-family:sans-serif;font-size:13px;">
          ⚠️ <strong>SMTP Fallback Notification:</strong> Delivery via primary SMTP (<code>${host}</code>) failed (${errorMsg}). This email was safely captured via Ethereal fallback.
        </div>
        ${opts.html}
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(fallbackInfo);
    console.log(`🧪 Fallback email captured in Ethereal: ${fallbackInfo.messageId}`);
    if (previewUrl) {
      console.log(`🔗 Fallback Preview URL: ${previewUrl}`);
    }

    return {
      messageId: fallbackInfo.messageId,
      previewUrl,
      isFallback: true,
      fallbackReason: errorMsg,
    };
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
