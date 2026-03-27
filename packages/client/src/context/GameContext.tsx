import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react';
import type { GameState, DraftState, GameMode } from '@empyrean-hero/engine';
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

interface GameContextState {
  socket: AppSocket | null;
  playerId: string | null;
  playerName: string | null;
  roomCode: string | null;
  lobbyPlayers: LobbyPlayerInfo[];
  gameState: GameState | null;
  draftState: DraftState | null;
  error: string | null;
  isConnected: boolean;
  /** Current game mode set in the lobby */
  roomMode: GameMode;
  /** Player ID of the room host */
  roomHostId: string | null;
}

type GameContextAction =
  | { type: 'SET_SOCKET'; socket: AppSocket }
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED' }
  | { type: 'SET_IDENTITY'; playerId: string; playerName: string; roomCode: string }
  | { type: 'SET_LOBBY_PLAYERS'; players: LobbyPlayerInfo[] }
  | { type: 'SET_GAME_STATE'; state: GameState }
  | { type: 'SET_DRAFT_STATE'; state: DraftState }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_ROOM_CONFIG'; mode: GameMode; hostId: string }
  | { type: 'RESET' };

const initialState: GameContextState = {
  socket: null,
  playerId: null,
  playerName: null,
  roomCode: null,
  lobbyPlayers: [],
  gameState: null,
  draftState: null,
  error: null,
  isConnected: false,
  roomMode: 'free-for-all',
  roomHostId: null,
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
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_ROOM_CONFIG':
      return { ...state, roomMode: action.mode, roomHostId: action.hostId };
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
