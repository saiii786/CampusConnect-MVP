/**
 * Chat (PRD FR-250…254), blocking (FR-253) and realtime event names (ARCHITECTURE §9).
 *
 * A conversation is between a BUYER and a SELLER about ONE listing:
 *   - service offer: buyer = the person contacting, seller = the listing owner;
 *   - job request:   buyer = the listing owner, seller = the person contacting / quoting.
 * Messages are always SENT over REST (validated + authorised like everything else); the socket
 * only DELIVERS them in real time.
 */
import { z } from 'zod';
import type { ListingType } from '../enums.js';

export const MESSAGE_MAX = 2000;

/** POST /conversations — start (or reopen) a chat about a listing. */
export const startConversationSchema = z.object({ listingId: z.uuid() }).strict();
export type StartConversationInput = z.infer<typeof startConversationSchema>;

/** POST /conversations/:id/messages */
export const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1, 'Write a message').max(MESSAGE_MAX, `At most ${MESSAGE_MAX} characters`),
  })
  .strict();
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

const optionalLimit = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : Number(v)),
  z.number().int().min(1).max(50).optional(),
);

/** GET /conversations and GET /conversations/:id/messages query string. */
export const pageQuerySchema = z.object({ cursor: z.string().max(200).optional(), limit: optionalLimit }).strict();
export type PageQuery = z.infer<typeof pageQuerySchema>;

/** POST /blocks */
export const blockUserSchema = z.object({ userId: z.uuid() }).strict();
export type BlockUserInput = z.infer<typeof blockUserSchema>;

export interface ConversationParticipantDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ConversationDto {
  id: string;
  listing: { id: string; title: string; type: ListingType };
  /** My role in this conversation. */
  myRole: 'BUYER' | 'SELLER';
  other: ConversationParticipantDto;
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
  /** True if either person blocked the other — sending is disabled. */
  blocked: boolean;
  createdAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface BlockedUserDto {
  userId: string;
  displayName: string;
  blockedAt: string;
}

/** GET /conversations/unread — for the badge on the Messages button. */
export interface UnreadSummaryDto {
  unreadConversations: number;
  unreadMessages: number;
}

/** Socket.io event names (server → client), ARCHITECTURE §9. */
export const ServerEvent = {
  MESSAGE_NEW: 'message:new',
  CONVERSATION_READ: 'conversation:read',
  NOTIFICATION_NEW: 'notification:new',
  ORDER_UPDATED: 'order:updated',
} as const;

/** Socket.io event names (client → server). */
export const ClientEvent = {
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
} as const;

export interface ConversationReadEvent {
  conversationId: string;
  userId: string;
  lastReadAt: string;
}

/** Ack returned for client → server events. */
export type SocketAck = { ok: true } | { ok: false; code: string };
