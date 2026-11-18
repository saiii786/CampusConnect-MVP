/**
 * Live updates over socket.io (FR-251, ARCHITECTURE §9).
 *
 * `useRealtime()` is mounted once in the signed-in layout: it connects with the current access
 * token (re-read on every reconnect, so refreshed tokens are used), and on
 *   - message:new        → adds the message to the cached conversation and refreshes the inbox/unread badge;
 *   - conversation:read  → refreshes the inbox.
 * `joinConversation(id)` is called by the chat screen (the server checks I am a participant).
 * If the socket is down, screens still work: they refetch on focus/pull-to-refresh.
 */
import { ClientEvent, ServerEvent, type MessageDto, type SocketAck } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getApiBaseUrl } from '@/config/api-url';
import { session } from '@/lib/auth/session';
import { addMessageToCache, chatKeys } from '@/lib/chat/chat-api';

let socket: Socket | null = null;

/** Server origin of the API (socket.io lives at /socket.io on the same server). */
export function socketOrigin(apiBaseUrl: string): string {
  return /^(https?:\/\/[^/]+)/i.exec(apiBaseUrl)?.[1] ?? apiBaseUrl;
}

export function useRealtime(): void {
  const client = useQueryClient();

  useEffect(() => {
    const s = io(socketOrigin(getApiBaseUrl()), {
      transports: ['websocket'],
      // A function: called on every (re)connect, so an expired token is refreshed first.
      auth: (cb) => {
        session
          .getAccessToken()
          .then((token) => cb({ token }))
          .catch(() => cb({ token: null }));
      },
      reconnectionDelayMax: 10_000,
    });
    socket = s;

    s.on(ServerEvent.MESSAGE_NEW, (message: MessageDto) => {
      addMessageToCache(client, message);
      void client.invalidateQueries({ queryKey: chatKeys.conversations });
      void client.invalidateQueries({ queryKey: chatKeys.unread });
    });
    s.on(ServerEvent.CONVERSATION_READ, () => {
      void client.invalidateQueries({ queryKey: chatKeys.conversations });
      void client.invalidateQueries({ queryKey: chatKeys.unread });
    });
    // After a reconnect we may have missed events: refresh what is on screen.
    s.io.on('reconnect', () => void client.invalidateQueries({ queryKey: chatKeys.all }));

    return () => {
      s.removeAllListeners();
      s.disconnect();
      if (socket === s) socket = null;
    };
  }, [client]);
}

/** Ask to receive live events for one conversation (participants only). */
export async function joinConversation(conversationId: string): Promise<boolean> {
  if (!socket?.connected) return false;
  try {
    const ack = (await socket.timeout(5000).emitWithAck(ClientEvent.CONVERSATION_JOIN, { conversationId })) as SocketAck;
    return ack.ok;
  } catch {
    return false;
  }
}

export function leaveConversation(conversationId: string): void {
  socket?.emit(ClientEvent.CONVERSATION_LEAVE, { conversationId });
}
