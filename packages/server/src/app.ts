import express from 'express';
import cors from 'cors';
import { config } from './config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Express app setup
// ─────────────────────────────────────────────────────────────────────────────

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: config.nodeEnv });
  });

  // TODO: REST endpoints for matchmaking, leaderboards, etc.
  app.get('/api/rooms', (_req, res) => {
    // TODO: return active room count / metadata (sanitized)
    res.json({ rooms: [] });
  });

  return app;
}
