/**
 * Listings — the two MVP matching modes (PRD §6, FR-150…153) and search (FR-101…103).
 *
 *   SERVICE_OFFER (Mode 2): a seller offers a service — FIXED or HOURLY price, or QUOTE ("ask me").
 *   JOB_REQUEST   (Mode 1): a buyer needs something done — always QUOTE (sellers send quotes),
 *                           optional budget range and preferred date.
 *
 * Location privacy (FR-054): on-site listings carry a pin, but the API stores it rounded to
 * ~100 m (LOCATION_DECIMALS) and NEVER returns coordinates — only the city and a distance.
 */
import { z } from 'zod';
import { ListingStatus, ListingType, PricingType, WorkMode } from '../enums.js';
import { isValidAmountPaise, MAX_AMOUNT_PAISE } from '../money.js';
import { uploadKeySchema } from '../uploads/schemas.js';

export const LISTING_TITLE_MIN = 5;
export const LISTING_TITLE_MAX = 100;
export const LISTING_DESCRIPTION_MIN = 20;
export const LISTING_DESCRIPTION_MAX = 2000;
export const LISTING_MAX_IMAGES = 5;
export const SERVICE_RADIUS_MIN_KM = 1;
export const SERVICE_RADIUS_MAX_KM = 50;
export const SEARCH_PAGE_SIZE = 20;
export const SEARCH_PAGE_SIZE_MAX = 50;
/** Coordinates are stored rounded to 3 decimals (≈110 m) — never an exact address. */
export const LOCATION_DECIMALS = 3;

const paise = z
  .number({ error: 'Enter an amount' })
  .refine(isValidAmountPaise, `Enter an amount between ₹1 and ₹${MAX_AMOUNT_PAISE / 100}`);

export const locationSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();
export type GeoPoint = z.infer<typeof locationSchema>;

/** `YYYY-MM-DD`, today or later (checked against the server's UTC date, with a day of slack). */
const futureDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Enter a real date')
  .refine((v) => Date.parse(`${v}T00:00:00Z`) >= Date.now() - 36 * 3600 * 1000, 'The date cannot be in the past');

const commonFields = {
  categoryId: z.uuid('Choose a category'),
  title: z
    .string()
    .trim()
    .min(LISTING_TITLE_MIN, `Title must be at least ${LISTING_TITLE_MIN} characters`)
    .max(LISTING_TITLE_MAX, `Title must be at most ${LISTING_TITLE_MAX} characters`),
  description: z
    .string()
    .trim()
    .min(LISTING_DESCRIPTION_MIN, `Describe it in at least ${LISTING_DESCRIPTION_MIN} characters`)
    .max(LISTING_DESCRIPTION_MAX, `At most ${LISTING_DESCRIPTION_MAX} characters`),
  workMode: z.enum(WorkMode),
  city: z.string().trim().max(60).nullable().optional(),
  location: locationSchema.nullable().optional(),
  imageUploadKeys: z.array(uploadKeySchema).max(LISTING_MAX_IMAGES, `At most ${LISTING_MAX_IMAGES} photos`).optional(),
};

/** The fields that decide whether a listing is consistent (used for create AND after merging an update). */
export interface ListingRulesInput {
  type: ListingType;
  workMode: WorkMode;
  pricingType: PricingType;
  pricePaise?: number | null;
  budgetMinPaise?: number | null;
  budgetMaxPaise?: number | null;
  city?: string | null;
  location?: GeoPoint | null;
  radiusKm?: number | null;
}

/** Cross-field rules. Returns problems as { path, message } (empty = valid). */
export function checkListingRules(l: ListingRulesInput): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (l.type === ListingType.SERVICE_OFFER) {
    if (l.pricingType === PricingType.QUOTE) {
      if (l.pricePaise != null) issues.push({ path: 'pricePaise', message: 'Leave the price empty for "ask for a quote"' });
    } else if (l.pricePaise == null) {
      issues.push({ path: 'pricePaise', message: 'Enter your price' });
    }
    if (l.budgetMinPaise != null || l.budgetMaxPaise != null) {
      issues.push({ path: 'budgetMinPaise', message: 'Budgets are only for job requests' });
    }
  } else {
    if (l.pricingType !== PricingType.QUOTE) {
      issues.push({ path: 'pricingType', message: 'Job requests receive quotes' });
    }
    if (l.pricePaise != null) issues.push({ path: 'pricePaise', message: 'Job requests use a budget, not a price' });
    if (l.budgetMinPaise != null && l.budgetMaxPaise != null && l.budgetMinPaise > l.budgetMaxPaise) {
      issues.push({ path: 'budgetMaxPaise', message: 'Maximum budget must be at least the minimum' });
    }
    if (l.radiusKm != null) issues.push({ path: 'radiusKm', message: 'Service radius is only for service offers' });
  }
  if (l.workMode === WorkMode.ONSITE) {
    if (!l.location) issues.push({ path: 'location', message: 'Set the location for on-site work' });
    if (!l.city) issues.push({ path: 'city', message: 'Enter the city or area' });
  }
  return issues;
}

const serviceOfferSchema = z
  .object({
    type: z.literal(ListingType.SERVICE_OFFER),
    ...commonFields,
    pricingType: z.enum(PricingType),
    pricePaise: paise.nullable().optional(),
    radiusKm: z.number().int().min(SERVICE_RADIUS_MIN_KM).max(SERVICE_RADIUS_MAX_KM).nullable().optional(),
  })
  .strict();

const jobRequestSchema = z
  .object({
    type: z.literal(ListingType.JOB_REQUEST),
    ...commonFields,
    pricingType: z.literal(PricingType.QUOTE).default(PricingType.QUOTE),
    budgetMinPaise: paise.nullable().optional(),
    budgetMaxPaise: paise.nullable().optional(),
    preferredDate: futureDate.nullable().optional(),
  })
  .strict();

