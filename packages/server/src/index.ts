import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@empyrean-hero/engine';
import { createApp } from './app.js';
import { config } from './config.js';
import { Database } from './database.js';
import { OnlineTracker } from './online.js';
import { MatchmakingQueue } from './matchmaking.js';
import { RoomManager } from './rooms/roomManager.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { verifyToken } from './auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// Server entry point
// ─────────────────────────────────────────────────────────────────────────────

const db = new Database();
const online = new OnlineTracker();
const matchmaking = new MatchmakingQueue();

const app = createApp(db, online);
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: {
      // In production the client is served from the same origin — block cross-origin
      origin: config.nodeEnv === 'production' ? false : config.clientOrigin,
      methods: ['GET', 'POST'],
    },
  },
);

// ── Auth middleware — extract accountId from JWT if present ──────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth['token'] as string | undefined;
  if (token) {
    try {
      const payload = verifyToken(token);
      socket.data.accountId = payload.accountId;
    } catch {
      // Invalid token — allow connection as guest
    }
  }
  next();
});

const roomManager = new RoomManager();

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // Track authenticated users as online
  if (socket.data.accountId) {
    online.track(socket.id, socket.data.accountId);
    // Notify their friends that they came online
    notifyFriendStatusChange(socket.data.accountId, true);
  }

  registerSocketHandlers(io, socket, roomManager, db, online, matchmaking);

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${socket.id} — ${reason}`);
    roomManager.handleDisconnect(socket.id);
    matchmaking.leave(socket.id);

    // Track offline
    const accountId = online.untrack(socket.id);
    if (accountId) {
      notifyFriendStatusChange(accountId, false);
    }
  });
});

// ── Matchmaking ticker — check for matches every 5 seconds ──────────────────
setInterval(() => {
  const matches = matchmaking.findMatches();
  for (const match of matches) {
    void handleMatch(match.players, match.gameMode, match.queueType);
  }

  // Also send status updates to everyone still queuing
  for (const [, queue] of (matchmaking as unknown as { queues: Map<string, unknown[]> }).queues ?? new Map()) {
    void queue; // noop — handled below
  }
}, 5_000);

async function handleMatch(
  players: import('./matchmaking.js').QueueEntry[],
  gameMode: import('@empyrean-hero/engine').GameMode,
  queueType: import('@empyrean-hero/engine').QueueType,
) {
  // Build the player list for createMatchedRoom
  const roomPlayers = players.map((p) => ({
    socketId: p.socketId,
    playerName: p.playerName,
    accountId: p.accountId,
    // For 2v2, balance teams by rating: first 2 = team A, last 2 = team B
    teamId: queueType === 'ranked-2v2'
      ? (players.indexOf(p) < 2 ? 'A' : 'B')
      : undefined,
  }));

  const { roomCode, playerIds } = roomManager.createMatchedRoom(roomPlayers, gameMode);

  // Join all sockets to the Socket.IO room and update their socket.data
  for (const player of players) {
    const sock = io.sockets.sockets.get(player.socketId);
    if (sock) {
      sock.data.roomCode = roomCode;
      sock.data.playerName = player.playerName;
      const playerId = playerIds[player.socketId]!;
      sock.data.playerId = playerId;
      await sock.join(roomCode);

      // Notify the player their match was found
      sock.emit('matchmaking:found', { roomCode, playerId, queueType });
    }
  }

  // Start the session immediately (all players are pre-ready)
  const session = roomManager.startSession(roomCode);
  if (!session) return;

  // Send personalised game state to each player
  for (const player of players) {
    const sock = io.sockets.sockets.get(player.socketId);
    const playerId = playerIds[player.socketId]!;
    if (sock) {
      sock.emit('game:state', session.getPlayerView(playerId));
    }
  }

  io.to(roomCode).emit('game:event', {
    type: 'PHASE_CHANGED',
    payload: { phase: session.getState().phase },
  });

  console.log(`[matchmaking] matched ${players.length} players → room ${roomCode} (${queueType})`);
}

function notifyFriendStatusChange(accountId: string, isOnline: boolean) {
  const friends = db.getAcceptedFriends(accountId);
  for (const f of friends) {
    const friendId = f.userId === accountId ? f.friendId : f.userId;
    const friendSocketId = online.getSocketId(friendId);
    if (friendSocketId) {
      const friendSocket = io.sockets.sockets.get(friendSocketId);
      friendSocket?.emit('friend:status-update', { accountId, online: isOnline });
    }
  }
}

// Export for use in handlers
export { db, online, matchmaking };

// ── Prune idle rooms every 10 minutes ────────────────────────────────────────
setInterval(() => roomManager.pruneIdleRooms(), 10 * 60 * 1000);

httpServer.listen(config.port, () => {
  console.log(`[server] listening on port ${config.port} (${config.nodeEnv})`);
});
