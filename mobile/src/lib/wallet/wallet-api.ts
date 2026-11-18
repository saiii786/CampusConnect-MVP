/**
 * Wallet: API calls + query hooks (backend: modules/wallet + payments, FR-450…455).
 * TEST MODE ONLY — no real money (ADR-004).
 */
import type { CreateTopupInput, Page, TopupDto, WalletDto, WalletTransactionDto, WithdrawalDto } from '@cc/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toQueryString } from '@/lib/listings/listings-api';

export const walletKeys = {
  all: ['wallet'] as const,
  wallet: ['wallet', 'summary'] as const,
  transactions: ['wallet', 'transactions'] as const,
};

export const walletApi = {
  get: () => api.get<WalletDto>('/wallet'),
  transactions: (cursor?: string) => api.get<Page<WalletTransactionDto>>(`/wallet/transactions${toQueryString({ cursor })}`),
  createTopup: (input: CreateTopupInput) => api.post<TopupDto>('/wallet/topups', input),
  verifyTopup: (id: string) => api.post<TopupDto>(`/wallet/topups/${id}/verify`),
  withdraw: (amountPaise: number) => api.post<WithdrawalDto>('/wallet/withdrawals', { amountPaise }),
};

export function useWallet() {
  return useQuery({ queryKey: walletKeys.wallet, queryFn: walletApi.get });
}

export function useWalletTransactions() {
  return useInfiniteQuery({
    queryKey: walletKeys.transactions,
    queryFn: ({ pageParam }) => walletApi.transactions(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export const TRANSACTION_LABEL: Record<WalletTransactionDto['kind'], string> = {
  TOPUP: 'Added money',
  ESCROW_HOLD: 'Paid into escrow',
  ESCROW_RELEASE: 'Payment received',
  ESCROW_REFUND: 'Refund',
  WITHDRAWAL: 'Withdrawal (simulated)',
};
