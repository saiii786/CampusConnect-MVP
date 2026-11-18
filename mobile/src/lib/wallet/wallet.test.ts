import { LedgerTransactionKind } from '@cc/shared';
import { TRANSACTION_LABEL } from './wallet-api';

jest.mock('expo-secure-store', () => ({}));
jest.mock('@/config/api-url', () => ({ getApiBaseUrl: () => 'http://test/api/v1' }));

describe('wallet labels', () => {
  it('every ledger transaction kind has a human label', () => {
    for (const kind of Object.values(LedgerTransactionKind)) expect(TRANSACTION_LABEL[kind]).toBeTruthy();
  });
});
