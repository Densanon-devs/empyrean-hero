// ─────────────────────────────────────────────────────────────────────────────
// REST API helper — typed fetch wrapper with JWT auth
// ─────────────────────────────────────────────────────────────────────────────

// In production the client is served from the server — use relative URLs
const SERVER_URL = import.meta.env.PROD
  ? ''
  : ((import.meta.env['VITE_SERVER_URL'] as string | undefined) ?? 'http://localhost:3001');

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

// ── Typed API helpers ─────────────────────────────────────────────────────────

import type { PlayerStats } from '../context/AuthContext';

export interface AuthResponse {
  token: string;
  account: { id: string; username: string };
  stats: PlayerStats | null;
}

export async function apiRegister(
  username: string,
  password: string,
  email?: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, email }),
  });
}

export async function apiLogin(
  username: string,
  password: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export interface ProfileData {
  account: { id: string; username: string; createdAt: string };
  stats: (PlayerStats & { rankTier: string }) | null;
  matchHistory: MatchHistoryEntry[];
}

export interface MatchHistoryEntry {
  matchId: string;
  players: string[];
  winnerIds: string[] | null;
  ratingChanges: Array<{ accountId: string; oldRating: number; newRating: number; delta: number }>;
  timestamp: string;
  gameMode: string;
  queueType: string;
}

export async function apiGetProfile(username?: string): Promise<ProfileData> {
  return apiFetch<ProfileData>(username ? `/api/profile/${username}` : '/api/profile');
}

export interface LeaderboardEntry {
  rank: number;
  accountId: string;
  username: string;
  rating: number;
  rankTier: string;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
}

export async function apiGetLeaderboard(params?: {
  limit?: number;
  tier?: string;
}): Promise<{ leaderboard: LeaderboardEntry[] }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.tier) qs.set('tier', params.tier);
  const q = qs.toString();
  return apiFetch(`/api/leaderboard${q ? `?${q}` : ''}`);
}
