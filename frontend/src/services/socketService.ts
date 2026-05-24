/**
 * Singleton Socket.IO client for the notification bell and other global
 * real-time features. Pages that need their own per-session socket
 * (VideoMeetingRoom, ProctoringMonitor, etc.) continue to create their own
 * connections — this service is only for cross-page persistent events.
 */
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) || 'http://localhost:5001';

let _socket: Socket | null = null;

/** Get or lazily create the global Socket.IO connection. */
export function getSocket(): Socket {
  if (!_socket || !_socket.connected) {
    const token = localStorage.getItem('token');
    _socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
      reconnectionDelay:    1_000,
      reconnectionDelayMax: 10_000,
    });

    _socket.on('connect', () => {
      // Noop — connection handled automatically; token auth done server-side
    });

    _socket.on('connect_error', (err) => {
      // Log silently — real-time is a progressive enhancement, not a hard requirement
      if (import.meta.env.DEV) {
        console.warn('[NotificationSocket] connection error:', err.message);
      }
    });
  }
  return _socket;
}

/**
 * Tear down the existing socket and create a fresh one with the latest token.
 * Call this after login / token refresh.
 */
export function reconnectSocket(): Socket {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  return getSocket();
}

/** Disconnect and clean up (call on logout). */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
