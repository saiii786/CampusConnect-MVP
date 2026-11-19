/**
 * Compact toggle pill for filters and categories ("Near me", "Filters · 2", "Tuition").
 * 38 px tall, 48 px touch area via hitSlop. Announced as a toggle with its selected state.
 */
import { ActivityIndicator, Pressable } from 'react-native';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  icon?: IconName;
  loading?: boolean;
  onPress: () => void;
}

export function FilterChip({ label, selected = false, icon, loading, onPress }: FilterChipProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: selected, busy: !!loading }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={5}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minHeight: 38,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : pressed ? colors.primarySoft : colors.surface,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={selected ? colors.onPrimary : colors.primary} />
      ) : icon ? (
        <Icon name={icon} size={16} color={selected ? 'onPrimary' : 'text'} />
      ) : null}
      <AppText variant="label" color={selected ? 'onPrimary' : 'text'} numberOfLines={1} maxFontSizeMultiplier={1.5}>
        {label}
      </AppText>
    </Pressable>
  );
}
