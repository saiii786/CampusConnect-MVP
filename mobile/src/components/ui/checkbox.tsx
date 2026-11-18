/**
 * Accessible checkbox with a label (whole row is the touch target, ≥ 48 px).
 * Announced as a checkbox with its checked state; shows an error message underneath.
 */
import { Pressable, View } from 'react-native';
import { MIN_TOUCH_SIZE } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  error?: string;
}

export function Checkbox({ checked, onChange, label, error }: CheckboxProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        accessibilityHint={error}
        onPress={() => onChange(!checked)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH_SIZE }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.sm,
            borderWidth: 2,
            borderColor: error ? colors.danger : checked ? colors.primary : colors.border,
            backgroundColor: checked ? colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <AppText style={{ color: colors.onPrimary, fontWeight: '700' }}>✓</AppText> : null}
        </View>
        <AppText style={{ flex: 1 }}>{label}</AppText>
      </Pressable>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
