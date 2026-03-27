import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io client singleton
// ─────────────────────────────────────────────────────────────────────────────

const SERVER_URL = import.meta.env.PROD
  ? window.location.origin
  : ((import.meta.env['VITE_SERVER_URL'] as string | undefined) ?? 'http://localhost:3001');

/** Typed socket singleton — created lazily on first use */
let _socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!_socket) {
    const token = localStorage.getItem('auth_token') ?? undefined;
    _socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket'],
      auth: token ? { token } : {},
    });
  }
  return _socket;
}

export function connectSocket(): void {
  getSocket().connect();
}

/** Recreate socket with updated auth token (call after login/logout) */
export function resetSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

export function disconnectSocket(): void {
  _socket?.disconnect();
  _socket = null;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
