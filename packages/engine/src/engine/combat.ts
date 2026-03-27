import type { GameState, CombatResult, GameEvent } from '../types/game';
import type { OvercomeAction } from '../types/actions';
import type { ArenaHero } from '../types/player';
import type { StatCard } from '../types/cards';
import {
  computeHeroAttack,
  computeHeroDefense,
  processAbilities,
  processGambitoEffect,
  resolveGoingNuclear,
  hasFieldAbility,
  defeatHeroInstance,
  fatigueHeroInstance,
  attachAbilityCardToHero,
  findHeroOwner,
  findOpponentId,
  updatePlayer,
  type AbilityContext,
} from './abilities';

// ─────────────────────────────────────────────────────────────────────────────
// Combat resolution — O (Overcome) action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a single combat exchange.
 *
 * Rules:
 *   - Total ATK = sum of all attacking heroes' effective ATK
 *   - Total DEF = sum of all defending heroes' effective DEF (halved if fatigued)
 *   - ATK >= DEF            → defenders DEFEATED
 *   - ATK >= DEF / 2        → defenders FATIGUED
 *   - ATK < DEF / 2         → NO EFFECT
 *   - Attacking heroes always fatigue after combat regardless of outcome.
 *
 * Ability resolution order:
 *   1. "Must use" abilities (Going Nuclear, Gambito) fire before optional ones.
 *   2. Prevention / Protect block outcomes before they apply.
 *   3. Passive triggers (Collateral Damage, Convert, Resurrect, etc.) fire after.
 *   4. Abilities that fire after combat still fire even if the hero was defeated.
 */
