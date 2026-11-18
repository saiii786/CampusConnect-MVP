/**
 * Welcome screen (Phase 0). Shows what the app is and a live "server status" card that
 * calls GET /health — proves the phone can reach the API (Phase 0 exit criterion).
 * Sign-up / sign-in buttons are added here in Phase 1 (T1.7).
 */
import { View } from 'react-native';
import { AppText, Button, ErrorState, LoadingState, Screen } from '@/components/ui';
import { getApiBaseUrl } from '@/config/api-url';
import { useServerHealth } from '@/lib/api/health';
import { useTheme } from '@/theme/use-theme';

function safeApiUrl(): string {
  try {
    return getApiBaseUrl();
  } catch {
    return 'not configured';
  }
}

function ServerStatusCard() {
  const { colors, radius, spacing } = useTheme();
  const health = useServerHealth();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <AppText variant="label">Server status</AppText>
      {health.isPending ? (
        <LoadingState label="Connecting to the server (can take up to a minute if it was asleep)…" />
      ) : health.isError ? (
        <ErrorState error={health.error} onRetry={() => health.refetch()} />
      ) : (
        <>
          <AppText color={health.data.status === 'ok' ? 'success' : 'warning'} accessibilityLiveRegion="polite">
            {health.data.status === 'ok' ? '● Connected' : '● Server is up, database unavailable'}
          </AppText>
          <Button
            label="Check again"
            variant="ghost"
            fullWidth={false}
            loading={health.isFetching}
            onPress={() => health.refetch()}
          />
        </>
      )}
      <AppText variant="caption" color="textMuted" selectable>
        API: {safeApiUrl()}
      </AppText>
    </View>
  );
}

export default function WelcomeScreen() {
  const { spacing } = useTheme();
  return (
    <Screen>
      <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
        <AppText variant="title">CampusConnect</AppText>
        <AppText color="textMuted">
          Earn from your skills. Hire people near you. Build a verified record of real work.
        </AppText>
      </View>
      <ServerStatusCard />
    </Screen>
  );
}