/** POST /listings */
export const createListingSchema = z
  .discriminatedUnion('type', [serviceOfferSchema, jobRequestSchema])
  .superRefine((l, ctx) => {
    for (const issue of checkListingRules(l)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  });
export type CreateListingInput = z.infer<typeof createListingSchema>;

/**
 * PATCH /listings/:id — any subset of fields; the type cannot change. The server merges the
 * update with the stored listing and re-checks `checkListingRules`. `imageUploadKeys` replaces
 * the whole photo list (keys already on the listing are kept as they are).
 */
export const updateListingSchema = z
  .object({
    categoryId: commonFields.categoryId.optional(),
    title: commonFields.title.optional(),
    description: commonFields.description.optional(),
    workMode: commonFields.workMode.optional(),
    city: commonFields.city,
    location: commonFields.location,
    imageUploadKeys: commonFields.imageUploadKeys,
    pricingType: z.enum(PricingType).optional(),
    pricePaise: paise.nullable().optional(),
    radiusKm: z.number().int().min(SERVICE_RADIUS_MIN_KM).max(SERVICE_RADIUS_MAX_KM).nullable().optional(),
    budgetMinPaise: paise.nullable().optional(),
    budgetMaxPaise: paise.nullable().optional(),
    preferredDate: futureDate.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

// ── Search (FR-101…103) ─────────────────────────────────────────────────────

export const ListingSort = {
  NEWEST: 'newest',
  DISTANCE: 'distance',
  PRICE_ASC: 'price_asc',
  PRICE_DESC: 'price_desc',
} as const;
export type ListingSort = (typeof ListingSort)[keyof typeof ListingSort];

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), schema.optional());

/** GET /listings query string. Everything optional; `lat`+`lng` enable distances and "near me". */
export const searchListingsSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    type: z.enum([ListingType.SERVICE_OFFER, ListingType.JOB_REQUEST]).optional(),
    categoryId: z.uuid().optional(),
    city: z.string().trim().max(60).optional(),
    workMode: z.enum(WorkMode).optional(),
    minPricePaise: optionalNumber(z.number().int().min(0).max(MAX_AMOUNT_PAISE)),
    maxPricePaise: optionalNumber(z.number().int().min(0).max(MAX_AMOUNT_PAISE)),
    lat: optionalNumber(z.number().min(-90).max(90)),
    lng: optionalNumber(z.number().min(-180).max(180)),
    radiusKm: optionalNumber(z.number().int().min(SERVICE_RADIUS_MIN_KM).max(SERVICE_RADIUS_MAX_KM)),
    sort: z.enum(ListingSort).default(ListingSort.NEWEST),
    cursor: z.string().max(200).optional(),
    limit: optionalNumber(z.number().int().min(1).max(SEARCH_PAGE_SIZE_MAX)),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lng === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Send both lat and lng' });
    }
    if ((v.radiusKm !== undefined || v.sort === ListingSort.DISTANCE) && v.lat === undefined) {
      ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Location is needed for near-me search' });
    }
    if (v.minPricePaise !== undefined && v.maxPricePaise !== undefined && v.minPricePaise > v.maxPricePaise) {
      ctx.addIssue({ code: 'custom', path: ['maxPricePaise'], message: 'Maximum must be at least the minimum' });
    }
  });
export type SearchListingsInput = z.infer<typeof searchListingsSchema>;

/** GET /listings/:id query string — optional viewer position to show the distance. */
export const listingDetailQuerySchema = z
  .object({
    lat: optionalNumber(z.number().min(-90).max(90)),
    lng: optionalNumber(z.number().min(-180).max(180)),
  })
  .strict();
export type ListingDetailQuery = z.infer<typeof listingDetailQuerySchema>;

/** GET /me/listings query string. */
export const myListingsSchema = z
  .object({
    status: z.enum(ListingStatus).optional(),
    cursor: z.string().max(200).optional(),
    limit: optionalNumber(z.number().int().min(1).max(SEARCH_PAGE_SIZE_MAX)),
  })
  .strict();
export type MyListingsInput = z.infer<typeof myListingsSchema>;

// ── Responses ───────────────────────────────────────────────────────────────

export interface Page<T> {
  items: T[];
  /** Pass back as `cursor` for the next page; null = no more results. */
  nextCursor: string | null;
}

export interface ListingOwnerDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isStudent: boolean;
}

export interface ListingSummaryDto {
  id: string;
  type: ListingType;
  status: ListingStatus;
  title: string;
  category: { id: string; slug: string; name: string };
  pricingType: PricingType;
  pricePaise: number | null;
  budgetMinPaise: number | null;
  budgetMaxPaise: number | null;
  workMode: WorkMode;
  city: string | null;
  /** Only when the search sent lat/lng and the listing has a location. Rounded to 0.1 km. */
  distanceKm: number | null;
  coverImageUrl: string | null;
  owner: ListingOwnerDto;
  createdAt: string;
}

export interface ListingDetailDto extends ListingSummaryDto {
  description: string;
  imageUrls: string[];
  /** Storage keys of the photos, same order as imageUrls — only for the owner (needed to edit); [] otherwise. */
  imageKeys: string[];
  radiusKm: number | null;
  preferredDate: string | null;
  /** True when the signed-in user owns this listing (show edit/pause/close instead of book/quote). */
  isOwner: boolean;
  updatedAt: string;
}

/** Great-circle distance in km (haversine). Exported so app and API compute the same number. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Round a coordinate for storage (~110 m). */
export function roundCoordinate(value: number): number {
  const f = 10 ** LOCATION_DECIMALS;
  return Math.round(value * f) / f;
}
