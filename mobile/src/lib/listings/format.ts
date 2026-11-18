/**
 * Human-readable labels for listings (prices, budgets, distance, type, work mode).
 */
import { formatPaise, type ListingSummaryDto } from '@cc/shared';

type PriceFields = Pick<ListingSummaryDto, 'type' | 'pricingType' | 'pricePaise' | 'budgetMinPaise' | 'budgetMaxPaise'>;

export function formatListingPrice(l: PriceFields): string {
  if (l.type === 'SERVICE_OFFER') {
    if (l.pricingType === 'QUOTE' || l.pricePaise === null) return 'Ask for a quote';
    return l.pricingType === 'HOURLY' ? `${formatPaise(l.pricePaise)}/hr` : formatPaise(l.pricePaise);
  }
  const { budgetMinPaise: min, budgetMaxPaise: max } = l;
  if (min !== null && max !== null) return min === max ? `Budget ${formatPaise(min)}` : `Budget ${formatPaise(min)}–${formatPaise(max)}`;
  if (max !== null) return `Budget up to ${formatPaise(max)}`;
  if (min !== null) return `Budget from ${formatPaise(min)}`;
  return 'Open budget';
}

export function formatDistance(km: number | null): string | null {
  if (km === null) return null;
  return km < 1 ? `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m away` : `${km.toFixed(1)} km away`;
}

export const LISTING_TYPE_LABEL = { SERVICE_OFFER: 'Service', JOB_REQUEST: 'Job request' } as const;
export const WORK_MODE_LABEL = { REMOTE: 'Remote', ONSITE: 'On-site' } as const;

/** "₹1,500" text field value (rupees) from paise, for editing. */
export function paiseToRupeesText(paise: number | null | undefined): string {
  if (paise == null) return '';
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}
