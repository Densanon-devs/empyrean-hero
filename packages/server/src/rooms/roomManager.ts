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
  /** Set for authenticated players */
  accountId?: string;
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
  /** Whether this room was created by matchmaking (affects draft mode) */
  isMatchmade: boolean;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  /** socketId → roomCode (for quick disconnect lookup) */
  private socketToRoom = new Map<string, string>();

  // ─── Create ───────────────────────────────────────────────────────────────

  createRoom(
    socketId: string,
    playerName: string,
    accountId?: string,
  ): { roomCode: string; playerId: string } {
    const roomCode = this.generateCode();
    const playerId = uuidv4();

    const room: Room = {
      code: roomCode,
      hostId: playerId,
      players: new Map([
        [playerId, { id: playerId, name: playerName, socketId, ready: false, accountId }],
      ]),
      session: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      gameMode: 'free-for-all',
      isMatchmade: false,
    };

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(socketId, roomCode);
    console.log(`[room] created ${roomCode} by ${playerName} (${playerId})`);
    return { roomCode, playerId };
  }

  /**
   * Create a room pre-populated with all matched players.
   * All players are set as ready so the game can start immediately.
   * Returns a map of socketId → playerId.
   */
  createMatchedRoom(
    players: Array<{ socketId: string; playerName: string; accountId?: string; teamId?: string }>,
    gameMode: GameMode,
  ): { roomCode: string; playerIds: Record<string, string> } {
    const roomCode = this.generateCode();
    const playerIds: Record<string, string> = {};
    const playerMap = new Map<string, RoomPlayer>();

    players.forEach((p, i) => {
      const playerId = uuidv4();
      playerIds[p.socketId] = playerId;
      playerMap.set(playerId, {
        id: playerId,
        name: p.playerName,
        socketId: p.socketId,
        ready: true,
        teamId: p.teamId,
        accountId: p.accountId,
      });
      this.socketToRoom.set(p.socketId, roomCode);
      if (i === 0) {
        // First player becomes the host
        Object.assign(playerMap.get(playerId)!, { id: playerId });
      }
    });

    const hostPlayerId = playerIds[players[0]!.socketId]!;

    const room: Room = {
      code: roomCode,
      hostId: hostPlayerId,
      players: playerMap,
      session: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      gameMode,
      isMatchmade: true,
    };

    this.rooms.set(roomCode, room);
    console.log(`[room] matchmade room ${roomCode} (${players.length} players)`);
    return { roomCode, playerIds };
  }

  // ─── Join ─────────────────────────────────────────────────────────────────

  joinRoom(
    roomCode: string,
    socketId: string,
    playerName: string,
    accountId?: string,
  ): { success: true; playerId: string } | { success: false; error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: 'Room not found' };
    if (room.players.size >= config.maxRoomSize) return { success: false, error: 'Room is full' };
    if (room.session) return { success: false, error: 'Game already in progress' };

    const playerId = uuidv4();
    room.players.set(playerId, { id: playerId, name: playerName, socketId, ready: false, accountId });
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
    const draftMode = room.isMatchmade ? 'hero-draft' : 'standardized-C';
    const session = new GameSession(players, room.gameMode, draftMode);
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

    if (!room.session) {
      room.players.delete(removedPlayerId);
      if (room.players.size === 0) {
        this.rooms.delete(room.code);
        console.log(`[room] deleted empty room ${room.code}`);
      }
    }

    return { roomCode: room.code, playerId: removedPlayerId };
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

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
      code = Array.from(
        { length: 4 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }
}
