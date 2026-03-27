import type { GameState, GameEvent, CombatResult } from '../types/game';
import type { TriggerEvent, AbilityCard, AbilityCardName } from '../types/cards';
import type { ArenaHero, PlayerState } from '../types/player';
import { drawCards, shuffleDeck } from './deck';

// ─────────────────────────────────────────────────────────────────────────────
// Ability processing — passive triggers, active card effects, heroic feats,
// and dynamic stat computation.
// ─────────────────────────────────────────────────────────────────────────────

export interface AbilityContext {
  /** The player whose action triggered the event */
  actingPlayerId: string;
  /** The hero involved in the triggering event (if any) */
  heroInstanceId?: string;
  /** The opposing player (if applicable) */
  targetPlayerId?: string;
  /** The secondary target hero (for abilities requiring two hero targets) */
  targetHeroInstanceId?: string;
  /** Extra numeric value (e.g., damage amount, ATK value) */
  value?: number;
  /** Full combat result, available in post-combat triggers */
  combatResult?: CombatResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic stat computation — called during combat instead of simple field access
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a hero's effective attack value including:
 * - Base attack + stat card bonuses + temp bonus
 * - Passive ability card bonuses (Bolster, Reinforcement)
 * - Hero passive bonuses (Grit, Zhao)
 */
export function computeHeroAttack(
  hero: ArenaHero,
  player: PlayerState,
  state: GameState,
): number {
  // Base: stat card ATT bonuses + temp bonus
  const statBonus = hero.appliedStatCards
    .filter((c) => c.statType === 'ATT')
    .reduce((s, c) => s + c.value, 0);
  let atk = hero.heroCard.attack + statBonus + hero.tempAttackBonus;

  // Bolster (P): +10 per strengthened (non-fatigued) hero on field
  if (hasFieldAbility(hero, 'Bolster')) {
    const strengthened = countStrengthenedHeroes(player);
    atk += strengthened * 10;
  }

  // Reinforcement (P): +10 per card in hand
  if (hasFieldAbility(hero, 'Reinforcement')) {
    atk += player.hand.length * 10;
  }

  // Grit hero passive: +20 per fatigued hero on field (both sides)
  if (hero.heroCard.heroName === 'Grit') {
    const fatigued = countAllFatiguedHeroesOnField(state);
    atk += fatigued * 20;
  }

  // Zhao hero passive: all allied heroes gain +10 attack while Zhao is in arena
  if (isHeroInArena(player, 'Zhao')) {
    atk += 10;
  }

  return atk;
}

/**
 * Compute a hero's effective defense value including:
 * - Base defense + stat card bonuses + temp bonus
 * - Fatigued defense halving (if defending while fatigued)
 * - Passive ability card bonuses (Fortification, Hardened, Shielding, Counter-Measures)
 * - Hero passive bonuses (Boulos, Izumi)
 * - Post-halve bonuses for fatigued heroes (Shielding, Izumi)
 *
 * @param isDefending       - true when this hero is currently being attacked
 * @param opponentPlayer    - the attacker's PlayerState (needed for Hardened, Counter-Measures)
 * @param attackers         - attacker ArenaHero list (needed for Counter-Measures)
 */
export function computeHeroDefense(
  hero: ArenaHero,
  player: PlayerState,
  state: GameState,
  isDefending = false,
  opponentPlayer?: PlayerState,
  attackers: ArenaHero[] = [],
): number {
  const statBonus = hero.appliedStatCards
    .filter((c) => c.statType === 'DEF')
    .reduce((s, c) => s + c.value, 0);
  const rawBase = hero.heroCard.defense + statBonus + hero.tempDefenseBonus;

  // Pre-halve additions (Fortification, Hardened, Boulos)
  let preHalve = rawBase;

  // Fortification (P): +10 per hero on field (all sides)
  if (hasFieldAbility(hero, 'Fortification')) {
    const allHeroes = countAllHeroesOnField(state);
    preHalve += allHeroes * 10;
  }

  // Hardened (P): +10 per opposing card on field (heroes + their stat + ability cards)
  if (hasFieldAbility(hero, 'Hardened') && opponentPlayer) {
    preHalve += countOpponentCards(opponentPlayer) * 10;
  }

  // Counter-Measures (P): when attacked, add base defense of all attackers (no enhancements)
  if (hasFieldAbility(hero, 'Counter-Measures') && isDefending && attackers.length > 0) {
    const attackerBaseDef = attackers.reduce((s, a) => s + a.heroCard.defense, 0);
    preHalve += attackerBaseDef;
  }

  // Boulos hero passive: +10 per card in hand
  if (hero.heroCard.heroName === 'Boulos') {
    preHalve += player.hand.length * 10;
  }

  // Halve if defending while fatigued
  const afterHalve = isDefending && hero.fatigued
    ? Math.floor(preHalve / 2)
    : preHalve;

  // Post-halve additions (Shielding, Izumi)
  let postHalve = afterHalve;

  // Shielding (P): if fatigued, +20 per strengthened ally (applied AFTER halving)
  if (hasFieldAbility(hero, 'Shielding') && hero.fatigued) {
    const strengthenedAllies = player.arena.filter(
      (h) => !h.fatigued && h.instanceId !== hero.instanceId,
    ).length;
    postHalve += strengthenedAllies * 20;
  }

  // Izumi hero passive: allied heroes gain +20 defense while Izumi is in arena
  // For fatigued heroes this applies AFTER halving
  if (isHeroInArena(player, 'Izumi')) {
    postHalve += 20;
  }

  return postHalve;
}

// ─────────────────────────────────────────────────────────────────────────────
// Passive hero ability triggers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan all arena heroes for passive abilities that respond to `event`
 * and apply their effects to the state.
 *
 * Resolution order:
 * 1. "Must use" abilities fire before optional ones.
 * 2. Within the same priority, resolve in announced order.
 * 3. Abilities that fire post-combat still fire even if the hero was defeated.
 */
export function processAbilities(
  state: GameState,
  event: TriggerEvent,
  context: AbilityContext,
): { newState: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;

  // Gambito fires on `on_fatigue` globally — handled inline in fatigueHeroes (combat.ts)
  // Here we handle all other hero passives.

  for (const [playerId, player] of Object.entries(state.players)) {
    // Check arena heroes. Also check defeatedHeroes for abilities that explicitly
    // fire even after the hero is defeated (e.g. Christoph, Yasmine, Zhao P2).
    const heroesToCheck = [...player.arena, ...player.defeatedHeroes];

    for (const hero of heroesToCheck) {
      const ability = hero.heroCard.ability;
      if (ability.abilityType !== 'P') continue;
      if (ability.triggerEvent !== event) continue;

      const result = applyPassiveAbility(newState, playerId, player, hero, context);
      newState = result.newState;
      events.push(...result.events);
    }
  }

  return { newState, events };
}

/**
 * Apply a single hero passive ability effect.
 *
 * `player` is the owner of `hero`. `context` carries details about what triggered
 * the event (acting player, which hero, target, numeric value, etc.).
 */
function applyPassiveAbility(
  state: GameState,
  playerId: string,
  player: PlayerState,
  hero: ArenaHero,
  context: AbilityContext,
): { newState: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;

  switch (hero.heroCard.heroName) {
    // ── Akio ─────────────────────────────────────────────────────────────────
    // Passive (on_fatigue_enemy): When Akio causes another hero to be fatigued,
    // Akio is not fatigued.
    case 'Akio': {
      // Only fires when Akio is in the acting player's team (the one who attacked)
      if (playerId !== context.actingPlayerId) break;
      // Un-fatigue Akio after he participated in combat that caused enemy fatigue
      const newArena = player.arena.map((h) =>
        h.instanceId === hero.instanceId ? { ...h, fatigued: false } : h,
      );
      newState = setPlayerArena(newState, playerId, newArena);
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Akio',
          abilityName: 'Unchecked',
          playerId,
          description: 'Akio was not fatigued after causing enemy fatigue',
        },
      });
      break;
    }

    // ── Ayumi ────────────────────────────────────────────────────────────────
    // Passive (on_recruit): Whenever a hero is recruited, draw a card.
    case 'Ayumi': {
      if (!player.arena.some((h) => h.heroCard.heroName === 'Ayumi')) break;
      const { drawn, deck, discard } = drawCards(
        player.enhancementDeck, player.discardPile, 1,
      );
      if (drawn.length > 0) {
        newState = updatePlayer(newState, playerId, {
          enhancementDeck: deck,
          discardPile: discard,
          hand: [...player.hand, ...drawn],
        });
        events.push({
          type: 'ABILITY_TRIGGERED',
          payload: {
            heroName: 'Ayumi',
            abilityName: 'Endless Support',
            playerId,
            description: 'Ayumi drew a card due to a hero being recruited',
          },
        });
      }
      break;
    }

    // ── Boulos ───────────────────────────────────────────────────────────────
    // Passive (on_defend): For each card in hand, Boulos gains +10 defense.
    // Defense is dynamically computed via computeHeroDefense — no state mutation needed.
    // This case just emits the trigger event for the log.
    case 'Boulos': {
      if (context.heroInstanceId !== hero.instanceId) break;
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Boulos',
          abilityName: 'Fortified',
          playerId,
          bonus: player.hand.length * 10,
          description: `Boulos gains +${player.hand.length * 10} DEF from ${player.hand.length} cards in hand`,
        },
      });
      break;
    }

    // ── Christoph ────────────────────────────────────────────────────────────
    // Passive (on_defend): When attack against Christoph is resolved, choose one
    // attacking hero to be defeated (even if Christoph is also defeated).
    case 'Christoph': {
      if (context.heroInstanceId !== hero.instanceId) break;
      const chosenAttackerId = context.targetHeroInstanceId;
      if (!chosenAttackerId) break;
      const attackerPlayerId = context.actingPlayerId;
      const attackerPlayer = newState.players[attackerPlayerId];
      if (!attackerPlayer) break;
      const attackerHero = attackerPlayer.arena.find((h) => h.instanceId === chosenAttackerId);
      if (!attackerHero) break;

      // Defeat the chosen attacker
      newState = defeatHeroInstance(newState, attackerPlayerId, chosenAttackerId);
      events.push({
        type: 'HERO_DEFEATED',
        payload: {
          heroInstanceId: chosenAttackerId,
          heroName: attackerHero.heroCard.heroName,
          playerId: attackerPlayerId,
          reason: 'Christoph: Measured Response',
        },
      });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Christoph',
          abilityName: 'Measured Response',
          playerId,
          description: `Christoph defeated ${attackerHero.heroCard.heroName} in response`,
        },
      });
      break;
    }

    // ── Gambito ──────────────────────────────────────────────────────────────
    // Passive (on_fatigue): When ANY hero is fatigued, ALL players discard random card.
    // Handled directly in combat.ts fatigueHeroes — not processed here.
    case 'Gambito':
      break;

    // ── Grit ─────────────────────────────────────────────────────────────────
    // Passive: +20 attack for every fatigued hero on field.
    // Dynamically computed via computeHeroAttack — no state mutation needed.
    case 'Grit':
      break;

    // ── Isaac ────────────────────────────────────────────────────────────────
    // Passive (on_defeat_ally): When another hero is defeated, draw a card from
    // your Discard Pile that was there before the defeat.
    case 'Isaac': {
      if (!player.arena.some((h) => h.heroCard.heroName === 'Isaac')) break;
      // Do not trigger if Isaac himself is the defeated hero
      if (context.heroInstanceId === hero.instanceId) break;
      if (player.discardPile.length === 0) break;

      // Draw top card of discard pile (LIFO — cards added most recently are last)
      const card = player.discardPile[player.discardPile.length - 1]!;
      const newDiscard = player.discardPile.slice(0, -1);
      newState = updatePlayer(newState, playerId, {
        discardPile: newDiscard,
        hand: [...player.hand, card],
      });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Isaac',
          abilityName: 'Scavenger',
          playerId,
          description: 'Isaac drew a card from the Discard Pile',
        },
      });
      break;
    }

    // ── Izumi ────────────────────────────────────────────────────────────────
    // Passive (on_defend): Allied heroes gain +20 defense; post-halve for fatigued.
    // Dynamically computed via computeHeroDefense — only emit event here.
    case 'Izumi': {
      if (context.heroInstanceId !== hero.instanceId) break;
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Izumi',
          abilityName: 'Guardian Aura',
          playerId,
          description: 'Izumi\'s aura grants +20 DEF to allied heroes',
        },
      });
      break;
    }

    // ── Mace ─────────────────────────────────────────────────────────────────
    // Passive (on_attack): May double Total Attack for one attack.
    // Handled in combat.ts via context.value flag — emit event here.
    case 'Mace': {
      if (playerId !== context.actingPlayerId) break;
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Mace',
          abilityName: 'Overwhelming Force',
          playerId,
          description: 'Mace activated Overwhelming Force — Total Attack doubled',
        },
      });
      break;
    }

    // ── Origin ───────────────────────────────────────────────────────────────
    // Passive (on_combat_start): May block one attack declared against Origin.
    // Checked in combat.ts before resolving combat — emit event here.
    case 'Origin': {
      if (context.heroInstanceId !== hero.instanceId) break;
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Origin',
          abilityName: 'Ancient Ward',
          playerId,
          description: 'Origin blocked the attack against them',
        },
      });
      break;
    }

    // ── Yasmine ──────────────────────────────────────────────────────────────
    // Passive (on_defend): When attack against Yasmine is resolved, play a card
    // to the field from hand (whether defeated or not).
    // The card to play is specified via context.targetHeroInstanceId (card ID).
    case 'Yasmine': {
      if (context.heroInstanceId !== hero.instanceId) break;
      const cardId = context.targetHeroInstanceId; // reused field: card ID to play
      if (!cardId) break;

      const currentPlayer = newState.players[playerId];
      if (!currentPlayer) break;
      const card = currentPlayer.hand.find((c) => c.id === cardId);
      if (!card || card.type !== 'ability') break;
      const abilityCard = card as AbilityCard;
      if (abilityCard.abilityType !== 'P') break; // Only passive cards go to field

      // Find the target hero to attach to — use first arena hero as default
      const attachHero = currentPlayer.arena[0];
      if (!attachHero) break;

      newState = attachAbilityCardToHero(newState, playerId, attachHero.instanceId, abilityCard);
      const newHand = newState.players[playerId]!.hand.filter((c) => c.id !== cardId);
      newState = updatePlayer(newState, playerId, { hand: newHand });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Yasmine',
          abilityName: 'Opportunist',
          playerId,
          cardName: card.name,
          description: 'Yasmine played a card to the field after being attacked',
        },
      });
      break;
    }

    // ── Zhao ─────────────────────────────────────────────────────────────────
    // P1 (on_attack): All allied heroes gain +10 attack — computed dynamically.
    // P2: When Zhao is defeated or removed, play a card from hand to field.
    case 'Zhao': {
      // P2: trigger when Zhao is the defeated hero (context.heroInstanceId = Zhao's id)
      if (context.heroInstanceId === hero.instanceId) {
        const cardId = context.targetHeroInstanceId; // card to play
        const currentPlayer = newState.players[playerId];
        if (cardId && currentPlayer) {
          const card = currentPlayer.hand.find((c) => c.id === cardId);
          if (card && card.type === 'ability') {
            const abilityCard = card as AbilityCard;
            if (abilityCard.abilityType === 'P') {
              const attachTarget = currentPlayer.arena[0];
              if (attachTarget) {
                newState = attachAbilityCardToHero(
                  newState, playerId, attachTarget.instanceId, abilityCard,
                );
                const newHand = newState.players[playerId]!.hand.filter((c) => c.id !== cardId);
                newState = updatePlayer(newState, playerId, { hand: newHand });
              }
            }
            events.push({
              type: 'ABILITY_TRIGGERED',
              payload: {
                heroName: 'Zhao',
                abilityName: 'War Banner',
                playerId,
                description: 'Zhao played a card to the field upon being defeated',
              },
            });
          }
        }
      }
      break;
    }

    default:
      break;
  }

  return { newState, events };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gambito — global fatigue trigger (called from combat.ts fatigueHeroes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When ANY hero is fatigued, if Gambito is in the arena of any player,
 * ALL players must discard a random card from hand.
 *
 * "Must be used" — this fires unconditionally.
 * If Gambito is defeated, does NOT trigger for the attacking heroes (they fatigue
 * after the combat outcome, by which point Gambito is already removed).
 */
export function processGambitoEffect(
  state: GameState,
  gambitoIsAlive: boolean,
): { newState: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;

  if (!gambitoIsAlive) return { newState, events };

  // Find if any player has Gambito in their arena
  const gambitoPlayer = Object.values(state.players).find((p) =>
    p.arena.some((h) => h.heroCard.heroName === 'Gambito'),
  );
  if (!gambitoPlayer) return { newState, events };

  // All players discard one random card
  for (const [pid, player] of Object.entries(newState.players)) {
    if (player.hand.length === 0) continue;
    const idx = Math.floor(Math.random() * player.hand.length);
    const card = player.hand[idx]!;
    const newHand = player.hand.filter((_, i) => i !== idx);
    newState = updatePlayer(newState, pid, {
      hand: newHand,
      discardPile: [...player.discardPile, card],
    });
    events.push({
      type: 'CARDS_DISCARDED',
      payload: {
        playerId: pid,
        cardId: card.id,
        cardName: card.name,
        reason: 'Gambito: High Stakes',
      },
    });
  }

  events.push({
    type: 'ABILITY_TRIGGERED',
    payload: {
      heroName: 'Gambito',
      abilityName: 'High Stakes',
      description: 'All players discarded a random card due to Gambito',
    },
  });

  return { newState, events };
}

// ─────────────────────────────────────────────────────────────────────────────
// Active ability card effects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve an active ability card played from a player's hand.
 *
 * For Active (A) cards: applies effect immediately; card goes to discard (handled
 * by the caller in gameState.ts).
 *
 * For Passive (P) cards: moves the card from hand to a hero's fieldAbilityCards.
 * The `targetId` must be the hero instance ID to attach to.
 *
 * For Heroic Feat (H) cards: delegates to applyHeroicFeatEffect.
 *
 * Returns `cardHandled: true` if the card was moved to field (passive) so the
 * caller knows NOT to additionally move it to the discard pile.
 */
export function applyAbilityCardEffect(
  state: GameState,
  playerId: string,
  cardId: string,
  targetId?: string,
  secondaryTargetId?: string,
): { newState: GameState; events: GameEvent[]; cardHandled: boolean } {
  const events: GameEvent[] = [];
  let newState = state;
  const player = state.players[playerId];
  if (!player) return { newState, events, cardHandled: false };

  // Check Drought: if active, this player cannot use any abilities
  if (player.droughtActive) {
    events.push({
      type: 'ABILITY_NULLIFIED',
      payload: { playerId, reason: 'Drought active — no abilities may be used this turn' },
    });
    return { newState, events, cardHandled: false };
  }

  const card = player.hand.find((c) => c.id === cardId);
  if (!card || card.type !== 'ability') return { newState, events, cardHandled: false };

  const abilityCard = card as AbilityCard;

  // ── Passive (P): play to field attached to a hero ────────────────────────
  if (abilityCard.abilityType === 'P') {
    if (!targetId) return { newState, events, cardHandled: false };
    // Verify the target hero belongs to this player's arena
    const targetHero = player.arena.find((h) => h.instanceId === targetId);
    if (!targetHero) return { newState, events, cardHandled: false };

    newState = attachAbilityCardToHero(newState, playerId, targetId, abilityCard);
    // Remove from hand
    const updatedPlayer = newState.players[playerId]!;
    newState = updatePlayer(newState, playerId, {
      hand: updatedPlayer.hand.filter((c) => c.id !== cardId),
    });

    events.push({
      type: 'CARD_PLAYED',
      payload: {
        cardId,
        cardName: abilityCard.name,
        playerId,
        targetId,
        placement: 'field',
        targetHeroName: targetHero.heroCard.heroName,
      },
    });
    return { newState, events, cardHandled: true };
  }

  // ── Heroic Feat (H): replace entire turn ─────────────────────────────────
  if (abilityCard.abilityType === 'H') {
    const featResult = applyHeroicFeatCardEffect(
      newState, playerId, abilityCard.cardName, targetId, secondaryTargetId,
    );
    events.push(...featResult.events);
    events.push({
      type: 'CARD_PLAYED',
      payload: { cardId, cardName: abilityCard.name, playerId, targetId, placement: 'discard' },
    });
    return { newState: featResult.newState, events, cardHandled: false };
  }

  // ── Active (A): apply immediate effect ───────────────────────────────────
  switch (abilityCard.cardName) {

    // Accelerate: target player draws 3 cards, then discards 2 from hand
    case 'Accelerate': {
      const tId = targetId ?? playerId;
      const tPlayer = newState.players[tId];
      if (!tPlayer) break;
      const { drawn, deck, discard } = drawCards(
        tPlayer.enhancementDeck, tPlayer.discardPile, 3,
      );
      const newHand = [...tPlayer.hand, ...drawn];
      // Auto-discard last 2 cards from hand (player should specify via targetId in real UI)
      const discarded = newHand.splice(-2);
      newState = updatePlayer(newState, tId, {
        enhancementDeck: deck,
        discardPile: [...discard, ...discarded],
        hand: newHand,
      });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          cardName: 'Accelerate',
          playerId,
          targetPlayerId: tId,
          drawnCount: drawn.length,
          discardedCount: discarded.length,
        },
      });
      break;
    }

    // Backfire: reveal opponent's field abilities; use one as your own
    case 'Backfire': {
      const oppId = targetId;
      if (!oppId) break;
      const opp = newState.players[oppId];
      if (!opp) break;

      // Collect all active ability cards on the opponent's field
      const fieldAbilities = opp.arena.flatMap((h) =>
        h.fieldAbilityCards.filter((c) => c.abilityType === 'A'),
      );

      // Use first active ability found (or the one specified via secondaryTargetId)
      const toUse = secondaryTargetId
        ? fieldAbilities.find((c) => c.id === secondaryTargetId)
        : fieldAbilities[0];

      if (toUse) {
        // Apply the chosen ability effect as if it were ours (targetId now points to our hero)
        const innerResult = applyAbilityCardEffect(
          newState, playerId, toUse.id, secondaryTargetId,
        );
        newState = innerResult.newState;
        events.push(...innerResult.events);
      }

      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          cardName: 'Backfire',
          playerId,
          targetPlayerId: oppId,
          revealedAbilities: fieldAbilities.map((c) => c.name),
          usedAbility: toUse?.name ?? null,
        },
      });
      break;
    }

    // Boost: discard 2 cards from hand; target player draws 1 per hero on field
    case 'Boost': {
      const currentHand = [...player.hand.filter((c) => c.id !== cardId)];
      if (currentHand.length < 2) break;
      const toDiscard = currentHand.slice(-2);
      const newHand = currentHand.slice(0, -2);

      const tId = targetId ?? playerId;
      const tPlayer = newState.players[tId];
      if (!tPlayer) break;

      const heroCount = countAllHeroesOnField(newState);
      const { drawn, deck, discard: discardPile } = drawCards(
        tPlayer.enhancementDeck, tPlayer.discardPile, heroCount,
      );

      // Apply own discard first
      newState = updatePlayer(newState, playerId, {
        hand: newHand,
        discardPile: [...player.discardPile, ...toDiscard],
      });
      // Apply target player draw
      const updatedTarget = newState.players[tId]!;
      newState = updatePlayer(newState, tId, {
        enhancementDeck: deck,
        discardPile: discardPile,
        hand: [...updatedTarget.hand, ...drawn],
      });

      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          cardName: 'Boost',
          playerId,
          targetPlayerId: tId,
          discardedCount: 2,
          drawnCount: drawn.length,
          description: `${tPlayer.name} draws ${drawn.length} cards (1 per hero on field)`,
        },
      });
      break;
    }

    // Kairos: grant an extra HERO action this turn (non-Overcome)
    case 'Kairos': {
      newState = { ...newState, kairosActionAvailable: true };
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          cardName: 'Kairos',
          playerId,
          description: 'Kairos grants an additional HERO action (non-Overcome) this turn',
        },
      });
      break;
    }

    // Reduction: fatigue one of your strengthened heroes; target player discards 2 random
    case 'Reduction': {
      const ownHeroId = targetId;
      const tPlayerId = secondaryTargetId ?? findOpponentId(state, playerId);
      if (!ownHeroId || !tPlayerId) break;

      const ownHero = player.arena.find(
        (h) => h.instanceId === ownHeroId && !h.fatigued,
      );
      if (!ownHero) break;

      // Fatigue own hero
      newState = fatigueHeroInstance(newState, playerId, ownHeroId);

      // Target player discards 2 random cards
      const tPlayer = newState.players[tPlayerId];
      if (tPlayer && tPlayer.hand.length > 0) {
        const shuffled = shuffleDeck([...tPlayer.hand]);
        const discardCount = Math.min(2, shuffled.length);
        const toDiscard = shuffled.slice(0, discardCount);
        const remaining = tPlayer.hand.filter((c) => !toDiscard.includes(c));
        newState = updatePlayer(newState, tPlayerId, {
          hand: remaining,
          discardPile: [...tPlayer.discardPile, ...toDiscard],
        });
        events.push({
          type: 'CARDS_DISCARDED',
          payload: {
            playerId: tPlayerId,
            count: discardCount,
            reason: 'Reduction',
          },
        });
      }

      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          cardName: 'Reduction',
          playerId,
          fatiguedHeroId: ownHeroId,
          targetPlayerId: tPlayerId,
        },
      });
      break;
    }

    // Revelation: view opponent's hand; discard one card from it
    case 'Revelation': {
      const oppId = targetId ?? findOpponentId(state, playerId);
      if (!oppId) break;
      const opp = newState.players[oppId];
      if (!opp || opp.hand.length === 0) break;

      // secondaryTargetId = card ID to discard from opponent's hand
      const cardToDiscardId = secondaryTargetId;
      if (cardToDiscardId) {
        const cardToDiscard = opp.hand.find((c) => c.id === cardToDiscardId);
        if (cardToDiscard) {
          newState = updatePlayer(newState, oppId, {
            hand: opp.hand.filter((c) => c.id !== cardToDiscardId),
            discardPile: [...opp.discardPile, cardToDiscard],
          });
          events.push({
            type: 'CARDS_DISCARDED',
            payload: {
              playerId: oppId,
              cardId: cardToDiscardId,
              cardName: cardToDiscard.name,
              reason: 'Revelation',
            },
          });
        }
      }

      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          cardName: 'Revelation',
          playerId,
          targetPlayerId: oppId,
          // Opponent's hand contents revealed to acting player (client handles display)
          revealedCards: opp.hand.map((c) => ({ id: c.id, name: c.name })),
        },
      });
      break;
    }

    default:
      break;
  }

  events.push({
    type: 'CARD_PLAYED',
    payload: { cardId, cardName: abilityCard.name, playerId, targetId, placement: 'discard' },
  });

  return { newState, events, cardHandled: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Heroic feat card effects (H-type AbilityCards in enhancement deck)
// ─────────────────────────────────────────────────────────────────────────────

function applyHeroicFeatCardEffect(
  state: GameState,
  playerId: string,
  featName: string,
  targetId?: string,
  secondaryTargetId?: string,
): { newState: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;
  const player = state.players[playerId];
  if (!player) return { newState, events };

  switch (featName) {

    // Absorb: discard enhancements from one hero, replace with enhancements from another
    case 'Absorb': {
      // targetId = source hero (enhancements are taken FROM here)
      // secondaryTargetId = destination hero (enhancements go TO here)
      const srcId = targetId;
      const dstId = secondaryTargetId;
      if (!srcId || !dstId) break;

      const srcHero = findHeroInAllArenas(newState, srcId);
      const dstHero = findHeroInAllArenas(newState, dstId);
      if (!srcHero || !dstHero) break;

      const srcOwner = findHeroOwner(newState, srcId);
      const dstOwner = findHeroOwner(newState, dstId);
      if (!srcOwner || !dstOwner) break;

      // Move source's field ability cards to discard (stripped)
      const srcAbilities = srcHero.hero.fieldAbilityCards;
      const srcStats = srcHero.hero.appliedStatCards;

      // Set destination's enhancements to source's enhancements
      const newSrcArena = newState.players[srcOwner]!.arena.map((h) =>
        h.instanceId === srcId
          ? { ...h, fieldAbilityCards: [], appliedStatCards: [] }
          : h,
      );
      const newDstArena = newState.players[dstOwner]!.arena.map((h) =>
        h.instanceId === dstId
          ? { ...h, fieldAbilityCards: srcAbilities, appliedStatCards: srcStats }
          : h,
      );

      newState = setPlayerArena(newState, srcOwner, newSrcArena);
      // If dstOwner differs from srcOwner, set separately
      if (srcOwner !== dstOwner) {
        newState = setPlayerArena(newState, dstOwner, newDstArena);
      } else {
        // Need to combine both arena updates for same player
        const combined = newState.players[dstOwner]!.arena.map((h) => {
          if (h.instanceId === dstId) {
            return { ...h, fieldAbilityCards: srcAbilities, appliedStatCards: srcStats };
          }
          return h;
        });
        newState = setPlayerArena(newState, dstOwner, combined);
      }

      // Discard stripped enhancements from source owner
      newState = updatePlayer(newState, srcOwner, {
        discardPile: [
          ...newState.players[srcOwner]!.discardPile,
          ...srcAbilities,
        ],
      });

      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          featName: 'Absorb',
          playerId,
          sourceHeroId: srcId,
          destHeroId: dstId,
          description: `Enhancements moved from ${srcHero.hero.heroCard.heroName} to ${dstHero.hero.heroCard.heroName}`,
        },
      });
      break;
    }

    // Drain: discard ALL of one opponent's enhancement cards from field
    case 'Drain': {
      const oppId = targetId ?? findOpponentId(state, playerId);
      if (!oppId) break;
      const opp = newState.players[oppId];
      if (!opp) break;

      const allFieldAbilities = opp.arena.flatMap((h) => h.fieldAbilityCards);
      const strippedArena = opp.arena.map((h) => ({ ...h, fieldAbilityCards: [] as AbilityCard[] }));
      newState = setPlayerArena(newState, oppId, strippedArena);
      newState = updatePlayer(newState, oppId, {
        discardPile: [...opp.discardPile, ...allFieldAbilities],
      });

      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          featName: 'Drain',
          playerId,
          targetPlayerId: oppId,
          discardedCount: allFieldAbilities.length,
          description: `Drained ${allFieldAbilities.length} enhancement cards from ${opp.name}'s field`,
        },
      });
      break;
    }

    // Pay the Cost: fatigue one of your strengthened heroes to remove one hero from field
    case 'Pay the Cost': {
      const ownHeroId = targetId;
      const removeHeroId = secondaryTargetId;
      if (!ownHeroId || !removeHeroId) break;

      const ownHero = player.arena.find((h) => h.instanceId === ownHeroId && !h.fatigued);
      if (!ownHero) break;

      // Fatigue own hero
      newState = fatigueHeroInstance(newState, playerId, ownHeroId);

      // Find and remove target hero (not defeat — no defeat triggers)
      const removeOwner = findHeroOwner(newState, removeHeroId);
      const removeHeroData = removeOwner
        ? findHeroInAllArenas(newState, removeHeroId)
        : null;

      if (removeOwner && removeHeroData) {
        const ownerPlayer = newState.players[removeOwner]!;
        // Return hero to pool (removal, not defeat)
        const removedHero = { ...removeHeroData.hero, zone: 'pool' as const, fieldAbilityCards: [], appliedStatCards: [] };
        newState = setPlayerArena(
          newState,
          removeOwner,
          ownerPlayer.arena.filter((h) => h.instanceId !== removeHeroId),
        );
        newState = updatePlayer(newState, removeOwner, {
          heroPool: [...newState.players[removeOwner]!.heroPool, removedHero],
        });

        events.push({
          type: 'HERO_REMOVED',
          payload: {
            heroInstanceId: removeHeroId,
            heroName: removeHeroData.hero.heroCard.heroName,
            playerId: removeOwner,
            reason: 'Pay the Cost',
          },
        });

        // Zhao P2: if removed hero is Zhao, trigger Zhao's on_defeat_ally passive
        if (removeHeroData.hero.heroCard.heroName === 'Zhao') {
          const zhaoContext: AbilityContext = {
            actingPlayerId: playerId,
            heroInstanceId: removeHeroId,
          };
          const zhaoResult = processAbilities(newState, 'on_defeat_ally', zhaoContext);
          newState = zhaoResult.newState;
          events.push(...zhaoResult.events);
        }
      }

      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          featName: 'Pay the Cost',
          playerId,
          fatiguedHeroId: ownHeroId,
          removedHeroId: removeHeroId,
        },
      });
      break;
    }

    // Under Siege: target opponent reveals hand; discards all non-hero cards
    case 'Under Siege': {
      const oppId = targetId ?? findOpponentId(state, playerId);
      if (!oppId) break;
      const opp = newState.players[oppId];
      if (!opp) break;

      // In this engine, hero cards live in heroPool/arena, not in hand.
      // "Non-hero cards" here means all enhancement cards (abilities + stats).
      const toDiscard = opp.hand;
      const remaining: typeof opp.hand = [];
      newState = updatePlayer(newState, oppId, {
        hand: remaining,
        discardPile: [...opp.discardPile, ...toDiscard],
      });

      events.push({
        type: 'CARDS_DISCARDED',
        payload: {
          playerId: oppId,
          count: toDiscard.length,
          reason: 'Under Siege',
        },
      });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          featName: 'Under Siege',
          playerId,
          targetPlayerId: oppId,
          discardedCount: toDiscard.length,
          revealedCards: opp.hand.map((c) => ({ id: c.id, name: c.name })),
          description: `${opp.name} discarded ${toDiscard.length} non-hero cards`,
        },
      });
      break;
    }

    default:
      break;
  }

  return { newState, events };
}

