// ─────────────────────────────────────────────────────────────────────────────
// @empyrean-hero/engine — public API
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  CardType,
  AbilityType,
  StatType,
  TriggerEvent,
  HeroName,
  AbilityCardName,
  HeroicFeatName,
  BaseCard,
  HeroAbility,
  HeroCard,
  AbilityCard,
  StatCard,
  HeroicFeatCard,
  SkyBase,
  ReferenceCard,
  AnyCard,
} from './types/cards';
export { ALL_HERO_NAMES } from './types/cards';

export type { HeroZone, ArenaHero, PlayerState } from './types/player';

export type {
  ActionType,
  CardPlay,
  HealAction,
  EnhanceAction,
  RecruitAction,
  OvercomeAction,
  PlayCardAction,
  UseHeroicFeatAction,
  PassTurnAction,
  GameAction,
} from './types/actions';

export type {
  GamePhase,
  ActiveTurnAction,
  GameMode,
  DraftMode,
  WinReason,
  CombatOutcome,
  CombatResult,
  GameResult,
  DraftState,
  GameState,
  ActionResult,
  GameEvent,
  GameEventType,
} from './types/game';

export type {
  LobbyPlayer,
  RoomConfig,
  QueueType,
  MatchmakingStatus,
  MatchFound,
  FriendInfo,
  FriendRequest,
  OutgoingRequest,
  FriendsList,
  GameInvite,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types/socketEvents';

// ── Data ───────────────────────────────────────────────────────────────────────
export { HEROES, getHeroByName, getHeroById } from './data/heroes';
export { ABILITY_CARDS, getAbilityCardByName, getAbilityCardById } from './data/abilityCards';
export { STAT_CARDS, getStatCardById } from './data/statCards';
export { HEROIC_FEATS, getHeroicFeatByName, getHeroicFeatById } from './data/heroicFeats';

// ── Engine ─────────────────────────────────────────────────────────────────────
export { applyAction, getPlayerView } from './engine/gameState';
export { createGame, processDraftPick } from './engine/setup';
export type { GameConfig, PlayerSetupInfo } from './engine/setup';
export { resolveCombat, getEffectiveAttack, getEffectiveDefense } from './engine/combat';
export { checkWinConditions, updateNoHeroesCounts } from './engine/winConditions';
export {
  processAbilities,
  applyAbilityCardEffect,
  applyHeroicFeatEffect,
  applyHeroActiveAbility,
  computeHeroAttack,
  computeHeroDefense,
  hasFieldAbility,
  findOpponentId,
  updatePlayer,
} from './engine/abilities';
export type { AbilityContext } from './engine/abilities';
export { shuffleDeck, drawCards, discardCard } from './engine/deck';
export type { DeckCard } from './engine/deck';

// ── Rating ─────────────────────────────────────────────────────────────────────
export {
  STARTING_RATING,
  RANK_TIERS,
  getRankTier,
  getRankTierInfo,
  calculateElo,
} from './rating';
export type { RankTier, RankTierInfo, PlayerRatingInfo, RatingChange } from './rating';
