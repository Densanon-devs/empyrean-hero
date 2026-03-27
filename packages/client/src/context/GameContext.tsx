import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react';
import type { GameState, DraftState, GameMode, GameEvent, QueueType } from '@empyrean-hero/engine';
import type { AppSocket } from '../socket/client';

// ─────────────────────────────────────────────────────────────────────────────
// Game context — provides game state and actions to the component tree
// ─────────────────────────────────────────────────────────────────────────────

export interface LobbyPlayerInfo {
  id: string;
  name: string;
  ready: boolean;
  teamId?: string;
}

interface MatchmakingState {
  status: 'idle' | 'queuing' | 'found';
  queueType: QueueType | null;
  queuePosition: number;
  queueSize: number;
  waitSeconds: number;
}

interface GameContextState {
  socket: AppSocket | null;
  playerId: string | null;
  playerName: string | null;
  roomCode: string | null;
  lobbyPlayers: LobbyPlayerInfo[];
  gameState: GameState | null;
  draftState: DraftState | null;
  /** Recent game events (last 50) for the event feed / notifications */
  gameEvents: GameEvent[];
  error: string | null;
  isConnected: boolean;
  /** Current game mode set in the lobby */
  roomMode: GameMode;
  /** Player ID of the room host */
  roomHostId: string | null;
  /** Matchmaking state */
  matchmaking: MatchmakingState;
}

type GameContextAction =
  | { type: 'SET_SOCKET'; socket: AppSocket }
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED' }
  | { type: 'SET_IDENTITY'; playerId: string; playerName: string; roomCode: string }
  | { type: 'SET_PLAYER_NAME'; playerName: string }
  | { type: 'SET_LOBBY_PLAYERS'; players: LobbyPlayerInfo[] }
  | { type: 'SET_GAME_STATE'; state: GameState }
  | { type: 'SET_DRAFT_STATE'; state: DraftState }
  | { type: 'ADD_GAME_EVENT'; event: GameEvent }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_ROOM_CONFIG'; mode: GameMode; hostId: string }
  | { type: 'MATCHMAKING_QUEUING'; queueType: QueueType }
  | { type: 'MATCHMAKING_STATUS'; position: number; queueSize: number; waitSeconds: number }
  | { type: 'MATCHMAKING_FOUND'; playerId: string; roomCode: string }
  | { type: 'MATCHMAKING_IDLE' }
  | { type: 'RESET' };

const initialMatchmaking: MatchmakingState = {
  status: 'idle',
  queueType: null,
  queuePosition: 0,
  queueSize: 0,
  waitSeconds: 0,
};

const initialState: GameContextState = {
  socket: null,
  playerId: null,
  playerName: null,
  roomCode: null,
  lobbyPlayers: [],
  gameState: null,
  draftState: null,
  gameEvents: [],
  error: null,
  isConnected: false,
  roomMode: 'free-for-all',
  roomHostId: null,
  matchmaking: initialMatchmaking,
};

function reducer(state: GameContextState, action: GameContextAction): GameContextState {
  switch (action.type) {
    case 'SET_SOCKET':
      return { ...state, socket: action.socket };
    case 'CONNECTED':
      return { ...state, isConnected: true, error: null };
    case 'DISCONNECTED':
      return { ...state, isConnected: false };
    case 'SET_IDENTITY':
      return { ...state, playerId: action.playerId, playerName: action.playerName, roomCode: action.roomCode };
    case 'SET_LOBBY_PLAYERS':
      return { ...state, lobbyPlayers: action.players };
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.state, error: null };
    case 'SET_DRAFT_STATE':
      return { ...state, draftState: action.state };
    case 'ADD_GAME_EVENT':
      return {
        ...state,
        gameEvents: [...state.gameEvents.slice(-49), action.event],
      };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_ROOM_CONFIG':
      return { ...state, roomMode: action.mode, roomHostId: action.hostId };
    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.playerName };
    case 'MATCHMAKING_QUEUING':
      return {
        ...state,
        matchmaking: { ...initialMatchmaking, status: 'queuing', queueType: action.queueType },
      };
    case 'MATCHMAKING_STATUS':
      return {
        ...state,
        matchmaking: {
          ...state.matchmaking,
          queuePosition: action.position,
          queueSize: action.queueSize,
          waitSeconds: action.waitSeconds,
        },
      };
    case 'MATCHMAKING_FOUND':
      return {
        ...state,
        playerId: action.playerId,
        roomCode: action.roomCode,
        matchmaking: { ...state.matchmaking, status: 'found' },
      };
    case 'MATCHMAKING_IDLE':
      return { ...state, matchmaking: initialMatchmaking };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

// ─── Context definition ───────────────────────────────────────────────────────

interface GameContextValue extends GameContextState {
  dispatch: React.Dispatch<GameContextAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <GameContext.Provider value={{ ...state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext must be used inside <GameProvider>');
  return ctx;
}