// ─────────────────────────────────────────────────────────────────────────────
// Heroic feat card effects (HeroicFeatCard objects in player.heroicFeats)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a HeroicFeat card effect (the powerful once-per-game versions).
 * targetId / secondaryTargetId semantics match the H ability card version.
 */
export function applyHeroicFeatEffect(
  state: GameState,
  playerId: string,
  featName: string,
  targetId?: string,
  secondaryTargetId?: string,
): { newState: GameState; events: GameEvent[] } {
  // Delegate to same implementation — heroic feat effects share logic with H ability cards
  return applyHeroicFeatCardEffect(state, playerId, featName, targetId, secondaryTargetId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Passive card field effects — active during combat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a hero has a given passive ability card on their field.
 */
export function hasFieldAbility(hero: ArenaHero, name: AbilityCardName): boolean {
  return hero.fieldAbilityCards.some((c) => c.cardName === name);
}

/**
 * Resolve Going Nuclear: when a hero with Going Nuclear is attacked,
 * ALL cards on field are removed except SkyBases. Must be used.
 *
 * Returns the cleaned state and the events.
 */
export function resolveGoingNuclear(
  state: GameState,
  defenderPlayerId: string,
  defenderHeroId: string,
): { newState: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;

  const defenderPlayer = state.players[defenderPlayerId];
  if (!defenderPlayer) return { newState, events };

  const defenderHero = defenderPlayer.arena.find((h) => h.instanceId === defenderHeroId);
  if (!defenderHero || !hasFieldAbility(defenderHero, 'Going Nuclear')) {
    return { newState, events };
  }

  // Remove ALL arena heroes from ALL players (they go to pool, not defeated)
  for (const [pid, player] of Object.entries(newState.players)) {
    const heroesReturned = player.arena.map((h) => ({
      ...h,
      zone: 'pool' as const,
      fieldAbilityCards: [] as AbilityCard[],
      appliedStatCards: [],
      fatigued: false,
    }));
    newState = updatePlayer(newState, pid, {
      arena: [],
      heroPool: [...player.heroPool, ...heroesReturned],
    });
    for (const h of player.arena) {
      events.push({
        type: 'HERO_REMOVED',
        payload: {
          heroInstanceId: h.instanceId,
          heroName: h.heroCard.heroName,
          playerId: pid,
          reason: 'Going Nuclear',
        },
      });
    }
  }

  events.push({
    type: 'ABILITY_TRIGGERED',
    payload: {
      cardName: 'Going Nuclear',
      defenderPlayerId,
      defenderHeroId,
      description: 'Going Nuclear: ALL heroes removed from field',
    },
  });

  return { newState, events };
}

/**
 * Resolve Drought when a Heroic Ability is used.
 * Scans all players for a Drought passive on any hero. If found, discard it
 * and nullify the ability; set the affected player's droughtActive flag.
 */
export function checkAndResolveDrought(
  state: GameState,
  affectedPlayerId: string,
): { newState: GameState; events: GameEvent[]; nullified: boolean } {
  const events: GameEvent[] = [];
  let newState = state;

  for (const [droughtOwnerId, droughtOwner] of Object.entries(state.players)) {
    for (const hero of droughtOwner.arena) {
      const droughtIdx = hero.fieldAbilityCards.findIndex((c) => c.cardName === 'Drought');
      if (droughtIdx === -1) continue;

      // Discard the Drought card from the hero's field
      const droughtCard = hero.fieldAbilityCards[droughtIdx]!;
      const newFieldCards = hero.fieldAbilityCards.filter((_, i) => i !== droughtIdx);
      const newArena = droughtOwner.arena.map((h) =>
        h.instanceId === hero.instanceId ? { ...h, fieldAbilityCards: newFieldCards } : h,
      );
      newState = setPlayerArena(newState, droughtOwnerId, newArena);
      newState = updatePlayer(newState, droughtOwnerId, {
        discardPile: [...newState.players[droughtOwnerId]!.discardPile, droughtCard],
      });

      // Set the affected player's droughtActive flag
      newState = updatePlayer(newState, affectedPlayerId, { droughtActive: true });

      events.push({
        type: 'ABILITY_NULLIFIED',
        payload: {
          reason: 'Drought',
          droughtOwnerId,
          affectedPlayerId,
        },
      });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          cardName: 'Drought',
          droughtOwnerId,
          affectedPlayerId,
          description: 'Drought nullified a Heroic Ability',
        },
      });

      return { newState, events, nullified: true };
    }
  }

  return { newState, events, nullified: false };
}

