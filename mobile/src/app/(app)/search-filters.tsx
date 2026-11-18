/**
 * Search filters (FR-101, FR-102): category, remote/on-site, price range, sort and near-me distance.
 * Edits the shared filter store; Browse refreshes automatically.
 */
import { rupeesToPaise, SERVICE_RADIUS_MAX_KM } from '@cc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CategoryPicker } from '@/components/listings/category-picker';
import { AppText, Button, Screen, Segmented, TextField } from '@/components/ui';
import { paiseToRupeesText } from '@/lib/listings/format';
import { useSearchFilters } from '@/lib/listings/search-filters';
import { useTheme } from '@/theme/use-theme';

const RADII = [2, 5, 10, 25, 50] as const;

export default function SearchFiltersScreen() {
  const { spacing } = useTheme();
  const f = useSearchFilters();
  const [minText, setMinText] = useState(paiseToRupeesText(f.minPricePaise));
  const [maxText, setMaxText] = useState(paiseToRupeesText(f.maxPricePaise));
  const [priceError, setPriceError] = useState<string | null>(null);

  const apply = () => {
    const min = minText.trim() ? rupeesToPaise(minText) : null;
    const max = maxText.trim() ? rupeesToPaise(maxText) : null;
    if ((minText.trim() && min === null) || (maxText.trim() && max === null)) {
      setPriceError('Enter amounts in rupees, e.g. 500');
      return;
    }
    if (min !== null && max !== null && min > max) {
      setPriceError('Maximum must be at least the minimum');
      return;
    }
    f.set({ minPricePaise: min, maxPricePaise: max });
    router.back();
  };

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        <CategoryPicker
          value={f.categoryId}
          allowClear
          onChange={(c) => f.set({ categoryId: c?.id ?? null, categoryName: c?.name ?? null })}
        />
        <Segmented
          label="Where"
          options={[
            { value: 'ANY', label: 'Any' },
            { value: 'ONSITE', label: 'On-site' },
            { value: 'REMOTE', label: 'Remote' },
          ]}
          value={f.workMode ?? 'ANY'}
          onChange={(m) => f.set({ workMode: m === 'ANY' ? null : m })}
        />
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField label="Min price (₹)" value={minText} onChangeText={setMinText} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Max price (₹)" value={maxText} onChangeText={setMaxText} keyboardType="decimal-pad" />
            </View>
          </View>
          {priceError ? (
            <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
              {priceError}
            </AppText>
          ) : null}
        </View>
        <Segmented
          label="Sort by"
          options={[
            { value: 'newest', label: 'Newest' },
            ...(f.location ? [{ value: 'distance' as const, label: 'Nearest' }] : []),
            { value: 'price_asc', label: 'Price ↑' },
            { value: 'price_desc', label: 'Price ↓' },
          ]}
          value={f.sort}
          onChange={(sort) => f.set({ sort })}
        />
        {f.nearMe ? (
          <Segmented
            label={`Distance (up to ${SERVICE_RADIUS_MAX_KM} km)`}
            options={RADII.map((r) => ({ value: String(r), label: `${r} km` }))}
            value={String(f.radiusKm)}
            onChange={(r) => f.set({ radiusKm: Number(r) })}
          />
        ) : (
          <AppText variant="caption" color="textMuted">
            Turn on &quot;Near me&quot; on the browse screen to filter by distance.
          </AppText>
        )}
        <Button label="Show results" onPress={apply} />
        <Button
          label="Clear filters"
          variant="ghost"
          onPress={() => {
            f.reset();
            setMinText('');
            setMaxText('');
            setPriceError(null);
          }}
        />
      </View>
    </Screen>
  );
}
