/**
 * socket.io gateway (FR-251, ARCHITECTURE §9) — at `/socket.io` on the API server.
 *
 * Handshake: the app connects with `auth: { token: <access token> }`. The token's SIGNATURE and
 * expiry are verified (TokenService) and the user must be ACTIVE — otherwise the connection is
 * refused with `connect_error` "AUTH_FAILED". (The old CampusConnect only decoded the token, so
 * anyone could impersonate anyone.)
 *
 * On connect every socket joins `user:<id>`. `conversation:join` is allowed only for the two
 * participants (DB check). Clients never SEND messages over the socket — that is REST.
 */
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ClientEvent, UserStatus, type SocketAck } from '@cc/shared';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenService } from '../auth/token.service.js';
import { conversationRoom, RealtimeService, userRoom } from './realtime.service.js';

const joinSchema = z.object({ conversationId: z.uuid() }).strict();

interface SocketData {
  userId: string;
}

@WebSocketGateway({ cors: false, serveClient: false })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger('Realtime');

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
    server.use((socket, next) => {
      void this.authenticate(socket)
        .then(() => next())
        .catch(() => next(new Error('AUTH_FAILED')));
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const { userId } = socket.data as SocketData;
    await socket.join(userRoom(userId));
  }

  @SubscribeMessage(ClientEvent.CONVERSATION_JOIN)
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<SocketAck> {
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' };
    const { userId } = socket.data as SocketData;
    const isMember = await this.prisma.conversation.count({
      where: { id: parsed.data.conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    });
    if (!isMember) return { ok: false, code: 'NOT_FOUND' };
    await socket.join(conversationRoom(parsed.data.conversationId));
    return { ok: true };
  }

  @SubscribeMessage(ClientEvent.CONVERSATION_LEAVE)
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<SocketAck> {
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' };
    await socket.leave(conversationRoom(parsed.data.conversationId));
    return { ok: true };
  }

  private async authenticate(socket: Socket): Promise<void> {
    const token: unknown = (socket.handshake.auth as Record<string, unknown> | undefined)?.token;
    if (typeof token !== 'string' || token.length > 4096) throw new Error('no token');
    const { userId } = await this.tokens.verifyAccessToken(token);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (user?.status !== UserStatus.ACTIVE) throw new Error('inactive user');
    (socket.data as SocketData).userId = userId;
  }
}
