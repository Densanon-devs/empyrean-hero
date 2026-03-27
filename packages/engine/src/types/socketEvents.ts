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

/** Matchmaking queue types */
export type QueueType = 'ranked-1v1' | 'ranked-2v2' | 'casual';

/** Matchmaking status sent back to the client */
export interface MatchmakingStatus {
  queueType: QueueType;
  position: number;
  queueSize: number;
  waitSeconds: number;
}

/** Payload when a match has been found */
export interface MatchFound {
  roomCode: string;
  playerId: string;
  queueType: QueueType;
}

// ── Friend types ──────────────────────────────────────────────────────────────

export interface FriendInfo {
  accountId: string;
  username: string;
  online: boolean;
  rating: number;
  rankTier: string;
}

export interface FriendRequest {
  requestId: string;
  fromAccountId: string;
  fromUsername: string;
  timestamp: string;
}

export interface OutgoingRequest {
  requestId: string;
  toAccountId: string;
  toUsername: string;
  timestamp: string;
}

export interface FriendsList {
  friends: FriendInfo[];
  pendingRequests: FriendRequest[];
  outgoingRequests: OutgoingRequest[];
}

export interface GameInvite {
  fromAccountId: string;
  fromUsername: string;
  roomCode: string;
}

// ── Client → Server events ───────────────────────────────────────────────────

export interface ClientToServerEvents {
  /** Create a new room; callback returns the room code and this player's ID */
  'room:create': (
    playerName: string,
    callback: (result: { roomCode: string; playerId: string }) => void
  ) => void;

  /** Join an existing room by code; callback returns success + this player's ID */
  'room:join': (
    roomCode: string,
    playerName: string,
    callback: (result: { success: boolean; error?: string; playerId?: string }) => void
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

  // ── Matchmaking ────────────────────────────────────────────────────────────

  /** Join a matchmaking queue */
  'matchmaking:join': (
    data: { playerName: string; queueType: QueueType },
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Leave the matchmaking queue */
  'matchmaking:leave': () => void;

  // ── Friends ───────────────────────────────────────────────────────────────

  /** Request the current friend list + pending requests */
  'friend:list': (
    callback: (result: FriendsList) => void
  ) => void;

  /** Send a friend request by username */
  'friend:request': (
    username: string,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Accept an incoming friend request */
  'friend:accept': (
    requestId: string,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Decline an incoming friend request */
  'friend:decline': (
    requestId: string,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Remove an existing friend */
  'friend:remove': (
    friendAccountId: string,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Invite a friend to your current room */
  'friend:invite': (
    friendAccountId: string,
    callback: (result: { success: boolean; error?: string }) => void
  ) => void;

  /** Respond to a received game invite */
  'friend:invite-response': (
    data: { roomCode: string; accept: boolean }
  ) => void;
}

// ── Server → Client events ───────────────────────────────────────────────────

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

  // ── Matchmaking ────────────────────────────────────────────────────────────

  /** Queue position / status update */
  'matchmaking:status': (status: MatchmakingStatus) => void;

  /** A match has been found — room is ready */
  'matchmaking:found': (data: MatchFound) => void;

  /** Queue was cancelled (timeout or server side) */
  'matchmaking:cancelled': (reason: string) => void;

  // ── Friends ───────────────────────────────────────────────────────────────

  /** Incoming friend request notification */
  'friend:request-received': (request: FriendRequest) => void;

  /** A friend's online status changed */
  'friend:status-update': (data: { accountId: string; online: boolean }) => void;

  /** A friend has invited you to a game */
  'friend:invite-received': (invite: GameInvite) => void;
}

// ── Server-to-server (inter-cluster) events — placeholder ────────────────────

export interface InterServerEvents {
  // TODO: add cluster coordination events if scaling beyond a single process
}

// ── Data stored on each socket connection ────────────────────────────────────

export interface SocketData {
  playerId: string;
  playerName: string;
  roomCode: string | null;
  /** Set for authenticated users; undefined for guests */
  accountId?: string;
}
