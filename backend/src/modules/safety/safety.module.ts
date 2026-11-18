/**
 * Safety module: blocks (Phase 4). Reports and the spam guard are added in Phase 8.
 */
import { Module } from '@nestjs/common';
import { BlocksController } from './blocks.controller.js';
import { BlocksService } from './blocks.service.js';

@Module({
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class SafetyModule {}
