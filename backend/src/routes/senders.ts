import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { senders } from '../db/schema';
import { createDefaultEtherealAccount } from '../services/emailService';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/senders
 * List all active senders.
 */
router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const allSenders = await db.select({
      id: senders.id,
      name: senders.name,
      email: senders.email,
      isActive: senders.isActive,
      createdAt: senders.createdAt,
    }).from(senders).orderBy(senders.createdAt);

    res.json({ senders: allSenders });
  } catch (error) {
    console.error('Error fetching senders:', error);
    res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

const createSenderSchema = z.object({
  name: z.string().min(1).max(255),
  // If email/credentials are provided, use them; otherwise auto-create Ethereal
  email: z.string().email().optional(),
  etherealUser: z.string().optional(),
  etherealPass: z.string().optional(),
});

/**
 * POST /api/senders
 * Create a new sender. If no credentials, auto-creates Ethereal account.
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  const parsed = createSenderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    let { name, email, etherealUser, etherealPass } = parsed.data;

    if (!email || !etherealUser || !etherealPass) {
      const account = await createDefaultEtherealAccount();
      email = account.email;
      etherealUser = account.user;
      etherealPass = account.pass;
    }

    const [sender] = await db.insert(senders).values({
      name,
      email,
      etherealUser,
      etherealPass,
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
    }).returning();

    res.status(201).json({ sender });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errMsg });
  }
});

export default router;
