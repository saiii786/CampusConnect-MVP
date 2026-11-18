/**
 * Reviews module: reviews, replies, public work record. Exports ReviewsService for order detail.
 */
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [UsersModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