/**
 * Check if an Impede passive is on the field for the current player.
 * If so, they may cancel one Active Ability per opponent turn.
 * Returns whether the ability was blocked.
 */
export function checkImpede(
  state: GameState,
  defendingPlayerId: string,
): boolean {
  const player = state.players[defendingPlayerId];
  if (!player) return false;
  return player.arena.some((h) => hasFieldAbility(h, 'Impede'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero active ability activations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a hero's Active (A) ability effect.
 *
 * Called when the player explicitly activates their hero's ability (outside of
 * the normal HERO action phase — these are additional actions).
 *
 * Returns the updated state, events, and whether the activation succeeded.
 */
export function applyHeroActiveAbility(
  state: GameState,
  playerId: string,
  heroInstanceId: string,
  targetId?: string,
  secondaryTargetId?: string,
): { newState: GameState; events: GameEvent[]; success: boolean } {
  const events: GameEvent[] = [];
  let newState = state;
  const player = state.players[playerId];
  if (!player) return { newState, events, success: false };

  const hero = player.arena.find((h) => h.instanceId === heroInstanceId);
  if (!hero) return { newState, events, success: false };
  if (hero.heroCard.ability.abilityType !== 'A') return { newState, events, success: false };

  if (player.droughtActive) {
    return { newState, events, success: false };
  }

  switch (hero.heroCard.heroName) {

    // ── Eng ────────────────────────────────────────────────────────────────
    // After an Action, heal one hero of choice.
    case 'Eng': {
      const healTarget = targetId;
      if (!healTarget) break;
      const newArena = player.arena.map((h) =>
        h.instanceId === healTarget ? { ...h, fatigued: false } : h,
      );
      newState = setPlayerArena(newState, playerId, newArena);
      events.push({
        type: 'HERO_HEALED',
        payload: { heroInstanceId: healTarget, playerId, reason: 'Eng: Triage' },
      });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: { heroName: 'Eng', abilityName: 'Triage', playerId },
      });
      return { newState, events, success: true };
    }

    // ── Hindra ─────────────────────────────────────────────────────────────
    // Choose one opponent — they cannot play Ability Cards on their next turn.
    case 'Hindra': {
      const oppId = targetId ?? findOpponentId(state, playerId);
      if (!oppId) break;
      newState = updatePlayer(newState, oppId, { cannotPlayAbilityCards: true });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Hindra',
          abilityName: 'Lockdown',
          playerId,
          targetPlayerId: oppId,
          description: `${player.name} prevented ${newState.players[oppId]?.name} from playing Ability Cards next turn`,
        },
      });
      return { newState, events, success: true };
    }

    // ── Ignacia ────────────────────────────────────────────────────────────
    // Ignacia may attack once per turn while fatigued.
    // The actual combat is resolved via the normal OVERCOME action; this ability
    // sets a flag that allows a fatigued Ignacia to attack.
    // (Handled in combat.ts attack validation.)
    case 'Ignacia': {
      // Mark Ignacia as eligible for a fatigued attack this turn
      const newArena = player.arena.map((h) =>
        h.instanceId === heroInstanceId
          ? { ...h, tempAttackBonus: h.tempAttackBonus } // no stat change, just activation
          : h,
      );
      newState = setPlayerArena(newState, playerId, newArena);
      newState = { ...newState, actionLog: [
        ...newState.actionLog,
        `[R${newState.round}] ${player.name}: Ignacia activated Relentless — fatigued attack allowed`,
      ]};
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Ignacia',
          abilityName: 'Relentless',
          playerId,
          description: 'Ignacia may attack this turn while fatigued',
        },
      });
      return { newState, events, success: true };
    }

    // ── Kay ────────────────────────────────────────────────────────────────
    // Play a card to the field from hand.
    case 'Kay': {
      const cardId = targetId;
      if (!cardId) break;
      const card = player.hand.find((c) => c.id === cardId);
      if (!card || card.type !== 'ability') break;
      const abilityCard = card as AbilityCard;
      if (abilityCard.abilityType !== 'P') break;

      const attachHeroId = secondaryTargetId ?? heroInstanceId;
      newState = attachAbilityCardToHero(newState, playerId, attachHeroId, abilityCard);
      const updatedPlayer = newState.players[playerId]!;
      newState = updatePlayer(newState, playerId, {
        hand: updatedPlayer.hand.filter((c) => c.id !== cardId),
      });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Kay',
          abilityName: 'Field Play',
          playerId,
          cardName: card.name,
          attachedToHeroId: attachHeroId,
        },
      });
      return { newState, events, success: true };
    }

    // ── Kyauta ─────────────────────────────────────────────────────────────
    // After completing Action, fatigue one strengthened hero; recruit from top of Reserves.
    case 'Kyauta': {
      const fatiguedHeroId = targetId;
      if (!fatiguedHeroId) break;
      const toFatigue = player.arena.find((h) => h.instanceId === fatiguedHeroId && !h.fatigued);
      if (!toFatigue) break;
      if (player.heroPool.length === 0) break;

      // Fatigue chosen hero
      newState = fatigueHeroInstance(newState, playerId, fatiguedHeroId);

      // Recruit top hero from pool (index 0 = top of Reserves)
      const topHero = player.heroPool[0]!;
      const newPool = player.heroPool.slice(1);
      const newArena = [
        ...newState.players[playerId]!.arena,
        { ...topHero, zone: 'arena' as const },
      ];
      newState = updatePlayer(newState, playerId, { heroPool: newPool });
      newState = setPlayerArena(newState, playerId, newArena);

      events.push({
        type: 'HERO_RECRUITED',
        payload: {
          heroInstanceId: topHero.instanceId,
          heroName: topHero.heroCard.heroName,
          playerId,
          reason: 'Kyauta: Advance',
        },
      });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: { heroName: 'Kyauta', abilityName: 'Advance', playerId },
      });
      return { newState, events, success: true };
    }

    // ── Michael ────────────────────────────────────────────────────────────
    // Draw a card from Enhancement Deck to hand.
    case 'Michael': {
      const { drawn, deck, discard } = drawCards(
        player.enhancementDeck, player.discardPile, 1,
      );
      newState = updatePlayer(newState, playerId, {
        enhancementDeck: deck,
        discardPile: discard,
        hand: [...player.hand, ...drawn],
      });
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Michael',
          abilityName: 'Quick Study',
          playerId,
          drawnCount: drawn.length,
        },
      });
      return { newState, events, success: true };
    }

    // ── Rohan ──────────────────────────────────────────────────────────────
    // For each fatigued hero on field (both sides), recruit one hero to hand.
    case 'Rohan': {
      const fatigued = countAllFatiguedHeroesOnField(state);
      const toRecruit = Math.min(fatigued, player.heroPool.length);
      const recruited = player.heroPool.slice(0, toRecruit);
      const remaining = player.heroPool.slice(toRecruit);

      // Move recruited heroes to hand (as conceptual "ready to deploy" state)
      // In this engine model, heroes go from heroPool to arena via Recruit action.
      // Rohan puts them into the heroPool queue; the player recruits them normally.
      // For accurate rule implementation, we simply note how many would be recruited.
      newState = updatePlayer(newState, playerId, { heroPool: remaining });

      // Actually per the rules: "recruit one hero from HQ or Reserves to hand"
      // "hand" for heroes means they become immediately deployable.
      // We'll move them to the pool's front (top of Reserves) so they can be recruited.
      newState = updatePlayer(newState, playerId, {
        heroPool: [...recruited, ...remaining],
      });

      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: {
          heroName: 'Rohan',
          abilityName: 'Rally',
          playerId,
          fatiguedCount: fatigued,
          recruitedCount: toRecruit,
          description: `Rohan moved ${toRecruit} hero(es) to the top of Reserves`,
        },
      });
      return { newState, events, success: true };
    }

    // ── Zoe ────────────────────────────────────────────────────────────────
    // Before performing Action, heal any hero(es) of choice.
    case 'Zoe': {
      // targetId can be a comma-separated list of hero instance IDs, or a single ID
      const healIds = targetId ? targetId.split(',').map((s) => s.trim()) : [];
      if (healIds.length === 0) break;

      const newArena = player.arena.map((h) =>
        healIds.includes(h.instanceId) ? { ...h, fatigued: false } : h,
      );
      newState = setPlayerArena(newState, playerId, newArena);
      for (const hid of healIds) {
        events.push({
          type: 'HERO_HEALED',
          payload: { heroInstanceId: hid, playerId, reason: 'Zoe: Refresh' },
        });
      }
      events.push({
        type: 'ABILITY_TRIGGERED',
        payload: { heroName: 'Zoe', abilityName: 'Refresh', playerId, healedCount: healIds.length },
      });
      return { newState, events, success: true };
    }

    default:
      break;
  }

  return { newState, events, success: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Attach an ability card to a hero's fieldAbilityCards */
export function attachAbilityCardToHero(
  state: GameState,
  playerId: string,
  heroInstanceId: string,
  card: AbilityCard,
): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  const newArena = player.arena.map((h) =>
    h.instanceId === heroInstanceId
      ? { ...h, fieldAbilityCards: [...h.fieldAbilityCards, card] }
      : h,
  );
  return setPlayerArena(state, playerId, newArena);
}

