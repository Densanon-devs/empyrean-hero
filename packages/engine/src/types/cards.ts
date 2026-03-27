// ─────────────────────────────────────────────────────────────────────────────
// Card type definitions for Empyrean Hero: The Card Game
// ─────────────────────────────────────────────────────────────────────────────

export type CardType =
  | 'hero'
  | 'ability'
  | 'stat'
  | 'heroic-feat'
  | 'sky-base'
  | 'reference';

/** Ability classification: Active (played from hand), Passive (auto-triggers), Heroic Feat (H, powerful once-per-game) */
export type AbilityType = 'A' | 'P' | 'H';

export type StatType = 'ATT' | 'DEF';

// ─── Game event triggers for passive abilities ────────────────────────────────

export type TriggerEvent =
  | 'on_attack'
  | 'on_defend'
  | 'on_defeat_ally'
  | 'on_defeat_enemy'
  | 'on_fatigue'
  | 'on_fatigue_enemy'
  | 'on_heal'
  | 'on_enhance'
  | 'on_recruit'
  | 'on_turn_start'
  | 'on_turn_end'
  | 'on_combat_start'
  | 'on_combat_end';

// ─── Canonical name types ─────────────────────────────────────────────────────

export type HeroName =
  | 'Akio'
  | 'Ayumi'
  | 'Boulos'
  | 'Christoph'
  | 'Eng'
  | 'Gambito'
  | 'Grit'
  | 'Hindra'
  | 'Ignacia'
  | 'Isaac'
  | 'Izumi'
  | 'Kay'
  | 'Kyauta'
  | 'Mace'
  | 'Michael'
  | 'Origin'
  | 'Rohan'
  | 'Yasmine'
  | 'Zhao'
  | 'Zoe';

export const ALL_HERO_NAMES: HeroName[] = [
  'Akio', 'Ayumi', 'Boulos', 'Christoph', 'Eng', 'Gambito',
  'Grit', 'Hindra', 'Ignacia', 'Isaac', 'Izumi', 'Kay',
  'Kyauta', 'Mace', 'Michael', 'Origin', 'Rohan', 'Yasmine',
  'Zhao', 'Zoe',
];

export type AbilityCardName =
  | 'Absorb'
  | 'Accelerate'
  | 'Backfire'
  | 'Bolster'
  | 'Boost'
  | 'Collateral Damage'
  | 'Convert'
  | 'Counter-Measures'
  | 'Drain'
  | 'Drought'
  | 'Fortification'
  | 'Going Nuclear'
  | 'Hardened'
  | 'Impede'
  | 'Kairos'
  | 'Pay the Cost'
  | 'Prevention'
  | 'Protect'
  | 'Reduction'
  | 'Reinforcement'
  | 'Resurrect'
  | 'Revelation'
  | 'Shielding'
  | 'Under Siege';

export type HeroicFeatName =
  | 'Absorb'
  | 'Drain'
  | 'Pay the Cost'
  | 'Under Siege';

// ─── Base card ────────────────────────────────────────────────────────────────

export interface BaseCard {
  id: string;
  name: string;
  type: CardType;
}

// ─── Hero ability definition ──────────────────────────────────────────────────

export interface HeroAbility {
  name: string;
  abilityType: AbilityType;
  description: string;
  /** For passive abilities: the game event that triggers this ability */
  triggerEvent?: TriggerEvent;
}

// ─── Card variants ────────────────────────────────────────────────────────────

/** Static definition of a hero card (not runtime state — see ArenaHero in player.ts) */
export interface HeroCard extends BaseCard {
  type: 'hero';
  heroName: HeroName;
  attack: number;
  defense: number;
  ability: HeroAbility;
  /** Relative path within public/assets/heroes/ */
  illustrationRef: string;
  lore: string;
}

export interface AbilityCard extends BaseCard {
  type: 'ability';
  cardName: AbilityCardName;
  abilityType: AbilityType;
  description: string;
}

/** Stat modification card — applied to a hero to permanently boost ATT or DEF */
export interface StatCard extends BaseCard {
  type: 'stat';
  statType: StatType;
  value: 20 | 30;
}

/** Heroic Feat card — (H) type, powerful once-per-game ability */
export interface HeroicFeatCard extends BaseCard {
  type: 'heroic-feat';
  featName: HeroicFeatName;
  description: string;
}

/** The player's SkyBase — all opposing SkyBases must be defeated to win */
export interface SkyBase extends BaseCard {
  type: 'sky-base';
  ownerId: string;
  defeated: boolean;
}

/** Quick-reference summary card (non-gameplay) */
export interface ReferenceCard extends BaseCard {
  type: 'reference';
  content: string;
}

export type AnyCard =
  | HeroCard
  | AbilityCard
  | StatCard
  | HeroicFeatCard
  | SkyBase
  | ReferenceCard;
