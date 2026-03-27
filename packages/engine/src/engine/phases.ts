import type { GameState, ActionResult, GameEvent } from '../types/game';
import type {
  HealAction, EnhanceAction, RecruitAction, OvercomeAction, PassTurnAction,
} from '../types/actions';
import type { ArenaHero } from '../types/player';
import { drawCards } from './deck';
import { resolveCombat } from './combat';
import { checkWinConditions, updateNoHeroesCounts } from './winConditions';
import {
  processAbilities,
  checkAndResolveDrought,
  updatePlayer,
  type AbilityContext,
} from './abilities';

// ─────────────────────────────────────────────────────────────────────────────
// HERO phase handlers — one is chosen per turn
// ─────────────────────────────────────────────────────────────────────────────

/**
 * H — Heal
 * Un-fatigue the specified heroes and optionally play up to 3 enhancement cards.
 *
 * Ability hooks fired:
 * - Zoe active: player may heal heroes BEFORE performing their action.
 *   (Zoe's ability is applied separately via PLAY_CARD; Heal itself also un-fatigues.)
 */
export function applyHeal(state: GameState, action: HealAction): ActionResult {
  const player = state.players[action.playerId];
  if (!player) return fail(state, 'Player not found');

  if (action.targetHeroInstanceIds.length === 0 && action.cardIds.length === 0) {
    return fail(state, 'Heal action must target at least one hero or play a card');
  }

  // Un-fatigue targeted heroes
  const newArena: ArenaHero[] = player.arena.map((hero) => {
    if (!action.targetHeroInstanceIds.includes(hero.instanceId)) return hero;
    return { ...hero, fatigued: false };
  });

  const events: GameEvent[] = action.targetHeroInstanceIds.map((id) => {
    const hero = player.arena.find((h) => h.instanceId === id);
    return {
      type: 'HERO_HEALED' as const,
      payload: {
        heroInstanceId: id,
        heroName: hero?.heroCard.heroName ?? id,
        playerId: action.playerId,
      },
    };
  });

  if (action.cardIds.length > 3) {
    return fail(state, 'Cannot play more than 3 cards during Heal');
  }

  let newState: GameState = {
    ...state,
    activeTurnAction: 'heal',
    noActionTurnCount: 0,
    players: {
      ...state.players,
      [action.playerId]: { ...player, arena: newArena },
    },
    actionLog: [
      ...state.actionLog,
      `[R${state.round}] ${player.name}: Heal — ${action.targetHeroInstanceIds.length} hero(es) un-fatigued`,
    ],
  };

  // Eng ability: after completing action, heal one hero
  // (Eng's ability is triggered separately via the hero ability activation system)

  return advance(newState, events);
}

/**
 * E — Enhance
 * Draw up to 3 cards from the enhancement deck, then play up to 3 cards from hand.
 *
 * Ability hooks fired:
 * - Hindra effect checked: if player cannot play ability cards, card plays are skipped.
 */
export function applyEnhance(state: GameState, action: EnhanceAction): ActionResult {
  const player = state.players[action.playerId];
  if (!player) return fail(state, 'Player not found');

  // Hindra: cannot play ability cards this turn
  if (player.cannotPlayAbilityCards && action.cardIds.length > 0) {
    return fail(state, 'Hindra: Lockdown — cannot play Ability Cards to field this turn');
  }

  const drawCount = Math.min(action.drawCount, 3);
  const { drawn, deck, discard } = drawCards(player.enhancementDeck, player.discardPile, drawCount);

  if (action.cardIds.length > 3) {
    return fail(state, 'Cannot play more than 3 cards during Enhance');
  }

  const events: GameEvent[] = [
    { type: 'CARD_PLAYED', payload: { count: drawn.length, playerId: action.playerId } },
  ];

  const newState: GameState = {
    ...state,
    activeTurnAction: 'enhance',
    noActionTurnCount: 0,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        enhancementDeck: deck,
        discardPile: discard,
        hand: [...player.hand, ...drawn],
      },
    },
    actionLog: [
      ...state.actionLog,
      `[R${state.round}] ${player.name}: Enhance — drew ${drawn.length} card(s)`,
    ],
  };

  return advance(newState, events);
}

/**
 * R — Recruit
 * Deploy up to 2 heroes from the player's pool into the arena.
 *
 * Ability hooks fired:
 * - Ayumi passive (on_recruit): draw a card when any hero is recruited.
 * - Kyauta active: handled separately after action completes.
 */
