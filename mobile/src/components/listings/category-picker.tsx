/**
 * Pick one category from the grouped tree (GET /categories). Gated categories never appear
 * (the API does not return them). Tapping the selected one again clears it when `allowClear`.
 */
import { Pressable, View } from 'react-native';
import { AppText, ErrorState, LoadingState } from '@/components/ui';
import { useCategories } from '@/lib/users/users-api';
import { MIN_TOUCH_SIZE } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export interface CategoryPickerProps {
  value: string | null;
  onChange: (category: { id: string; name: string } | null) => void;
  allowClear?: boolean;
  error?: string;
}

export function CategoryPicker({ value, onChange, allowClear, error }: CategoryPickerProps) {
  const { colors, radius, spacing } = useTheme();
  const categories = useCategories();

  if (categories.isPending) return <LoadingState label="Loading categories…" />;
  if (categories.isError) return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />;

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="label">Category</AppText>
      {categories.data.groups.map((group) => (
        <View key={group.name} style={{ gap: spacing.xs }}>
          <AppText variant="caption" color="textMuted">
            {group.name}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {group.categories.map((c) => {
              const selected = c.id === value;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={c.name}
                  onPress={() => onChange(selected && allowClear ? null : { id: c.id, name: c.name })}
                  style={{
                    minHeight: MIN_TOUCH_SIZE,
                    justifyContent: 'center',
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.borderStrong,
                    backgroundColor: selected ? colors.primarySoft : 'transparent',
                  }}
                >
                  <AppText variant="caption" color={selected ? 'primary' : 'text'}>
                    {c.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
