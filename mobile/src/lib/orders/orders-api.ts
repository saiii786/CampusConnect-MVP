/**
 * Orders: API calls + query hooks (backend: modules/orders, FR-400…409).
 * The socket's `order:updated` event invalidates these queries (lib/realtime/realtime.ts).
 */
import type {
  AcceptQuoteInput,
  BookServiceInput,
  OrderActionBody,
  ListOrdersInput,
  OrderDetailDto,
  OrderSummaryDto,
  Page,
  UserOrderAction,
} from '@cc/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toQueryString } from '@/lib/listings/listings-api';

/** Escrow (pay into the in-app wallet, test mode) is available since Phase 6. */
export const ESCROW_AVAILABLE = true;

export type OrderScope = NonNullable<ListOrdersInput['scope']>;

export const orderKeys = {
  all: ['orders'] as const,
  list: (role: 'buyer' | 'seller', scope: OrderScope) => ['orders', 'list', role, scope] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
};

export const ordersApi = {
  book: (input: BookServiceInput) => api.post<OrderDetailDto>('/orders', input),
  acceptQuote: (quoteId: string, input: AcceptQuoteInput) => api.post<OrderDetailDto>(`/quotes/${quoteId}/accept`, input),
  list: (role: 'buyer' | 'seller', scope: OrderScope, cursor?: string) =>
    api.get<Page<OrderSummaryDto>>(`/orders${toQueryString({ role, scope, cursor })}`),
  get: (id: string) => api.get<OrderDetailDto>(`/orders/${id}`),
  act: (id: string, action: UserOrderAction, body: OrderActionBody = {}) =>
    api.post<OrderDetailDto>(`/orders/${id}/actions/${action}`, body),
  start: (id: string, code: string) => api.post<OrderDetailDto>(`/orders/${id}/start`, { code }),
};

/** "Active" is filtered on the server, so endless scrolling works even when most orders are finished. */
export function useOrders(role: 'buyer' | 'seller', scope: OrderScope) {
  return useInfiniteQuery({
    queryKey: orderKeys.list(role, scope),
    queryFn: ({ pageParam }) => ordersApi.list(role, scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: orderKeys.detail(id), queryFn: () => ordersApi.get(id) });
}
