/**
 * Sends realtime events to connected apps (ARCHITECTURE §9). Feature services call this AFTER
 * their database write succeeded; if nobody is connected the event is simply dropped (apps
 * refetch on screen focus / reconnect, so nothing is lost).
 *
 * Rooms: `user:<id>` (every socket of that user joins automatically) and `conversation:<id>`
 * (joined on request, after a membership check).
 */
import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

export const userRoom = (userId: string) => `user:${userId}`;
export const conversationRoom = (conversationId: string) => `conversation:${conversationId}`;

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  /** Called once by the gateway when socket.io starts. */
  attach(server: Server): void {
    this.server = server;
  }

  /**
   * Drop every live socket of a user (suspension, password reset, stolen session). The app reconnects
   * with a fresh token if it still has a valid session; otherwise the handshake is refused.
   */
  disconnectUser(userId: string): void {
    this.server?.in(userRoom(userId)).disconnectSockets(true);
  }

  /** Emit once per socket even if it is in several of the rooms. */
  emit(rooms: string[], event: string, payload: unknown): void {
    if (!this.server || rooms.length === 0) return;
    this.server.to(rooms).emit(event, payload);
  }
}
