import type { GameState, ActionResult } from '../types/game';
import type { GameAction } from '../types/actions';
import type { AbilityCard } from '../types/cards';
import { applyHeal, applyEnhance, applyRecruit, applyOvercome, applyPass } from './phases';
import {
  applyAbilityCardEffect,
  applyHeroicFeatEffect,
  applyHeroActiveAbility,
  checkAndResolveDrought,
  updatePlayer,
} from './abilities';

// ─────────────────────────────────────────────────────────────────────────────
// Central action dispatcher — the engine's public mutation API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a player action to the current game state.
 * This is the single entry point for all state mutations during gameplay.
 * The server should call this and broadcast the resulting state.
 */
export function applyAction(state: GameState, action: GameAction): ActionResult {
  // Guard: game must be in gameplay phase
  if (state.phase !== 'gameplay') {
    return fail(state, `Cannot apply actions during phase: ${state.phase}`);
  }

  // Guard: only the current player can act
  if (state.currentPlayerId !== action.playerId) {
    return fail(state, `It is not ${action.playerId}'s turn`);
  }

  // Guard: player must exist and not be eliminated
  const player = state.players[action.playerId];
  if (!player) return fail(state, 'Player not found');
  if (player.isEliminated) return fail(state, 'Player is eliminated');

  // Guard: a HERO action has already been chosen this turn
  // (Only PLAY_CARD and USE_HEROIC_FEAT are valid as follow-up sub-actions within a turn,
  //  UNLESS Kairos granted an additional free HERO action.)
  const isMainAction =
    action.type === 'HEAL' ||
    action.type === 'ENHANCE' ||
    action.type === 'RECRUIT' ||
    action.type === 'OVERCOME';

  if (isMainAction && state.activeTurnAction !== null) {
    // Kairos exception: allow one additional non-Overcome HERO action
    if (state.kairosActionAvailable && action.type !== 'OVERCOME') {
      // Clear the Kairos flag before processing (advance() will not see it)
      const stateWithoutKairos = { ...state, kairosActionAvailable: false };
      return dispatchMainAction(stateWithoutKairos, action);
    }
    return fail(state, 'A HERO action has already been chosen for this turn');
  }

  return dispatchMainAction(state, action);
}

function dispatchMainAction(state: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'HEAL':
      return applyHeal(state, action);

    case 'ENHANCE':
      return applyEnhance(state, action);

    case 'RECRUIT':
      return applyRecruit(state, action);

    case 'OVERCOME':
      return applyOvercome(state, action);

    case 'PLAY_CARD':
      return applyPlayCard(state, action.playerId, action.cardId, action.targetId, action.secondaryTargetId);

    case 'USE_HEROIC_FEAT':
      return applyHeroicFeat(state, action.playerId, action.featCardId, action.targetId, action.secondaryTargetId);

    case 'PASS_TURN':
      return applyPass(state, action);

    default:
      return fail(state, 'Unknown action type');
  }
}

// ─── Sub-action handlers ──────────────────────────────────────────────────────

function applyPlayCard(
  state: GameState,
  playerId: string,
  cardId: string,
  targetId?: string,
  secondaryTargetId?: string,
): ActionResult {
  const player = state.players[playerId];
  if (!player) return fail(state, 'Player not found');

  // Hindra: check if player is blocked from playing ability cards
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return fail(state, `Card ${cardId} not in hand`);

  if (card.type === 'ability') {
    const abilityCard = card as AbilityCard;
    if (player.cannotPlayAbilityCards && abilityCard.abilityType === 'P') {
      return fail(state, 'Hindra: Lockdown — cannot play Ability Cards to field this turn');
    }
  }

  // Heroic feat H-type ability cards replace the entire turn (handled via USE_HEROIC_FEAT)
  // If played directly as a PLAY_CARD action, we handle them here too.
  const { newState, events, cardHandled } = applyAbilityCardEffect(
    state, playerId, cardId, targetId, secondaryTargetId,
  );

  if (cardHandled) {
    // Card was already moved to field inside applyAbilityCardEffect (passive card)
    return { success: true, newState, events };
  }

  // Active/H cards go to discard — remove from hand and add to discard
  const updatedPlayer = newState.players[playerId];
  if (!updatedPlayer) return fail(state, 'Player state corrupted');

  const removedCard = updatedPlayer.hand.find((c) => c.id === cardId) ?? card;
  return {
    success: true,
    newState: {
      ...newState,
      players: {
        ...newState.players,
        [playerId]: {
          ...updatedPlayer,
          hand: updatedPlayer.hand.filter((c) => c.id !== cardId),
          discardPile: [...updatedPlayer.discardPile, removedCard],
        },
      },
    },
    events,
  };
}

function applyHeroicFeat(
  state: GameState,
  playerId: string,
  featCardId: string,
  targetId?: string,
  secondaryTargetId?: string,
): ActionResult {
  const player = state.players[playerId];
  if (!player) return fail(state, 'Player not found');

  const feat = player.heroicFeats.find((f) => f.id === featCardId);
  if (!feat) return fail(state, `Heroic Feat ${featCardId} not available`);

  // Drought: check if any player can nullify this heroic ability
  const { newState: postDrought, events: droughtEvents, nullified } = checkAndResolveDrought(
    state, playerId,
  );
  if (nullified) {
    // Feat was nullified — remove it from hand anyway (used but nullified)
    const newHeroicFeats = player.heroicFeats.filter((f) => f.id !== featCardId);
    return {
      success: true,
      newState: updatePlayer(postDrought, playerId, { heroicFeats: newHeroicFeats }),
      events: droughtEvents,
    };
  }

  // Remove the feat from the player's available feats
  const newHeroicFeats = player.heroicFeats.filter((f) => f.id !== featCardId);
  let newState = updatePlayer(state, playerId, { heroicFeats: newHeroicFeats });

  // Apply the heroic feat effect
  const { newState: afterFeat, events: featEvents } = applyHeroicFeatEffect(
    newState, playerId, feat.featName, targetId, secondaryTargetId,
  );
  newState = afterFeat;

  newState = {
    ...newState,
    actionLog: [
      ...newState.actionLog,
      `[R${newState.round}] ${player.name}: Used Heroic Feat — ${feat.featName}`,
    ],
  };

  return {
    success: true,
    newState,
    events: [
      ...droughtEvents,
      ...featEvents,
      { type: 'HEROIC_FEAT_USED', payload: { featName: feat.featName, playerId, targetId } },
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fail(state: GameState, error: string): ActionResult {
  return { success: false, error, newState: state, events: [] };
}

// ─── Read-only helpers ────────────────────────────────────────────────────────

/**
 * Build a sanitized view of the game state for a specific player.
 * Hides opponent hand contents.
 */
export function getPlayerView(state: GameState, viewingPlayerId: string): GameState {
  const sanitizedPlayers = Object.fromEntries(
    Object.entries(state.players).map(([id, player]) => {
      if (id === viewingPlayerId) return [id, player];
      // Hide opponent's hand — preserve structure but blank card info
      return [id, {
        ...player,
        hand: player.hand.map((c) => ({ ...c, id: 'hidden', name: '?' })),
      }];
    }),
  );

  return { ...state, players: sanitizedPlayers };
}
