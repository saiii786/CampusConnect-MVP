/**
 * Typed calls + TanStack Query hooks for profiles, student badge, portfolio, categories
 * (backend: docs/ARCHITECTURE.md §8.1, modules users/categories).
 *
 * Own account data (MeResponse) lives in the session store (`useSession(s => s.user)`); every call
 * that returns a MeResponse updates it via `session.setUser`, so all screens stay in sync.
 */
import type {
  CategoriesResponse,
  ConfirmStudentVerificationInput,
  CreatePortfolioItemInput,
  MeResponse,
  PortfolioItemDto,
  PublicProfile,
  StartStudentVerificationInput,
  UpdatePortfolioItemInput,
  UpdateProfileInput,
} from '@cc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { session } from '@/lib/auth/session';

export const queryKeys = {
  portfolio: ['me', 'portfolio'] as const,
  user: (id: string) => ['users', id] as const,
  categories: ['categories'] as const,
};

const keepSessionInSync = (me: MeResponse) => {
  session.setUser(me);
  return me;
};

export const usersApi = {
  me: () => api.get<MeResponse>('/me').then(keepSessionInSync),
  updateMe: (input: UpdateProfileInput) => api.patch<MeResponse>('/me', input).then(keepSessionInSync),
  deleteAccount: (password: string) => api.delete<void>('/me', { body: { password } }),
  startStudent: (input: StartStudentVerificationInput) =>
    api.post<MeResponse>('/me/student-verification', input).then(keepSessionInSync),
  confirmStudent: (input: ConfirmStudentVerificationInput) =>
    api.post<MeResponse>('/me/student-verification/confirm', input).then(keepSessionInSync),
  portfolio: () => api.get<PortfolioItemDto[]>('/me/portfolio'),
  addPortfolioItem: (input: CreatePortfolioItemInput) => api.post<PortfolioItemDto>('/me/portfolio', input),
  updatePortfolioItem: (id: string, input: UpdatePortfolioItemInput) =>
    api.patch<PortfolioItemDto>(`/me/portfolio/${id}`, input),
  deletePortfolioItem: (id: string) => api.delete<void>(`/me/portfolio/${id}`),
  publicProfile: (id: string) => api.get<PublicProfile>(`/users/${id}`),
  categories: () => api.get<CategoriesResponse>('/categories', { auth: false }),
};

export function usePortfolio() {
  return useQuery({ queryKey: queryKeys.portfolio, queryFn: usersApi.portfolio });
}

export function usePublicProfile(id: string) {
  return useQuery({ queryKey: queryKeys.user(id), queryFn: () => usersApi.publicProfile(id) });
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: usersApi.categories, staleTime: 60 * 60 * 1000 });
}

export function useDeletePortfolioItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: usersApi.deletePortfolioItem,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.portfolio }),
  });
}
