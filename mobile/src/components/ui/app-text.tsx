/**
 * Text with the app's typography. Respects the phone's font-size setting (NFR-07):
 * font scaling is on, capped at 2× so layouts don't break.
 */
import { Text, type TextProps } from 'react-native';
import type { ColorName, TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorName;
  align?: 'left' | 'center' | 'right';
}

export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  const { colors, typography } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={2}
      accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : undefined}
      style={[typography[variant], { color: colors[color], textAlign: align }, style]}
      {...rest}
    />
  );
}
