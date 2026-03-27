import { useEffect, useRef } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '../socket/client';
import { useGameContext } from '../context/GameContext';

// ─────────────────────────────────────────────────────────────────────────────
// useSocket — manages socket lifecycle and wires server events to context
// ─────────────────────────────────────────────────────────────────────────────

export function useSocket() {
  const { dispatch } = useGameContext();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    const socket = getSocket();
    dispatch({ type: 'SET_SOCKET', socket });

    // ── Connection events ───────────────────────────────────────────────────
    socket.on('connect', () => dispatch({ type: 'CONNECTED' }));
    socket.on('disconnect', () => dispatch({ type: 'DISCONNECTED' }));

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
    socket.on('game:error', (msg) => dispatch({ type: 'SET_ERROR', error: msg }));

    // ── Draft events ────────────────────────────────────────────────────────
    socket.on('draft:state', (state) => {
      dispatch({ type: 'SET_DRAFT_STATE', state });
    });

    connectSocket();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:players');
      socket.off('room:config');
      socket.off('room:error');
      socket.off('game:state');
      socket.off('game:error');
      socket.off('draft:state');
      disconnectSocket();
      registeredRef.current = false;
    };
  }, [dispatch]);

  return getSocket();
}
