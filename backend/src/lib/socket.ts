import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Annotation } from '../types';

export type AnnotationEvent =
  | { type: 'annotation:created'; annotation: Annotation }
  | { type: 'annotation:updated'; annotation: Annotation }
  | { type: 'annotation:deleted'; annotationId: string; orgId: string };

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    },
  });

  // Auth middleware: verify JWT on socket connection
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization ?? '').replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return next(new Error('Server config error'));

    try {
      const payload = jwt.verify(token, jwtSecret) as { id: string; email: string };
      socket.data.userId = payload.id;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[socket] Client connected: ${socket.data.email} (${socket.id})`);

    // Clients join org-specific rooms to scope annotation events
    socket.on('join:org', (orgId: string) => {
      void socket.join(`org:${orgId}`);
      console.log(`[socket] ${socket.data.email} joined room org:${orgId}`);
    });

    socket.on('leave:org', (orgId: string) => {
      void socket.leave(`org:${orgId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastAnnotationEvent(orgId: string, event: AnnotationEvent): void {
  if (!io) return;
  io.to(`org:${orgId}`).emit('annotation:event', event);
}

export function getIO(): SocketIOServer | null {
  return io;
}
