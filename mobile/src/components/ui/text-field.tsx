/**
 * Labelled text input with an error message. The label is always visible (placeholders
 * disappear while typing and are not reliable labels for screen readers).
 */
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { MIN_TOUCH_SIZE } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export interface TextFieldProps extends Omit<TextInputProps, 'ref'> {
  label: string;
  error?: string;
  hint?: string;
  /** React 19: `ref` is a normal prop (no forwardRef needed). */
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({ label, error, hint, style, ref, ...rest }: TextFieldProps) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={2}
        style={[
          styles.input,
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surfaceRaised,
            borderColor: error ? colors.danger : colors.borderStrong,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: MIN_TOUCH_SIZE, borderWidth: 1 },
});
