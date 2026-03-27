import type { GameMode } from '@empyrean-hero/engine';
import type { QueueType } from '@empyrean-hero/engine';
import { STARTING_RATING } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Matchmaking queue system
// ─────────────────────────────────────────────────────────────────────────────

export interface QueueEntry {
  socketId: string;
  playerName: string;
  accountId?: string;
  rating: number;
  joinedAt: number;
  queueType: QueueType;
}

export interface MatchResult {
  players: QueueEntry[];
  gameMode: GameMode;
  queueType: QueueType;
}

/** How many players are needed to start a match */
const MATCH_SIZES: Record<QueueType, number> = {
  'ranked-1v1': 2,
  'ranked-2v2': 4,
  'casual': 2,
};

const GAME_MODES: Record<QueueType, GameMode> = {
  'ranked-1v1': 'free-for-all',
  'ranked-2v2': 'team-play',
  'casual': 'free-for-all',
};

const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes → match anyone
const BASE_RANGE = 100;            // initial rating window ±100
const RANGE_EXPAND = 50;           // +50 per 30-second interval
const EXPAND_INTERVAL = 30_000;    // 30 s

export class MatchmakingQueue {
  private queues = new Map<QueueType, QueueEntry[]>([
    ['ranked-1v1', []],
    ['ranked-2v2', []],
    ['casual', []],
  ]);

  /** Add a player to the queue. Returns false if already queued. */
  join(entry: QueueEntry): boolean {
    const queue = this.queues.get(entry.queueType)!;
    if (queue.some((e) => e.socketId === entry.socketId)) return false;
    queue.push({ ...entry, rating: entry.rating || STARTING_RATING });
    return true;
  }

  /** Remove a player from any queue they're in. */
  leave(socketId: string): void {
    for (const queue of this.queues.values()) {
      const idx = queue.findIndex((e) => e.socketId === socketId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        return;
      }
    }
  }

  /** Returns which queue the socket is in, or null */
  getQueueType(socketId: string): QueueType | null {
    for (const [type, queue] of this.queues.entries()) {
      if (queue.some((e) => e.socketId === socketId)) return type;
    }
    return null;
  }

  getQueueStatus(socketId: string): { position: number; queueSize: number; waitSeconds: number } | null {
    for (const queue of this.queues.values()) {
      const idx = queue.findIndex((e) => e.socketId === socketId);
      if (idx !== -1) {
        const entry = queue[idx]!;
        return {
          position: idx + 1,
          queueSize: queue.length,
          waitSeconds: Math.floor((Date.now() - entry.joinedAt) / 1000),
        };
      }
    }
    return null;
  }

  /**
   * Scan all queues for possible matches.
   * Returns matched groups and removes them from the queues.
   */
  findMatches(): MatchResult[] {
    const results: MatchResult[] = [];
    const now = Date.now();

    for (const [queueType, queue] of this.queues.entries()) {
      const matchSize = MATCH_SIZES[queueType];
      const found = this._matchInQueue(queue, queueType, matchSize, now);
      results.push(...found);
    }

    return results;
  }

  private _matchInQueue(
    queue: QueueEntry[],
    queueType: QueueType,
    matchSize: number,
    now: number,
  ): MatchResult[] {
    const results: MatchResult[] = [];
    // Sort oldest-first for fairness
    const sorted = [...queue].sort((a, b) => a.joinedAt - b.joinedAt);

    while (sorted.length >= matchSize) {
      const oldest = sorted[0]!;
      const waitMs = now - oldest.joinedAt;

      let ratingRange: number;
      if (waitMs >= TIMEOUT_MS || queueType === 'casual') {
        ratingRange = Infinity;
      } else {
        const expansions = Math.floor(waitMs / EXPAND_INTERVAL);
        ratingRange = BASE_RANGE + expansions * RANGE_EXPAND;
      }

      const candidates = sorted.filter(
        (e) => Math.abs(e.rating - oldest.rating) <= ratingRange,
      );

      if (candidates.length >= matchSize) {
        const matched = candidates.slice(0, matchSize);

        // Remove from working copy and from the live queue
        for (const m of matched) {
          const si = sorted.findIndex((e) => e.socketId === m.socketId);
          if (si !== -1) sorted.splice(si, 1);
          const qi = queue.findIndex((e) => e.socketId === m.socketId);
          if (qi !== -1) queue.splice(qi, 1);
        }

        results.push({
          players: matched,
          gameMode: GAME_MODES[queueType],
          queueType,
        });
      } else {
        break; // No match possible for this iteration
      }
    }

    return results;
  }
}