export function applyRecruit(state: GameState, action: RecruitAction): ActionResult {
  const player = state.players[action.playerId];
  if (!player) return fail(state, 'Player not found');

  if (action.heroInstanceIds.length > 2) {
    return fail(state, 'Cannot recruit more than 2 heroes per turn');
  }

  const toRecruit = action.heroInstanceIds
    .map((id) => player.heroPool.find((h) => h.instanceId === id))
    .filter((h): h is ArenaHero => h !== undefined);

  if (toRecruit.length !== action.heroInstanceIds.length) {
    return fail(state, 'One or more specified heroes not found in pool');
  }

  const newPool = player.heroPool.filter(
    (h) => !action.heroInstanceIds.includes(h.instanceId),
  );
  const newArena = [
    ...player.arena,
    ...toRecruit.map((h) => ({ ...h, zone: 'arena' as const })),
  ];

  const events: GameEvent[] = toRecruit.map((h) => ({
    type: 'HERO_RECRUITED' as const,
    payload: { heroInstanceId: h.instanceId, heroName: h.heroCard.heroName, playerId: action.playerId },
  }));

  let newState: GameState = {
    ...state,
    activeTurnAction: 'recruit',
    noActionTurnCount: 0,
    players: {
      ...state.players,
      [action.playerId]: { ...player, heroPool: newPool, arena: newArena },
    },
    actionLog: [
      ...state.actionLog,
      `[R${state.round}] ${player.name}: Recruit — ${toRecruit.map((h) => h.heroCard.heroName).join(', ')}`,
    ],
  };

  // ── Ayumi passive: fire on_recruit for each recruited hero ────────────────
  for (const h of toRecruit) {
    const ctx: AbilityContext = {
      actingPlayerId: action.playerId,
      heroInstanceId: h.instanceId,
    };
    const ayumiResult = processAbilities(newState, 'on_recruit', ctx);
    newState = ayumiResult.newState;
    events.push(...ayumiResult.events);
  }

  return advance(newState, events);
}

/**
 * O — Overcome
 * Declare an attack. Delegates to resolveCombat.
 *
 * Ability hooks:
 * - Prevention: if defender's preventionActive is set, combat is blocked.
 * - Origin: if Origin is the sole target and other defenders exist, combat blocked.
 * - Protect passive: if any defender is in protectedHeroIds, skip defeat/fatigue for them.
 * - Going Nuclear: if triggered, all heroes removed.
 * - Gambito: fires on any fatigue/defeat during combat.
 * - Christoph: fires post-combat on_defend.
 * - Yasmine: fires post-combat on_defend.
 * - Akio: un-fatigues after causing enemy fatigue.
 */
export function applyOvercome(state: GameState, action: OvercomeAction): ActionResult {
  const player = state.players[action.playerId];
  if (!player) return fail(state, 'Player not found');

  if (action.attackerInstanceIds.length === 0) {
    return fail(state, 'Must declare at least one attacker');
  }

  // Check if Ignacia's Relentless has been activated for fatigued attack
  const allowFatiguedAttack = action.attackerInstanceIds.some((id) => {
    const h = player.arena.find((a) => a.instanceId === id);
    return h?.heroCard.heroName === 'Ignacia' && h.fatigued;
  });

  // Before resolving combat, check Protect passive for each declared defender:
  // If a hero OTHER than the declared defenders is being attacked, activate Protect.
  const defenderPlayer = state.players[action.targetPlayerId];
  let preState: GameState = { ...state, activeTurnAction: 'overcome' as const };

  if (defenderPlayer) {
    for (const hero of defenderPlayer.arena) {
      // Check if this non-attacked hero has a Protect card and another hero IS being attacked
      const isAttacked = action.defenderInstanceIds.includes(hero.instanceId);
      const hasProtect = hero.fieldAbilityCards.some((c) => c.cardName === 'Protect');
      if (!isAttacked && hasProtect && action.defenderInstanceIds.length > 0) {
        // Protect activates: mark the attacked heroes as protected
        const updatedProtectedIds = [
          ...defenderPlayer.protectedHeroIds,
          ...action.defenderInstanceIds,
        ];
        preState = updatePlayer(preState, action.targetPlayerId, {
          protectedHeroIds: [...new Set(updatedProtectedIds)],
        });
        preState = {
          ...preState,
          actionLog: [
            ...preState.actionLog,
            `[R${state.round}] Protect activated by ${hero.heroCard.heroName} — ` +
            `${action.defenderInstanceIds.length} hero(es) protected`,
          ],
        };
        break;
      }
    }
  }

  const { result, newState: afterCombat, events } = resolveCombat(
    preState,
    action,
    allowFatiguedAttack,
  );

  // Check win conditions after combat
  const winResult = checkWinConditions(afterCombat);
  if (winResult) {
    return {
      success: true,
      newState: {
        ...afterCombat,
        phase: 'gameover',
        result: winResult,
      },
      events: [
        ...events,
        { type: 'GAME_OVER', payload: { result: winResult } },
      ],
    };
  }

  return advance(afterCombat, events);
}

