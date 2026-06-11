'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

let socket: Socket | null = null;
let socketToken: string | null = null;
let socketBranchId: string | null = null;

function getSocket(): Socket {
  const { accessToken, branchId } = useAuthStore.getState();

  // If token changed (refresh happened) or socket doesn't exist, (re)connect
  if (socket && socketToken === accessToken) {
    // Socket exists with same token — but check if branchId changed
    // and we need to join a new room
    if (branchId && branchId !== socketBranchId) {
      socketBranchId = branchId;
      socket.emit('join:branch', { branchId });
    }
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socketToken  = accessToken;
  socketBranchId = branchId;

  socket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/orders`, {
    auth: { token: accessToken },
    transports: ['websocket'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[WS] Connected, joining branch:', branchId);
    // Always re-read branchId from store on connect/reconnect
    const currentBranchId = useAuthStore.getState().branchId;
    if (currentBranchId) {
      socketBranchId = currentBranchId;
      socket?.emit('join:branch', { branchId: currentBranchId });
    }
  });

  socket.on('disconnect', () => {
    console.log('[WS] Disconnected');
  });

  socket.on('connect_error', (err) => {
    console.warn('[WS] Connection error:', err.message);
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
        socketToken = null;
      }
      // If branchId changes, rejoin the new branch room
      if (state.branchId !== prev.branchId && socket?.connected) {
        socketBranchId = state.branchId;
        if (state.branchId) {
          socket?.emit('join:branch', { branchId: state.branchId });
        }
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
  socketToken  = null;
  socketBranchId = null;
}