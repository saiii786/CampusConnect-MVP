/**
 * Listings API calls + TanStack Query hooks (backend: modules/listings).
 * Lists use infinite queries with the API's opaque `nextCursor`.
 */
import type {
  CreateListingInput,
  ListingDetailDto,
  ListingStatus,
  ListingSummaryDto,
  Page,
  SearchListingsInput,
  UpdateListingInput,
} from '@cc/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/** Build a query string from defined values only. */
export function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const listingKeys = {
  all: ['listings'] as const,
  search: (q: Partial<SearchListingsInput>) => ['listings', 'search', q] as const,
  detail: (id: string) => ['listings', 'detail', id] as const,
  mine: (status: ListingStatus | null) => ['listings', 'mine', status] as const,
};

export const listingsApi = {
  search: (q: Partial<SearchListingsInput>, cursor?: string) =>
    api.get<Page<ListingSummaryDto>>(`/listings${toQueryString({ ...q, cursor })}`),
  get: (id: string, from?: { lat: number; lng: number } | null) =>
    api.get<ListingDetailDto>(`/listings/${id}${toQueryString({ lat: from?.lat, lng: from?.lng })}`),
  create: (input: CreateListingInput) => api.post<ListingDetailDto>('/listings', input),
  update: (id: string, input: UpdateListingInput) => api.patch<ListingDetailDto>(`/listings/${id}`, input),
  changeStatus: (id: string, action: 'pause' | 'resume' | 'close') =>
    api.post<ListingDetailDto>(`/listings/${id}/${action}`),
  mine: (status: ListingStatus | null, cursor?: string) =>
    api.get<Page<ListingSummaryDto>>(`/me/listings${toQueryString({ status, cursor })}`),
};

export function useListingSearch(query: Partial<SearchListingsInput>) {
  return useInfiniteQuery({
    queryKey: listingKeys.search(query),
    queryFn: ({ pageParam }) => listingsApi.search(query, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useMyListings(status: ListingStatus | null) {
  return useInfiniteQuery({
    queryKey: listingKeys.mine(status),
    queryFn: ({ pageParam }) => listingsApi.mine(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useListing(id: string, from?: { lat: number; lng: number } | null) {
  return useQuery({ queryKey: listingKeys.detail(id), queryFn: () => listingsApi.get(id, from) });
}

export function useListingStatus(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: 'pause' | 'resume' | 'close') => listingsApi.changeStatus(id, action),
    onSuccess: (listing) => {
      client.setQueryData(listingKeys.detail(id), listing);
      void client.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}
