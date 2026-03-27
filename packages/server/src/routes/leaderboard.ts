import { Router } from 'express';
import { getRankTier } from '@empyrean-hero/engine';
import type { Database } from '../database.js';

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard routes
// ─────────────────────────────────────────────────────────────────────────────

export function createLeaderboardRouter(db: Database): Router {
  const router = Router();

  // GET /api/leaderboard?limit=50&tier=Gold
  router.get('/', (req, res) => {
    const limit = Math.min(Number(req.query['limit'] ?? 50), 200);
    const tierFilter = req.query['tier'] as string | undefined;

    let entries = db.getLeaderboard(200); // fetch more, filter client-side

    if (tierFilter) {
      entries = entries.filter(
        ({ stats }) => getRankTier(stats.rating) === tierFilter,
      );
    }

    const result = entries.slice(0, limit).map(({ account, stats }, idx) => ({
      rank: idx + 1,
      accountId: account.id,
      username: account.username,
      rating: stats.rating,
      rankTier: getRankTier(stats.rating),
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      gamesPlayed: stats.gamesPlayed,
    }));

    res.json({ leaderboard: result });
  });

  return router;
}
