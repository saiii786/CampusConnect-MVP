/**
 * "You're offline" banner (NFR-06, T9.1). Shown app-wide while the phone has no connection; queries
 * pause meanwhile and refresh by themselves when it comes back (see lib/query-client.ts).
 */
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}

export function OfflineBanner() {
  const online = useIsOnline();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.warningSoft,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm + insets.bottom,
        paddingHorizontal: spacing.lg,
      }}
    >
      <AppText variant="label" color="warning" align="center">
        You&apos;re offline — showing saved data. We&apos;ll refresh when you&apos;re back online.
      </AppText>
    </View>
  );
}
