import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../socket/client';
import { RankBadge } from '../components/ui/RankBadge';
import { getRankTier } from '@empyrean-hero/engine';
import type { GameMode, QueueType } from '@empyrean-hero/engine';

const TEAM_COLORS: Record<string, string> = {
  A: 'text-sky-400',
  B: 'text-orange-400',
};

const TEAM_BG: Record<string, string> = {
  A: 'bg-sky-500/20 border-sky-500/50',
  B: 'bg-orange-500/20 border-orange-500/50',
};

const QUEUE_LABELS: Record<QueueType, string> = {
  'ranked-1v1': 'Ranked 1v1',
  'ranked-2v2': 'Ranked 2v2',
  'casual':     'Casual',
};

type LobbyView = 'menu' | 'lobby' | 'matchmaking';

export default function Lobby() {
  const navigate = useNavigate();
  const {
    dispatch, lobbyPlayers, roomCode, playerId, error, isConnected,
    roomMode, roomHostId, gameState, playerName: ctxPlayerName, matchmaking,
  } = useGameContext();
  const { user } = useAuth();

  const [playerName, setPlayerName] = useState(ctxPlayerName ?? user?.username ?? '');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState<LobbyView>('menu');

  // If we land here with a roomCode already (matchmaking result), show lobby
  useEffect(() => {
    if (roomCode && matchmaking.status === 'found') {
      setView('lobby');
    }
  }, [roomCode, matchmaking.status]);

  // Navigate to draft/game when server starts the session
  useEffect(() => {
    if (gameState && roomCode) {
      if (gameState.phase === 'draft' || gameState.phase === 'gameplay') {
        navigate(`/game/${roomCode}/draft`);
      }
    }
  }, [gameState, roomCode, navigate]);

  const socket = getSocket();
  const isHost = playerId === roomHostId;
  const isTeamPlay = roomMode === 'team-play';
  const myPlayer = lobbyPlayers.find((p) => p.id === playerId);

  // ── Lobby handlers ───────────────────────────────────────────────────────

  function handleCreate() {
    const name = (playerName || user?.username || '').trim();
    if (!name) return;
    dispatch({ type: 'SET_PLAYER_NAME', playerName: name });
    socket.emit('room:create', name, ({ roomCode: code, playerId: pid }) => {
      dispatch({ type: 'SET_IDENTITY', playerId: pid, playerName: name, roomCode: code });
      setView('lobby');
    });
  }

  function handleJoin() {
    const name = (playerName || user?.username || '').trim();
    if (!name || !joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();
    dispatch({ type: 'SET_PLAYER_NAME', playerName: name });
    socket.emit('room:join', code, name, (result) => {
      if (!result.success) {
        dispatch({ type: 'SET_ERROR', error: result.error ?? 'Failed to join' });
        return;
      }
      dispatch({ type: 'SET_IDENTITY', playerId: result.playerId ?? '', playerName: name, roomCode: code });
      setView('lobby');
    });
  }

  function handleReady() {
    socket.emit('room:ready');
  }

  function handleSetMode(mode: GameMode) {
    socket.emit('room:set-mode', mode, (result) => {
      if (!result.success) {
        dispatch({ type: 'SET_ERROR', error: result.error ?? 'Could not change mode' });
      }
    });
  }

  function handleSetTeam(teamId: string) {
    socket.emit('room:set-team', teamId, (result) => {
      if (!result.success) {
        dispatch({ type: 'SET_ERROR', error: result.error ?? 'Could not set team' });
      }
    });
  }

  // ── Matchmaking handlers ─────────────────────────────────────────────────

  function handleJoinQueue(queueType: QueueType) {
    const name = (playerName || user?.username || 'Player').trim();
    dispatch({ type: 'SET_PLAYER_NAME', playerName: name });
    socket.emit('matchmaking:join', { playerName: name, queueType }, (result) => {
      if (!result.success) {
        dispatch({ type: 'SET_ERROR', error: result.error ?? 'Could not join queue' });
        return;
      }
      dispatch({ type: 'MATCHMAKING_QUEUING', queueType });
      setView('matchmaking');
    });
  }

  function handleLeaveQueue() {
    socket.emit('matchmaking:leave');
    dispatch({ type: 'MATCHMAKING_IDLE' });
    setView('menu');
  }

  // ── In-lobby view ────────────────────────────────────────────────────────

  if (view === 'lobby' && roomCode) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 pt-16">
        <div className="panel w-full max-w-md">
          <h2 className="font-display text-2xl text-empyrean-gold mb-1">Room</h2>
          <p className="text-4xl font-display font-bold tracking-widest text-white mb-4">
            {roomCode}
          </p>
          <p className="text-sm text-white/50 mb-4">Share this code with friends</p>

          {/* Game mode selector (host only) */}
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-2">
              Game Mode
            </p>
            <div className="flex gap-2">
              {(['free-for-all', 'team-play'] as GameMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => isHost && handleSetMode(mode)}
                  disabled={!isHost}
                  className={[
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    roomMode === mode
                      ? 'border-empyrean-gold bg-empyrean-gold/20 text-empyrean-gold'
                      : 'border-white/20 bg-white/5 text-white/50',
                    isHost ? 'hover:border-white/40 cursor-pointer' : 'cursor-default opacity-70',
                  ].join(' ')}
                >
                  {mode === 'free-for-all' ? 'Free-For-All' : 'Team Play'}
                </button>
              ))}
            </div>
            {!isHost && (
              <p className="mt-1 text-xs text-white/30">Only the host can change the mode</p>
            )}
          </div>

          {/* Team selector */}
          {isTeamPlay && (
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-2">
                Your Team
              </p>
              <div className="flex gap-2">
                {['A', 'B'].map((team) => (
                  <button
                    key={team}
                    onClick={() => handleSetTeam(team)}
                    className={[
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                      myPlayer?.teamId === team
                        ? `${TEAM_BG[team]} ${TEAM_COLORS[team]}`
                        : 'border-white/20 bg-white/5 text-white/50 hover:border-white/40',
                    ].join(' ')}
                  >
                    Team {team}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Player list */}
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-2">
            Players ({lobbyPlayers.length})
          </h3>
          <ul className="space-y-2 mb-6">
            {lobbyPlayers.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${p.ready ? 'bg-green-400' : 'bg-white/30'}`} />
                <span className="flex-1">{p.name}</span>
                {isTeamPlay && p.teamId && (
                  <span className={`text-xs font-semibold ${TEAM_COLORS[p.teamId] ?? 'text-white/40'}`}>
                    Team {p.teamId}
                  </span>
                )}
                {p.id === roomHostId && (
                  <span className="text-xs text-empyrean-gold/70">Host</span>
                )}
                {p.ready && <span className="text-xs text-green-400">Ready</span>}
              </li>
            ))}
          </ul>

          <button className="btn-primary w-full" onClick={handleReady}>
            Ready Up
          </button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  // ── Matchmaking view ─────────────────────────────────────────────────────

  if (view === 'matchmaking') {
    const { queueType, queuePosition, queueSize, waitSeconds } = matchmaking;
    const mins = Math.floor(waitSeconds / 60);
    const secs = waitSeconds % 60;
    const waitLabel = mins > 0
      ? `${mins}m ${secs}s`
      : `${secs}s`;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
        <button
          className="absolute top-4 left-4 text-white/40 hover:text-white text-sm"
          onClick={handleLeaveQueue}
        >
          ← Cancel
        </button>

        <div className="panel w-full max-w-sm text-center space-y-6">
          <div className="animate-pulse">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full border-4 border-empyrean-gold/40 border-t-empyrean-gold animate-spin" />
            <h2 className="font-display text-2xl text-empyrean-gold">
              {queueType ? QUEUE_LABELS[queueType] : 'Finding Match'}
            </h2>
            <p className="text-white/60 mt-2">Searching for opponents…</p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{waitLabel}</p>
              <p className="text-xs text-white/40">Wait time</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{queuePosition}</p>
              <p className="text-xs text-white/40">Position</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{queueSize}</p>
              <p className="text-xs text-white/40">In queue</p>
            </div>
          </div>

          {user?.stats && (
            <div className="flex items-center justify-center gap-2 text-sm text-white/50">
              <RankBadge tier={getRankTier(user.stats.rating)} size={24} />
              <span>{getRankTier(user.stats.rating)}</span>
              <span className="text-empyrean-gold font-bold">{user.stats.rating}</span>
            </div>
          )}

          <button
            className="btn-secondary w-full text-sm"
            onClick={handleLeaveQueue}
          >
            Cancel Queue
          </button>
        </div>
      </div>
    );
  }

  // ── Menu view ────────────────────────────────────────────────────────────

  const nameValue = playerName || user?.username || '';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 pt-16">
      <button
        className="absolute top-16 left-4 text-white/40 hover:text-white text-sm"
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      {!isConnected && (
        <p className="text-yellow-400 text-sm">Connecting to server…</p>
      )}

      {/* Custom room */}
      <div className="panel w-full max-w-sm space-y-4">
        <h2 className="font-display text-2xl text-empyrean-gold">Private Room</h2>

        {!user && (
          <div>
            <label className="block text-sm text-white/60 mb-1">Your Name</label>
            <input
              className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-empyrean-gold/60"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={24}
            />
          </div>
        )}

        <button
          className="btn-primary w-full"
          onClick={handleCreate}
          disabled={!nameValue.trim()}
        >
          Create Room
        </button>

        <div className="flex items-center gap-2 text-white/30 text-sm">
          <div className="flex-1 border-t border-white/10" />
          or join
          <div className="flex-1 border-t border-white/10" />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1">Room Code</label>
          <input
            className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/30 uppercase tracking-widest focus:outline-none focus:border-empyrean-gold/60"
            placeholder="XXXX"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
          />
        </div>

        <button
          className="btn-secondary w-full"
          onClick={handleJoin}
          disabled={!nameValue.trim() || joinCode.length !== 4}
        >
          Join Room
        </button>
      </div>

      {/* Matchmaking */}
      <div className="panel w-full max-w-sm space-y-3">
        <h2 className="font-display text-2xl text-empyrean-gold">Find Match</h2>

        {user?.stats && (
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
            <RankBadge tier={getRankTier(user.stats.rating)} size={28} />
            <div>
              <p className="text-sm font-semibold text-white">{getRankTier(user.stats.rating)}</p>
              <p className="text-xs text-white/40">{user.stats.rating} rating</p>
            </div>
            <div className="flex-1" />
            <div className="text-xs text-white/40 text-right">
              <p>{user.stats.wins}W / {user.stats.losses}L</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {(['ranked-1v1', 'ranked-2v2'] as QueueType[]).map((qt) => (
            <button
              key={qt}
              className="btn-primary w-full text-sm"
              onClick={() => handleJoinQueue(qt)}
              disabled={!user}
              title={!user ? 'Sign in to play ranked' : undefined}
            >
              {QUEUE_LABELS[qt]}
              {!user && <span className="text-xs opacity-60 ml-2">(Sign in required)</span>}
            </button>
          ))}
          <button
            className="btn-secondary w-full text-sm"
            onClick={() => handleJoinQueue('casual')}
            disabled={!nameValue.trim()}
          >
            {QUEUE_LABELS['casual']}
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
