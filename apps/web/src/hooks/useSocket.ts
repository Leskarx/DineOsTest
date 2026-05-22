'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

let socket: Socket | null = null;
// Track the token the current socket was created with.
// When the axios interceptor silently refreshes the access token, the old
// socket is still authenticated with the original (now-expired) token.
// After the gateway adds JWT verification (§1.2 fix), the old socket would
// be disconnected by the server on the next round-trip. We proactively
// reconnect when the token changes so real-time events are never lost.
let socketToken: string | null = null;

function getSocket(): Socket {
  const { accessToken, branchId } = useAuthStore.getState();

  // If token changed (refresh happened) or socket doesn't exist, (re)connect
  if (socket && socketToken === accessToken) return socket;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socketToken = accessToken;
  socket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/orders`, {
    auth: { token: accessToken },
    transports: ['websocket'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    if (branchId) socket?.emit('join:branch', { branchId });
  });

  socket.on('disconnect', () => {
    console.log('[WS] Disconnected');
  });

  return socket;
}

export function useSocket(event: string, handler: (data: any) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const s = getSocket();
    const fn = (data: any) => handlerRef.current(data);
    s.on(event, fn);
    return () => { s.off(event, fn); };
  }, [event]);

  // When the access token is refreshed, reset socketToken so the next
  // getSocket() call recreates the connection with the new credential.
  useEffect(() => {
    return useAuthStore.subscribe((state, prev) => {
      if (state.accessToken !== prev.accessToken) {
        socketToken = null; // triggers reconnect on next getSocket() call
      }
    });
  }, []);
}

export function emitSocket(event: string, data: any) {
  getSocket().emit(event, data);
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
