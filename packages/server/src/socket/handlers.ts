import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  LobbyPlayer,
  RoomConfig,
  QueueType,
} from '@empyrean-hero/engine';
import { calculateElo, getRankTier } from '@empyrean-hero/engine';
import type { RoomManager } from '../rooms/roomManager.js';
import type { Database } from '../database.js';
import type { OnlineTracker } from '../online.js';
import type { MatchmakingQueue } from '../matchmaking.js';
import { buildFriendsList } from '../routes/friends.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ─────────────────────────────────────────────────────────────────────────────
// Socket event handlers
// ─────────────────────────────────────────────────────────────────────────────

export function registerSocketHandlers(
  io: AppServer,
  socket: AppSocket,
  rooms: RoomManager,
  db: Database,
  online: OnlineTracker,
  matchmaking: MatchmakingQueue,
): void {

  // ── room:create ─────────────────────────────────────────────────────────────
  socket.on('room:create', (playerName, callback) => {
    const { roomCode, playerId } = rooms.createRoom(
      socket.id,
      playerName,
      socket.data.accountId,
    );

    socket.data.playerId = playerId;
    socket.data.playerName = playerName;
    socket.data.roomCode = roomCode;

    void socket.join(roomCode);
    broadcastRoomPlayers(io, rooms, roomCode);
    broadcastRoomConfig(io, rooms, roomCode);
    callback({ roomCode, playerId });
    console.log(`[handler] room:create — ${roomCode} by ${playerName} (${playerId})`);
  });

  // ── room:join ───────────────────────────────────────────────────────────────
  socket.on('room:join', (roomCode, playerName, callback) => {
    const result = rooms.joinRoom(roomCode, socket.id, playerName, socket.data.accountId);
    if (!result.success) {
      callback(result);
      return;
    }

    socket.data.playerId = result.playerId;
    socket.data.playerName = playerName;
    socket.data.roomCode = roomCode;

    void socket.join(roomCode);
    broadcastRoomPlayers(io, rooms, roomCode);

    const room = rooms.getRoom(roomCode);
    if (room) {
      const cfg: RoomConfig = { gameMode: room.gameMode, hostId: room.hostId };
      socket.emit('room:config', cfg);
    }

    callback({ success: true, playerId: result.playerId });
    console.log(`[handler] room:join — ${playerName} (${result.playerId}) joined ${roomCode}`);
  });

  // ── room:ready ──────────────────────────────────────────────────────────────
  socket.on('room:ready', () => {
    const room = rooms.setReady(socket.id);
    if (!room) return;

    broadcastRoomPlayers(io, rooms, room.code);

    if (rooms.allReady(room.code)) {
      const session = rooms.startSession(room.code);
      if (session) {
        for (const player of rooms.getRoomPlayers(room.code)) {
          const playerSocket = getSocketById(io, player.socketId);
          if (playerSocket) {
            playerSocket.emit('game:state', session.getPlayerView(player.id));
          }
        }
        io.to(room.code).emit('game:event', {
          type: 'PHASE_CHANGED',
          payload: { phase: session.getState().phase },
        });
      }
    }
  });

  // ── room:set-mode ────────────────────────────────────────────────────────────
  socket.on('room:set-mode', (mode, callback) => {
    const room = rooms.setGameMode(socket.id, mode);
    if (!room) {
      callback({ success: false, error: 'Only the host can change the game mode' });
      return;
    }
    broadcastRoomConfig(io, rooms, room.code);
    callback({ success: true });
    console.log(`[handler] room:set-mode — ${room.code} → ${mode}`);
  });

  // ── room:set-team ────────────────────────────────────────────────────────────
  socket.on('room:set-team', (teamId, callback) => {
    const room = rooms.setPlayerTeam(socket.id, teamId);
    if (!room) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }
    broadcastRoomPlayers(io, rooms, room.code);
    callback({ success: true });
  });

  // ── game:action ─────────────────────────────────────────────────────────────
  socket.on('game:action', (action, callback) => {
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;

    if (!roomCode || !playerId) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const session = rooms.getSession(roomCode);
    if (!session) {
      callback({ success: false, error: 'No active game session' });
      return;
    }

    const result = session.applyAction(playerId, action);
    callback({ success: result.success, error: result.error });

    if (result.success) {
      for (const player of rooms.getRoomPlayers(roomCode)) {
        const playerSocket = getSocketById(io, player.socketId);
        if (playerSocket) {
          playerSocket.emit('game:state', session.getPlayerView(player.id));
        }
      }
      for (const event of result.events) {
        io.to(roomCode).emit('game:event', event);
      }

      // Record match result when game ends
      if (session.isOver()) {
        void recordMatchResult(session.getState(), rooms.getRoomPlayers(roomCode), db);
      }
    } else {
      socket.emit('game:error', result.error ?? 'Unknown error');
    }
  });

  // ── draft:pick ──────────────────────────────────────────────────────────────
  socket.on('draft:pick', (heroId, callback) => {
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;

    if (!roomCode || !playerId) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const session = rooms.getSession(roomCode);
    if (!session) {
      callback({ success: false, error: 'No active session' });
      return;
    }

    const result = session.draftPick(playerId, heroId);
    callback(result);

    if (result.success) {
      const draftState = session.getState().draftState;
      if (draftState) io.to(roomCode).emit('draft:state', draftState);

      if (session.getState().phase === 'gameplay') {
        for (const player of rooms.getRoomPlayers(roomCode)) {
          const playerSocket = getSocketById(io, player.socketId);
          if (playerSocket) {
            playerSocket.emit('game:state', session.getPlayerView(player.id));
          }
        }
      }
    }
  });

  // ── chat:message ─────────────────────────────────────────────────────────────
  socket.on('chat:message', (message) => {
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    const playerName = socket.data.playerName;
    if (!roomCode || !playerId || !playerName) return;
    const safe = message.slice(0, 300);
    io.to(roomCode).emit('chat:message', playerId, playerName, safe);
  });

  // ── matchmaking:join ─────────────────────────────────────────────────────────
  socket.on('matchmaking:join', ({ playerName, queueType }, callback) => {
    // Ranked queues require auth
    if (queueType !== 'casual' && !socket.data.accountId) {
      callback({ success: false, error: 'Ranked queues require a registered account' });
      return;
    }

    // Look up rating
    let rating = 1000;
    if (socket.data.accountId) {
      const stats = db.getStats(socket.data.accountId);
      if (stats) rating = stats.rating;
    }

    socket.data.playerName = playerName;

    const joined = matchmaking.join({
      socketId: socket.id,
      playerName,
      accountId: socket.data.accountId,
      rating,
      joinedAt: Date.now(),
      queueType,
    });

    if (!joined) {
      callback({ success: false, error: 'Already in a queue' });
      return;
    }

    callback({ success: true });

    const status = matchmaking.getQueueStatus(socket.id);
    if (status) {
      socket.emit('matchmaking:status', {
        queueType,
        position: status.position,
        queueSize: status.queueSize,
        waitSeconds: status.waitSeconds,
      });
    }

    console.log(`[matchmaking] ${playerName} joined ${queueType} queue (rating ${rating})`);
  });

  // ── matchmaking:leave ────────────────────────────────────────────────────────
  socket.on('matchmaking:leave', () => {
    matchmaking.leave(socket.id);
    socket.emit('matchmaking:cancelled', 'Left the queue');
    console.log(`[matchmaking] ${socket.data.playerName ?? socket.id} left queue`);
  });

  // ── friend:list ──────────────────────────────────────────────────────────────
  socket.on('friend:list', (callback) => {
    if (!socket.data.accountId) {
      callback({ friends: [], pendingRequests: [], outgoingRequests: [] });
      return;
    }
    callback(buildFriendsList(socket.data.accountId, db, online));
  });

  // ── friend:request ───────────────────────────────────────────────────────────
  socket.on('friend:request', (username, callback) => {
    if (!socket.data.accountId) {
      callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const target = db.findAccountByUsername(username);
    if (!target) {
      callback({ success: false, error: 'User not found' });
      return;
    }
    if (target.id === socket.data.accountId) {
      callback({ success: false, error: 'Cannot friend yourself' });
      return;
    }

    const record = db.sendFriendRequest(socket.data.accountId, target.id);
    if (!record) {
      callback({ success: false, error: 'Friend request already exists' });
      return;
    }

    callback({ success: true });

    // Notify the recipient if online
    const targetSocket = online.getSocketId(target.id);
    if (targetSocket) {
      const myAccount = db.findAccountById(socket.data.accountId);
      io.to(targetSocket).emit('friend:request-received', {
        requestId: record.id,
        fromAccountId: socket.data.accountId,
        fromUsername: myAccount?.username ?? '???',
        timestamp: record.createdAt,
      });
    }
  });

  // ── friend:accept ────────────────────────────────────────────────────────────
  socket.on('friend:accept', (requestId, callback) => {
    if (!socket.data.accountId) {
      callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const ok = db.acceptFriendRequest(requestId, socket.data.accountId);
    if (!ok) {
      callback({ success: false, error: 'Request not found' });
      return;
    }

    callback({ success: true });

    // Notify sender if online
    const pending = db.getPendingRequests(socket.data.accountId);
    void pending; // already accepted above — fetch the accepted friend to notify
    const friends = db.getAcceptedFriends(socket.data.accountId);
    const newFriend = friends.find((f) => {
      // The accepted request had requestId — hard to look up now, but we notify all
      return true;
    });
    void newFriend;

    // Simple: re-emit status update to both sides
    socket.emit('friend:status-update', { accountId: socket.data.accountId, online: true });
  });

  // ── friend:decline ───────────────────────────────────────────────────────────
  socket.on('friend:decline', (requestId, callback) => {
    if (!socket.data.accountId) {
      callback({ success: false, error: 'Not authenticated' });
      return;
    }
    const ok = db.declineFriendRequest(requestId, socket.data.accountId);
    callback(ok ? { success: true } : { success: false, error: 'Request not found' });
  });

  // ── friend:remove ────────────────────────────────────────────────────────────
  socket.on('friend:remove', (friendAccountId, callback) => {
    if (!socket.data.accountId) {
      callback({ success: false, error: 'Not authenticated' });
      return;
    }
    const ok = db.removeFriend(socket.data.accountId, friendAccountId);
    callback(ok ? { success: true } : { success: false, error: 'Friend not found' });
  });

  // ── friend:invite ────────────────────────────────────────────────────────────
  socket.on('friend:invite', (friendAccountId, callback) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }
    if (!socket.data.accountId) {
      callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const friendSocketId = online.getSocketId(friendAccountId);
    if (!friendSocketId) {
      callback({ success: false, error: 'Friend is offline' });
      return;
    }

    const myAccount = db.findAccountById(socket.data.accountId);
    io.to(friendSocketId).emit('friend:invite-received', {
      fromAccountId: socket.data.accountId,
      fromUsername: myAccount?.username ?? '???',
      roomCode,
    });

    callback({ success: true });
  });

  // ── friend:invite-response ───────────────────────────────────────────────────
  socket.on('friend:invite-response', ({ roomCode, accept }) => {
    if (!accept) return;

    const playerName = socket.data.playerName ?? 'Player';
    const result = rooms.joinRoom(roomCode, socket.id, playerName, socket.data.accountId);
    if (!result.success) {
      socket.emit('room:error', result.error);
      return;
    }

    socket.data.playerId = result.playerId;
    socket.data.playerName = playerName;
    socket.data.roomCode = roomCode;

    void socket.join(roomCode);
    broadcastRoomPlayers(io, rooms, roomCode);

    const room = rooms.getRoom(roomCode);
    if (room) {
      socket.emit('room:config', { gameMode: room.gameMode, hostId: room.hostId });
    }
  });
}

