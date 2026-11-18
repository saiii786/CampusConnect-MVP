/**
 * Admin moderation (FR-601) — `@Roles('ADMIN')`:
 *
 *   GET  /admin/reports?status=OPEN|ACTIONED|DISMISSED  → AdminReportDto[] (oldest first)
 *   POST /admin/reports/:id/resolve   { decision: DISMISS|ACTION, hideContent?, suspendUser?, note? }
 *   POST /admin/users/:id/suspend     { reason }   → 204 (signs the user out everywhere)
 *   POST /admin/users/:id/unsuspend                → 204
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, Post, Query } from '@nestjs/common';
import {
  adminReportsQuerySchema,
  idParamSchema,
  resolveReportSchema,
  suspendUserSchema,
  type AdminReportDto,
  type AdminReportsQuery,
  type ReportDto,
  type ResolveReportInput,
  type SuspendUserInput,
} from '@cc/shared';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import { ReportsService } from '../safety/reports.service.js';

@Roles('ADMIN')
@Controller('admin')
export class AdminSafetyController {
  private readonly logger = new Logger('Admin');

  constructor(private readonly reports: ReportsService) {}

  @Get('reports')
  list(@Query({ schema: adminReportsQuerySchema }) query: AdminReportsQuery): Promise<AdminReportDto[]> {
    return this.reports.list(query);
  }

  @Post('reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentUser() admin: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: resolveReportSchema }) body: ResolveReportInput,
  ): Promise<ReportDto> {
    this.logger.log(`admin ${admin.id} resolved report ${id}: ${body.decision}`);
    return this.reports.resolve(admin.id, id, body);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspend(
    @CurrentUser() admin: AuthUser,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: suspendUserSchema }) body: SuspendUserInput,
  ): Promise<void> {
    await this.reports.suspend(id);
    this.logger.warn(`admin ${admin.id} suspended user ${id}: ${body.reason}`);
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsuspend(@CurrentUser() admin: AuthUser, @Param('id', { schema: idParamSchema }) id: string): Promise<void> {
    await this.reports.unsuspend(id);
    this.logger.warn(`admin ${admin.id} unsuspended user ${id}`);
  }
}
