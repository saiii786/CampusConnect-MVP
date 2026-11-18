/**
 * Uploads module: signing uploads, claiming them for features, and the local-driver routes.
 * The raw-body parser (images, max 5 MB) is mounted ONLY on the local upload route; every other
 * route keeps the global 100 kb JSON limit.
 */
import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { IMAGE_CONTENT_TYPES, MAX_UPLOAD_BYTES } from '@cc/shared';
import express from 'express';
import { LocalUploadsController } from './local-uploads.controller.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';

@Module({
  controllers: [UploadsController, LocalUploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(express.raw({ type: Object.keys(IMAGE_CONTENT_TYPES), limit: MAX_UPLOAD_BYTES }))
      .forRoutes({ path: 'uploads/local/:token', method: RequestMethod.PUT });
  }
}
