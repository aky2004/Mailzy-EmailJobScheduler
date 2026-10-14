import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  toName?: string;
  from: string;
  fromName: string;
  subject: string;
  html: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
}

export interface SendEmailResult {
  messageId: string;
}

/**
 * Send a single email via the sender's own SMTP server.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const transport = nodemailer.createTransport({
    host: opts.smtpHost,
    port: opts.smtpPort,
    secure: opts.smtpSecure,
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

  console.log(`📧 Email sent: ${info.messageId} → ${opts.to}`);
  return { messageId: info.messageId };
}

/**
 * Verify SMTP credentials by attempting a connection handshake.
 */
export async function testSmtpConnection(config: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 8000,
    });
    await transporter.verify();
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'SMTP connection failed';
    return { success: false, error: msg };
  }
}
