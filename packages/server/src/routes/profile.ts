import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getRankTier } from '@empyrean-hero/engine';
import type { Database } from '../database.js';
import type { AuthRequest } from '../auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// Profile routes
// ─────────────────────────────────────────────────────────────────────────────

export function createProfileRouter(db: Database): Router {
  const router = Router();

  // GET /api/profile — own profile (auth required)
  router.get('/', requireAuth, (req: AuthRequest, res) => {
    const { accountId } = req.account!;
    const account = db.findAccountById(accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const stats = db.getStats(accountId);
    const history = db.getMatchHistory(accountId, 20);

    res.json({
      account: { id: account.id, username: account.username, createdAt: account.createdAt },
      stats: stats
        ? { ...stats, rankTier: getRankTier(stats.rating) }
        : null,
      matchHistory: history,
    });
  });

  // GET /api/profile/:username — public profile
  router.get('/:username', (req, res) => {
    const account = db.findAccountByUsername(req.params['username']!);
    if (!account) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const stats = db.getStats(account.id);
    const history = db.getMatchHistory(account.id, 10);

    res.json({
      account: { id: account.id, username: account.username, createdAt: account.createdAt },
      stats: stats
        ? { ...stats, rankTier: getRankTier(stats.rating) }
        : null,
      matchHistory: history,
    });
  });

  return router;
}
