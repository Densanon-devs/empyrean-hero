import { v4 as uuidv4 } from 'uuid';
import {
  createGame,
  applyAction,
  getPlayerView,
  processDraftPick,
} from '@empyrean-hero/engine';
import type { GameState, ActionResult, GameMode, DraftMode } from '@empyrean-hero/engine';
import type { GameAction } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Game session — wraps the engine for a single multiplayer game
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionPlayer {
  id: string;
  name: string;
}

export class GameSession {
  private state: GameState;

  constructor(players: SessionPlayer[], mode: GameMode, draftMode: DraftMode) {
    this.state = createGame({
      gameId: uuidv4(),
      mode,
      draftMode,
      players,
    });
    console.log(`[session] created game ${this.state.id} — ${mode} / ${draftMode}`);
  }

  // ─── State accessors ───────────────────────────────────────────────────────

  getState(): GameState {
    return this.state;
  }

  /** Return a player-specific view with opponent hands hidden */
  getPlayerView(playerId: string): GameState {
    return getPlayerView(this.state, playerId);
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  applyAction(playerId: string, action: GameAction): ActionResult {
    if (action.playerId !== playerId) {
      return {
        success: false,
        error: 'Action playerId does not match socket identity',
        newState: this.state,
        events: [],
      };
    }

    const result = applyAction(this.state, action);
    if (result.success) {
      this.state = result.newState;
    }
    return result;
  }

  // ─── Draft ─────────────────────────────────────────────────────────────────

  draftPick(playerId: string, heroId: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'draft') {
      return { success: false, error: 'Not in draft phase' };
    }

    const currentPicker = this.state.draftState?.pickOrder[this.state.draftState.pickIndex];
    if (currentPicker !== playerId) {
      return { success: false, error: 'Not your pick' };
    }

    this.state = processDraftPick(this.state, playerId, heroId);
    return { success: true };
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  isOver(): boolean {
    return this.state.phase === 'gameover';
  }

  currentPlayerId(): string {
    return this.state.currentPlayerId;
  }
}
