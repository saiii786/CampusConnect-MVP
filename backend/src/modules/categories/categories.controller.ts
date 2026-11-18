/**
 * GET /api/v1/categories — public (needed on the sign-up/onboarding path and for browsing).
 * Cacheable for an hour: categories only change with a deploy (seed data).
 */
import { Controller, Get, Header } from '@nestjs/common';
import type { CategoriesResponse } from '@cc/shared';
import { Public } from '../auth/auth.decorators.js';
import { CategoriesService } from './categories.service.js';

@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  list(): Promise<CategoriesResponse> {
    return this.categories.list();
  }
}