/**
 * Pass turn — counts toward draw condition.
 */
export function applyPass(state: GameState, action: PassTurnAction): ActionResult {
  const player = state.players[action.playerId];
  const newState: GameState = {
    ...state,
    noActionTurnCount: state.noActionTurnCount + 1,
    actionLog: [
      ...state.actionLog,
      `[R${state.round}] ${player?.name ?? action.playerId}: Passed`,
    ],
  };

  // Check for draw on pass
  const winResult = checkWinConditions(newState);
  if (winResult) {
    return {
      success: true,
      newState: { ...newState, phase: 'gameover', result: winResult },
      events: [{ type: 'GAME_OVER', payload: { result: winResult } }],
    };
  }

  return advance(newState, []);
}

// ─── Turn advancement ─────────────────────────────────────────────────────────

/**
 * Advance to the next player's turn, updating round counters.
 *
 * Clears all per-turn flags:
 * - tempAttackBonus / tempDefenseBonus on all heroes
 * - kairosActionAvailable
 * - droughtActive
 * - cannotPlayAbilityCards (set by Hindra for the NEXT player's turn, so clear the
 *   flag on the player who is about to start their turn)
 * - preventionActive (Prevention blocks until start of YOUR next turn)
 * - protectedHeroIds (Protect lasts until end of YOUR next turn)
 */
export function advance(state: GameState, events: GameEvent[]): ActionResult {
  // If Kairos action is available, the turn has NOT ended yet — return without advancing
  if (state.kairosActionAvailable) {
    return {
      success: true,
      newState: { ...state, kairosActionAvailable: false },
      events,
    };
  }

  const currentIdx = state.turnOrder.indexOf(state.currentPlayerId);
  const nextIdx = (currentIdx + 1) % state.turnOrder.length;
  const nextPlayerId = state.turnOrder[nextIdx]!;

  // Completed a full round when we wrap back to the first player
  const completedRound = nextIdx === 0;
  const newRound = completedRound ? state.round + 1 : state.round;

  // Clear temp bonuses and per-turn state for the player who just acted
  let newState = clearTurnState(state, state.currentPlayerId);

  if (completedRound) {
    newState = updateNoHeroesCounts(newState);
  }

  // Clear per-turn flags for the NEXT player (effects that expire at start of their turn)
  const nextPlayer = newState.players[nextPlayerId];
  if (nextPlayer) {
    newState = updatePlayer(newState, nextPlayerId, {
      cannotPlayAbilityCards: false,  // Hindra effect expires
      droughtActive: false,           // Drought expires
      preventionActive: false,        // Prevention expires
      protectedHeroIds: [],           // Protect expires at end of their next turn
    });
  }

  newState = {
    ...newState,
    currentPlayerId: nextPlayerId,
    round: newRound,
    activeTurnAction: null,
    kairosActionAvailable: false,
  };

  events.push({ type: 'TURN_ENDED', payload: { playerId: state.currentPlayerId } });
  events.push({ type: 'TURN_STARTED', payload: { playerId: nextPlayerId, round: newRound } });

  return { success: true, newState, events };
}

/** Clear temporary buffs/debuffs applied during the current player's turn */
function clearTurnState(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  if (!player) return state;

  const clearedArena = player.arena.map((hero) => ({
    ...hero,
    tempAttackBonus: 0,
    tempDefenseBonus: 0,
  }));

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, arena: clearedArena },
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fail(state: GameState, error: string): ActionResult {
  return { success: false, error, newState: state, events: [] };
}
