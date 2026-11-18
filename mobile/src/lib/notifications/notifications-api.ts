/**
 * In-app notifications (FR-550): calls + query hooks, and what tapping one opens.
 * The socket's `notification:new` refreshes these queries (lib/realtime/realtime.ts).
 */
import type { NotificationDto, NotificationLink, Page } from '@cc/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import { api } from '@/lib/api/client';
import { toQueryString } from '@/lib/listings/listings-api';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
};

export const notificationsApi = {
  list: (cursor?: string) =>
    api.get<Page<NotificationDto> & { unreadCount: number }>(`/notifications${toQueryString({ cursor })}`),
  unreadCount: () => api.get<{ unreadCount: number }>('/notifications/unread-count'),
  markRead: (ids?: string[]) => api.post<{ unreadCount: number }>('/notifications/read', ids ? { ids } : {}),
};

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useNotificationCount() {
  return useQuery({ queryKey: notificationKeys.unread, queryFn: notificationsApi.unreadCount, refetchInterval: 60_000 });
}

/** Screen to open for a notification link (null = nothing to open). */
export function hrefForLink(link: NotificationLink | null): Href | null {
  if (!link) return null;
  switch (link.kind) {
    case 'order':
      return { pathname: '/orders/[id]', params: { id: link.id } };
    case 'conversation':
      return { pathname: '/chat/[id]', params: { id: link.id } };
    case 'listing':
      return { pathname: '/listings/[id]', params: { id: link.id } };
    case 'quotes':
      return { pathname: '/listing-quotes/[id]', params: { id: link.id } };
    case 'wallet':
      return '/wallet';
    case 'profile':
      return '/profile';
  }
}
