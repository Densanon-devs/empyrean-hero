import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { STARTING_RATING } from '@empyrean-hero/engine';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/db.json');

// ─────────────────────────────────────────────────────────────────────────────
// Persistent data models
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerAccount {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  createdAt: string;
}

export interface PlayerStats {
  accountId: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
}

export interface MatchRecord {
  matchId: string;
  /** accountIds of all participants */
  players: string[];
  /** accountIds of winners, or null for draw */
  winnerIds: string[] | null;
  ratingChanges: Array<{
    accountId: string;
    oldRating: number;
    newRating: number;
    delta: number;
  }>;
  timestamp: string;
  gameMode: string;
  queueType: string;
}

export interface FriendRecord {
  id: string;
  /** accountId of the sender */
  userId: string;
  /** accountId of the recipient */
  friendId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: string;
}

interface DbSchema {
  accounts: PlayerAccount[];
  stats: Record<string, PlayerStats>;
  matches: MatchRecord[];
  friends: FriendRecord[];
}

const emptyDb: DbSchema = {
  accounts: [],
  stats: {},
  matches: [],
  friends: [],
};

function loadDb(): DbSchema {
  if (!existsSync(DB_PATH)) return structuredClone(emptyDb);
  try {
    const raw = readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw) as DbSchema;
  } catch {
    return structuredClone(emptyDb);
  }
}

function saveDb(db: DbSchema): void {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Database class
// ─────────────────────────────────────────────────────────────────────────────

export class Database {
  private db: DbSchema;

  constructor() {
    this.db = loadDb();
  }

  // ── Accounts ──────────────────────────────────────────────────────────────

  createAccount(username: string, passwordHash: string, email?: string): PlayerAccount {
    const account: PlayerAccount = {
      id: uuidv4(),
      username,
      passwordHash,
      email,
      createdAt: new Date().toISOString(),
    };
    this.db.accounts.push(account);
    this.db.stats[account.id] = {
      accountId: account.id,
      rating: STARTING_RATING,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
    };
    saveDb(this.db);
    return account;
  }

  findAccountByUsername(username: string): PlayerAccount | null {
    return (
      this.db.accounts.find(
        (a) => a.username.toLowerCase() === username.toLowerCase(),
      ) ?? null
    );
  }

  findAccountById(id: string): PlayerAccount | null {
    return this.db.accounts.find((a) => a.id === id) ?? null;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats(accountId: string): PlayerStats | null {
    return this.db.stats[accountId] ?? null;
  }

  updateStats(accountId: string, updates: Partial<PlayerStats>): void {
    const stats = this.db.stats[accountId];
    if (!stats) return;
    this.db.stats[accountId] = { ...stats, ...updates };
    saveDb(this.db);
  }

  getLeaderboard(limit = 50): Array<{ account: PlayerAccount; stats: PlayerStats }> {
    const sorted = Object.values(this.db.stats)
      .filter((s) => s.gamesPlayed > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);

    return sorted
      .map((stats) => {
        const account = this.findAccountById(stats.accountId);
        return account ? { account, stats } : null;
      })
      .filter((entry): entry is { account: PlayerAccount; stats: PlayerStats } => entry !== null);
  }

  // ── Matches ────────────────────────────────────────────────────────────────

  recordMatch(match: Omit<MatchRecord, 'matchId'>): MatchRecord {
    const record: MatchRecord = { matchId: uuidv4(), ...match };
    this.db.matches.push(record);
    saveDb(this.db);
    return record;
  }

  getMatchHistory(accountId: string, limit = 20): MatchRecord[] {
    return this.db.matches
      .filter((m) => m.players.includes(accountId))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // ── Friends ────────────────────────────────────────────────────────────────

  sendFriendRequest(senderId: string, receiverId: string): FriendRecord | null {
    const existing = this.db.friends.find(
      (f) =>
        (f.userId === senderId && f.friendId === receiverId) ||
        (f.userId === receiverId && f.friendId === senderId),
    );
    if (existing) return null;

    const record: FriendRecord = {
      id: uuidv4(),
      userId: senderId,
      friendId: receiverId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.db.friends.push(record);
    saveDb(this.db);
    return record;
  }

  acceptFriendRequest(requestId: string, receiverId: string): boolean {
    const record = this.db.friends.find(
      (f) => f.id === requestId && f.friendId === receiverId && f.status === 'pending',
    );
    if (!record) return false;
    record.status = 'accepted';
    saveDb(this.db);
    return true;
  }

  declineFriendRequest(requestId: string, receiverId: string): boolean {
    const idx = this.db.friends.findIndex(
      (f) => f.id === requestId && f.friendId === receiverId && f.status === 'pending',
    );
    if (idx === -1) return false;
    this.db.friends.splice(idx, 1);
    saveDb(this.db);
    return true;
  }

  removeFriend(userId: string, friendId: string): boolean {
    const idx = this.db.friends.findIndex(
      (f) =>
        ((f.userId === userId && f.friendId === friendId) ||
          (f.userId === friendId && f.friendId === userId)) &&
        f.status === 'accepted',
    );
    if (idx === -1) return false;
    this.db.friends.splice(idx, 1);
    saveDb(this.db);
    return true;
  }

  getAcceptedFriends(accountId: string): FriendRecord[] {
    return this.db.friends.filter(
      (f) =>
        (f.userId === accountId || f.friendId === accountId) &&
        f.status === 'accepted',
    );
  }

  getPendingRequests(accountId: string): FriendRecord[] {
    return this.db.friends.filter(
      (f) => f.friendId === accountId && f.status === 'pending',
    );
  }

  getOutgoingRequests(accountId: string): FriendRecord[] {
    return this.db.friends.filter(
      (f) => f.userId === accountId && f.status === 'pending',
    );
  }
}
