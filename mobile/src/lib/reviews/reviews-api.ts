/**
 * Reviews (FR-500…502) and the shareable work record (FR-053).
 */
import type { CreateReviewInput, Page, ReviewDto } from '@cc/shared';
import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/config/api-url';
import { api } from '@/lib/api/client';

export const reviewKeys = {
  forUser: (userId: string) => ['reviews', 'user', userId] as const,
};

export const reviewsApi = {
  create: (orderId: string, input: CreateReviewInput) => api.post<ReviewDto>(`/orders/${orderId}/review`, input),
  reply: (reviewId: string, reply: string) => api.post<ReviewDto>(`/reviews/${reviewId}/reply`, { reply }),
  forUser: (userId: string) => api.get<Page<ReviewDto>>(`/users/${userId}/reviews`),
};

/** First page of reviews a person received (enough for profile screens). */
export function useUserReviews(userId: string) {
  return useQuery({ queryKey: reviewKeys.forUser(userId), queryFn: () => reviewsApi.forUser(userId) });
}

/** Public link to someone's verified work record page (works without the app). */
export function workRecordUrl(userId: string, apiBaseUrl: string = getApiBaseUrl()): string {
  return `${apiBaseUrl.replace(/\/+$/, '')}/work-record/${userId}`;
}
