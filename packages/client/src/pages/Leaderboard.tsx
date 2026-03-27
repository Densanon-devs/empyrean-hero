import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGetLeaderboard, type LeaderboardEntry } from '../api/client';
import { RankBadge, getRankColor } from '../components/ui/RankBadge';
import type { RankTier } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard page
// ─────────────────────────────────────────────────────────────────────────────

const TIERS: Array<RankTier | 'All'> = ['All', 'Empyrean', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<RankTier | 'All'>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGetLeaderboard({ limit: 100, tier: tierFilter === 'All' ? undefined : tierFilter })
      .then((res) => setEntries(res.leaderboard))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, [tierFilter]);

  const filtered = search.trim()
    ? entries.filter((e) => e.username.toLowerCase().includes(search.toLowerCase()))
    : entries;

  return (
    <div className="min-h-dvh pt-20 px-4 pb-8">
      <div className="max-w-2xl mx-auto">

        <h1 className="font-display text-3xl font-bold text-empyrean-gold mb-6">Leaderboard</h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <input
            className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-empyrean-gold/60 text-sm"
            placeholder="Search player…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Tier filter */}
          <div className="flex gap-1 flex-wrap">
            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={[
                  'rounded-lg px-2 py-1 text-xs font-semibold border transition-colors',
                  tierFilter === t
                    ? 'border-empyrean-gold bg-empyrean-gold/20 text-empyrean-gold'
                    : 'border-white/20 bg-white/5 text-white/50 hover:border-white/40',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-white/50 animate-pulse text-center py-8">Loading…</p>
        ) : error ? (
          <p className="text-red-400 text-center py-8">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-white/40 text-center py-8">No players found</p>
        ) : (
          <div className="panel p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-white/40 font-medium w-10">#</th>
                  <th className="text-left px-4 py-3 text-white/40 font-medium">Player</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium">Rating</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium hidden sm:table-cell">W</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium hidden sm:table-cell">L</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium hidden sm:table-cell">Games</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.accountId}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-white/30 font-mono">{entry.rank}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/profile/${entry.username}`}
                        className="flex items-center gap-2 hover:text-empyrean-gold transition-colors"
                      >
                        <RankBadge tier={entry.rankTier as RankTier} size={20} />
                        <span className="font-medium">{entry.username}</span>
                        <span
                          className="text-xs hidden sm:inline"
                          style={{ color: getRankColor(entry.rankTier as RankTier) }}
                        >
                          {entry.rankTier}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-empyrean-gold">
                      {entry.rating}
                    </td>
                    <td className="px-4 py-3 text-right text-green-400 hidden sm:table-cell">
                      {entry.wins}
                    </td>
                    <td className="px-4 py-3 text-right text-red-400 hidden sm:table-cell">
                      {entry.losses}
                    </td>
                    <td className="px-4 py-3 text-right text-white/40 hidden sm:table-cell">
                      {entry.gamesPlayed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
