// ─────────────────────────────────────────────────────────────────────────────
// Player action types — one of H / E / R / O chosen per turn
// ─────────────────────────────────────────────────────────────────────────────

export type ActionType =
  | 'HEAL'
  | 'ENHANCE'
  | 'RECRUIT'
  | 'OVERCOME'
  | 'PLAY_CARD'
  | 'USE_HEROIC_FEAT'
  | 'PASS_TURN';

interface BaseAction {
  playerId: string;
}

// ─── HERO actions ─────────────────────────────────────────────────────────────

/** A card to play during a HEAL or ENHANCE action, with an optional hero/player target */
export interface CardPlay {
  cardId: string;
  /** Hero instance ID for passive ability cards that attach to a hero; player ID for active cards targeting a player */
  targetId?: string;
  /** Secondary target for abilities that need two choices */
  secondaryTargetId?: string;
}

/**
 * H — Heal
 * Pick any of your fatigued heroes to un-fatigue; optionally play up to 3 enhancement cards.
 */
export interface HealAction extends BaseAction {
  type: 'HEAL';
  /** Instance IDs of fatigued heroes to heal (un-fatigue) */
  targetHeroInstanceIds: string[];
  /** Cards to play during this action (max 3), each with an optional target */
  cardPlays?: CardPlay[];
  /** @deprecated Use cardPlays instead */
  cardIds?: string[];
}

/**
 * E — Enhance
 * Draw up to 3 cards from your enhancement deck; play up to 3 cards from hand.
 */
export interface EnhanceAction extends BaseAction {
  type: 'ENHANCE';
  /** How many cards to draw (1–3) */
  drawCount: number;
  /** Cards to play during this action (max 3), each with an optional target */
  cardPlays?: CardPlay[];
  /** @deprecated Use cardPlays instead */
  cardIds?: string[];
}

/**
 * R — Recruit
 * Deploy up to 2 heroes from your pool into the arena.
 */
export interface RecruitAction extends BaseAction {
  type: 'RECRUIT';
  /** Instance IDs of heroes to deploy from heroPool (max 2) */
  heroInstanceIds: string[];
}

/**
 * O — Overcome
 * Declare an attack: choose your attackers, the defending player, and their defenders.
 */
export interface OvercomeAction extends BaseAction {
  type: 'OVERCOME';
  /** Instance IDs of your arena heroes that will attack */
  attackerInstanceIds: string[];
  /** The player being attacked */
  targetPlayerId: string;
  /** Instance IDs of the defender's arena heroes being attacked */
  defenderInstanceIds: string[];
}

// ─── Mid-action sub-actions ───────────────────────────────────────────────────

/** Play a single card from hand (usable within a HERO action context) */
export interface PlayCardAction extends BaseAction {
  type: 'PLAY_CARD';
  cardId: string;
  /** Primary target: hero instance ID or player ID */
  targetId?: string;
  /**
   * Secondary target for abilities that require two choices (e.g. Absorb: source and dest hero,
   * Revelation: opponent ID + card ID to discard, Reduction: own hero + target player).
   */
  secondaryTargetId?: string;
}

/** Activate one of your Heroic Feat (H) cards */
export interface UseHeroicFeatAction extends BaseAction {
  type: 'USE_HEROIC_FEAT';
  featCardId: string;
  targetId?: string;
  /** Secondary target for feats requiring two choices (e.g. Absorb, Pay the Cost) */
  secondaryTargetId?: string;
}

/** End turn without choosing a HERO action (counts toward draw condition) */
export interface PassTurnAction extends BaseAction {
  type: 'PASS_TURN';
}

export type GameAction =
  | HealAction
  | EnhanceAction
  | RecruitAction
  | OvercomeAction
  | PlayCardAction
  | UseHeroicFeatAction
  | PassTurnAction;
