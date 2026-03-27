import type { GameState, GameResult } from '../types/game';
import type { PlayerState } from '../types/player';

// ─────────────────────────────────────────────────────────────────────────────
// Win / draw condition detection
// ─────────────────────────────────────────────────────────────────────────────

const NO_ACTION_DRAW_THRESHOLD = 5;
const NO_HEROES_WIN_THRESHOLD = 3;
const ATTACK_LOOP_THRESHOLD = 6;

/**
 * Check all win/draw conditions after every state mutation.
 * Returns a GameResult if the game should end, otherwise null.
 */
export function checkWinConditions(state: GameState): GameResult | null {
  const activePlayers = Object.values(state.players).filter((p) => !p.isEliminated);

  // ── Draw: no meaningful action for 5 consecutive turns ──────────────────────
  if (state.noActionTurnCount >= NO_ACTION_DRAW_THRESHOLD) {
    return {
      winnerIds: null,
      loserIds: activePlayers.map((p) => p.id),
      reason: 'draw-no-action',
    };
  }

  // ── Draw: 6-attack loop detected ────────────────────────────────────────────
  if (detectAttackLoop(state)) {
    return {
      winnerIds: null,
      loserIds: activePlayers.map((p) => p.id),
      reason: 'draw-attack-loop',
    };
  }

  // ── Win: all opposing SkyBases defeated ─────────────────────────────────────
  if (state.mode === 'free-for-all') {
    const skyBaseResult = checkSkyBaseWin(state);
    if (skyBaseResult) return skyBaseResult;
  } else {
    // Team Play: a team wins when all enemy team SkyBases are defeated
    const teamResult = checkTeamSkyBaseWin(state);
    if (teamResult) return teamResult;
  }

  // ── Win: opponent has no heroes in arena for 3 full turns ───────────────────
  if (state.mode === 'free-for-all') {
    for (const player of activePlayers) {
      const hasZeroHeroes =
        player.arena.length === 0 &&
        player.heroPool.length === 0;

      if (hasZeroHeroes && player.noHeroesTurnCount >= NO_HEROES_WIN_THRESHOLD) {
        const opponents = activePlayers.filter((p) => p.id !== player.id);
        return {
          winnerIds: opponents.map((p) => p.id),
          loserIds: [player.id],
          reason: 'no-heroes-3-turns',
        };
      }
    }
  } else {
    // Team Play: game continues until ALL players on a team are removed.
    // A player is removed (virtually) if they have no heroes for 3 full turns.
    // Heroes are NOT healed when a SkyBase is defeated in Team Play.
    const teamEliminationResult = checkTeamNoHeroesWin(state);
    if (teamEliminationResult) return teamEliminationResult;
  }

  return null; // Game continues
}

// ─── FFA helpers ──────────────────────────────────────────────────────────────

function checkSkyBaseWin(state: GameState): GameResult | null {
  const activePlayers = Object.values(state.players).filter((p) => !p.isEliminated);
  const survivors = activePlayers.filter((p) => !p.skyBase.defeated);

  if (survivors.length === 1 && activePlayers.length > 1) {
    const winner = survivors[0]!;
    return {
      winnerIds: [winner.id],
      loserIds: activePlayers.filter((p) => p.id !== winner.id).map((p) => p.id),
      reason: 'all-skybases-defeated',
    };
  }

  if (survivors.length === 0) {
    // Simultaneous defeat — draw
    return {
      winnerIds: null,
      loserIds: activePlayers.map((p) => p.id),
      reason: 'all-skybases-defeated',
    };
  }

  return null;
}

// ─── Team helpers ─────────────────────────────────────────────────────────────

/**
 * Team Play SkyBase win condition.
 * A team is defeated when ALL of its members have their SkyBase defeated or are eliminated.
 * Note: heroes are NOT healed on SkyBase defeat in Team Play (no consolation unfatigue).
 */
