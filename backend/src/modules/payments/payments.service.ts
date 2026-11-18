/**
 * Wallet top-ups (FR-451). The wallet is credited ONLY after the server itself confirms with the
 * gateway that the payment is paid for exactly the expected amount — triggered by a signed
 * webhook, by the app asking "verify", or by the fake checkout page. All three paths call
 * `refreshFromGateway()`, which is idempotent (conditional status update + ledger idempotency key).
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  formatPaise,
  LedgerAccount,
  LedgerTransactionKind,
  NotificationType,
  PaymentStatus,
  type CreateTopupInput,
  type TopupDto,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { Prisma, type Payment } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { LedgerService } from '../wallet/ledger.service.js';
import { FakeGateway } from './fake-gateway.js';
import { PaymentGateway } from './payment-gateway.js';

const notFound = () => AppError.notFound('PAYMENT_NOT_FOUND', 'Payment not found');

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGateway,
    private readonly ledger: LedgerService,
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly notifications: NotificationsService,
  ) {}

  /** POST /wallet/topups */
  async createTopup(userId: string, input: CreateTopupInput): Promise<TopupDto> {
    const payment = await this.prisma.payment.create({
      data: { userId, gateway: this.gateway.name, gatewayRef: `pending_${randomUUID()}`, amountPaise: input.amountPaise, checkoutUrl: '' },
    });
    try {
      const session = await this.gateway.createCheckout({
        paymentId: payment.id,
        amountPaise: input.amountPaise,
        description: 'CampusConnect wallet top-up (TEST MODE)',
      });
      const checkoutUrl =
        this.gateway.name === 'fake' ? `${session.checkoutUrl}?token=${this.fakeToken(payment.id)}` : session.checkoutUrl;
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { gatewayRef: session.gatewayRef, checkoutUrl },
      });
      return toDto(updated);
    } catch (error) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
      this.logger.error(`Could not create checkout: ${(error as Error).message}`);
      throw new AppError('PAYMENT_GATEWAY_ERROR', 'The payment service is not available right now. Please try again.', 502);
    }
  }

  /** GET /wallet/topups/:id */
  async get(userId: string, paymentId: string): Promise<TopupDto> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!payment) throw notFound();
    return toDto(payment);
  }

  /** POST /wallet/topups/:id/verify — the app asks us to check with the gateway now. */
  async verify(userId: string, paymentId: string): Promise<TopupDto> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!payment) throw notFound();
    return toDto(await this.refreshFromGateway(payment));
  }

  /** POST /webhooks/razorpay — signature verified by the gateway; unknown refs are ignored. */
  async handleWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<void> {
    let ref: string | null;
    try {
      ref = this.gateway.parseWebhook(rawBody, headers);
    } catch (error) {
      this.logger.warn(`Rejected webhook: ${(error as Error).message}`);
      throw AppError.unauthorized('WEBHOOK_SIGNATURE_INVALID', 'Invalid signature');
    }
    if (!ref) return;
    const payment = await this.prisma.payment.findUnique({ where: { gatewayRef: ref } });
    if (payment) await this.refreshFromGateway(payment);
  }

  /** Fake checkout page buttons (dev/tests only). */
  async completeFake(paymentId: string, token: string, outcome: 'paid' | 'failed'): Promise<Payment> {
    if (!(this.gateway instanceof FakeGateway)) throw AppError.notFound();
    const payment = await this.findByFakeToken(paymentId, token);
    this.gateway.complete(payment.gatewayRef, outcome);
    return this.refreshFromGateway(payment);
  }

  async findByFakeToken(paymentId: string, token: string): Promise<Payment> {
    if (!(this.gateway instanceof FakeGateway)) throw AppError.notFound();
    const a = Buffer.from(this.fakeToken(paymentId));
    const b = Buffer.from(token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw AppError.notFound();
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw notFound();
    return payment;
  }

  /**
   * Ask the gateway for the truth and apply it once. PAID → credit the wallet (TOPUP:
   * EXTERNAL −x, WALLET +x) in the same transaction as the status change.
   */
  async refreshFromGateway(payment: Payment): Promise<Payment> {
    if (payment.status !== PaymentStatus.CREATED) return payment;
    const status = await this.gateway.fetchStatus(payment.gatewayRef);
    if (status.state === 'pending') return payment;

    if (status.state === 'paid' && status.amountPaidPaise !== payment.amountPaise) {
      this.logger.error(`Amount mismatch for payment ${payment.id}: expected ${payment.amountPaise}, gateway says ${status.amountPaidPaise}`);
      return payment; // never credit a different amount; needs manual review
    }

    const next = status.state === 'paid' ? PaymentStatus.PAID : status.state === 'expired' ? PaymentStatus.EXPIRED : PaymentStatus.FAILED;
    try {
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.CREATED },
          data: { status: next, rawLastEvent: status.raw as Prisma.InputJsonValue },
        });
        if (changed.count !== 1 || next !== PaymentStatus.PAID) return;
        await this.ledger.post(tx, {
          kind: LedgerTransactionKind.TOPUP,
          idempotencyKey: `topup:${payment.id}`,
          paymentId: payment.id,
          description: 'Added money (test mode)',
          entries: [
            { account: LedgerAccount.EXTERNAL, amountPaise: -payment.amountPaise },
            { account: LedgerAccount.WALLET, userId: payment.userId, amountPaise: payment.amountPaise },
          ],
        });
      });
    } catch (error) {
      // A concurrent refresh (webhook + verify at the same moment) already applied it.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
    const after = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (after.status === PaymentStatus.PAID && next === PaymentStatus.PAID) {
      await this.notifications.notify(payment.userId, {
        type: NotificationType.TOPUP_PAID,
        title: `${formatPaise(payment.amountPaise)} added to your wallet`,
        body: 'Test-mode top-up successful',
        link: { kind: 'wallet' },
      });
    }
    return after;
  }

  private fakeToken(paymentId: string): string {
    return createHmac('sha256', this.env.CODE_HASH_SECRET).update(`fake-checkout:${paymentId}`).digest('base64url');
  }
}

function toDto(p: Payment): TopupDto {
  return {
    id: p.id,
    amountPaise: p.amountPaise,
    status: p.status,
    checkoutUrl: p.checkoutUrl,
    gateway: p.gateway === 'razorpay' ? 'razorpay' : 'fake',
    createdAt: p.createdAt.toISOString(),
  };
}
