import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { createAuthRouter } from './routes/auth.js';
import { createProfileRouter } from './routes/profile.js';
import { createLeaderboardRouter } from './routes/leaderboard.js';
import { createFriendsRouter } from './routes/friends.js';
import type { Database } from './database.js';
import type { OnlineTracker } from './online.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Express app setup
// ─────────────────────────────────────────────────────────────────────────────

export function createApp(db: Database, online: OnlineTracker): express.Application {
  const app = express();

  // In production the client is served from the same origin — CORS not needed
  if (config.nodeEnv !== 'production') {
    app.use(cors({ origin: config.clientOrigin, credentials: true }));
  }

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

  // ── Static client serving (production only) ────────────────────────────────
  if (config.nodeEnv === 'production') {
    const clientDist = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDist));

    // SPA fallback — serve index.html for all non-API, non-socket routes
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
        res.sendFile(path.join(clientDist, 'index.html'));
      }
    });
  }

  return app;
}
