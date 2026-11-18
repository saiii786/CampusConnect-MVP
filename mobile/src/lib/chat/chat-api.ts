/**
 * Chat + blocks: API calls and TanStack Query hooks (backend: modules/conversations, safety).
 * Messages are SENT over REST; new ones ARRIVE via the socket (lib/realtime/realtime.ts), which
 * writes them into the same query cache used here.
 */
import type {
  ConversationDto,
  ConversationReadEvent,
  MessageDto,
  Page,
  UnreadSummaryDto,
} from '@cc/shared';
import { useInfiniteQuery, useQuery, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toQueryString } from '@/lib/listings/listings-api';

export const chatKeys = {
  all: ['chat'] as const,
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
  unread: ['chat', 'unread'] as const,
};

export const chatApi = {
  start: (listingId: string) => api.post<ConversationDto>('/conversations', { listingId }),
  list: (cursor?: string) => api.get<Page<ConversationDto>>(`/conversations${toQueryString({ cursor })}`),
  get: (id: string) => api.get<ConversationDto>(`/conversations/${id}`),
  messages: (id: string, cursor?: string) =>
    api.get<Page<MessageDto>>(`/conversations/${id}/messages${toQueryString({ cursor, limit: 30 })}`),
  send: (id: string, body: string) => api.post<MessageDto>(`/conversations/${id}/messages`, { body }),
  markRead: (id: string) => api.post<ConversationReadEvent>(`/conversations/${id}/read`),
  unread: () => api.get<UnreadSummaryDto>('/conversations/unread'),
  block: (userId: string) => api.post<void>('/blocks', { userId }),
  unblock: (userId: string) => api.delete<void>(`/blocks/${userId}`),
};

export function useConversations() {
  return useInfiniteQuery({
    queryKey: chatKeys.conversations,
    queryFn: ({ pageParam }) => chatApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useConversation(id: string) {
  return useQuery({ queryKey: chatKeys.conversation(id), queryFn: () => chatApi.get(id) });
}

/** Messages newest first (render with an inverted list). */
export function useMessages(id: string) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(id),
    queryFn: ({ pageParam }) => chatApi.messages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useUnread() {
  return useQuery({ queryKey: chatKeys.unread, queryFn: chatApi.unread, refetchInterval: 60_000 });
}

/**
 * Put a message at the top of a conversation's cached messages, unless it is already there
 * (the sender gets it both from the REST response and from the socket).
 */
export function addMessageToCache(client: QueryClient, message: MessageDto): void {
  client.setQueryData<InfiniteData<Page<MessageDto>, string | undefined>>(chatKeys.messages(message.conversationId), (data) => {
    if (!data) return data;
    if (data.pages.some((p) => p.items.some((m) => m.id === message.id))) return data;
    const [first, ...rest] = data.pages;
    return { ...data, pages: [{ ...first!, items: [message, ...first!.items] }, ...rest] };
  });
}
