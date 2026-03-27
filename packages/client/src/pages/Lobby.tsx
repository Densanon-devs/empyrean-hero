import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { getSocket } from '../socket/client';
import type { GameMode } from '@empyrean-hero/engine';

const TEAM_COLORS: Record<string, string> = {
  A: 'text-sky-400',
  B: 'text-orange-400',
};

const TEAM_BG: Record<string, string> = {
  A: 'bg-sky-500/20 border-sky-500/50',
  B: 'bg-orange-500/20 border-orange-500/50',
};

export default function Lobby() {
  const navigate = useNavigate();
  const {
    dispatch, lobbyPlayers, roomCode, playerId, error, isConnected,
    roomMode, roomHostId,
  } = useGameContext();

  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState<'menu' | 'lobby'>('menu');

  const socket = getSocket();
  const isHost = playerId === roomHostId;
  const isTeamPlay = roomMode === 'team-play';
  const myPlayer = lobbyPlayers.find((p) => p.id === playerId);

  function handleCreate() {
    if (!playerName.trim()) return;
    socket.emit('room:create', playerName.trim(), (code) => {
      dispatch({ type: 'SET_IDENTITY', playerId: playerId ?? '', playerName: playerName.trim(), roomCode: code });
      setView('lobby');
    });
  }

  function handleJoin() {
    if (!playerName.trim() || !joinCode.trim()) return;
    socket.emit('room:join', joinCode.trim().toUpperCase(), playerName.trim(), (result) => {
      if (!result.success) {
        dispatch({ type: 'SET_ERROR', error: result.error ?? 'Failed to join' });
        return;
      }
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

  if (view === 'lobby' && roomCode) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
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

          {/* Team selector (Team Play mode only) */}
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

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <button
        className="absolute top-4 left-4 text-white/40 hover:text-white text-sm"
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      {!isConnected && (
        <p className="text-yellow-400 text-sm">Connecting to server…</p>
      )}

      <div className="panel w-full max-w-sm space-y-4">
        <h2 className="font-display text-2xl text-empyrean-gold">Join or Create</h2>

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

        <button className="btn-primary w-full" onClick={handleCreate} disabled={!playerName.trim()}>
          Create Room
        </button>

        <div className="flex items-center gap-2 text-white/30 text-sm">
          <div className="flex-1 border-t border-white/10" />
          or
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
          disabled={!playerName.trim() || joinCode.length !== 4}
        >
          Join Room
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