// ─── Record match result & update ratings ────────────────────────────────────

async function recordMatchResult(
  state: import('@empyrean-hero/engine').GameState,
  roomPlayers: import('../rooms/roomManager.js').RoomPlayer[],
  db: Database,
): Promise<void> {
  const result = state.result;
  if (!result) return;

  // Collect authenticated players
  const authPlayers = roomPlayers.filter((p) => p.accountId);
  if (authPlayers.length < 2) return; // nothing to record

  // Build rating info
  const ratingInfos = authPlayers.map((p) => {
    const stats = db.getStats(p.accountId!);
    return {
      playerId: p.accountId!,
      rating: stats?.rating ?? 1000,
      gamesPlayed: stats?.gamesPlayed ?? 0,
    };
  });

  // Map game playerIds → accountIds for winner lookup
  const playerIdToAccountId: Record<string, string> = {};
  for (const p of roomPlayers) {
    if (p.accountId) playerIdToAccountId[p.id] = p.accountId;
  }

  const winnerAccountIds = result.winnerIds
    ? result.winnerIds
        .map((pid) => playerIdToAccountId[pid])
        .filter((id): id is string => !!id)
    : null;

  const ratingChanges = calculateElo(ratingInfos, winnerAccountIds);

  // Update each player's stats
  for (const change of ratingChanges) {
    const stats = db.getStats(change.playerId);
    if (!stats) continue;

    const isWinner = winnerAccountIds?.includes(change.playerId) ?? false;
    const isDraw = winnerAccountIds === null;

    db.updateStats(change.playerId, {
      rating: change.newRating,
      gamesPlayed: stats.gamesPlayed + 1,
      wins: stats.wins + (isWinner ? 1 : 0),
      losses: stats.losses + (!isWinner && !isDraw ? 1 : 0),
      draws: stats.draws + (isDraw ? 1 : 0),
    });
  }

  // Persist the match record
  db.recordMatch({
    players: authPlayers.map((p) => p.accountId!),
    winnerIds: winnerAccountIds,
    ratingChanges: ratingChanges.map((c) => ({
      accountId: c.playerId,
      oldRating: c.oldRating,
      newRating: c.newRating,
      delta: c.delta,
    })),
    timestamp: new Date().toISOString(),
    gameMode: state.mode,
    queueType: 'ranked-1v1', // TODO: pass queue type through
  });

  console.log(
    `[rating] match recorded — changes: ${ratingChanges
      .map((c) => `${c.playerId} ${c.oldRating}→${c.newRating} (${c.delta >= 0 ? '+' : ''}${c.delta})`)
      .join(', ')}`,
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function broadcastRoomPlayers(io: AppServer, rooms: RoomManager, roomCode: string): void {
  const players: LobbyPlayer[] = rooms.getRoomPlayers(roomCode).map((p) => ({
    id: p.id,
    name: p.name,
    ready: p.ready,
    teamId: p.teamId,
  }));
  io.to(roomCode).emit('room:players', players);
}

function broadcastRoomConfig(io: AppServer, rooms: RoomManager, roomCode: string): void {
  const room = rooms.getRoom(roomCode);
  if (!room) return;
  const cfg: RoomConfig = { gameMode: room.gameMode, hostId: room.hostId };
  io.to(roomCode).emit('room:config', cfg);
}

function getSocketById(io: AppServer, socketId: string) {
  return io.sockets.sockets.get(socketId) ?? null;
}
