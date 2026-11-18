/**
 * Wallet: balance, history, simulated withdrawals (FR-450, FR-453, FR-454) and the escrow
 * implementation used by orders (FR-452) through the ORDER_MONEY hook (ADR-023).
 *
 * Escrow movements (idempotency key per order and effect, so each happens at most once):
 *   HOLD     (fund)                WALLET(buyer) −amount   ESCROW(order) +amount
 *   RELEASE  (approve / auto / admin release)   ESCROW(order) −held   WALLET(seller) +held
 *   REFUND   (seller cancels / admin refund)    ESCROW(order) −held   WALLET(buyer)  +held
 * Platform fee is 0% during the pilot (FR-456).
 */
import { Injectable } from '@nestjs/common';
import {
  LedgerAccount,
  LedgerTransactionKind,
  MoneyEffect,
  type CreateWithdrawalInput,
  type Page,
  type PageQuery,
  type WalletDto,
  type WalletTransactionDto,
  type WithdrawalDto,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { OrderMoney } from '../orders/orders.service.js';
import { LedgerService, type Tx } from './ledger.service.js';

@Injectable()
export class WalletService implements OrderMoney {
  readonly escrowEnabled = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async getWallet(userId: string): Promise<WalletDto> {
    const [wallet, held] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { userId }, select: { balancePaise: true } }),
      this.prisma.$queryRaw<{ held: number | null }[]>`
        SELECT SUM(e."amountPaise")::int AS held
        FROM "LedgerEntry" e JOIN "Order" o ON o.id = e."orderId"
        WHERE e.account = 'ESCROW' AND o."buyerId" = ${userId}::uuid`,
    ]);
    if (!wallet) throw AppError.notFound('WALLET_NOT_FOUND', 'Wallet not found');
    return { balancePaise: wallet.balancePaise, inEscrowPaise: held[0]?.held ?? 0, testMode: true };
  }

  /** GET /wallet/transactions — my wallet movements, newest first. */
  async transactions(userId: string, query: PageQuery): Promise<Page<WalletTransactionDto>> {
    const limit = query.limit ?? 20;
    const cursor = decodeCursor(query.cursor, 'id');
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { account: LedgerAccount.WALLET, userId, ...(cursor ? { id: { lt: cursor.v as string } } : {}) },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: { transaction: { select: { kind: true, description: true, orderId: true } } },
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((e) => ({
        id: e.id,
        kind: e.transaction.kind,
        amountPaise: e.amountPaise,
        description: e.transaction.description,
        orderId: e.transaction.orderId,
        createdAt: e.createdAt.toISOString(),
      })),
      nextCursor: rows.length > limit ? encodeCursor({ k: 'id', v: page[page.length - 1]!.id }) : null,
    };
  }

  /** POST /wallet/withdrawals — simulated (FR-454): money leaves the wallet, nothing is sent anywhere. */
  async withdraw(userId: string, input: CreateWithdrawalInput): Promise<WithdrawalDto> {
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const w = await tx.withdrawal.create({ data: { userId, amountPaise: input.amountPaise } });
      await this.ledger.post(tx, {
        kind: LedgerTransactionKind.WITHDRAWAL,
        idempotencyKey: `withdrawal:${w.id}`,
        withdrawalId: w.id,
        description: 'Withdrawal (test mode — no real transfer)',
        entries: [
          { account: LedgerAccount.WALLET, userId, amountPaise: -input.amountPaise },
          { account: LedgerAccount.EXTERNAL, amountPaise: input.amountPaise },
        ],
      });
      return w;
    });
    return { id: withdrawal.id, amountPaise: withdrawal.amountPaise, status: 'SIMULATED', createdAt: withdrawal.createdAt.toISOString() };
  }

  /** OrderMoney.apply — called by OrdersService.transition() inside its transaction. */
  async apply(
    tx: Tx,
    order: { id: string; buyerId: string; sellerId: string; amountPaise: number },
    effect: MoneyEffect,
  ): Promise<void> {
    if (effect === MoneyEffect.HOLD) {
      await this.ledger.post(tx, {
        kind: LedgerTransactionKind.ESCROW_HOLD,
        idempotencyKey: `escrow-hold:${order.id}`,
        orderId: order.id,
        description: 'Paid into escrow',
        entries: [
          { account: LedgerAccount.WALLET, userId: order.buyerId, amountPaise: -order.amountPaise },
          { account: LedgerAccount.ESCROW, orderId: order.id, amountPaise: order.amountPaise },
        ],
      });
      return;
    }
    const held = await this.ledger.escrowBalance(tx, order.id);
    if (held <= 0) return; // nothing held (e.g. cancelled before funding)
    const release = effect === MoneyEffect.RELEASE;
    await this.ledger.post(tx, {
      kind: release ? LedgerTransactionKind.ESCROW_RELEASE : LedgerTransactionKind.ESCROW_REFUND,
      idempotencyKey: `${release ? 'escrow-release' : 'escrow-refund'}:${order.id}`,
      orderId: order.id,
      description: release ? 'Payment for completed order' : 'Refund from escrow',
      entries: [
        { account: LedgerAccount.ESCROW, orderId: order.id, amountPaise: -held },
        { account: LedgerAccount.WALLET, userId: release ? order.sellerId : order.buyerId, amountPaise: held },
      ],
    });
  }
}
