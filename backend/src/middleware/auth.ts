import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../config/firebase';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { DecodedIdToken } from 'firebase-admin/auth';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        name: string;
        avatarUrl?: string;
        dbId: string;
      };
      firebaseUser?: DecodedIdToken;
    }
  }
}

/**
 * Middleware to verify Firebase ID token from Authorization header.
 * Expects: Authorization: Bearer <firebase_id_token>
 *
 * On success: populates req.user with DB user info.
 * On failure: returns 401.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decoded = await verifyIdToken(idToken);
    req.firebaseUser = decoded;

    // Upsert user in DB
    const [dbUser] = await db
      .insert(users)
      .values({
        firebaseUid: decoded.uid,
        email: decoded.email ?? '',
        name: decoded.name ?? 'Unknown',
        avatarUrl: decoded.picture ?? null,
      })
      .onConflictDoUpdate({
        target: users.firebaseUid,
        set: {
          name: decoded.name ?? 'Unknown',
          avatarUrl: decoded.picture ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? '',
      name: decoded.name ?? 'Unknown',
      avatarUrl: decoded.picture,
      dbId: dbUser.id,
    };

    next();
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Token verification failed';
    console.error('Auth error:', errMsg);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
