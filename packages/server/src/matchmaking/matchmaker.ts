// ─────────────────────────────────────────────────────────────────────────────
// Matchmaker — placeholder for automatic game pairing
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchmakingEntry {
  socketId: string;
  playerId: string;
  playerName: string;
  enqueuedAt: Date;
}

/**
 * Basic queue-based matchmaker.
 *
 * TODO: Replace with a proper Elo-based or skill-based system.
 * For now, simply pairs the first two players who join the queue.
 */
export class Matchmaker {
  private queue: MatchmakingEntry[] = [];

  enqueue(entry: MatchmakingEntry): void {
    if (this.queue.some((e) => e.socketId === entry.socketId)) return;
    this.queue.push(entry);
    console.log(`[matchmaking] enqueued ${entry.playerName} — queue size: ${this.queue.length}`);
  }

  dequeue(socketId: string): void {
    this.queue = this.queue.filter((e) => e.socketId !== socketId);
  }

  /** Try to form a match. Returns a pair of entries if found, otherwise null. */
  tryMatch(): [MatchmakingEntry, MatchmakingEntry] | null {
    if (this.queue.length < 2) return null;
    const a = this.queue.shift()!;
    const b = this.queue.shift()!;
    console.log(`[matchmaking] matched ${a.playerName} vs ${b.playerName}`);
    return [a, b];
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
