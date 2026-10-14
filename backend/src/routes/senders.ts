import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { eq, and, ne } from 'drizzle-orm';
import { senders, campaigns } from '../db/schema';
import { testSmtpConnection } from '../services/emailService';
import { encrypt, decrypt } from '../utils/crypto';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/senders
 * List senders belonging to the authenticated user. Never exposes smtpPass.
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const allSenders = await db.select({
      id: senders.id,
      name: senders.name,
      email: senders.email,
      smtpHost: senders.smtpHost,
      smtpPort: senders.smtpPort,
      smtpSecure: senders.smtpSecure,
      isVerified: senders.isVerified,
      createdAt: senders.createdAt,
    }).from(senders)
      .where(eq(senders.userId, req.user!.dbId))
      .orderBy(senders.createdAt);

    res.json({ senders: allSenders });
  } catch (error) {
    console.error('Error fetching senders:', error);
    res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

const createSenderSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().min(1).max(65535),
  smtpUser: z.string().min(1),
  smtpPass: z.string().min(1),
  smtpSecure: z.boolean().default(false),
});

/**
 * POST /api/senders/test
 * Test SMTP connection without saving.
 */
router.post('/test', authenticate, async (req: Request, res: Response) => {
  const parsed = createSenderSchema.omit({ name: true, email: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = parsed.data;
  const result = await testSmtpConnection({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: smtpUser,
    pass: smtpPass,
  });

  res.json(result);
});

/**
 * POST /api/senders
 * Create a new sender. Tests SMTP credentials, encrypts password, saves under the user.
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  const parsed = createSenderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, email, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = parsed.data;

  try {
    // Verify credentials before saving
    const testResult = await testSmtpConnection({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      pass: smtpPass,
    });

    const encryptedPass = encrypt(smtpPass);

    const [sender] = await db.insert(senders).values({
      userId: req.user!.dbId,
      name,
      email,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass: encryptedPass,
      smtpSecure,
      isVerified: testResult.success,
    }).returning({
      id: senders.id,
      name: senders.name,
      email: senders.email,
      smtpHost: senders.smtpHost,
      smtpPort: senders.smtpPort,
      smtpSecure: senders.smtpSecure,
      isVerified: senders.isVerified,
      createdAt: senders.createdAt,
    });

    res.status(201).json({
      sender,
      verified: testResult.success,
      verifyError: testResult.error,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errMsg });
  }
});

/**
 * DELETE /api/senders/:id
 * Delete a sender belonging to the authenticated user.
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const [sender] = await db.select().from(senders)
      .where(and(eq(senders.id, id), eq(senders.userId, req.user!.dbId)))
      .limit(1);

    if (!sender) {
      res.status(404).json({ error: 'Sender not found' });
      return;
    }

    // Reassign campaigns to another sender if available
    const otherSenders = await db.select().from(senders)
      .where(and(ne(senders.id, id), eq(senders.userId, req.user!.dbId)))
      .limit(1);

    if (otherSenders.length > 0) {
      await db.update(campaigns)
        .set({ senderId: otherSenders[0].id })
        .where(eq(campaigns.senderId, id));
    }

    await db.delete(senders).where(eq(senders.id, id));
    res.json({ message: 'Sender deleted successfully', id });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting sender:', error);
    res.status(500).json({ error: errMsg });
  }
});

export default router;
