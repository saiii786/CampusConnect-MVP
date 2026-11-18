/**
 * POST /api/v1/reports — report a user, listing, message or review (FR-600). Rate-limited.
 * Returns the (new or already open) report. 404 if the target is unknown or not visible to you,
 * 422 CANNOT_REPORT_SELF.
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { createReportSchema, type CreateReportInput, type ReportDto } from '@cc/shared';
import { AuthRateLimit, CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @AuthRateLimit()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body({ schema: createReportSchema }) body: CreateReportInput): Promise<ReportDto> {
    return this.reports.create(user.id, body);
  }
}
