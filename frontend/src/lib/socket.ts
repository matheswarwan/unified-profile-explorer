'use client';

import { io, Socket } from 'socket.io-client';
import { Annotation } from './api';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api')
  .replace('/api', ''); // socket.io connects to the root, not /api

let socket: Socket | null = null;

export type AnnotationEvent =
  | { type: 'annotation:created'; annotation: Annotation }
  | { type: 'annotation:updated'; annotation: Annotation }
  | { type: 'annotation:deleted'; annotationId: string; orgId: string };

export function getSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[socket] Connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] Disconnected:', reason);
  });

  return socket;
}

export function joinOrgRoom(token: string, orgId: string): Socket {
  const s = getSocket(token);
  s.emit('join:org', orgId);
  return s;
}

export function leaveOrgRoom(orgId: string): void {
  socket?.emit('leave:org', orgId);
}

export function onAnnotationEvent(
  s: Socket,
  handler: (event: AnnotationEvent) => void
): () => void {
  s.on('annotation:event', handler);
  return () => s.off('annotation:event', handler);
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