/** Defeat a specific hero instance (move to defeatedHeroes, trigger Resurrect if applicable) */
export function defeatHeroInstance(
  state: GameState,
  playerId: string,
  heroInstanceId: string,
): GameState {
  const player = state.players[playerId];
  if (!player) return state;

  const hero = player.arena.find((h) => h.instanceId === heroInstanceId);
  if (!hero) return state;

  // Check Resurrect passive
  if (hasFieldAbility(hero, 'Resurrect') && !hero.cannotBeResurrected) {
    // Return to arena as strengthened, strip enhancements
    const resurrected: ArenaHero = {
      ...hero,
      fatigued: false,
      fieldAbilityCards: [], // Resurrect strips all enhancements
      appliedStatCards: [],
      zone: 'arena',
    };
    const newArena = player.arena.map((h) =>
      h.instanceId === heroInstanceId ? resurrected : h,
    );
    return setPlayerArena(state, playerId, newArena);
  }

  // Normal defeat
  const remaining = player.arena.filter((h) => h.instanceId !== heroInstanceId);
  const defeated = { ...hero, zone: 'defeated' as const };
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        arena: remaining,
        defeatedHeroes: [...player.defeatedHeroes, defeated],
      },
    },
  };
}

/** Fatigue a specific hero instance */
export function fatigueHeroInstance(
  state: GameState,
  playerId: string,
  heroInstanceId: string,
): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  const newArena = player.arena.map((h) =>
    h.instanceId === heroInstanceId ? { ...h, fatigued: true } : h,
  );
  return setPlayerArena(state, playerId, newArena);
}

