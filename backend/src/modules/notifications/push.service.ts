/**
 * Push delivery (FR-551) through Expo's free push service (no Firebase setup needed):
 *   POST https://exp.host/--/api/v2/push/send  [{ to, title, body, data, sound }]
 * Tokens Expo reports as `DeviceNotRegistered` are deleted. Failures are only logged — a push
 * is a nice-to-have; the in-app notification is always stored.
 * Drivers (PUSH_DRIVER): expo · log (development) · none (tests).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { AppEnv } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const PUSH_FETCH = Symbol('PUSH_FETCH');

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(PUSH_FETCH) private readonly fetchImpl: typeof fetch,
  ) {}

  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    if (this.env.PUSH_DRIVER === 'none') return;
    const tokens = (await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } })).map((t) => t.token);
    if (tokens.length === 0) return;
    if (this.env.PUSH_DRIVER === 'log') {
      this.logger.log(`[push → ${tokens.length} device(s) of ${userId}] ${message.title}: ${message.body}`);
      return;
    }
    try {
      const res = await this.fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(tokens.map((to) => ({ to, title: message.title, body: message.body, data: message.data ?? {}, sound: 'default' }))),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push failed: HTTP ${res.status}`);
        return;
      }
      const result = (await res.json()) as { data?: { status?: string; details?: { error?: string } }[] };
      const dead = (result.data ?? [])
        .map((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? tokens[i] : null))
        .filter((t): t is string => !!t);
      if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    } catch (error) {
      this.logger.warn(`Expo push error: ${(error as Error).message}`);
    }
  }
}
