import type { GameState, GameMode, DraftMode, DraftState } from '../types/game';
import type { PlayerState, ArenaHero } from '../types/player';
import type { HeroCard, AbilityCard, StatCard, HeroicFeatCard } from '../types/cards';
import { HEROES } from '../data/heroes';
import { ABILITY_CARDS } from '../data/abilityCards';
import { STAT_CARDS } from '../data/statCards';
import { HEROIC_FEATS } from '../data/heroicFeats';
import { shuffleDeck } from './deck';

// ─────────────────────────────────────────────────────────────────────────────
// Game setup and drafting
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerSetupInfo {
  id: string;
  name: string;
  teamId?: string;
}

export interface GameConfig {
  gameId: string;
  mode: GameMode;
  draftMode: DraftMode;
  players: PlayerSetupInfo[];
}

// ─── Standardized enhancement decks A/B/C/D ─────────────────────────────────

/** ATK-focused deck (aggressive) */
const DECK_A: string[] = [
  'ability-boost', 'ability-boost', 'ability-going-nuclear',
  'ability-drain', 'ability-accelerate', 'ability-reinforcement',
  'stat-att-20', 'stat-att-20', 'stat-att-30',
];

/** DEF-focused deck (defensive) */
const DECK_B: string[] = [
  'ability-bolster', 'ability-bolster', 'ability-fortification',
  'ability-shielding', 'ability-protect', 'ability-hardened',
  'stat-def-20', 'stat-def-20', 'stat-def-30',
];

/** Balanced deck */
const DECK_C: string[] = [
  'ability-boost', 'ability-bolster', 'ability-accelerate',
  'ability-reinforcement', 'ability-pay-the-cost', 'ability-resurrect',
  'stat-att-20', 'stat-def-20', 'stat-att-30',
];

/** Control deck */
const DECK_D: string[] = [
  'ability-prevention', 'ability-counter-measures', 'ability-backfire',
  'ability-drought', 'ability-impede', 'ability-revelation',
  'ability-kairos', 'stat-def-20', 'stat-att-20',
];

const STANDARDIZED_DECKS: Record<string, string[]> = {
  'standardized-A': DECK_A,
  'standardized-B': DECK_B,
  'standardized-C': DECK_C,
  'standardized-D': DECK_D,
};

// ─── Main setup entry point ───────────────────────────────────────────────────

/**
 * Create the initial GameState for a new game session.
 * After calling this, the game enters the 'draft' phase (or 'gameplay' for standardized).
 */
export function createGame(config: GameConfig): GameState {
  const allHeroes = [...HEROES] as HeroCard[];

  // Build draft state for hero-draft mode
  const isDraft = config.draftMode === 'hero-draft' || config.draftMode === 'ability-draft';
  const draftState: DraftState | null = isDraft
    ? buildInitialDraftState(allHeroes, config.players.map((p) => p.id))
    : null;

  // For standardized modes, divide heroes evenly among players up front
  const heroAssignments = isDraft
    ? buildEmptyAssignments(config.players)
    : buildStandardizedHeroAssignments(allHeroes, config.players);

  const players: Record<string, PlayerState> = {};
  for (const p of config.players) {
    players[p.id] = buildPlayerState(
      p,
      heroAssignments[p.id] ?? [],
      config.draftMode,
    );
  }

  return {
    id: config.gameId,
    mode: config.mode,
    draftMode: config.draftMode,
    phase: isDraft ? 'draft' : 'gameplay',
    activeTurnAction: null,
    round: 1,
    currentPlayerId: config.players[0]?.id ?? '',
    turnOrder: config.players.map((p) => p.id),
    players,
    noActionTurnCount: 0,
    combatHistory: [],
    actionLog: [`Game started — ${config.mode}, ${config.draftMode}`],
    draftState,
    result: null,
    kairosActionAvailable: false,
  };
}

// ─── Draft helpers ────────────────────────────────────────────────────────────

/**
 * Build a snake-draft structure.
 * With 2 players picking 5 heroes each: [p1, p2, p2, p1, p1, p2, p2, p1, p1, p2]
 */
function buildInitialDraftState(heroes: HeroCard[], playerIds: string[]): DraftState {
  const totalHeroes = heroes.length; // 20
  const pickOrder: string[] = [];

  // Snake draft: forward then backward, repeat
  let forward = true;
  const ids = [...playerIds];
  while (pickOrder.length < totalHeroes) {
    const wave = forward ? ids : [...ids].reverse();
    for (const id of wave) {
      if (pickOrder.length < totalHeroes) pickOrder.push(id);
    }
    forward = !forward;
  }

  return {
    phase: 'hero-pick',
    availableHeroes: shuffleDeck(heroes),
    picks: Object.fromEntries(playerIds.map((id) => [id, []])),
    pickIndex: 0,
    pickOrder,
  };
}

function buildEmptyAssignments(players: PlayerSetupInfo[]): Record<string, HeroCard[]> {
  return Object.fromEntries(players.map((p) => [p.id, []]));
}

