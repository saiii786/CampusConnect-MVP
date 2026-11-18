/**
 * Portfolio (FR-051): up to PORTFOLIO_MAX_ITEMS images with title/description, in the owner's order.
 * Every method takes the acting user's id and only touches that user's items (other users get 404).
 */
import { Injectable } from '@nestjs/common';
import {
  PORTFOLIO_MAX_ITEMS,
  UploadPurpose,
  type CreatePortfolioItemInput,
  type PortfolioItemDto,
  type UpdatePortfolioItemInput,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { toPortfolioItemDto } from './user.mapper.js';

const ORDER = [{ position: 'asc' as const }, { createdAt: 'asc' as const }];
const notFound = () => AppError.notFound('PORTFOLIO_ITEM_NOT_FOUND', 'Portfolio item not found');

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async list(userId: string): Promise<PortfolioItemDto[]> {
    const items = await this.prisma.portfolioItem.findMany({ where: { userId }, orderBy: ORDER });
    return items.map(toPortfolioItemDto);
  }

  async create(userId: string, input: CreatePortfolioItemInput): Promise<PortfolioItemDto> {
    const image = await this.uploads.claim(userId, input.uploadKey, UploadPurpose.PORTFOLIO);
    try {
      const item = await this.prisma.$transaction(async (tx) => {
        // Lock the owner's profile row so two simultaneous adds cannot both pass the limit.
        await tx.$queryRaw`SELECT 1 FROM "Profile" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
        const count = await tx.portfolioItem.count({ where: { userId } });
        if (count >= PORTFOLIO_MAX_ITEMS) {
          throw AppError.unprocessable('PORTFOLIO_LIMIT', `You can have at most ${PORTFOLIO_MAX_ITEMS} portfolio items`);
        }
        return tx.portfolioItem.create({
          data: {
            userId,
            title: input.title,
            description: input.description ?? null,
            imageUrl: image.url,
            imageKey: image.key,
            position: count,
          },
        });
      });
      return toPortfolioItemDto(item);
    } catch (error) {
      await this.uploads.discard([image.key]);
      throw error;
    }
  }

  async update(userId: string, id: string, input: UpdatePortfolioItemInput): Promise<PortfolioItemDto> {
    const item = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.portfolioItem.findFirst({ where: { id, userId } });
      if (!existing) throw notFound();
      if (input.position !== undefined && input.position !== existing.position) {
        // Move the item, then renumber all items 0..n-1.
        const ids = (await tx.portfolioItem.findMany({ where: { userId }, orderBy: ORDER, select: { id: true } }))
          .map((i) => i.id)
          .filter((x) => x !== id);
        ids.splice(Math.min(input.position, ids.length), 0, id);
        for (const [position, itemId] of ids.entries()) {
          await tx.portfolioItem.update({ where: { id: itemId }, data: { position } });
        }
      }
      return tx.portfolioItem.update({
        where: { id },
        data: { title: input.title, description: input.description },
      });
    });
    return toPortfolioItemDto(item);
  }

  async remove(userId: string, id: string): Promise<void> {
    const removed = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.portfolioItem.findFirst({ where: { id, userId } });
      if (!existing) throw notFound();
      await tx.portfolioItem.delete({ where: { id } });
      const rest = await tx.portfolioItem.findMany({ where: { userId }, orderBy: ORDER, select: { id: true } });
      for (const [position, item] of rest.entries()) {
        await tx.portfolioItem.update({ where: { id: item.id }, data: { position } });
      }
      return existing;
    });
    await this.uploads.discard([removed.imageKey]);
  }
}
