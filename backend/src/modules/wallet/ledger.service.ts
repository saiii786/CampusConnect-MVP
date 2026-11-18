/**
 * Double-entry ledger (FR-450, ARCHITECTURE §7, ADR-006). The ONLY code that moves money.
 *
 *   post(tx, { kind, idempotencyKey, entries: [...] })
 *     - entries must sum to zero (money is never created or destroyed);
 *     - the idempotency key is unique: posting the same business event twice is a no-op;
 *     - every WALLET entry updates the cached `Wallet.balancePaise` in the SAME transaction with a
 *       conditional update, so a balance can never go negative (422 WALLET_INSUFFICIENT_FUNDS);
 *     - ESCROW entries are per order (no cached balance; sum of entries).
 *   reconcile() — proves cache == ledger for every wallet, every transaction sums to zero and no
 *     finished order still holds escrow.
 */
import { Injectable } from '@nestjs/common';
import { LedgerAccount, type LedgerReconcileDto, type LedgerTransactionKind } from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type Tx = Prisma.TransactionClient;

export interface LedgerEntryInput {
  account: LedgerAccount;
  /** Required for WALLET entries. */
  userId?: string;
  /** Required for ESCROW entries. */
  orderId?: string;
  /** Signed paise: negative = money leaves this account. */
  amountPaise: number;
}

export interface LedgerPostInput {
  kind: LedgerTransactionKind;
  idempotencyKey: string;
  description?: string;
  orderId?: string;
  paymentId?: string;
  withdrawalId?: string;
  entries: LedgerEntryInput[];
}

export function insufficientFunds(): AppError {
  return AppError.unprocessable('WALLET_INSUFFICIENT_FUNDS', 'Not enough money in your wallet. Add money and try again.');
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Post a balanced transaction inside `tx`. Returns false if this idempotency key was already posted. */
  async post(tx: Tx, input: LedgerPostInput): Promise<boolean> {
    validateEntries(input.entries);
    const existing = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
    if (existing) return false;

    const created = await tx.ledgerTransaction.create({
      data: {
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
        description: input.description ?? null,
        orderId: input.orderId ?? null,
        paymentId: input.paymentId ?? null,
        withdrawalId: input.withdrawalId ?? null,
      },
    });
    for (const e of input.entries) {
      if (e.account === LedgerAccount.WALLET) {
        const userId = e.userId!;
        const changed =
          e.amountPaise < 0
            ? await tx.wallet.updateMany({
                where: { userId, balancePaise: { gte: -e.amountPaise } },
                data: { balancePaise: { increment: e.amountPaise } },
              })
            : await tx.wallet.updateMany({ where: { userId }, data: { balancePaise: { increment: e.amountPaise } } });
        if (changed.count !== 1) throw insufficientFunds(); // (also: wallet missing) — rolls back everything
      }
      await tx.ledgerEntry.create({
        data: {
          transactionId: created.id,
          account: e.account,
          userId: e.account === LedgerAccount.WALLET ? e.userId! : null,
          orderId: e.account === LedgerAccount.ESCROW ? e.orderId! : null,
          amountPaise: e.amountPaise,
        },
      });
    }
    return true;
  }

  /** Money currently held in escrow for one order. */
  async escrowBalance(tx: Tx | PrismaService, orderId: string): Promise<number> {
    const agg = await tx.ledgerEntry.aggregate({
      where: { account: LedgerAccount.ESCROW, orderId },
      _sum: { amountPaise: true },
    });
    return agg._sum.amountPaise ?? 0;
  }

  async reconcile(): Promise<LedgerReconcileDto> {
    const [wallets, ledger, unbalanced, stranded] = await Promise.all([
      this.prisma.wallet.findMany({ select: { userId: true, balancePaise: true } }),
      this.prisma.ledgerEntry.groupBy({ by: ['userId'], where: { account: LedgerAccount.WALLET }, _sum: { amountPaise: true } }),
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT t.id FROM "LedgerTransaction" t JOIN "LedgerEntry" e ON e."transactionId" = t.id
        GROUP BY t.id HAVING SUM(e."amountPaise") <> 0`,
      this.prisma.$queryRaw<{ orderId: string; status: string; held: number }[]>`
        SELECT o.id AS "orderId", o.status::text AS status, SUM(e."amountPaise")::int AS held
        FROM "LedgerEntry" e JOIN "Order" o ON o.id = e."orderId"
        WHERE e.account = 'ESCROW' AND o.status IN ('COMPLETED', 'CANCELLED', 'DECLINED')
        GROUP BY o.id, o.status HAVING SUM(e."amountPaise") <> 0`,
    ]);
    const ledgerBy = new Map(ledger.map((l) => [l.userId, l._sum.amountPaise ?? 0]));
    const walletMismatches = wallets
      .map((w) => ({ userId: w.userId, cachedPaise: w.balancePaise, ledgerPaise: ledgerBy.get(w.userId) ?? 0 }))
      .filter((m) => m.cachedPaise !== m.ledgerPaise);
    const strandedEscrow = stranded.map((s) => ({ orderId: s.orderId, status: s.status, heldPaise: s.held }));
    return {
      walletsChecked: wallets.length,
      walletMismatches,
      unbalancedTransactions: unbalanced.map((u) => u.id),
      strandedEscrow,
      ok: walletMismatches.length === 0 && unbalanced.length === 0 && strandedEscrow.length === 0,
    };
  }
}

/** Exported for unit tests. */
export function validateEntries(entries: LedgerEntryInput[]): void {
  if (entries.length < 2) throw new Error('A ledger transaction needs at least two entries');
  let sum = 0;
  for (const e of entries) {
    if (!Number.isSafeInteger(e.amountPaise) || e.amountPaise === 0) throw new Error('Entry amounts must be non-zero integers');
    if (e.account === LedgerAccount.WALLET && !e.userId) throw new Error('WALLET entries need a userId');
    if (e.account === LedgerAccount.ESCROW && !e.orderId) throw new Error('ESCROW entries need an orderId');
    sum += e.amountPaise;
  }
  if (sum !== 0) throw new Error(`Ledger transaction does not balance (sum ${sum})`);
}
