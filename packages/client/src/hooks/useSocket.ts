import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket, connectSocket, disconnectSocket } from '../socket/client';
import { useGameContext } from '../context/GameContext';
import { useFriends } from '../context/FriendsContext';

// ─────────────────────────────────────────────────────────────────────────────
// useSocket — manages socket lifecycle and wires server events to context
// ─────────────────────────────────────────────────────────────────────────────

export function useSocket() {
  const { dispatch } = useGameContext();
  const friends = useFriends();
  const navigate = useNavigate();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    const socket = getSocket();
    dispatch({ type: 'SET_SOCKET', socket });

    // ── Connection events ───────────────────────────────────────────────────
    socket.on('connect', () => dispatch({ type: 'CONNECTED' }));
    socket.on('disconnect', () => {
      dispatch({ type: 'DISCONNECTED' });
      dispatch({ type: 'MATCHMAKING_IDLE' });
    });

    // ── Room events ─────────────────────────────────────────────────────────
    socket.on('room:players', (players) => {
      dispatch({ type: 'SET_LOBBY_PLAYERS', players });
    });
    socket.on('room:config', (config) => {
      dispatch({ type: 'SET_ROOM_CONFIG', mode: config.gameMode, hostId: config.hostId });
    });
    socket.on('room:error', (msg) => dispatch({ type: 'SET_ERROR', error: msg }));

    // ── Game events ─────────────────────────────────────────────────────────
    socket.on('game:state', (state) => {
      dispatch({ type: 'SET_GAME_STATE', state });
    });
    socket.on('game:event', (event) => {
      dispatch({ type: 'ADD_GAME_EVENT', event });
    });
    socket.on('game:error', (msg) => dispatch({ type: 'SET_ERROR', error: msg }));

    // ── Draft events ────────────────────────────────────────────────────────
    socket.on('draft:state', (state) => {
      dispatch({ type: 'SET_DRAFT_STATE', state });
    });

    // ── Matchmaking events ──────────────────────────────────────────────────
    socket.on('matchmaking:status', (status) => {
      dispatch({
        type: 'MATCHMAKING_STATUS',
        position: status.position,
        queueSize: status.queueSize,
        waitSeconds: status.waitSeconds,
      });
    });

    socket.on('matchmaking:found', ({ roomCode, playerId }) => {
      dispatch({ type: 'MATCHMAKING_FOUND', playerId, roomCode });
      // Navigate to lobby — Lobby will auto-navigate to draft once gameState arrives
      navigate('/lobby');
    });

    socket.on('matchmaking:cancelled', () => {
      dispatch({ type: 'MATCHMAKING_IDLE' });
    });

    // ── Friend events ───────────────────────────────────────────────────────
    socket.on('friend:request-received', (req) => {
      friends.addPendingRequest(req);
    });

    socket.on('friend:status-update', ({ accountId, online: isOnline }) => {
      friends.updateFriendStatus(accountId, isOnline);
    });

    socket.on('friend:invite-received', (invite) => {
      friends.setInvite(invite);
    });

    connectSocket();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:players');
      socket.off('room:config');
      socket.off('room:error');
      socket.off('game:state');
      socket.off('game:event');
      socket.off('game:error');
      socket.off('draft:state');
      socket.off('matchmaking:status');
      socket.off('matchmaking:found');
      socket.off('matchmaking:cancelled');
      socket.off('friend:request-received');
      socket.off('friend:status-update');
      socket.off('friend:invite-received');
      disconnectSocket();
      registeredRef.current = false;
    };
  }, [dispatch, friends, navigate]);

  return getSocket();
}
