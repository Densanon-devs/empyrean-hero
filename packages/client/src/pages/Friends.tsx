import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFriends } from '../context/FriendsContext';
import { useGameContext } from '../context/GameContext';
import { RankBadge } from '../components/ui/RankBadge';
import { getSocket } from '../socket/client';
import type { RankTier } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Friends management page
// ─────────────────────────────────────────────────────────────────────────────

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { friends, pendingRequests, outgoingRequests, setFriendsList } = useFriends();
  const { roomCode } = useGameContext();

  const [addUsername, setAddUsername] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    // Request fresh friend list from server
    const socket = getSocket();
    socket.emit('friend:list', (result) => {
      setFriendsList(result);
    });
  }, [user, navigate, setFriendsList]);

  function handleAdd() {
    if (!addUsername.trim()) return;
    setAddError(null);
    setAddSuccess(false);
    const socket = getSocket();
    socket.emit('friend:request', addUsername.trim(), (result) => {
      if (!result.success) {
        setAddError(result.error ?? 'Failed to send request');
      } else {
        setAddSuccess(true);
        setAddUsername('');
        setTimeout(() => setAddSuccess(false), 3000);
      }
    });
  }

  function handleAccept(requestId: string) {
    const socket = getSocket();
    socket.emit('friend:accept', requestId, (result) => {
      if (result.success) {
        // Refresh list
        socket.emit('friend:list', setFriendsList);
      }
    });
  }

  function handleDecline(requestId: string) {
    const socket = getSocket();
    socket.emit('friend:decline', requestId, (result) => {
      if (result.success) {
        socket.emit('friend:list', setFriendsList);
      }
    });
  }

  function handleRemove(friendAccountId: string) {
    const socket = getSocket();
    socket.emit('friend:remove', friendAccountId, (result) => {
      if (result.success) {
        socket.emit('friend:list', setFriendsList);
      }
    });
  }

  function handleInvite(friendAccountId: string) {
    if (!roomCode) return;
    const socket = getSocket();
    socket.emit('friend:invite', friendAccountId, () => {});
  }

  const pendingCount = pendingRequests.length;

  return (
    <div className="min-h-dvh pt-20 px-4 pb-8">
      <div className="max-w-lg mx-auto space-y-5">

        <h1 className="font-display text-3xl font-bold text-empyrean-gold">Friends</h1>

        {/* Add friend */}
        <div className="panel">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-3">
            Add Friend
          </h2>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-empyrean-gold/60 text-sm"
              placeholder="Enter username…"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              maxLength={24}
            />
            <button
              className="btn-primary px-4 py-2 text-sm"
              onClick={handleAdd}
              disabled={!addUsername.trim()}
            >
              Send
            </button>
          </div>
          {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
          {addSuccess && <p className="text-green-400 text-xs mt-2">Friend request sent!</p>}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('friends')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'friends'
                ? 'border-empyrean-gold bg-empyrean-gold/20 text-empyrean-gold'
                : 'border-white/20 bg-white/5 text-white/50'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setTab('requests')}
            className={`relative flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'requests'
                ? 'border-empyrean-gold bg-empyrean-gold/20 text-empyrean-gold'
                : 'border-white/20 bg-white/5 text-white/50'
            }`}
          >
            Requests
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Friends list */}
        {tab === 'friends' && (
          <div className="panel p-0 overflow-hidden">
            {friends.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">
                No friends yet. Add someone to get started!
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {friends.map((f) => (
                  <li key={f.accountId} className="flex items-center gap-3 px-4 py-3">
                    {/* Online indicator */}
                    <span
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        f.online ? 'bg-green-400' : 'bg-white/20'
                      }`}
                    />
                    <RankBadge tier={f.rankTier as RankTier} size={24} />
                    <Link
                      to={`/profile/${f.username}`}
                      className="flex-1 font-medium hover:text-empyrean-gold transition-colors truncate"
                    >
                      {f.username}
                    </Link>
                    <span className="text-xs text-white/40">{f.rating}</span>
                    <div className="flex gap-1">
                      {roomCode && f.online && (
                        <button
                          onClick={() => handleInvite(f.accountId)}
                          className="text-xs rounded px-2 py-1 bg-empyrean-gold/20 text-empyrean-gold hover:bg-empyrean-gold/30 transition-colors"
                          title="Invite to game"
                        >
                          Invite
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(f.accountId)}
                        className="text-xs rounded px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Remove friend"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Requests tab */}
        {tab === 'requests' && (
          <div className="space-y-3">
            {/* Incoming */}
            {pendingRequests.length > 0 && (
              <div className="panel">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
                  Incoming
                </h3>
                <ul className="space-y-2">
                  {pendingRequests.map((req) => (
                    <li key={req.requestId} className="flex items-center gap-3">
                      <span className="flex-1 text-sm font-medium">{req.fromUsername}</span>
                      <button
                        onClick={() => handleAccept(req.requestId)}
                        className="text-xs rounded px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(req.requestId)}
                        className="text-xs rounded px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        Decline
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Outgoing */}
            {outgoingRequests.length > 0 && (
              <div className="panel">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
                  Sent
                </h3>
                <ul className="space-y-2">
                  {outgoingRequests.map((req) => (
                    <li key={req.requestId} className="flex items-center gap-3">
                      <span className="flex-1 text-sm font-medium">{req.toUsername}</span>
                      <span className="text-xs text-white/30">Pending…</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pendingRequests.length === 0 && outgoingRequests.length === 0 && (
              <p className="text-white/40 text-sm text-center py-8">No pending requests</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
