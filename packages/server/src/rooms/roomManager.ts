import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { GameSession } from './gameSession.js';
import type { GameMode } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Room management
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomPlayer {
  id: string;
  name: string;
  socketId: string;
  ready: boolean;
  /** Set during Team Play lobby; 'A' or 'B' */
  teamId?: string;
}

export interface Room {
  code: string;
  hostId: string;
  players: Map<string, RoomPlayer>;
  session: GameSession | null;
  createdAt: Date;
  lastActivityAt: Date;
  /** Game mode chosen by the host; defaults to free-for-all */
  gameMode: GameMode;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  /** socketId → roomCode (for quick disconnect lookup) */
  private socketToRoom = new Map<string, string>();

  // ─── Create ───────────────────────────────────────────────────────────────

  createRoom(socketId: string, playerName: string): { roomCode: string; playerId: string } {
    const roomCode = this.generateCode();
    const playerId = uuidv4();

    const room: Room = {
      code: roomCode,
      hostId: playerId,
      players: new Map([[playerId, { id: playerId, name: playerName, socketId, ready: false }]]),
      session: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      gameMode: 'free-for-all',
    };

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(socketId, roomCode);
    console.log(`[room] created ${roomCode} by ${playerName} (${playerId})`);
    return { roomCode, playerId };
  }

  // ─── Join ─────────────────────────────────────────────────────────────────

  joinRoom(
    roomCode: string,
    socketId: string,
    playerName: string,
  ): { success: true; playerId: string } | { success: false; error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: 'Room not found' };
    if (room.players.size >= config.maxRoomSize) return { success: false, error: 'Room is full' };
    if (room.session) return { success: false, error: 'Game already in progress' };

    const playerId = uuidv4();
    room.players.set(playerId, { id: playerId, name: playerName, socketId, ready: false });
    room.lastActivityAt = new Date();
    this.socketToRoom.set(socketId, roomCode);
    console.log(`[room] ${playerName} (${playerId}) joined ${roomCode}`);
    return { success: true, playerId };
  }

  // ─── Ready ────────────────────────────────────────────────────────────────

  setReady(socketId: string): Room | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;

    for (const player of room.players.values()) {
      if (player.socketId === socketId) {
        player.ready = true;
        break;
      }
    }
    room.lastActivityAt = new Date();
    return room;
  }

  allReady(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room || room.players.size < 2) return false;
    return [...room.players.values()].every((p) => p.ready);
  }

  // ─── Mode & Teams ─────────────────────────────────────────────────────────

  /**
   * Set the game mode for a room. Only the host may change the mode.
   * Returns the room on success, null if not found or not host.
   */
  setGameMode(socketId: string, mode: GameMode): Room | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;

    const player = this.getPlayerBySocket(socketId);
    if (!player || player.id !== room.hostId) return null;

    room.gameMode = mode;
    room.lastActivityAt = new Date();
    console.log(`[room] ${room.code} mode set to ${mode} by ${player.name}`);
    return room;
  }

  /**
   * Assign the player's team ('A' or 'B') for Team Play.
   * Returns the room on success, null if socket not in a room.
   */
  setPlayerTeam(socketId: string, teamId: string): Room | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;

    for (const player of room.players.values()) {
      if (player.socketId === socketId) {
        player.teamId = teamId;
        break;
      }
    }
    room.lastActivityAt = new Date();
    return room;
  }

  // ─── Session ──────────────────────────────────────────────────────────────

  startSession(roomCode: string): GameSession | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const players = [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
    }));
    const session = new GameSession(players, room.gameMode, 'standardized-C');
    room.session = session;
    room.lastActivityAt = new Date();
    return session;
  }

  getSession(roomCode: string): GameSession | null {
    return this.rooms.get(roomCode)?.session ?? null;
  }

  // ─── Lookup ───────────────────────────────────────────────────────────────

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  getRoomBySocket(socketId: string): Room | null {
    const code = this.socketToRoom.get(socketId);
    return code ? (this.rooms.get(code) ?? null) : null;
  }

  getPlayerBySocket(socketId: string): RoomPlayer | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    for (const player of room.players.values()) {
      if (player.socketId === socketId) return player;
    }
    return null;
  }

  getRoomPlayers(roomCode: string): RoomPlayer[] {
    return [...(this.rooms.get(roomCode)?.players.values() ?? [])];
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  handleDisconnect(socketId: string): { roomCode: string; playerId: string } | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;

    let removedPlayerId: string | null = null;
    for (const [id, player] of room.players.entries()) {
      if (player.socketId === socketId) {
        removedPlayerId = id;
        break;
      }
    }

    if (!removedPlayerId) return null;

    this.socketToRoom.delete(socketId);

    // If game not started, remove player from room
    if (!room.session) {
      room.players.delete(removedPlayerId);
      if (room.players.size === 0) {
        this.rooms.delete(room.code);
        console.log(`[room] deleted empty room ${room.code}`);
      }
    }
    // TODO: handle mid-game disconnects (pause timer, allow reconnect, forfeit after timeout)

    return { roomCode: room.code, playerId: removedPlayerId };
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  /** Prune rooms idle for longer than the configured timeout */
  pruneIdleRooms(): void {
    const cutoff = Date.now() - config.roomIdleTimeoutMinutes * 60 * 1000;
    for (const [code, room] of this.rooms.entries()) {
      if (room.lastActivityAt.getTime() < cutoff) {
        this.rooms.delete(code);
        console.log(`[room] pruned idle room ${code}`);
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }
}
