/**
 * Standard loading / error / empty states, so every screen handles them the same way
 * (NFR-06, roadmap T9.1). Error messages are human-readable, never raw codes.
 */
import { ActivityIndicator, View } from 'react-native';
import { describeError } from '@/lib/api/api-error';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';
import { Button } from './button';
import { Icon, type IconName } from './icon';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}
    >
      <ActivityIndicator color={colors.primary} />
      <AppText color="textMuted">{label}</AppText>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
      <AppText color="danger" align="center" accessibilityLiveRegion="polite">
        {describeError(error)}
      </AppText>
      {onRetry ? <Button label="Try again" variant="secondary" fullWidth={false} onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
  icon?: IconName;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
      {icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.pill,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xs,
          }}
        >
          <Icon name={icon} size={30} color="primary" />
        </View>
      ) : null}
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText color="textMuted" align="center">
          {message}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}
