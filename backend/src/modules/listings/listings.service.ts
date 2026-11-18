/**
 * Listings: create/edit/pause/resume/close (FR-150…152) and search (FR-101…103).
 *
 * Visibility: the owner sees their listing in any status; everyone else only sees ACTIVE, not
 * deleted listings of ACTIVE users in non-gated categories (otherwise 404 LISTING_NOT_FOUND).
 * Never hard-deleted (FR-152): "delete" = close.
 *
 * Search has two paths:
 *   - database path (no radius, sort newest/price): filters + ORDER BY in Postgres, keyset (newest)
 *     or offset (price) cursor;
 *   - geo path (radiusKm set or sort=distance): bounding-box prefilter in SQL, exact haversine
 *     distance in code, then sort + offset cursor. Capped at GEO_CANDIDATE_LIMIT candidates —
 *     plenty for a pilot city; a PostGIS index is the upgrade path if that ever binds.
 */
import { Injectable } from '@nestjs/common';
import {
  checkListingRules,
  ListingSort,
  ListingStatus,
  ListingType,
  roundCoordinate,
  SEARCH_PAGE_SIZE,
  SERVICE_RADIUS_MAX_KM,
  UploadPurpose,
  UserStatus,
  WorkMode,
  type CreateListingInput,
  type GeoPoint,
  type ListingDetailDto,
  type ListingSummaryDto,
  type MyListingsInput,
  type Page,
  type SearchListingsInput,
  type UpdateListingInput,
} from '@cc/shared';
import { AppError } from '../../common/errors/app-error.js';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { assertContentAllowed, LISTING_LIMIT_PER_HOUR, tooManyRequests } from '../safety/content-guard.js';
import { UploadsService, type ClaimedUpload } from '../uploads/uploads.service.js';
import {
  LISTING_INCLUDE,
  listingDistance,
  toListingDetail,
  toListingSummary,
  type ListingWithRelations,
} from './listing.mapper.js';

export const GEO_CANDIDATE_LIMIT = 1000;
const KM_PER_DEGREE_LAT = 111.32;

const notFound = () => AppError.notFound('LISTING_NOT_FOUND', 'Listing not found');

/** WHERE clause for listings a non-owner may see. */
const PUBLICLY_VISIBLE: Prisma.ListingWhereInput = {
  status: ListingStatus.ACTIVE,
  deletedAt: null,
  type: { in: [ListingType.SERVICE_OFFER, ListingType.JOB_REQUEST] },
  category: { sensitive: false },
  owner: { status: UserStatus.ACTIVE },
};

