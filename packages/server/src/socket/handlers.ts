import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  LobbyPlayer,
  RoomConfig,
} from '@empyrean-hero/engine';
import type { RoomManager } from '../rooms/roomManager.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// ─────────────────────────────────────────────────────────────────────────────
// Socket event handlers
// ─────────────────────────────────────────────────────────────────────────────

export function registerSocketHandlers(
  io: AppServer,
  socket: AppSocket,
  rooms: RoomManager,
): void {
  // ── room:create ─────────────────────────────────────────────────────────────
  socket.on('room:create', (playerName, callback) => {
    const { roomCode, playerId } = rooms.createRoom(socket.id, playerName);

    socket.data.playerId = playerId;
    socket.data.playerName = playerName;
    socket.data.roomCode = roomCode;

    void socket.join(roomCode);
    broadcastRoomPlayers(io, rooms, roomCode);
    broadcastRoomConfig(io, rooms, roomCode);
    callback(roomCode);
    console.log(`[handler] room:create — ${roomCode}`);
  });

  // ── room:join ───────────────────────────────────────────────────────────────
  socket.on('room:join', (roomCode, playerName, callback) => {
    const result = rooms.joinRoom(roomCode, socket.id, playerName);
    if (!result.success) {
      callback(result);
      return;
    }

    socket.data.playerId = result.playerId;
    socket.data.playerName = playerName;
    socket.data.roomCode = roomCode;

    void socket.join(roomCode);
    broadcastRoomPlayers(io, rooms, roomCode);

    // Send the joiner the current room config so they see the host's mode selection
    const room = rooms.getRoom(roomCode);
    if (room) {
      const config: RoomConfig = { gameMode: room.gameMode, hostId: room.hostId };
      socket.emit('room:config', config);
    }

    callback({ success: true });
    console.log(`[handler] room:join — ${playerName} joined ${roomCode}`);
  });

  // ── room:ready ──────────────────────────────────────────────────────────────
  socket.on('room:ready', () => {
    const room = rooms.setReady(socket.id);
    if (!room) return;

    broadcastRoomPlayers(io, rooms, room.code);

    // Auto-start when all players are ready
    if (rooms.allReady(room.code)) {
      const session = rooms.startSession(room.code);
      if (session) {
        // Send each player their personalised view
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
      // Broadcast updated state to each player (personalised)
      for (const player of rooms.getRoomPlayers(roomCode)) {
        const playerSocket = getSocketById(io, player.socketId);
        if (playerSocket) {
          playerSocket.emit('game:state', session.getPlayerView(player.id));
        }
      }
      // Broadcast events for animations
      for (const event of result.events) {
        io.to(roomCode).emit('game:event', event);
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

      // If draft complete, send game state
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
    // Sanitize message length
    const safe = message.slice(0, 300);
    io.to(roomCode).emit('chat:message', playerId, playerName, safe);
  });
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
  const config: RoomConfig = { gameMode: room.gameMode, hostId: room.hostId };
  io.to(roomCode).emit('room:config', config);
}

function getSocketById(io: AppServer, socketId: string) {
  return io.sockets.sockets.get(socketId) ?? null;
}
