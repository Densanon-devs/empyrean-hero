import { Router } from 'express';
import { hashPassword, verifyPassword, signToken } from '../auth.js';
import type { Database } from '../database.js';

// ─────────────────────────────────────────────────────────────────────────────
// Auth routes — register / login
// ─────────────────────────────────────────────────────────────────────────────

export function createAuthRouter(db: Database): Router {
  const router = Router();

  // POST /api/auth/register
  router.post('/register', async (req, res) => {
    const { username, password, email } = req.body as {
      username?: string;
      password?: string;
      email?: string;
    };

    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }
    if (username.length < 3 || username.length > 24) {
      res.status(400).json({ error: 'Username must be 3–24 characters' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    if (db.findAccountByUsername(username)) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const account = db.createAccount(username, passwordHash, email);
    const token = signToken({ accountId: account.id, username: account.username });
    const stats = db.getStats(account.id)!;

    res.status(201).json({
      token,
      account: { id: account.id, username: account.username },
      stats,
    });
  });

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    const account = db.findAccountByUsername(username);
    if (!account) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const token = signToken({ accountId: account.id, username: account.username });
    const stats = db.getStats(account.id);

    res.json({
      token,
      account: { id: account.id, username: account.username },
      stats,
    });
  });

  return router;
}
