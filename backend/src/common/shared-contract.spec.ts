/**
 * Contract test: enums in the database schema (Prisma) must be identical to the enums in
 * @cc/shared that the mobile app uses. This is the check that would have caught the old
 * demo-connect bug (frontend "PENDING" vs backend "PROPOSED"). See ADR-007.
 */
import * as Shared from '@cc/shared';
import * as Db from '../generated/prisma/enums.js';

const PAIRS: Array<[name: string, shared: Record<string, string>, db: Record<string, string>]> = [
  ['UserRole', Shared.UserRole, Db.UserRole],
  ['UserStatus', Shared.UserStatus, Db.UserStatus],
  ['ListingType', Shared.ListingType, Db.ListingType],
  ['ListingStatus', Shared.ListingStatus, Db.ListingStatus],
  ['PricingType', Shared.PricingType, Db.PricingType],
  ['WorkMode', Shared.WorkMode, Db.WorkMode],
  ['QuoteStatus', Shared.QuoteStatus, Db.QuoteStatus],
  ['PaymentMode', Shared.PaymentMode, Db.PaymentMode],
  ['OrderStatus', Shared.OrderStatus, Db.OrderStatus],
  ['DisputeStatus', Shared.DisputeStatus, Db.DisputeStatus],
  ['LedgerTransactionKind', Shared.LedgerTransactionKind, Db.LedgerTransactionKind],
  ['LedgerAccount', Shared.LedgerAccount, Db.LedgerAccount],
  ['PaymentStatus', Shared.PaymentStatus, Db.PaymentStatus],
  ['ReportTargetType', Shared.ReportTargetType, Db.ReportTargetType],
  ['ReportStatus', Shared.ReportStatus, Db.ReportStatus],
];

describe('shared enums ↔ database enums', () => {
  it.each(PAIRS)('%s has identical values', (_name, shared, db) => {
    expect(Object.values(shared).sort()).toEqual(Object.values(db).sort());
  });
});
