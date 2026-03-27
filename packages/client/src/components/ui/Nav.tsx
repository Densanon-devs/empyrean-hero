import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFriends } from '../../context/FriendsContext';
import { useGameContext } from '../../context/GameContext';
import { RankBadge } from './RankBadge';
import { getRankTier } from '@empyrean-hero/engine';
import { getSocket } from '../../socket/client';

// ─────────────────────────────────────────────────────────────────────────────
// Top navigation bar
// ─────────────────────────────────────────────────────────────────────────────

export function Nav() {
  const { user, logout } = useAuth();
  const { pendingRequests } = useFriends();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-empyrean-gold border-b border-empyrean-gold'
      : 'text-white/60 hover:text-white';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-4 py-3 bg-empyrean-navy/90 backdrop-blur border-b border-white/10">
      {/* Logo */}
      <Link to="/" className="font-display font-bold text-empyrean-gold tracking-widest mr-2">
        EH
      </Link>

      <Link to="/leaderboard" className={`text-sm font-medium transition-colors pb-0.5 ${isActive('/leaderboard')}`}>
        Leaderboard
      </Link>

      <div className="flex-1" />

      {user ? (
        <>
          {/* Friends link with notification badge */}
          <Link
            to="/friends"
            className={`relative text-sm font-medium transition-colors pb-0.5 ${isActive('/friends')}`}
          >
            Friends
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1.5 -right-2.5 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </Link>

          {/* Profile link with rank badge + rating */}
          <Link
            to="/profile"
            className={`flex items-center gap-2 text-sm font-medium transition-colors pb-0.5 ${isActive('/profile')}`}
          >
            {user.stats && (
              <RankBadge tier={getRankTier(user.stats.rating)} size={20} />
            )}
            <span className="max-w-[120px] truncate">{user.username}</span>
            {user.stats && (
              <span className="text-xs text-white/40">{user.stats.rating}</span>
            )}
          </Link>

          <button
            onClick={logout}
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </>
      ) : (
        <Link
          to="/login"
          className="text-sm font-medium text-empyrean-gold hover:text-empyrean-gold/80 transition-colors"
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game invite toast — shown when a friend invites you to a game
// ─────────────────────────────────────────────────────────────────────────────

export function InviteToast() {
  const { pendingInvite, clearInvite } = useFriends();
  const { dispatch, playerName } = useGameContext();
  const navigate = useNavigate();

  if (!pendingInvite) return null;

  function handleAccept() {
    const socket = getSocket();
    socket.emit('friend:invite-response', { roomCode: pendingInvite!.roomCode, accept: true });
    dispatch({
      type: 'SET_IDENTITY',
      playerId: '',
      playerName: playerName ?? 'Player',
      roomCode: pendingInvite!.roomCode,
    });
    clearInvite();
    navigate('/lobby');
  }

  function handleDecline() {
    const socket = getSocket();
    socket.emit('friend:invite-response', { roomCode: pendingInvite!.roomCode, accept: false });
    clearInvite();
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-empyrean-navy border border-empyrean-gold/40 rounded-xl px-4 py-3 shadow-xl max-w-xs animate-slide-up">
      <p className="text-sm font-semibold text-empyrean-gold mb-1">Game Invite</p>
      <p className="text-sm text-white/80 mb-3">
        <span className="font-medium text-white">{pendingInvite.fromUsername}</span>{' '}
        invited you to a game
      </p>
      <div className="flex gap-2">
        <button onClick={handleAccept} className="btn-primary flex-1 text-sm py-1.5">
          Join
        </button>
        <button onClick={handleDecline} className="btn-secondary flex-1 text-sm py-1.5">
          Decline
        </button>
      </div>
    </div>
  );
}