function checkTeamSkyBaseWin(state: GameState): GameResult | null {
  const teams = groupByTeam(state);
  if (teams.size < 2) return null;

  const defeatedTeams: string[] = [];
  const survivingTeams: string[] = [];

  for (const [teamId, members] of teams.entries()) {
    const allSkyBasesDown = members.every(
      (p) => p.isEliminated || p.skyBase.defeated,
    );
    if (allSkyBasesDown) {
      defeatedTeams.push(teamId);
    } else {
      survivingTeams.push(teamId);
    }
  }

  if (defeatedTeams.length === 0) return null;

  if (survivingTeams.length === 1) {
    const winningTeamId = survivingTeams[0]!;
    const winnerPlayers = teams.get(winningTeamId) ?? [];
    const loserPlayers = defeatedTeams.flatMap((t) => teams.get(t) ?? []);
    return {
      winnerIds: winnerPlayers.map((p) => p.id),
      loserIds: loserPlayers.map((p) => p.id),
      reason: 'all-skybases-defeated',
    };
  }

  // All teams defeated simultaneously — draw
  const allPlayers = Object.values(state.players);
  return {
    winnerIds: null,
    loserIds: allPlayers.map((p) => p.id),
    reason: 'all-skybases-defeated',
  };
}

/**
 * Team Play no-heroes win condition.
 * A player is "removed" if they have no heroes for 3 full turns (isEliminated OR count >= threshold).
 * The game ends only when ALL members of a team are removed.
 */
function checkTeamNoHeroesWin(state: GameState): GameResult | null {
  const teams = groupByTeam(state);
  if (teams.size < 2) return null;

  const defeatedTeams: string[] = [];
  const survivingTeams: string[] = [];

  for (const [teamId, members] of teams.entries()) {
    const allRemoved = members.every(
      (p) =>
        p.isEliminated ||
        (p.arena.length === 0 &&
          p.heroPool.length === 0 &&
          p.noHeroesTurnCount >= NO_HEROES_WIN_THRESHOLD),
    );
    if (allRemoved) {
      defeatedTeams.push(teamId);
    } else {
      survivingTeams.push(teamId);
    }
  }

  if (defeatedTeams.length === 0) return null;

  if (survivingTeams.length === 1) {
    const winningTeamId = survivingTeams[0]!;
    const winnerPlayers = teams.get(winningTeamId) ?? [];
    const loserPlayers = defeatedTeams.flatMap((t) => teams.get(t) ?? []);
    return {
      winnerIds: winnerPlayers.map((p) => p.id),
      loserIds: loserPlayers.map((p) => p.id),
      reason: 'no-heroes-3-turns',
    };
  }

  // All teams removed simultaneously — draw
  const allPlayers = Object.values(state.players);
  return {
    winnerIds: null,
    loserIds: allPlayers.map((p) => p.id),
    reason: 'no-heroes-3-turns',
  };
}

// ─── Attack loop detection ────────────────────────────────────────────────────

/**
 * Detect a 6-attack loop: the same two players have attacked each other
 * 6 times in a row with no 'defeated' outcome (no board-state change).
 *
 * An endless attack/heal loop ends after the 6th consecutive attack.
 */
function detectAttackLoop(state: GameState): boolean {
  const history = state.combatHistory;
  if (history.length < ATTACK_LOOP_THRESHOLD) return false;

  const recent = history.slice(-ATTACK_LOOP_THRESHOLD);
  const first = recent[0]!;
  const pairA = first.attackerPlayerId;
  const pairB = first.defenderPlayerId;

  for (const combat of recent) {
    // Must involve the same two players (in either direction)
    const samePair =
      (combat.attackerPlayerId === pairA && combat.defenderPlayerId === pairB) ||
      (combat.attackerPlayerId === pairB && combat.defenderPlayerId === pairA);

    if (!samePair) return false;

    // A 'defeated' outcome changes board state — not a loop
    if (combat.outcome === 'defeated') return false;
  }

  return true;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Group all players by their teamId. In FFA each player is their own team. */
function groupByTeam(state: GameState): Map<string, PlayerState[]> {
  const teams = new Map<string, PlayerState[]>();
  for (const player of Object.values(state.players)) {
    const teamId = player.teamId ?? player.id;
    const existing = teams.get(teamId) ?? [];
    teams.set(teamId, [...existing, player]);
  }
  return teams;
}

/**
 * Update per-player hero counts at the end of each full turn.
 * Call this once per full round (after all players have taken a turn).
 */
export function updateNoHeroesCounts(state: GameState): GameState {
  const updatedPlayers = { ...state.players };

  for (const [id, player] of Object.entries(updatedPlayers)) {
    const hasHeroesAvailable =
      player.arena.length > 0 || player.heroPool.length > 0;

    updatedPlayers[id] = {
      ...player,
      noHeroesTurnCount: hasHeroesAvailable ? 0 : player.noHeroesTurnCount + 1,
    };
  }

  return { ...state, players: updatedPlayers };
}
