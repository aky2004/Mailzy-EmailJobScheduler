import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 */
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({
    uid: req.user!.uid,
    email: req.user!.email,
    name: req.user!.name,
    avatarUrl: req.user!.avatarUrl,
    dbId: req.user!.dbId,
  });
});

export default router;
