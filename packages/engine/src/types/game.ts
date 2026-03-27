import type { HeroCard } from './cards';
import type { PlayerState } from './player';

// ─────────────────────────────────────────────────────────────────────────────
// Game-level state and result types
// ─────────────────────────────────────────────────────────────────────────────

export type GamePhase = 'lobby' | 'draft' | 'gameplay' | 'gameover';

/** The HERO action chosen for this turn, or null between turns */
export type ActiveTurnAction = 'heal' | 'enhance' | 'recruit' | 'overcome' | null;

export type GameMode = 'free-for-all' | 'team-play';

export type DraftMode =
  | 'hero-draft'      // Players pick heroes from a shared pool
  | 'ability-draft'   // Players pick ability cards for their enhancement decks
  | 'standardized-A'  // Pre-built deck A (aggressive)
  | 'standardized-B'  // Pre-built deck B (defensive)
  | 'standardized-C'  // Pre-built deck C (balanced)
  | 'standardized-D'; // Pre-built deck D (control)

export type WinReason =
  | 'all-skybases-defeated'
  | 'no-heroes-3-turns'
  | 'draw-no-action'
  | 'draw-attack-loop';

export type CombatOutcome = 'defeated' | 'fatigued' | 'no-effect';

// ─── Combat ───────────────────────────────────────────────────────────────────

export interface CombatResult {
  attackerPlayerId: string;
  defenderPlayerId: string;
  attackerHeroInstanceIds: string[];
  defenderHeroInstanceIds: string[];
  totalAttack: number;
  totalDefense: number;
  outcome: CombatOutcome;
  /** Instance IDs of heroes that were defeated in this combat */
  defeatedHeroInstanceIds: string[];
  /** Instance IDs of heroes that were fatigued in this combat (defender side) */
  fatiguedHeroInstanceIds: string[];
  /** Names of abilities that triggered during this combat */
  triggeredAbilities: string[];
}

// ─── Draft ────────────────────────────────────────────────────────────────────

export interface DraftState {
  phase: 'hero-pick' | 'ability-pick' | 'complete';
  /** Heroes still available in the shared draft pool */
  availableHeroes: HeroCard[];
  /** Heroes each player has picked: playerId → array of heroCard IDs */
  picks: Record<string, string[]>;
  /** Index into pickOrder for the current pick */
  pickIndex: number;
  /** Snake-draft order: e.g. [p1, p2, p2, p1] */
  pickOrder: string[];
}

// ─── Game result ──────────────────────────────────────────────────────────────

export interface GameResult {
  /** Winning player IDs; null on a draw */
  winnerIds: string[] | null;
  loserIds: string[];
  reason: WinReason;
}

// ─── Game events (emitted by the engine, consumed by server/client) ───────────

export type GameEventType =
  | 'HERO_FATIGUED'
  | 'HERO_DEFEATED'
  | 'HERO_RECRUITED'
  | 'HERO_HEALED'
  | 'HERO_REMOVED'       // Hero removed from field (not defeated) — e.g. Pay the Cost
  | 'CARD_PLAYED'
  | 'CARDS_DISCARDED'    // One or more cards discarded (player, count, reason)
  | 'ABILITY_TRIGGERED'
  | 'ABILITY_NULLIFIED'  // An ability was countered/nullified
  | 'HEROIC_FEAT_USED'
  | 'COMBAT_RESOLVED'
  | 'TURN_STARTED'
  | 'TURN_ENDED'
  | 'PHASE_CHANGED'
  | 'GAME_OVER';

export interface GameEvent {
  type: GameEventType;
  payload: Record<string, unknown>;
}

// ─── Core game state ──────────────────────────────────────────────────────────

export interface GameState {
  id: string;
  mode: GameMode;
  draftMode: DraftMode;
  phase: GamePhase;
  /** The HERO action selected this turn; null between turns */
  activeTurnAction: ActiveTurnAction;
  round: number;
  currentPlayerId: string;
  /** Ordered list of player IDs for turn rotation */
  turnOrder: string[];
  /** All player states keyed by player ID */
  players: Record<string, PlayerState>;
  /**
   * Consecutive turns with no meaningful action taken across all players.
   * Draw condition triggers at 5.
   */
  noActionTurnCount: number;
  /** Full history of combat resolutions (for detection of 6-attack loop) */
  combatHistory: CombatResult[];
  /** Human-readable action log for display / replay */
  actionLog: string[];
  /** Draft state — only populated during the 'draft' phase */
  draftState: DraftState | null;
  /** Final result — only populated during the 'gameover' phase */
  result: GameResult | null;
  /**
   * When Kairos is played, the current player may take one additional HERO action
   * (non-Overcome) before the turn advances. Cleared after the extra action is used.
   */
  kairosActionAvailable: boolean;
}

// ─── Action result ────────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  error?: string;
  newState: GameState;
  events: GameEvent[];
}
