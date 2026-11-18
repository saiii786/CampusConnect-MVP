# `listings` module — service offers, job requests and search

PRD: FR-101…103, FR-150…152 · Design: [ADR-021](../../../../docs/DECISIONS.md) · Roadmap: Phase 3

## Endpoints (`/api/v1`, all signed in)
| Endpoint | Who | Body / query | Success | Main errors |
|---|---|---|---|---|
| `GET /listings` | anyone signed in | `searchListingsSchema`: `q, type, categoryId, city, workMode, minPricePaise, maxPricePaise, lat, lng, radiusKm, sort (newest/distance/price_asc/price_desc), cursor, limit` | 200 `Page<ListingSummaryDto>` | 400 `VALIDATION_FAILED`, `INVALID_CURSOR` |
| `GET /listings/:id` | owner (any status) / others (ACTIVE only) | optional `lat,lng` for distance | 200 `ListingDetailDto` | 404 `LISTING_NOT_FOUND` |
| `POST /listings` | **verified email** | `createListingSchema` | 201 | 403 `AUTH_EMAIL_NOT_VERIFIED`, 422 `CATEGORY_NOT_AVAILABLE`, 400 `UPLOAD_*` |
| `PATCH /listings/:id` | owner | `updateListingSchema` (merged + re-checked) | 200 | 404, 409 `LISTING_CLOSED`, 400 |
| `POST /listings/:id/pause` · `/resume` · `/close` | owner | — | 200 | 404, 409 `LISTING_INVALID_STATUS` |
| `GET /me/listings` | owner | `status?, cursor?, limit?` | 200 `Page<ListingSummaryDto>` | |

## Rules
- Service offers: `FIXED`/`HOURLY` need `pricePaise`; `QUOTE` must not have one. Job requests: always `QUOTE`, optional budget (min ≤ max) and `preferredDate` (not in the past). On-site needs `location` + `city`. All in `@cc/shared` `checkListingRules`.
- Location: rounded to ~110 m before saving; **never returned** — only `city` and `distanceKm`.
- Photos: up to 5, uploaded with purpose `LISTING` and claimed (ADR-019); editing replaces the list, removed photos are deleted. `imageKeys` in the detail response are only filled for the owner.
- Closing is final and marks the listing's ACTIVE quotes `NOT_SELECTED`. Nothing is hard-deleted (FR-152).
- Status changes are conditional updates (no lost updates under concurrency).

## Files
| File | What it does |
|---|---|
| `listings.module.ts` | Imports Categories + Uploads; exports `ListingsService` |
| `listings.controller.ts` | `ListingsController` (`/listings…`) and `MyListingsController` (`/me/listings`) |
| `listings.service.ts` | create / update (merge + rules + photo diff) / changeStatus / getDetail / myListings / search (database path and geo path) |
| `listing.mapper.ts` | `toListingSummary`, `toListingDetail`, `LISTING_INCLUDE`, `listingDistance` |

Shared helpers: `backend/src/common/pagination/cursor.ts` (opaque keyset/offset cursors). Integration tests: `backend/test/listings.e2e-spec.ts`.
