/**
 * Live "server status" card (GET /health). Proves the phone can reach the API; shown on the
 * welcome screen and the home screen during development and testing.
 */
import { View } from 'react-native';
import { AppText, Button, ErrorState, LoadingState } from '@/components/ui';
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

export function ServerStatusCard() {
  const { colors, radius, spacing } = useTheme();
  const health = useServerHealth();

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
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
