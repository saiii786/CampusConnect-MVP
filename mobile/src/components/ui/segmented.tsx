/**
 * Row of mutually exclusive options (e.g. Services | Jobs, Fixed | Hourly | Quote).
 * Announced to screen readers as radio buttons with their selected state; each option ≥ 48 px tall.
 */
import { Pressable, View } from 'react-native';
import { MIN_TOUCH_SIZE } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
  error?: string;
}

export function Segmented<T extends string>({ options, value, onChange, label, error }: SegmentedProps<T>) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.xs, gap: spacing.xs }}
      >
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={{
                flex: 1,
                minHeight: MIN_TOUCH_SIZE,
                paddingVertical: spacing.xs,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: spacing.sm,
                backgroundColor: selected ? colors.surfaceRaised : 'transparent',
                borderWidth: selected ? 1 : 0,
                borderColor: colors.border,
              }}
            >
              {/* No numberOfLines: with large system fonts the label wraps instead of being cut off (NFR-07). */}
              <AppText variant="label" color={selected ? 'primary' : 'textMuted'} style={{ textAlign: 'center' }}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
