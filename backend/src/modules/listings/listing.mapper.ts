/**
 * Listing response mappers. Coordinates are NEVER included (FR-054) — only city and distance.
 */
import { distanceKm, type GeoPoint, type ListingDetailDto, type ListingSummaryDto } from '@cc/shared';
import type { Prisma } from '../../generated/prisma/client.js';

export const LISTING_INCLUDE = {
  category: { select: { id: true, slug: true, name: true } },
  owner: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, studentVerifiedAt: true } } } },
} as const satisfies Prisma.ListingInclude;
export type ListingWithRelations = Prisma.ListingGetPayload<{ include: typeof LISTING_INCLUDE }>;

export function listingDistance(listing: { lat: number | null; lng: number | null }, from?: GeoPoint | null): number | null {
  if (!from || listing.lat === null || listing.lng === null) return null;
  return Math.round(distanceKm(from, { lat: listing.lat, lng: listing.lng }) * 10) / 10;
}

export function toListingSummary(l: ListingWithRelations, from?: GeoPoint | null): ListingSummaryDto {
  return {
    id: l.id,
    type: l.type as ListingSummaryDto['type'],
    status: l.status,
    title: l.title,
    category: l.category,
    pricingType: l.pricingType,
    pricePaise: l.pricePaise,
    budgetMinPaise: l.budgetMinPaise,
    budgetMaxPaise: l.budgetMaxPaise,
    workMode: l.workMode,
    city: l.city,
    distanceKm: listingDistance(l, from),
    coverImageUrl: l.imageUrls[0] ?? null,
    owner: {
      id: l.owner.id,
      displayName: l.owner.profile?.displayName ?? '',
      avatarUrl: l.owner.profile?.avatarUrl ?? null,
      isStudent: l.owner.profile?.studentVerifiedAt != null,
    },
    createdAt: l.createdAt.toISOString(),
  };
}

export function toListingDetail(l: ListingWithRelations, viewerId: string, from?: GeoPoint | null): ListingDetailDto {
  return {
    ...toListingSummary(l, from),
    description: l.description,
    imageUrls: l.imageUrls,
    imageKeys: l.ownerId === viewerId ? l.imageKeys : [],
    radiusKm: l.radiusKm,
    preferredDate: l.preferredDate ? l.preferredDate.toISOString().slice(0, 10) : null,
    isOwner: l.ownerId === viewerId,
    updatedAt: l.updatedAt.toISOString(),
  };
}
