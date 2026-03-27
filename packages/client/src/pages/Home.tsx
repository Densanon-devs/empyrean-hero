import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RankBadge } from '../components/ui/RankBadge';
import { getRankTier } from '@empyrean-hero/engine';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
      {/* Title */}
      <div className="animate-fade-in">
        <p className="text-sm font-display tracking-[0.4em] uppercase text-empyrean-gold/70 mb-2">
          A Tactical Card Game
        </p>
        <h1 className="font-display text-5xl sm:text-7xl font-bold text-empyrean-gold drop-shadow-[0_0_24px_rgba(212,175,55,0.4)]">
          Empyrean Hero
        </h1>
        <p className="mt-4 text-empyrean-ash/80 max-w-md mx-auto leading-relaxed">
          Draft your heroes. Build your strategy. Overcome your rivals.
        </p>
      </div>

      {/* User rank badge if logged in */}
      {user?.stats && (
        <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-5 py-3 animate-fade-in">
          <RankBadge tier={getRankTier(user.stats.rating)} size={36} />
          <div className="text-left">
            <p className="font-semibold text-white">{user.username}</p>
            <p className="text-xs text-white/40">
              {getRankTier(user.stats.rating)} · {user.stats.rating} rating
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs animate-slide-up">
        <button
          className="btn-primary text-center"
          onClick={() => navigate('/lobby')}
        >
          Play Online
        </button>
        <button
          className="btn-secondary text-center"
          onClick={() => navigate('/leaderboard')}
        >
          Leaderboard
        </button>
        {user ? (
          <button
            className="btn-secondary text-center"
            onClick={() => navigate('/profile')}
          >
            My Profile
          </button>
        ) : (
          <button
            className="btn-secondary text-center"
            onClick={() => navigate('/login')}
          >
            Sign In / Register
          </button>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-white/30 absolute bottom-6">
        v0.0.1 — Early Access
      </p>
    </div>
  );
}
