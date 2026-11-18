/**
 * Quotes: API calls + query hooks (backend: modules/quotes, FR-200…203).
 */
import type { CreateQuoteInput, MyQuoteDto, QuoteDto, UpdateQuoteInput } from '@cc/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export const quoteKeys = {
  all: ['quotes'] as const,
  forListing: (listingId: string) => ['quotes', 'listing', listingId] as const,
  mine: ['quotes', 'mine'] as const,
};

export const quotesApi = {
  create: (listingId: string, input: CreateQuoteInput) => api.post<QuoteDto>(`/listings/${listingId}/quotes`, input),
  forListing: (listingId: string) => api.get<QuoteDto[]>(`/listings/${listingId}/quotes`),
  mine: () => api.get<MyQuoteDto[]>('/me/quotes'),
  update: (id: string, input: UpdateQuoteInput) => api.patch<QuoteDto>(`/quotes/${id}`, input),
  withdraw: (id: string) => api.post<QuoteDto>(`/quotes/${id}/withdraw`),
  reject: (id: string) => api.post<QuoteDto>(`/quotes/${id}/reject`),
};

export function useListingQuotes(listingId: string, enabled = true) {
  return useQuery({ queryKey: quoteKeys.forListing(listingId), queryFn: () => quotesApi.forListing(listingId), enabled });
}

export function useMyQuotes() {
  return useQuery({ queryKey: quoteKeys.mine, queryFn: quotesApi.mine });
}

/** My quote for a listing, if any (from the "my quotes" list). */
export function useMyQuoteFor(listingId: string) {
  const mine = useMyQuotes();
  return { ...mine, data: mine.data?.find((q) => q.listingId === listingId) ?? null };
}