export function resolveCombat(
  state: GameState,
  action: OvercomeAction,
  /** Set true to allow a fatigued Ignacia to attack */
  allowFatiguedAttack = false,
): { result: CombatResult; newState: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const attackerPlayer = state.players[action.playerId];
  const defenderPlayer = state.players[action.targetPlayerId];

  if (!attackerPlayer || !defenderPlayer) {
    throw new Error('Invalid player IDs in combat action');
  }

  // ── Prevention: all attacks blocked until start of defender's next turn ──
  if (defenderPlayer.preventionActive) {
    const result = makeNoEffectResult(action, 0, 0);
    events.push({
      type: 'ABILITY_TRIGGERED',
      payload: {
        cardName: 'Prevention',
        playerId: action.targetPlayerId,
        description: 'Attack blocked by Prevention — all attacks nullified this turn',
      },
    });
    events.push({ type: 'COMBAT_RESOLVED', payload: { combatResult: result } });
    return { result, newState: state, events };
  }

  // Gather attacker hero instances
  const attackers = action.attackerInstanceIds
    .map((id) => attackerPlayer.arena.find((h) => h.instanceId === id))
    .filter((h): h is ArenaHero => h !== undefined);

  // Validate: attackers must be non-fatigued (exception: Ignacia's Relentless)
  const validAttackers = attackers.filter((h) => {
    if (!h.fatigued) return true;
    if (h.heroCard.heroName === 'Ignacia' && allowFatiguedAttack) return true;
    return false;
  });

  if (validAttackers.length === 0) {
    throw new Error('No valid (non-fatigued) attackers declared');
  }

  // Gather defender hero instances
  const defenders = action.defenderInstanceIds
    .map((id) => defenderPlayer.arena.find((h) => h.instanceId === id))
    .filter((h): h is ArenaHero => h !== undefined);

  // ── Origin: may block one attack against Origin per opponent turn ─────────
  const originDefender = defenders.find((h) => h.heroCard.heroName === 'Origin');
  if (originDefender && defenderPlayer.arena.length > 1) {
    // Origin can block one attack — if Origin is the sole declared defender, abort combat
    if (defenders.length === 1 && defenders[0]!.heroCard.heroName === 'Origin') {
      const result = makeNoEffectResult(action, 0, 0);
      const ctx: AbilityContext = {
        actingPlayerId: action.playerId,
        heroInstanceId: originDefender.instanceId,
      };
      const originResult = processAbilities(state, 'on_combat_start', ctx);
      events.push(...originResult.events);
      events.push({ type: 'COMBAT_RESOLVED', payload: { combatResult: result } });
      return { result, newState: originResult.newState, events };
    }
  }

  // ── Going Nuclear: ALL cards removed from field ───────────────────────────
  // Check each defender for Going Nuclear (must use)
  for (const def of defenders) {
    if (hasFieldAbility(def, 'Going Nuclear')) {
      const nuclearResult = resolveGoingNuclear(state, action.targetPlayerId, def.instanceId);
      events.push(...nuclearResult.events);
      const noEffect = makeNoEffectResult(action, 0, 0);
      events.push({ type: 'COMBAT_RESOLVED', payload: { combatResult: noEffect } });
      return { result: noEffect, newState: nuclearResult.newState, events };
    }
  }

  // ── Compute Total ATK ─────────────────────────────────────────────────────
  let totalAttack = validAttackers.reduce(
    (sum, h) => sum + computeHeroAttack(h, attackerPlayer, state),
    0,
  );

  // Mace: may double Total Attack (context.value = 1 to activate)
  // The player signals Mace activation via the action metadata — here we check
  // if Mace is among the attackers and the ability is being used.
  const maceAttacker = validAttackers.find((h) => h.heroCard.heroName === 'Mace');
  const useMace = maceAttacker !== undefined;
  if (useMace) {
    totalAttack *= 2;
    const maceCtx: AbilityContext = { actingPlayerId: action.playerId };
    const maceResult = processAbilities(state, 'on_attack', maceCtx);
    events.push(...maceResult.events);
  }

  // ── Compute Total DEF ─────────────────────────────────────────────────────
  let totalDefense = defenders.reduce(
    (sum, h) =>
      sum + computeHeroDefense(h, defenderPlayer, state, true, attackerPlayer, validAttackers),
    0,
  );

  // ── Protected heroes: Protect passive prevents fatigue/defeat ────────────
  const protectedDefenderIds = defenderPlayer.protectedHeroIds;

  // ── Determine outcome ─────────────────────────────────────────────────────
  let outcome: CombatResult['outcome'];
  if (totalAttack >= totalDefense) {
    outcome = 'defeated';
  } else if (totalDefense > 0 && totalAttack >= totalDefense / 2) {
    outcome = 'fatigued';
  } else {
    outcome = 'no-effect';
  }

  const defeatedIds: string[] = [];
  const fatiguedIds: string[] = [];
  const triggeredAbilities: string[] = [];

  let newState = { ...state };

  // ── Protect passive: check for Protect ability card on any allied hero ────
  // If triggered before this combat, defenders are shielded.
  // (Protect activates when ANOTHER hero is attacked — handled in phases.ts)

  // ── Apply outcome to defenders ────────────────────────────────────────────
  // Note: Gambito checks happen BEFORE attacking heroes fatigue, because
  // if Gambito is defeated first, the attacker fatigue after doesn't trigger Gambito.
  const gambitoAliveBeforeCombat = Object.values(state.players).some((p) =>
    p.arena.some((h) => h.heroCard.heroName === 'Gambito'),
  );

  if (outcome === 'defeated') {
    for (const hero of defenders) {
      if (protectedDefenderIds.includes(hero.instanceId)) {
        // Hero is protected — skip defeat
        events.push({
          type: 'ABILITY_TRIGGERED',
          payload: {
            cardName: 'Protect',
            heroName: hero.heroCard.heroName,
            description: 'Protect shielded this hero from defeat',
          },
        });
        continue;
      }
      defeatedIds.push(hero.instanceId);
      events.push({
        type: 'HERO_DEFEATED',
        payload: {
          heroInstanceId: hero.instanceId,
          heroName: hero.heroCard.heroName,
          playerId: action.targetPlayerId,
        },
      });
    }

    // Apply defeats (Resurrect handled inside defeatHeroInstance)
    for (const id of defeatedIds) {
      newState = defeatHeroInstance(newState, action.targetPlayerId, id);
    }

    // Gambito: fires when defenders are defeated (but not for attacker fatigue yet)
    if (defeatedIds.length > 0 && gambitoAliveBeforeCombat) {
      const gambitoResult = processGambitoEffect(newState, true);
      newState = gambitoResult.newState;
      events.push(...gambitoResult.events);
    }

  } else if (outcome === 'fatigued') {
    for (const hero of defenders) {
      if (protectedDefenderIds.includes(hero.instanceId)) {
        events.push({
          type: 'ABILITY_TRIGGERED',
          payload: {
            cardName: 'Protect',
            heroName: hero.heroCard.heroName,
            description: 'Protect shielded this hero from fatigue',
          },
        });
        continue;
      }
      fatiguedIds.push(hero.instanceId);
    }
    newState = fatigueHeroes(newState, action.targetPlayerId, fatiguedIds, events);

    // Gambito fires for defender fatigue
    if (fatiguedIds.length > 0 && gambitoAliveBeforeCombat) {
      const gambitoResult = processGambitoEffect(newState, gambitoAliveBeforeCombat);
      newState = gambitoResult.newState;
      events.push(...gambitoResult.events);
    }
  }

  // ── Fatigue attackers ─────────────────────────────────────────────────────
  // "Attackers always fatigue after combat regardless of outcome."
  const gambitoStillAlive = Object.values(newState.players).some((p) =>
    p.arena.some((h) => h.heroCard.heroName === 'Gambito'),
  );
  newState = fatigueHeroes(newState, action.playerId, action.attackerInstanceIds, events);

  // Gambito fires for attacker fatigue (only if Gambito is STILL alive at this point)
  if (gambitoStillAlive) {
    const gambitoResult = processGambitoEffect(newState, gambitoStillAlive);
    newState = gambitoResult.newState;
    events.push(...gambitoResult.events);
  }

  // ── Akio passive: if Akio attacked and caused enemy fatigue → un-fatigue Akio ──
  if (outcome === 'fatigued' && fatiguedIds.length > 0) {
    const akioCtx: AbilityContext = { actingPlayerId: action.playerId };
    const akioResult = processAbilities(newState, 'on_fatigue_enemy', akioCtx);
    newState = akioResult.newState;
    events.push(...akioResult.events);
  }

  // ── Post-combat passive triggers ──────────────────────────────────────────
  if (outcome === 'defeated' && defeatedIds.length > 0) {
    // Collateral Damage: if attacker hero has it, may fatigue one other enemy hero
    for (const attacker of validAttackers) {
      if (hasFieldAbility(attacker, 'Collateral Damage')) {
        // Find a non-defeated strengthened enemy hero to fatigue (first one found)
        const defenderArena = newState.players[action.targetPlayerId]?.arena ?? [];
        const target = defenderArena.find((h) => !h.fatigued && !defeatedIds.includes(h.instanceId));
        if (target) {
          newState = fatigueHeroes(newState, action.targetPlayerId, [target.instanceId], events);
          triggeredAbilities.push('Collateral Damage');
          events.push({
            type: 'ABILITY_TRIGGERED',
            payload: {
              cardName: 'Collateral Damage',
              playerId: action.playerId,
              description: `Collateral Damage fatigued ${target.heroCard.heroName}`,
            },
          });
        }
      }
    }

    // Convert: when the defeated hero had Convert attached, take control of any hero
    for (const defeatedId of defeatedIds) {
      // The hero is now in defeatedHeroes — we need to check the original arena state
      const originalHero = defenderPlayer.arena.find((h) => h.instanceId === defeatedId);
      if (originalHero && hasFieldAbility(originalHero, 'Convert')) {
        // Take control of first enemy hero on field (attacker's side, first available)
        const targetArena = newState.players[action.playerId]?.arena ?? [];
        const heroToConvert = targetArena[0];
        if (heroToConvert) {
          const convertedHero: ArenaHero = {
            ...heroToConvert,
            // Strip enhancements from converted hero
            fieldAbilityCards: [],
            appliedStatCards: [],
            // Preserve fatigued state
          };
          // Move from attacker's arena to defender's arena
          const updatedAttackerArena = newState.players[action.playerId]!.arena.filter(
            (h) => h.instanceId !== heroToConvert.instanceId,
          );
          newState = {
            ...newState,
            players: {
              ...newState.players,
              [action.playerId]: {
                ...newState.players[action.playerId]!,
                arena: updatedAttackerArena,
              },
              [action.targetPlayerId]: {
                ...newState.players[action.targetPlayerId]!,
                arena: [...newState.players[action.targetPlayerId]!.arena, convertedHero],
              },
            },
          };
          triggeredAbilities.push('Convert');
          events.push({
            type: 'ABILITY_TRIGGERED',
            payload: {
              cardName: 'Convert',
              playerId: action.targetPlayerId,
              convertedHeroName: heroToConvert.heroCard.heroName,
              description: `Convert transferred ${heroToConvert.heroCard.heroName} to ${defenderPlayer.name}`,
            },
          });
        }
      }
    }

    // Isaac: draw from discard when any hero is defeated
    for (const defeatedId of defeatedIds) {
      const isaacCtx: AbilityContext = {
        actingPlayerId: action.playerId,
        heroInstanceId: defeatedId,
      };
      const isaacResult = processAbilities(newState, 'on_defeat_ally', isaacCtx);
      newState = isaacResult.newState;
      events.push(...isaacResult.events);
    }

    // Zhao P2: if Zhao was defeated, trigger on_defeat_ally for Zhao's player
    const zhaoDefeated = defeatedIds.some((id) => {
      const h = defenderPlayer.arena.find((a) => a.instanceId === id);
      return h?.heroCard.heroName === 'Zhao';
    });
    if (zhaoDefeated) {
      const zhaoId = defeatedIds.find((id) => {
        const h = defenderPlayer.arena.find((a) => a.instanceId === id);
        return h?.heroCard.heroName === 'Zhao';
      })!;
      const zhaoCtx: AbilityContext = {
        actingPlayerId: action.playerId,
        heroInstanceId: zhaoId,
      };
      const zhaoResult = processAbilities(newState, 'on_defeat_ally', zhaoCtx);
      newState = zhaoResult.newState;
      events.push(...zhaoResult.events);
    }
  }

  // Christoph: fires on_defend when Christoph is among the defenders
  // (fires even if Christoph is defeated)
  const christoph = defenderPlayer.arena
    .concat(newState.players[action.targetPlayerId]?.defeatedHeroes ?? [])
    .find((h) => h.heroCard.heroName === 'Christoph');
  if (
    christoph &&
    action.defenderInstanceIds.includes(christoph.instanceId) &&
    validAttackers.length > 0
  ) {
    // Choose attacker to defeat — first attacker as default
    const chosenAttacker = validAttackers[0]!;
    const christophCtx: AbilityContext = {
      actingPlayerId: action.playerId,
      heroInstanceId: christoph.instanceId,
      targetHeroInstanceId: chosenAttacker.instanceId,
    };
    const christophResult = processAbilities(newState, 'on_defend', christophCtx);
    newState = christophResult.newState;
    events.push(...christophResult.events);
    triggeredAbilities.push('Christoph: Measured Response');
  }

  // Yasmine: fires on_defend after combat (whether defeated or not)
  const yasmine = defenderPlayer.arena
    .concat(newState.players[action.targetPlayerId]?.defeatedHeroes ?? [])
    .find((h) => h.heroCard.heroName === 'Yasmine');
  if (yasmine && action.defenderInstanceIds.includes(yasmine.instanceId)) {
    // targetHeroInstanceId would be card ID to play — left as undefined for now
    // (client sends this via a follow-up event; engine emits the trigger)
    const yasmineCtx: AbilityContext = {
      actingPlayerId: action.playerId,
      heroInstanceId: yasmine.instanceId,
    };
    const yasmineResult = processAbilities(newState, 'on_defend', yasmineCtx);
    newState = yasmineResult.newState;
    events.push(...yasmineResult.events);
    triggeredAbilities.push('Yasmine: Opportunist');
  }

  // Prevention passive: defender may discard it to block the attack entirely
  // (handled before combat starts in the Prevention check above)
  // If a defender had Prevention and didn't use it (attack still resolved),
  // they had the option not to use it.

  // Mace: Crushing Blow check — if Mace's ATK exceeded defender's DEF by 20+,
  // mark defeated heroes as cannotBeResurrected
  if (maceAttacker && outcome === 'defeated') {
    for (const id of defeatedIds) {
      const defOwner = findHeroOwner(newState, id);
      if (!defOwner) continue;
      const defArena = newState.players[defOwner]?.defeatedHeroes ?? [];
      const defHero = defArena.find((h) => h.instanceId === id);
      if (defHero) {
        // Check if Mace's portion of ATK exceeded this hero's DEF by 20+
        const maceAtk = computeHeroAttack(maceAttacker, attackerPlayer, state);
        const originalDef = computeHeroDefense(defHero, defenderPlayer, state);
        if (maceAtk >= originalDef + 20) {
          const newDefeated = newState.players[defOwner]!.defeatedHeroes.map((h) =>
            h.instanceId === id ? { ...h, cannotBeResurrected: true } : h,
          );
          newState = updatePlayer(newState, defOwner, { defeatedHeroes: newDefeated });
          triggeredAbilities.push('Mace: Overwhelming Force — hero cannot be resurrected');
        }
      }
    }
  }

  const combatResult: CombatResult = {
    attackerPlayerId: action.playerId,
    defenderPlayerId: action.targetPlayerId,
    attackerHeroInstanceIds: action.attackerInstanceIds,
    defenderHeroInstanceIds: action.defenderInstanceIds,
    totalAttack,
    totalDefense,
    outcome,
    defeatedHeroInstanceIds: defeatedIds,
    fatiguedHeroInstanceIds: fatiguedIds,
    triggeredAbilities,
  };

  events.push({
    type: 'COMBAT_RESOLVED',
    payload: { combatResult },
  });

  newState = {
    ...newState,
    combatHistory: [...newState.combatHistory, combatResult],
    actionLog: [
      ...newState.actionLog,
      `[Round ${newState.round}] ${attackerPlayer.name} attacks ${defenderPlayer.name} — ` +
      `ATK ${totalAttack} vs DEF ${totalDefense}: ${outcome.toUpperCase()}`,
    ],
  };

  return { result: combatResult, newState, events };
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy stat helpers (used by external callers that haven't migrated yet)
// ─────────────────────────────────────────────────────────────────────────────

/** Calculate a hero's base effective ATK (no dynamic ability bonuses) */
export function getEffectiveAttack(hero: ArenaHero): number {
  const statBonus = hero.appliedStatCards
    .filter((c): c is StatCard & { statType: 'ATT' } => c.statType === 'ATT')
    .reduce((sum, c) => sum + c.value, 0);
  return hero.heroCard.attack + statBonus + hero.tempAttackBonus;
}

/** Calculate a hero's base effective DEF (no dynamic ability bonuses or halving) */
export function getEffectiveDefense(hero: ArenaHero): number {
  const statBonus = hero.appliedStatCards
    .filter((c): c is StatCard & { statType: 'DEF' } => c.statType === 'DEF')
    .reduce((sum, c) => sum + c.value, 0);
  return hero.heroCard.defense + statBonus + hero.tempDefenseBonus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fatigueHeroes(
  state: GameState,
  playerId: string,
  instanceIds: string[],
  events: GameEvent[],
): GameState {
  const player = state.players[playerId];
  if (!player) return state;

  const newArena = player.arena.map((hero) => {
    if (!instanceIds.includes(hero.instanceId)) return hero;
    if (!hero.fatigued) {
      events.push({
        type: 'HERO_FATIGUED',
        payload: { heroInstanceId: hero.instanceId, heroName: hero.heroCard.heroName, playerId },
      });
    }
    return { ...hero, fatigued: true };
  });

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, arena: newArena },
    },
  };
}

/** Construct a no-effect CombatResult */
function makeNoEffectResult(
  action: OvercomeAction,
  totalAttack: number,
  totalDefense: number,
): CombatResult {
  return {
    attackerPlayerId: action.playerId,
    defenderPlayerId: action.targetPlayerId,
    attackerHeroInstanceIds: action.attackerInstanceIds,
    defenderHeroInstanceIds: action.defenderInstanceIds,
    totalAttack,
    totalDefense,
    outcome: 'no-effect',
    defeatedHeroInstanceIds: [],
    fatiguedHeroInstanceIds: [],
    triggeredAbilities: [],
  };
}
