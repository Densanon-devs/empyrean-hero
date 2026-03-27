import type { GameState, GameEvent, DraftState, GameMode } from './game';
import type { GameAction } from './actions';

// ─────────────────────────────────────────────────────────────────────────────
// Shared Socket.io event type contracts (used by both server and client)
// ─────────────────────────────────────────────────────────────────────────────

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  /** Set during Team Play lobby; 'A' or 'B' */
  teamId?: string;
}

export interface RoomConfig {
  gameMode: GameMode;
  /** Player ID of the room host (only host can change mode) */
  hostId: string;
}

// Client → Server events
export interface ClientToServerEvents {
  /** Create a new room; callback returns the generated room code */
  'room:create': (
    playerName: string,
    callback: (roomCode: string) => void
  ) => void;

  /** Join an existing room by code */
  'room:join': (
    roomCode: string,
    playerName: string,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Signal that this player is ready to start */
  'room:ready': () => void;

  /** Host sets the game mode (free-for-all or team-play) */
  'room:set-mode': (
    mode: GameMode,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Player chooses their team ('A' or 'B') for Team Play mode */
  'room:set-team': (
    teamId: string,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Submit a game action; callback indicates success */
  'game:action': (
    action: GameAction,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Pick a hero during the draft phase */
  'draft:pick': (
    heroId: string,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Send a chat message to the room */
  'chat:message': (message: string) => void;
}

// Server → Client events
export interface ServerToClientEvents {
  /** Lobby player list update (includes teamId when in Team Play) */
  'room:players': (players: LobbyPlayer[]) => void;

  /** Room configuration broadcast (mode, host) */
  'room:config': (config: RoomConfig) => void;

  /** Full game state sync (sent after every action) */
  'game:state': (state: GameState) => void;

  /** Incremental game event (for animation/display triggers) */
  'game:event': (event: GameEvent) => void;

  /** Draft state update */
  'draft:state': (state: DraftState) => void;

  /** Incoming chat message */
  'chat:message': (fromId: string, fromName: string, message: string) => void;

  /** Room-level error */
  'room:error': (message: string) => void;

  /** Game-level error */
  'game:error': (message: string) => void;
}

// Server-to-server (inter-cluster) events — placeholder
export interface InterServerEvents {
  // TODO: add cluster coordination events if scaling beyond a single process
}

// Data stored on each socket connection
export interface SocketData {
  playerId: string;
  playerName: string;
  roomCode: string | null;
}
