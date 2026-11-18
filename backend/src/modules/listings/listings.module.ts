/**
 * Listings module (Phase 3). Exports ListingsService for quotes/orders (Phases 4–5).
 */
import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { ListingsController, MyListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';

@Module({
  imports: [CategoriesModule, UploadsModule],
  controllers: [ListingsController, MyListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
