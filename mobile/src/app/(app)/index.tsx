/**
 * Home for signed-in users (Phase 1 placeholder). Greets the user, prompts for email
 * verification (FR-003) and offers sign-out. Listings, search, etc. arrive in later phases.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { ServerStatusCard } from '@/components/server-status-card';
import { AppText, Button, Notice, Screen } from '@/components/ui';
import { session, useSession } from '@/lib/auth/session';
import { useTheme } from '@/theme/use-theme';

export default function HomeScreen() {
  const { spacing } = useTheme();
  const user = useSession((s) => s.user);

  return (
    <Screen>
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <AppText variant="title">Hi, {user?.displayName || 'there'} 👋</AppText>
        <AppText color="textMuted">{user?.email}</AppText>
      </View>

      {user && !user.emailVerified ? (
        <Notice
          tone="warning"
          title="Verify your email"
          message="We sent a 6-digit code to your email. You need to verify before you can post or order."
        >
          <Button label="Enter code" fullWidth={false} onPress={() => router.push('/verify-email')} />
        </Notice>
      ) : null}

      <AppText color="textMuted">
        Posting jobs, offering services and finding work arrive in the next updates.
      </AppText>

      {__DEV__ ? <ServerStatusCard /> : null}

      <Button label="Sign out" variant="ghost" onPress={() => session.signOut()} />
    </Screen>
  );
}
