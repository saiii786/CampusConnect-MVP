/**
 * Safety module: blocks (Phase 4), reports + suspension (Phase 8). The content guard
 * (content-guard.ts) is plain functions used by listings, quotes and conversations.
 */
import { Module } from '@nestjs/common';
import { BlocksController } from './blocks.controller.js';
import { BlocksService } from './blocks.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [BlocksController, ReportsController],
  providers: [BlocksService, ReportsService],
  exports: [BlocksService, ReportsService],
})
export class SafetyModule {}
