import { workRecordUrl } from '@/lib/reviews/reviews-api';
import { starText } from '@/components/reviews/review-card';
import { hrefForLink } from './notifications-api';

jest.mock('expo-secure-store', () => ({}));
jest.mock('@/config/api-url', () => ({ getApiBaseUrl: () => 'http://test/api/v1' }));

describe('notification links', () => {
  it('open the right screen for each kind', () => {
    expect(hrefForLink(null)).toBeNull();
    expect(hrefForLink({ kind: 'order', id: 'o1' })).toEqual({ pathname: '/orders/[id]', params: { id: 'o1' } });
    expect(hrefForLink({ kind: 'conversation', id: 'c1' })).toEqual({ pathname: '/chat/[id]', params: { id: 'c1' } });
    expect(hrefForLink({ kind: 'quotes', id: 'l1' })).toEqual({ pathname: '/listing-quotes/[id]', params: { id: 'l1' } });
    expect(hrefForLink({ kind: 'wallet' })).toBe('/wallet');
  });
});

describe('reviews helpers', () => {
  it('builds the public work-record link and star text', () => {
    expect(workRecordUrl('u1', 'https://api.example.com/api/v1/')).toBe('https://api.example.com/api/v1/work-record/u1');
    expect(starText(4)).toBe('★★★★☆');
  });
});
