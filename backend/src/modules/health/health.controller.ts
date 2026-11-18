/**
 * GET /api/v1/health — liveness + database check (NFR-09).
 * Used by Render's health check, uptime monitors and the mobile app's "server status".
 * Public (no auth) and excluded from rate limiting. Returns 503 if the database is down.
 */
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
  timestamp: string;
}

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const dbUp = await this.prisma.isHealthy();
    if (!dbUp) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: dbUp ? 'ok' : 'degraded',
      database: dbUp ? 'up' : 'down',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