/** Find the player ID who owns a hero given its instance ID */
export function findHeroOwner(state: GameState, heroInstanceId: string): string | undefined {
  for (const [pid, player] of Object.entries(state.players)) {
    if (player.arena.some((h) => h.instanceId === heroInstanceId)) return pid;
  }
  return undefined;
}

/** Find a hero and its owner across all arenas */
function findHeroInAllArenas(
  state: GameState,
  heroInstanceId: string,
): { hero: ArenaHero; playerId: string } | undefined {
  for (const [pid, player] of Object.entries(state.players)) {
    const hero = player.arena.find((h) => h.instanceId === heroInstanceId);
    if (hero) return { hero, playerId: pid };
  }
  return undefined;
}

/** Find the first opponent's player ID (for 2-player convenience) */
export function findOpponentId(state: GameState, playerId: string): string | undefined {
  return state.turnOrder.find((id) => id !== playerId);
}

/** Count all heroes on field across all players */
export function countAllHeroesOnField(state: GameState): number {
  return Object.values(state.players).reduce((s, p) => s + p.arena.length, 0);
}

/** Count all fatigued heroes on field across all players */
function countAllFatiguedHeroesOnField(state: GameState): number {
  return Object.values(state.players)
    .flatMap((p) => p.arena)
    .filter((h) => h.fatigued).length;
}

/** Count non-fatigued heroes in a player's arena */
function countStrengthenedHeroes(player: PlayerState): number {
  return player.arena.filter((h) => !h.fatigued).length;
}

/** Count all opposing cards: heroes + their stat cards + their field ability cards */
function countOpponentCards(opponent: PlayerState): number {
  return opponent.arena.reduce(
    (s, h) => s + 1 + h.appliedStatCards.length + h.fieldAbilityCards.length,
    0,
  );
}

/** Check if a specific named hero is in a player's arena */
function isHeroInArena(player: PlayerState, heroName: string): boolean {
  return player.arena.some((h) => h.heroCard.heroName === heroName);
}

/** Immutable helper: replace a player's arena array */
function setPlayerArena(
  state: GameState,
  playerId: string,
  arena: ArenaHero[],
): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...player, arena } },
  };
}

/** Immutable helper: merge partial updates into a player's state */
export function updatePlayer(
  state: GameState,
  playerId: string,
  updates: Partial<PlayerState>,
): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...player, ...updates } },
  };
}
