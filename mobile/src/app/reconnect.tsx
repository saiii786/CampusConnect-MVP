/**
 * Shown when the app had a saved session but could not reach the server at start-up
 * (offline, or the free-tier server is waking up). The saved session is kept.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Screen } from '@/components/ui';
import { session } from '@/lib/auth/session';
import { useTheme } from '@/theme/use-theme';

export default function ReconnectScreen() {
  const { spacing } = useTheme();
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    try {
      await session.restore();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <AppText variant="title">Can&apos;t reach CampusConnect</AppText>
        <AppText color="textMuted">
          Check your internet connection. If the server was asleep it can take up to a minute to wake up.
        </AppText>
        <Button label="Try again" loading={busy} onPress={retry} />
        <Button label="Sign out" variant="ghost" onPress={() => session.signOut()} />
      </View>
    </Screen>
  );
}
