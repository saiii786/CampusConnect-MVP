/**
 * Browse/search filters, kept in a small store so the filters screen and the browse screen share
 * them (and they survive navigating to a listing and back). Not persisted across app restarts.
 */
import type { ListingSort, SearchListingsInput, WorkMode } from '@cc/shared';
import { create } from 'zustand';

/** The two listing types searchable in the MVP (instant-mode types are v1.1). */
type SearchableType = 'SERVICE_OFFER' | 'JOB_REQUEST';

export interface SearchFilters {
  q: string;
  type: SearchableType | null;
  categoryId: string | null;
  categoryName: string | null;
  workMode: WorkMode | null;
  minPricePaise: number | null;
  maxPricePaise: number | null;
  sort: ListingSort;
  /** "Near me": requires `location`. */
  nearMe: boolean;
  radiusKm: number;
  location: { lat: number; lng: number } | null;
}

export const DEFAULT_FILTERS: SearchFilters = {
  q: '',
  type: 'SERVICE_OFFER',
  categoryId: null,
  categoryName: null,
  workMode: null,
  minPricePaise: null,
  maxPricePaise: null,
  sort: 'newest',
  nearMe: false,
  radiusKm: 10,
  location: null,
};

interface FiltersState extends SearchFilters {
  set: (patch: Partial<SearchFilters>) => void;
  reset: () => void;
}

export const useSearchFilters = create<FiltersState>((set) => ({
  ...DEFAULT_FILTERS,
  set: (patch) => set(patch),
  reset: () => set((s) => ({ ...DEFAULT_FILTERS, type: s.type, location: s.location })),
}));

/** Turn the filter state into the API query (only the parameters that are set). */
export function toSearchQuery(f: SearchFilters): Partial<SearchListingsInput> {
  const query: Partial<SearchListingsInput> = { sort: f.sort };
  if (f.q.trim()) query.q = f.q.trim();
  if (f.type) query.type = f.type;
  if (f.categoryId) query.categoryId = f.categoryId;
  if (f.workMode) query.workMode = f.workMode;
  if (f.minPricePaise !== null) query.minPricePaise = f.minPricePaise;
  if (f.maxPricePaise !== null) query.maxPricePaise = f.maxPricePaise;
  if (f.location) {
    query.lat = f.location.lat;
    query.lng = f.location.lng;
    if (f.nearMe) query.radiusKm = f.radiusKm;
  }
  // Distance sort without a location is not possible.
  if (query.sort === 'distance' && !f.location) query.sort = 'newest';
  return query;
}

/** Number of active filters (shown on the Filters button). Type and sort are not counted. */
export function activeFilterCount(f: SearchFilters): number {
  return [f.categoryId !== null, f.workMode !== null, f.minPricePaise !== null, f.maxPricePaise !== null, f.nearMe].filter(Boolean)
    .length;
}
