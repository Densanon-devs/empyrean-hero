import type { HeroCard, AbilityCard, StatCard, HeroicFeatCard, SkyBase } from './cards';

// ─────────────────────────────────────────────────────────────────────────────
// Player & arena state types
// ─────────────────────────────────────────────────────────────────────────────

export type HeroZone = 'pool' | 'arena' | 'defeated';

/**
 * Runtime state of a single hero instance.
 * The base `heroCard` holds static definition; this wrapper holds transient state.
 */
export interface ArenaHero {
  /** Unique instance ID: `hero-${heroName}-${playerId}` */
  instanceId: string;
  /** Static card definition */
  heroCard: HeroCard;
  /** Whether this hero has used their action this turn and cannot attack again */
  fatigued: boolean;
  /** Temporary ATK bonus (cleared at turn end unless a card says otherwise) */
  tempAttackBonus: number;
  /** Temporary DEF bonus (cleared at turn end) */
  tempDefenseBonus: number;
  /** Stat cards permanently attached to this hero */
  appliedStatCards: StatCard[];
  /** Where the hero currently is */
  zone: HeroZone;
  /**
   * Passive ability cards played to the field and attached to this hero.
   * These remain until discarded by game effects or when the hero leaves the arena.
   */
  fieldAbilityCards: AbilityCard[];
  /**
   * Set by Mace's ability when this hero is defeated by Mace with overwhelming ATK.
   * Prevents the hero from being resurrected for the rest of the game.
   */
  cannotBeResurrected: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  /** Optional team identifier for Team Play mode */
  teamId?: string;
  skyBase: SkyBase;
  /**
   * Heroes assigned to this player (via draft or setup) that are NOT yet in the arena.
   * These can be recruited during the Recruit (R) action.
   */
  heroPool: ArenaHero[];
  /** Heroes currently deployed and active in the arena */
  arena: ArenaHero[];
  /** Heroes that have been defeated (available for Resurrect) */
  defeatedHeroes: ArenaHero[];
  /** Enhancement draw pile (shuffled ability + stat cards) */
  enhancementDeck: (AbilityCard | StatCard)[];
  /** Cards currently in hand */
  hand: (AbilityCard | StatCard)[];
  /** Played / discarded enhancement cards */
  discardPile: (AbilityCard | StatCard)[];
  /** Heroic Feat (H) cards available to this player */
  heroicFeats: HeroicFeatCard[];
  /**
   * Consecutive full turns this player has had zero heroes in the arena.
   * Win condition: opponent reaches 3.
   */
  noHeroesTurnCount: number;
  /** True once this player has been knocked out of the game */
  isEliminated: boolean;
  /**
   * Set by Hindra's active ability. When true, this player cannot play ability cards
   * to the field on their current turn. Cleared at start of the affected player's turn.
   */
  cannotPlayAbilityCards: boolean;
  /**
   * Set by Drought when a Heroic Ability is nullified. The affected player cannot
   * use ANY abilities this turn. Cleared at start of next turn.
   */
  droughtActive: boolean;
  /**
   * Instance IDs of heroes currently protected by the Protect passive ability card.
   * Protected heroes cannot be fatigued or defeated until end of the player's next turn.
   */
  protectedHeroIds: string[];
  /**
   * Set by the Prevention passive ability card when it is discarded.
   * All attacks against this player's heroes are blocked until start of their next turn.
   */
  preventionActive: boolean;
}
