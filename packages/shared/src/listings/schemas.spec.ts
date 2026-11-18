import { describe, expect, it } from 'vitest';
import {
  checkListingRules,
  createListingSchema,
  distanceKm,
  roundCoordinate,
  searchListingsSchema,
  updateListingSchema,
} from './schemas.js';

const CAT = '01936b6e-7c3a-7d4e-8f00-0123456789ab';
const offer = {
  type: 'SERVICE_OFFER',
  categoryId: CAT,
  title: 'Wall painting',
  description: 'I paint rooms and walls neatly, with my own tools.',
  workMode: 'ONSITE',
  city: 'Hyderabad',
  location: { lat: 17.385, lng: 78.4867 },
  pricingType: 'FIXED',
  pricePaise: 150000,
};
const job = {
  type: 'JOB_REQUEST',
  categoryId: CAT,
  title: 'Need a logo for my shop',
  description: 'Small tiffin centre needs a simple logo and a banner design.',
  workMode: 'REMOTE',
  budgetMinPaise: 50000,
  budgetMaxPaise: 200000,
};

describe('createListingSchema', () => {
  it('accepts a valid service offer and a valid job request (pricing defaults to QUOTE)', () => {
    expect(createListingSchema.safeParse(offer).success).toBe(true);
    const parsed = createListingSchema.parse(job);
    expect(parsed.pricingType).toBe('QUOTE');
  });

  it('service offers: price required unless QUOTE, and no price with QUOTE', () => {
    expect(createListingSchema.safeParse({ ...offer, pricePaise: undefined }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...offer, pricingType: 'QUOTE', pricePaise: undefined }).success).toBe(true);
    expect(createListingSchema.safeParse({ ...offer, pricingType: 'QUOTE' }).success).toBe(false);
  });

  it('job requests: no fixed price, budget min ≤ max, date not in the past', () => {
    expect(createListingSchema.safeParse({ ...job, pricePaise: 100 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...job, pricingType: 'FIXED' }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...job, budgetMinPaise: 300000 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...job, preferredDate: '2001-01-01' }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...job, preferredDate: '2999-01-01' }).success).toBe(true);
  });

  it('on-site work needs a location and a city; amounts must be valid paise', () => {
    expect(createListingSchema.safeParse({ ...offer, location: null }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...offer, city: '' }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...offer, pricePaise: -5 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...offer, pricePaise: 10.5 }).success).toBe(false);
  });

  it('rejects unknown fields, short text and more than 5 images', () => {
    expect(createListingSchema.safeParse({ ...offer, ownerId: CAT }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...offer, title: 'Hi' }).success).toBe(false);
    const key = `users/${CAT}/listing/${CAT}.jpg`;
    expect(createListingSchema.safeParse({ ...offer, imageUploadKeys: Array(6).fill(key) }).success).toBe(false);
  });
});

describe('checkListingRules (used after merging an update)', () => {
  it('flags inconsistent combinations', () => {
    expect(checkListingRules({ type: 'JOB_REQUEST', workMode: 'REMOTE', pricingType: 'QUOTE', radiusKm: 5 })).toEqual([
      { path: 'radiusKm', message: expect.any(String) },
    ]);
    expect(checkListingRules({ type: 'SERVICE_OFFER', workMode: 'REMOTE', pricingType: 'HOURLY', pricePaise: 50000 })).toEqual([]);
  });
  it('update schema cannot change the type and needs at least one field', () => {
    expect(updateListingSchema.safeParse({ type: 'JOB_REQUEST' }).success).toBe(false);
    expect(updateListingSchema.safeParse({}).success).toBe(false);
    expect(updateListingSchema.safeParse({ title: 'New title here' }).success).toBe(true);
  });
});

describe('searchListingsSchema', () => {
  it('coerces query-string numbers and applies defaults', () => {
    const v = searchListingsSchema.parse({ lat: '17.4', lng: '78.5', radiusKm: '10', limit: '5' });
    expect(v).toMatchObject({ lat: 17.4, lng: 78.5, radiusKm: 10, limit: 5, sort: 'newest' });
  });
  it('needs both coordinates for near-me and distance sort; price range must be ordered', () => {
    expect(searchListingsSchema.safeParse({ lat: '17.4' }).success).toBe(false);
    expect(searchListingsSchema.safeParse({ radiusKm: '5' }).success).toBe(false);
    expect(searchListingsSchema.safeParse({ sort: 'distance' }).success).toBe(false);
    expect(searchListingsSchema.safeParse({ minPricePaise: '500', maxPricePaise: '100' }).success).toBe(false);
    expect(searchListingsSchema.safeParse({ radiusKm: '80', lat: '1', lng: '1' }).success).toBe(false);
  });
});

describe('geo helpers', () => {
  it('distanceKm: Hyderabad → Secunderabad is about 7 km; same point is 0', () => {
    const d = distanceKm({ lat: 17.385, lng: 78.4867 }, { lat: 17.4399, lng: 78.4983 });
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(8);
    expect(distanceKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
  it('roundCoordinate keeps 3 decimals', () => {
    expect(roundCoordinate(17.385044)).toBe(17.385);
    expect(roundCoordinate(-78.48675)).toBe(-78.487);
  });
});
