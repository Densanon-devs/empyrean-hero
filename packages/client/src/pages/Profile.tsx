import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGetProfile, type ProfileData } from '../api/client';
import { RankBadge, getRankColor } from '../components/ui/RankBadge';
import { getRankTier } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Profile page — own profile or public profile by username
// ─────────────────────────────────────────────────────────────────────────────

export default function Profile() {
  const { username } = useParams<{ username?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = !username || username === user?.username;

  useEffect(() => {
    if (isOwnProfile && !user) {
      navigate('/login');
      return;
    }
    setLoading(true);
    setError(null);
    apiGetProfile(isOwnProfile ? undefined : username)
      .then(setProfile)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [username, isOwnProfile, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-white/50 animate-pulse">Loading profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error ?? 'Profile not found'}</p>
        <button className="btn-secondary" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  const { account, stats, matchHistory } = profile;
  const tier = stats ? getRankTier(stats.rating) : null;
  const winRate = stats && stats.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : null;

  return (
    <div className="min-h-dvh pt-20 px-4 pb-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header card */}
        <div className="panel flex items-center gap-5">
          {tier && <RankBadge tier={tier} size={56} />}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-white truncate">{account.username}</h1>
            {tier && (
              <p className="text-sm font-semibold" style={{ color: getRankColor(tier) }}>
                {tier}
              </p>
            )}
            <p className="text-xs text-white/30 mt-1">
              Joined {new Date(account.createdAt).toLocaleDateString()}
            </p>
          </div>
          {stats && (
            <div className="text-right">
              <p className="text-3xl font-display font-bold text-empyrean-gold">{stats.rating}</p>
              <p className="text-xs text-white/40">Rating</p>
            </div>
          )}
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Wins',   value: stats.wins,        color: 'text-green-400' },
              { label: 'Losses', value: stats.losses,       color: 'text-red-400' },
              { label: 'Draws',  value: stats.draws,        color: 'text-white/60' },
              { label: 'Win Rate', value: winRate != null ? `${winRate}%` : '—', color: 'text-empyrean-gold' },
            ].map(({ label, value, color }) => (
              <div key={label} className="panel text-center py-4">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-white/40 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Match history */}
        <div className="panel">
          <h2 className="font-display text-lg text-empyrean-gold mb-4">Match History</h2>
          {matchHistory.length === 0 ? (
            <p className="text-white/40 text-sm">No matches played yet</p>
          ) : (
            <ul className="space-y-2">
              {matchHistory.map((match) => {
                const won = match.winnerIds?.includes(account.id);
                const isDraw = match.winnerIds === null;
                const myChange = match.ratingChanges.find((c) => c.accountId === account.id);
                return (
                  <li
                    key={match.matchId}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      isDraw
                        ? 'bg-white/5'
                        : won
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold w-8 ${
                        isDraw ? 'text-white/50' : won ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {isDraw ? 'DRAW' : won ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="flex-1 text-xs text-white/50">
                      {match.gameMode} · {match.queueType}
                    </span>
                    {myChange && (
                      <span
                        className={`text-xs font-semibold ${
                          myChange.delta >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {myChange.delta >= 0 ? '+' : ''}{myChange.delta}
                      </span>
                    )}
                    <span className="text-xs text-white/30">
                      {new Date(match.timestamp).toLocaleDateString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
