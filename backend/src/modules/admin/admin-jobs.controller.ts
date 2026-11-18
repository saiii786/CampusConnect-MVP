/**
 * POST /api/v1/admin/jobs/auto-approve — run the auto-approve job now (admin). Returns how many
 * orders were approved. Useful after the free server woke up, and for testing.
 */
import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Roles } from '../auth/auth.decorators.js';
import { JobsService } from '../jobs/jobs.service.js';

@Roles('ADMIN')
@Controller('admin/jobs')
export class AdminJobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('auto-approve')
  @HttpCode(HttpStatus.OK)
  async autoApprove(): Promise<{ approved: number }> {
    return { approved: await this.jobs.autoApprove() };
  }
}