/**
 * For standardized modes, deal heroes evenly to each player.
 * With 20 heroes and 2 players → 10 each.
 */
function buildStandardizedHeroAssignments(
  heroes: HeroCard[],
  players: PlayerSetupInfo[],
): Record<string, HeroCard[]> {
  const shuffled = shuffleDeck([...heroes]);
  const perPlayer = Math.floor(shuffled.length / players.length);
  const result: Record<string, HeroCard[]> = {};
  players.forEach((p, i) => {
    result[p.id] = shuffled.slice(i * perPlayer, (i + 1) * perPlayer);
  });
  return result;
}

// ─── Player state builder ─────────────────────────────────────────────────────

function buildPlayerState(
  info: PlayerSetupInfo,
  assignedHeroes: HeroCard[],
  draftMode: DraftMode,
): PlayerState {
  const heroPool: ArenaHero[] = assignedHeroes.map((card) =>
    makeArenaHero(card, info.id),
  );

  const enhancementDeck = buildEnhancementDeck(info.id, draftMode);

  return {
    id: info.id,
    name: info.name,
    teamId: info.teamId,
    skyBase: {
      id: `skybase-${info.id}`,
      name: `${info.name}'s Sky Base`,
      type: 'sky-base',
      ownerId: info.id,
      defeated: false,
    },
    heroPool,
    arena: [],
    defeatedHeroes: [],
    enhancementDeck: shuffleDeck(enhancementDeck),
    hand: [],
    discardPile: [],
    heroicFeats: [...HEROIC_FEATS] as HeroicFeatCard[],
    noHeroesTurnCount: 0,
    isEliminated: false,
    cannotPlayAbilityCards: false,
    droughtActive: false,
    protectedHeroIds: [],
    preventionActive: false,
  };
}

function makeArenaHero(card: HeroCard, playerId: string): ArenaHero {
  return {
    instanceId: `hero-${card.heroName.toLowerCase()}-${playerId}`,
    heroCard: card,
    fatigued: false,
    tempAttackBonus: 0,
    tempDefenseBonus: 0,
    appliedStatCards: [],
    zone: 'pool',
    fieldAbilityCards: [],
    cannotBeResurrected: false,
  };
}

function buildEnhancementDeck(playerId: string, draftMode: DraftMode): (AbilityCard | StatCard)[] {
  const deckIds = STANDARDIZED_DECKS[draftMode];
  if (!deckIds) {
    // For draft modes, return empty deck — filled after the draft
    return [];
  }

  const cards: (AbilityCard | StatCard)[] = [];
  for (const id of deckIds) {
    const ability = ABILITY_CARDS.find((c) => c.id === id);
    if (ability) { cards.push(ability); continue; }
    const stat = STAT_CARDS.find((c) => c.id === id);
    if (stat) cards.push(stat);
  }
  return cards;
}

// ─── Draft pick ───────────────────────────────────────────────────────────────

/**
 * Process a hero pick during the draft phase.
 * The current pick player selects one hero from draftState.availableHeroes.
 */
export function processDraftPick(
  state: GameState,
  playerId: string,
  heroId: string,
): GameState {
  const draft = state.draftState;
  if (!draft || draft.phase !== 'hero-pick') return state;

  const currentPickPlayer = draft.pickOrder[draft.pickIndex];
  if (currentPickPlayer !== playerId) return state; // Not this player's pick

  const heroIdx = draft.availableHeroes.findIndex((h) => h.id === heroId);
  if (heroIdx === -1) return state;

  const pickedHero = draft.availableHeroes[heroIdx]!;
  const newAvailable = draft.availableHeroes.filter((_, i) => i !== heroIdx);
  const newPicks = {
    ...draft.picks,
    [playerId]: [...(draft.picks[playerId] ?? []), heroId],
  };

  const newPickIndex = draft.pickIndex + 1;
  const isDraftComplete = newPickIndex >= draft.pickOrder.length;

  // Assign picked hero to player's heroPool
  const player = state.players[playerId];
  const newArenaHero = makeArenaHero(pickedHero, playerId);

  const updatedPlayers = {
    ...state.players,
    [playerId]: player
      ? { ...player, heroPool: [...player.heroPool, newArenaHero] }
      : state.players[playerId]!,
  };

  const newDraftState: DraftState = {
    ...draft,
    availableHeroes: newAvailable,
    picks: newPicks,
    pickIndex: newPickIndex,
    phase: isDraftComplete ? 'complete' : 'hero-pick',
  };

  return {
    ...state,
    players: updatedPlayers,
    phase: isDraftComplete ? 'gameplay' : 'draft',
    draftState: isDraftComplete ? { ...newDraftState, phase: 'complete' } : newDraftState,
    actionLog: [
      ...state.actionLog,
      `${state.players[playerId]?.name ?? playerId} drafted ${pickedHero.heroName}`,
    ],
  };
}
