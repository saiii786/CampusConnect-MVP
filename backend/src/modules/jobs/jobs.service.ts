/**
 * Scheduled jobs (FR-407).
 *
 * Auto-approve: an order SUBMITTED more than AUTO_APPROVE_AFTER_DAYS (5) ago, where the buyer did
 * nothing, is approved by the SYSTEM — the seller is paid (escrow release) and both are notified.
 * Uses OrdersService.transition(), so the state machine, optimistic lock and escrow rules apply
 * and running twice (or on two servers) is safe.
 *
 * Runs every JOBS_INTERVAL_MINUTES while the server is up (and once shortly after start — free
 * hosting sleeps when idle, so the first run after waking catches up). Disabled with
 * JOBS_ENABLED=false (tests). Admins can trigger it: POST /admin/jobs/auto-approve.
 */
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { AUTO_APPROVE_AFTER_DAYS, OrderAction, OrderActor, OrderStatus } from '@cc/shared';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 100;

@Injectable()
export class JobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Jobs');
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.env.JOBS_ENABLED) return;
    const every = this.env.JOBS_INTERVAL_MINUTES * 60 * 1000;
    this.startTimer = setTimeout(() => void this.tick(), 30_000);
    this.timer = setInterval(() => void this.tick(), every);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.startTimer) clearTimeout(this.startTimer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.autoApprove();
      if (n) this.logger.log(`auto-approved ${n} order(s)`);
    } catch (error) {
      this.logger.error(`auto-approve failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Approve orders submitted more than 5 days ago. Returns how many were approved. */
  async autoApprove(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - AUTO_APPROVE_AFTER_DAYS * DAY_MS);
    const due = await this.prisma.order.findMany({
      where: { status: OrderStatus.SUBMITTED, submittedAt: { lte: cutoff } },
      orderBy: { submittedAt: 'asc' },
      take: BATCH,
    });
    let approved = 0;
    for (const order of due) {
      try {
        await this.orders.transition(order, OrderAction.AUTO_APPROVE, OrderActor.SYSTEM, null, `No response for ${AUTO_APPROVE_AFTER_DAYS} days`);
        approved++;
      } catch (error) {
        // Someone acted at the same moment (409) — fine, skip.
        this.logger.warn(`auto-approve skipped ${order.id}: ${(error as Error).message}`);
      }
    }
    return approved;
  }
}
