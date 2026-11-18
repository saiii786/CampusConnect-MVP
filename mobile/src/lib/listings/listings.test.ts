import { buildListingBody, EMPTY_LISTING_FORM, listingToFormValues } from '@/components/listings/listing-form';
import { formatDistance, formatListingPrice, paiseToRupeesText } from './format';
import { toQueryString } from './listings-api';
import { activeFilterCount, DEFAULT_FILTERS, toSearchQuery } from './search-filters';

jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));
jest.mock('expo-location', () => ({}));
jest.mock('expo-secure-store', () => ({}));
jest.mock('@/config/api-url', () => ({ getApiBaseUrl: () => 'http://test/api/v1' }));

const base = { budgetMinPaise: null, budgetMaxPaise: null, pricePaise: null } as const;

describe('formatListingPrice', () => {
  it('formats offers and budgets in rupees', () => {
    expect(formatListingPrice({ ...base, type: 'SERVICE_OFFER', pricingType: 'FIXED', pricePaise: 150_000 })).toBe('₹1,500');
    expect(formatListingPrice({ ...base, type: 'SERVICE_OFFER', pricingType: 'HOURLY', pricePaise: 30_000 })).toBe('₹300/hr');
    expect(formatListingPrice({ ...base, type: 'SERVICE_OFFER', pricingType: 'QUOTE' })).toBe('Ask for a quote');
    expect(formatListingPrice({ ...base, type: 'JOB_REQUEST', pricingType: 'QUOTE', budgetMinPaise: 50_000, budgetMaxPaise: 200_000 })).toBe(
      'Budget ₹500–₹2,000',
    );
    expect(formatListingPrice({ ...base, type: 'JOB_REQUEST', pricingType: 'QUOTE', budgetMaxPaise: 200_000 })).toBe('Budget up to ₹2,000');
    expect(formatListingPrice({ ...base, type: 'JOB_REQUEST', pricingType: 'QUOTE' })).toBe('Open budget');
  });

  it('formats distances and rupee text', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(0.04)).toBe('100 m away');
    expect(formatDistance(0.46)).toBe('500 m away');
    expect(formatDistance(7.25)).toBe('7.3 km away');
    expect(paiseToRupeesText(150_000)).toBe('1500');
    expect(paiseToRupeesText(150_050)).toBe('1500.50');
    expect(paiseToRupeesText(null)).toBe('');
  });
});

describe('search filters → API query', () => {
  it('sends only what is set; near-me adds radius; distance sort needs a location', () => {
    expect(toSearchQuery(DEFAULT_FILTERS)).toEqual({ sort: 'newest', type: 'SERVICE_OFFER' });
    const q = toSearchQuery({ ...DEFAULT_FILTERS, q: '  cake ', nearMe: true, radiusKm: 5, sort: 'distance', location: { lat: 1, lng: 2 } });
    expect(q).toEqual({ sort: 'distance', type: 'SERVICE_OFFER', q: 'cake', lat: 1, lng: 2, radiusKm: 5 });
    expect(toSearchQuery({ ...DEFAULT_FILTERS, sort: 'distance' }).sort).toBe('newest');
    expect(activeFilterCount({ ...DEFAULT_FILTERS, categoryId: 'c', nearMe: true })).toBe(2);
    expect(toQueryString({ a: 1, b: undefined, c: '', d: 'x y' })).toBe('?a=1&d=x%20y');
  });
});

describe('listing form body', () => {
  it('converts rupees to paise and shapes offers vs job requests', () => {
    const offer = buildListingBody({ ...EMPTY_LISTING_FORM, categoryId: 'c', priceRupees: '1500.5', workMode: 'REMOTE' });
    expect(offer.errors).toEqual({});
    expect(offer.body).toMatchObject({ type: 'SERVICE_OFFER', pricingType: 'FIXED', pricePaise: 150_050, location: null });

    const job = buildListingBody({ ...EMPTY_LISTING_FORM, type: 'JOB_REQUEST', budgetMaxRupees: '2000', preferredDate: '' });
    expect(job.body).toMatchObject({ pricingType: 'QUOTE', budgetMinPaise: null, budgetMaxPaise: 200_000, preferredDate: null });
    expect(job.body).not.toHaveProperty('pricePaise');

    expect(buildListingBody({ ...EMPTY_LISTING_FORM, priceRupees: 'abc' }).errors.priceRupees).toBeDefined();
  });

  it('maps an existing listing back into form values (photos keep their keys)', () => {
    const v = listingToFormValues({
      type: 'SERVICE_OFFER',
      category: { id: 'cat' },
      title: 't',
      description: 'd',
      pricingType: 'HOURLY',
      pricePaise: 30_000,
      budgetMinPaise: null,
      budgetMaxPaise: null,
      preferredDate: null,
      workMode: 'ONSITE',
      city: 'Hyderabad',
      radiusKm: 5,
      imageUrls: ['/u/a.jpg'],
      imageKeys: ['users/x/listing/a.jpg'],
    });
    expect(v).toMatchObject({ priceRupees: '300', radiusKm: '5', location: null, photos: [{ key: 'users/x/listing/a.jpg', url: '/u/a.jpg' }] });
  });
});
