/**
 * Inline message box for form-level errors, warnings and confirmations
 * (e.g. "Email or password is incorrect", "Verify your email"). Announced by screen readers.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export interface NoticeProps {
  tone?: 'danger' | 'warning' | 'success' | 'info';
  title?: string;
  message: string;
  /** Optional actions (buttons) under the message. */
  children?: ReactNode;
}

export function Notice({ tone = 'info', title, message, children }: NoticeProps) {
  const { colors, radius, spacing } = useTheme();
  const palette = {
    danger: { bg: colors.dangerSoft, fg: 'danger' as const },
    warning: { bg: colors.warningSoft, fg: 'warning' as const },
    success: { bg: colors.successSoft, fg: 'success' as const },
    info: { bg: colors.primarySoft, fg: 'text' as const },
  }[tone];
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={{ backgroundColor: palette.bg, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs }}
    >
      {title ? (
        <AppText variant="label" color={palette.fg}>
          {title}
        </AppText>
      ) : null}
      <AppText color={palette.fg}>{message}</AppText>
      {children}
    </View>
  );
}
