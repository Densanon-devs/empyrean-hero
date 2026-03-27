import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getRankTier } from '@empyrean-hero/engine';
import type { Database } from '../database.js';
import type { AuthRequest } from '../auth.js';
import type { OnlineTracker } from '../online.js';

// ─────────────────────────────────────────────────────────────────────────────
// Friends REST routes
// ─────────────────────────────────────────────────────────────────────────────

export function createFriendsRouter(db: Database, online: OnlineTracker): Router {
  const router = Router();

  // All friends routes require auth
  router.use(requireAuth);

  // GET /api/friends
  router.get('/', (req: AuthRequest, res) => {
    const { accountId } = req.account!;
    res.json(buildFriendsList(accountId, db, online));
  });

  // POST /api/friends/request  { username }
  router.post('/request', (req: AuthRequest, res) => {
    const { accountId } = req.account!;
    const { username } = req.body as { username?: string };

    if (!username) {
      res.status(400).json({ error: 'username is required' });
      return;
    }
    const target = db.findAccountByUsername(username);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (target.id === accountId) {
      res.status(400).json({ error: 'Cannot friend yourself' });
      return;
    }

    const record = db.sendFriendRequest(accountId, target.id);
    if (!record) {
      res.status(409).json({ error: 'Friend request already exists or already friends' });
      return;
    }
    res.status(201).json({ requestId: record.id });
  });

  // POST /api/friends/accept  { requestId }
  router.post('/accept', (req: AuthRequest, res) => {
    const { accountId } = req.account!;
    const { requestId } = req.body as { requestId?: string };
    if (!requestId) {
      res.status(400).json({ error: 'requestId is required' });
      return;
    }
    const ok = db.acceptFriendRequest(requestId, accountId);
    if (!ok) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    res.json({ success: true });
  });

  // POST /api/friends/decline  { requestId }
  router.post('/decline', (req: AuthRequest, res) => {
    const { accountId } = req.account!;
    const { requestId } = req.body as { requestId?: string };
    if (!requestId) {
      res.status(400).json({ error: 'requestId is required' });
      return;
    }
    const ok = db.declineFriendRequest(requestId, accountId);
    if (!ok) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    res.json({ success: true });
  });

  // DELETE /api/friends/:friendAccountId
  router.delete('/:friendAccountId', (req: AuthRequest, res) => {
    const { accountId } = req.account!;
    const { friendAccountId } = req.params as { friendAccountId: string };
    const ok = db.removeFriend(accountId, friendAccountId);
    if (!ok) {
      res.status(404).json({ error: 'Friend not found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

export function buildFriendsList(
  accountId: string,
  db: Database,
  online: OnlineTracker,
) {
  const accepted = db.getAcceptedFriends(accountId);
  const pending = db.getPendingRequests(accountId);
  const outgoing = db.getOutgoingRequests(accountId);

  const friends = accepted.map((f) => {
    const friendId = f.userId === accountId ? f.friendId : f.userId;
    const acc = db.findAccountById(friendId);
    const stats = db.getStats(friendId);
    return {
      accountId: friendId,
      username: acc?.username ?? '???',
      online: online.isOnline(friendId),
      rating: stats?.rating ?? 1000,
      rankTier: getRankTier(stats?.rating ?? 1000),
    };
  });

  const pendingRequests = pending.map((f) => {
    const acc = db.findAccountById(f.userId);
    return {
      requestId: f.id,
      fromAccountId: f.userId,
      fromUsername: acc?.username ?? '???',
      timestamp: f.createdAt,
    };
  });

  const outgoingRequests = outgoing.map((f) => {
    const acc = db.findAccountById(f.friendId);
    return {
      requestId: f.id,
      toAccountId: f.friendId,
      toUsername: acc?.username ?? '???',
      timestamp: f.createdAt,
    };
  });

  return { friends, pendingRequests, outgoingRequests };
}
