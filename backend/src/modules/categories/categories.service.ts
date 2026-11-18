/**
 * Category tree (FR-100) with sensitive-category gating (FR-104, ADR-010): categories flagged
 * `sensitive` (child care, elder care, pet care) are never listed and cannot be used, until
 * ID verification (FR-008) exists.
 */
import { Injectable } from '@nestjs/common';
import type { CategoriesResponse, CategoryGroupDto } from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import type { Category } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All selectable categories, grouped, in seed order. */
  async list(): Promise<CategoriesResponse> {
    const rows = await this.prisma.category.findMany({
      where: { sensitive: false },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    const groups = new Map<string, CategoryGroupDto>();
    for (const c of rows) {
      let group = groups.get(c.groupName);
      if (!group) {
        group = { name: c.groupName, categories: [] };
        groups.set(c.groupName, group);
      }
      group.categories.push({ id: c.id, slug: c.slug, name: c.name });
    }
    return { groups: [...groups.values()] };
  }

  /**
   * For listings (Phase 3): the category must exist and must not be gated.
   * Gated categories answer exactly like unknown ones (422), so the app cannot use them.
   */
  async getSelectable(categoryId: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.sensitive) {
      throw AppError.unprocessable('CATEGORY_NOT_AVAILABLE', 'This category is not available');
    }
    return category;
  }
}
