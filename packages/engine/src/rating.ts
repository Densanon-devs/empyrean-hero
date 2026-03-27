// ─────────────────────────────────────────────────────────────────────────────
// Elo rating system for Empyrean Hero
// ─────────────────────────────────────────────────────────────────────────────

export const STARTING_RATING = 1000;

export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Empyrean';

export interface RankTierInfo {
  tier: RankTier;
  minRating: number;
  maxRating: number | null;
  color: string;
}

export const RANK_TIERS: RankTierInfo[] = [
  { tier: 'Bronze',   minRating: 0,    maxRating: 799,  color: '#cd7f32' },
  { tier: 'Silver',   minRating: 800,  maxRating: 999,  color: '#c0c0c0' },
  { tier: 'Gold',     minRating: 1000, maxRating: 1199, color: '#ffd700' },
  { tier: 'Platinum', minRating: 1200, maxRating: 1399, color: '#00b4d8' },
  { tier: 'Diamond',  minRating: 1400, maxRating: 1599, color: '#4895ef' },
  { tier: 'Empyrean', minRating: 1600, maxRating: null,  color: '#d4af37' },
];

export function getRankTier(rating: number): RankTier {
  if (rating >= 1600) return 'Empyrean';
  if (rating >= 1400) return 'Diamond';
  if (rating >= 1200) return 'Platinum';
  if (rating >= 1000) return 'Gold';
  if (rating >= 800)  return 'Silver';
  return 'Bronze';
}

export function getRankTierInfo(tier: RankTier): RankTierInfo {
  return RANK_TIERS.find((t) => t.tier === tier)!;
}

export interface PlayerRatingInfo {
  playerId: string;
  rating: number;
  gamesPlayed: number;
}

export interface RatingChange {
  playerId: string;
  oldRating: number;
  newRating: number;
  delta: number;
}

function getKFactor(rating: number, gamesPlayed: number): number {
  if (gamesPlayed < 10) return 40; // placement matches
  if (gamesPlayed < 30) return 32; // new players
  if (rating >= 1400)   return 16; // high-ranked
  return 24;                        // established
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate Elo rating changes after a match.
 *
 * For 2-player games uses standard 1v1 Elo.
 * For multi-player/team games each player is compared against the average
 * rating of all their opponents.
 *
 * @param players   - All players with their current ratings and game counts
 * @param winnerIds - IDs of winning players, or null for a draw
 */
export function calculateElo(
  players: PlayerRatingInfo[],
  winnerIds: string[] | null,
): RatingChange[] {
  if (players.length === 2) {
    const [a, b] = players as [PlayerRatingInfo, PlayerRatingInfo];
    const kA = getKFactor(a.rating, a.gamesPlayed);
    const kB = getKFactor(b.rating, b.gamesPlayed);
    const eA = expectedScore(a.rating, b.rating);
    const eB = expectedScore(b.rating, a.rating);

    let sA: number, sB: number;
    if (winnerIds === null) {
      sA = 0.5; sB = 0.5;
    } else if (winnerIds.includes(a.playerId)) {
      sA = 1; sB = 0;
    } else {
      sA = 0; sB = 1;
    }

    const newA = Math.max(0, Math.round(a.rating + kA * (sA - eA)));
    const newB = Math.max(0, Math.round(b.rating + kB * (sB - eB)));
    return [
      { playerId: a.playerId, oldRating: a.rating, newRating: newA, delta: newA - a.rating },
      { playerId: b.playerId, oldRating: b.rating, newRating: newB, delta: newB - b.rating },
    ];
  }

  // Multi-player / team: each player compared against the average of all opponents
  return players.map((player) => {
    const opponents = players.filter((p) => p.playerId !== player.playerId);
    const avgOpponentRating =
      opponents.reduce((sum, o) => sum + o.rating, 0) / opponents.length;
    const k = getKFactor(player.rating, player.gamesPlayed);
    const e = expectedScore(player.rating, avgOpponentRating);

    let s: number;
    if (winnerIds === null) {
      s = 0.5;
    } else if (winnerIds.includes(player.playerId)) {
      s = 1;
    } else {
      s = 0;
    }

    const newRating = Math.max(0, Math.round(player.rating + k * (s - e)));
    return {
      playerId: player.playerId,
      oldRating: player.rating,
      newRating,
      delta: newRating - player.rating,
    };
  });
}