export type ListingStatusAction = 'pause' | 'resume' | 'close';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly uploads: UploadsService,
  ) {}

  // ── Create / update / status ──────────────────────────────────────────────

  async create(userId: string, input: CreateListingInput): Promise<ListingDetailDto> {
    assertContentAllowed(input.title, input.description);
    const recent = await this.prisma.listing.count({ where: { ownerId: userId, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (recent >= LISTING_LIMIT_PER_HOUR) throw tooManyRequests('listings');
    await this.categories.getSelectable(input.categoryId);
    const images = await this.claimImages(userId, input.imageUploadKeys ?? []);
    try {
      const isOffer = input.type === ListingType.SERVICE_OFFER;
      const listing = await this.prisma.listing.create({
        data: {
          ownerId: userId,
          type: input.type,
          categoryId: input.categoryId,
          title: input.title,
          description: input.description,
          pricingType: input.pricingType,
          pricePaise: isOffer ? (input.pricePaise ?? null) : null,
          budgetMinPaise: isOffer ? null : (input.budgetMinPaise ?? null),
          budgetMaxPaise: isOffer ? null : (input.budgetMaxPaise ?? null),
          workMode: input.workMode,
          city: input.city || null,
          ...this.locationData(input.workMode, input.location),
          radiusKm: isOffer ? (input.radiusKm ?? null) : null,
          preferredDate: !isOffer && input.preferredDate ? new Date(`${input.preferredDate}T00:00:00.000Z`) : null,
          imageUrls: images.map((i) => i.url),
          imageKeys: images.map((i) => i.key),
        },
        include: LISTING_INCLUDE,
      });
      return toListingDetail(listing, userId);
    } catch (error) {
      await this.uploads.discard(images.map((i) => i.key));
      throw error;
    }
  }

  async update(userId: string, id: string, input: UpdateListingInput): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findFirst({ where: { id, ownerId: userId, deletedAt: null } });
    if (!existing) throw notFound();
    if (existing.status === ListingStatus.CLOSED) {
      throw AppError.conflict('LISTING_CLOSED', 'Closed listings cannot be edited');
    }
    assertContentAllowed(input.title, input.description);

    // Merge, then re-check the cross-field rules on the result.
    const pick = <K extends keyof UpdateListingInput, T>(key: K, current: T) =>
      (input[key] !== undefined ? input[key] : current) as Exclude<UpdateListingInput[K], undefined> | T;
    const merged = {
      type: existing.type as ListingType,
      workMode: pick('workMode', existing.workMode),
      pricingType: pick('pricingType', existing.pricingType),
      pricePaise: pick('pricePaise', existing.pricePaise),
      budgetMinPaise: pick('budgetMinPaise', existing.budgetMinPaise),
      budgetMaxPaise: pick('budgetMaxPaise', existing.budgetMaxPaise),
      city: pick('city', existing.city),
      location:
        input.location !== undefined
          ? input.location
          : existing.lat !== null && existing.lng !== null
            ? { lat: existing.lat, lng: existing.lng }
            : null,
      radiusKm: pick('radiusKm', existing.radiusKm),
    };
    const problems = checkListingRules(merged);
    if (problems.length) throw AppError.badRequest('VALIDATION_FAILED', 'Some fields are missing or invalid', problems);
    if (input.categoryId && input.categoryId !== existing.categoryId) await this.categories.getSelectable(input.categoryId);

    // Photos: keep the ones already on the listing, claim new ones, delete removed ones afterwards.
    let imageData: { imageUrls: string[]; imageKeys: string[] } | undefined;
    let removedKeys: string[] = [];
    let newlyClaimed: ClaimedUpload[] = [];
    if (input.imageUploadKeys !== undefined) {
      const urlByKey = new Map(existing.imageKeys.map((k, i) => [k, existing.imageUrls[i]!]));
      newlyClaimed = await this.claimImages(
        userId,
        input.imageUploadKeys.filter((k) => !urlByKey.has(k)),
      );
      for (const c of newlyClaimed) urlByKey.set(c.key, c.url);
      const keys = [...new Set(input.imageUploadKeys)];
      imageData = { imageKeys: keys, imageUrls: keys.map((k) => urlByKey.get(k)!) };
      removedKeys = existing.imageKeys.filter((k) => !keys.includes(k));
    }

    try {
      const isOffer = existing.type === ListingType.SERVICE_OFFER;
      const updated = await this.prisma.listing.update({
        where: { id },
        data: {
          categoryId: input.categoryId,
          title: input.title,
          description: input.description,
          workMode: merged.workMode,
          pricingType: merged.pricingType,
          pricePaise: isOffer ? merged.pricePaise : null,
          budgetMinPaise: isOffer ? null : merged.budgetMinPaise,
          budgetMaxPaise: isOffer ? null : merged.budgetMaxPaise,
          city: merged.city || null,
          ...this.locationData(merged.workMode, merged.location),
          radiusKm: isOffer ? merged.radiusKm : null,
          ...(input.preferredDate !== undefined && !isOffer
            ? { preferredDate: input.preferredDate ? new Date(`${input.preferredDate}T00:00:00.000Z`) : null }
            : {}),
          ...imageData,
        },
        include: LISTING_INCLUDE,
      });
      await this.uploads.discard(removedKeys);
      return toListingDetail(updated, userId);
    } catch (error) {
      await this.uploads.discard(newlyClaimed.map((c) => c.key));
      throw error;
    }
  }

  /** pause: ACTIVE→PAUSED · resume: PAUSED→ACTIVE · close: ACTIVE|PAUSED→CLOSED (final). */
  async changeStatus(userId: string, id: string, action: ListingStatusAction): Promise<ListingDetailDto> {
    const from: Record<ListingStatusAction, ListingStatus[]> = {
      pause: [ListingStatus.ACTIVE],
      resume: [ListingStatus.PAUSED],
      close: [ListingStatus.ACTIVE, ListingStatus.PAUSED],
    };
    const to: Record<ListingStatusAction, ListingStatus> = {
      pause: ListingStatus.PAUSED,
      resume: ListingStatus.ACTIVE,
      close: ListingStatus.CLOSED,
    };
    const existing = await this.prisma.listing.findFirst({ where: { id, ownerId: userId, deletedAt: null } });
    if (!existing) throw notFound();

    const result = await this.prisma.$transaction(async (tx) => {
      // Conditional update: a concurrent change cannot slip through.
      const changed = await tx.listing.updateMany({
        where: { id, status: { in: from[action] } },
        data: { status: to[action] },
      });
      if (changed.count !== 1) {
        throw AppError.conflict('LISTING_INVALID_STATUS', `This listing cannot be ${action}d now`, {
          status: existing.status,
        });
      }
      if (action === 'close') {
        // Open quotes on a closed job request are no longer considered (FR-202 spirit).
        await tx.quote.updateMany({ where: { listingId: id, status: 'ACTIVE' }, data: { status: 'NOT_SELECTED' } });
      }
      return tx.listing.findUniqueOrThrow({ where: { id }, include: LISTING_INCLUDE });
    });
    return toListingDetail(result, userId);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async getDetail(viewerId: string, id: string, from?: GeoPoint | null): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findFirst({
      where: { id, OR: [{ ownerId: viewerId, deletedAt: null }, PUBLICLY_VISIBLE] },
      include: LISTING_INCLUDE,
    });
    if (!listing) throw notFound();
    return toListingDetail(listing, viewerId, from);
  }

  async myListings(userId: string, query: MyListingsInput): Promise<Page<ListingSummaryDto>> {
    const limit = query.limit ?? SEARCH_PAGE_SIZE;
    const cursor = decodeCursor(query.cursor, 'id');
    const rows = await this.prisma.listing.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(cursor ? { id: { lt: cursor.v as string } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: LISTING_INCLUDE,
    });
    return this.keysetPage(rows, limit, null);
  }

  async search(query: SearchListingsInput): Promise<Page<ListingSummaryDto>> {
    const limit = query.limit ?? SEARCH_PAGE_SIZE;
    const from: GeoPoint | null = query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : null;
    const where = this.searchWhere(query);

    if (from && (query.radiusKm !== undefined || query.sort === ListingSort.DISTANCE)) {
      return this.geoSearch(where, from, query.radiusKm ?? SERVICE_RADIUS_MAX_KM, query.sort, query.cursor, limit);
    }

    if (query.sort === ListingSort.NEWEST || query.sort === ListingSort.DISTANCE) {
      const cursor = decodeCursor(query.cursor, 'id');
      const rows = await this.prisma.listing.findMany({
        where: cursor ? { AND: [where, { id: { lt: cursor.v as string } }] } : where,
        orderBy: { id: 'desc' },
        take: limit + 1,
        include: LISTING_INCLUDE,
      });
      return this.keysetPage(rows, limit, from);
    }

    const offset = (decodeCursor(query.cursor, 'off')?.v as number | undefined) ?? 0;
    const direction = query.sort === ListingSort.PRICE_ASC ? 'asc' : 'desc';
    const rows = await this.prisma.listing.findMany({
      where,
      orderBy: [{ pricePaise: { sort: direction, nulls: 'last' } }, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
      include: LISTING_INCLUDE,
    });
    return this.offsetPage(rows, offset, limit, from);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private searchWhere(q: SearchListingsInput): Prisma.ListingWhereInput {
    const and: Prisma.ListingWhereInput[] = [PUBLICLY_VISIBLE];
    if (q.type) and.push({ type: q.type });
    if (q.categoryId) and.push({ categoryId: q.categoryId });
    if (q.workMode) and.push({ workMode: q.workMode });
    if (q.city) and.push({ city: { equals: q.city, mode: 'insensitive' } });
    // Every word must appear in the title or description.
    for (const word of (q.q ?? '').split(/\s+/).filter(Boolean).slice(0, 8)) {
      and.push({
        OR: [{ title: { contains: word, mode: 'insensitive' } }, { description: { contains: word, mode: 'insensitive' } }],
      });
    }
    // Price filters use the price for service offers and the budget range for job requests.
    if (q.minPricePaise !== undefined) {
      and.push({ OR: [{ pricePaise: { gte: q.minPricePaise } }, { budgetMaxPaise: { gte: q.minPricePaise } }] });
    }
    if (q.maxPricePaise !== undefined) {
      and.push({ OR: [{ pricePaise: { lte: q.maxPricePaise } }, { budgetMinPaise: { lte: q.maxPricePaise } }] });
    }
    return { AND: and };
  }

  private async geoSearch(
    where: Prisma.ListingWhereInput,
    from: GeoPoint,
    radiusKm: number,
    sort: SearchListingsInput['sort'],
    rawCursor: string | undefined,
    limit: number,
  ): Promise<Page<ListingSummaryDto>> {
    const dLat = radiusKm / KM_PER_DEGREE_LAT;
    const dLng = radiusKm / (KM_PER_DEGREE_LAT * Math.max(Math.cos((from.lat * Math.PI) / 180), 0.01));
    const candidates = await this.prisma.listing.findMany({
      where: {
        AND: [
          where,
          { workMode: WorkMode.ONSITE },
          { lat: { gte: from.lat - dLat, lte: from.lat + dLat } },
          { lng: { gte: from.lng - dLng, lte: from.lng + dLng } },
        ],
      },
      orderBy: { id: 'desc' },
      take: GEO_CANDIDATE_LIMIT,
      // Pass 1 is light (no joins): up to 1000 rows are filtered and sorted here, but only one page
      // is loaded with owner/category below (Phase 9 load test: p95 597 → see DEV_LOG).
      select: { id: true, lat: true, lng: true, pricePaise: true },
    });
    const inRange = candidates
      .map((l) => ({ l, d: listingDistance(l, from)! }))
      .filter((x) => x.d <= radiusKm);
    if (sort === ListingSort.DISTANCE) inRange.sort((a, b) => a.d - b.d);
    if (sort === ListingSort.PRICE_ASC || sort === ListingSort.PRICE_DESC) {
      const dir = sort === ListingSort.PRICE_ASC ? 1 : -1;
      inRange.sort((a, b) => {
        if (a.l.pricePaise === null) return 1;
        if (b.l.pricePaise === null) return -1;
        return dir * (a.l.pricePaise - b.l.pricePaise);
      });
    }
    const offset = (decodeCursor(rawCursor, 'off')?.v as number | undefined) ?? 0;
    const page = inRange.slice(offset, offset + limit);
    // Pass 2: full rows for this page only, returned in the computed order.
    const full = new Map(
      (await this.prisma.listing.findMany({ where: { id: { in: page.map((x) => x.l.id) } }, include: LISTING_INCLUDE })).map(
        (l) => [l.id, l],
      ),
    );
    return {
      items: page.flatMap((x) => {
        const l = full.get(x.l.id);
        return l ? [toListingSummary(l, from)] : []; // gone between the two reads → skip
      }),
      nextCursor: offset + limit < inRange.length ? encodeCursor({ k: 'off', v: offset + limit }) : null,
    };
  }

  private keysetPage(rows: ListingWithRelations[], limit: number, from: GeoPoint | null): Page<ListingSummaryDto> {
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      items: page.map((l) => toListingSummary(l, from)),
      nextCursor: hasMore ? encodeCursor({ k: 'id', v: page[page.length - 1]!.id }) : null,
    };
  }

  private offsetPage(rows: ListingWithRelations[], offset: number, limit: number, from: GeoPoint | null) {
    const hasMore = rows.length > limit;
    return {
      items: rows.slice(0, limit).map((l) => toListingSummary(l, from)),
      nextCursor: hasMore ? encodeCursor({ k: 'off', v: offset + limit }) : null,
    };
  }

  private locationData(workMode: string, location: GeoPoint | null | undefined) {
    // Remote work has no location; on-site pins are rounded (~110 m) for privacy.
    if (workMode !== WorkMode.ONSITE || !location) return { lat: null, lng: null };
    return { lat: roundCoordinate(location.lat), lng: roundCoordinate(location.lng) };
  }

  private async claimImages(userId: string, keys: string[]): Promise<ClaimedUpload[]> {
    const claimed: ClaimedUpload[] = [];
    try {
      for (const key of new Set(keys)) claimed.push(await this.uploads.claim(userId, key, UploadPurpose.LISTING));
      return claimed;
    } catch (error) {
      await this.uploads.discard(claimed.map((c) => c.key));
      throw error;
    }
  }
}
