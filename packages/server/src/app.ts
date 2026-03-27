import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { createAuthRouter } from './routes/auth.js';
import { createProfileRouter } from './routes/profile.js';
import { createLeaderboardRouter } from './routes/leaderboard.js';
import { createFriendsRouter } from './routes/friends.js';
import type { Database } from './database.js';
import type { OnlineTracker } from './online.js';

// ─────────────────────────────────────────────────────────────────────────────
// Express app setup — API + WebSocket only (client is a separate static site)
// ─────────────────────────────────────────────────────────────────────────────

export function createApp(db: Database, online: OnlineTracker): express.Application {
  const app = express();

  app.use(cors({ origin: config.clientOrigin, credentials: true }));

  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: config.nodeEnv });
  });

  // ── REST API ───────────────────────────────────────────────────────────────
  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/profile', createProfileRouter(db));
  app.use('/api/leaderboard', createLeaderboardRouter(db));
  app.use('/api/friends', createFriendsRouter(db, online));

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: [] });
  });

  return app;
}
