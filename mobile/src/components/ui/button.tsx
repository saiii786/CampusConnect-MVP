/**
 * Button with variants, loading and disabled states. Always ≥ 48 px tall and announced to
 * screen readers as a button with its busy/disabled state (NFR-07).
 */
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { MIN_TOUCH_SIZE } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  fullWidth = true,
  ...rest
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;

  const background = {
    primary: colors.primary,
    secondary: colors.primarySoft,
    danger: colors.danger,
    ghost: 'transparent',
  }[variant];
  const foreground = {
    primary: colors.onPrimary,
    secondary: colors.primary,
    danger: colors.onDanger,
    ghost: colors.primary,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <AppText variant="label" style={{ color: foreground }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
});
