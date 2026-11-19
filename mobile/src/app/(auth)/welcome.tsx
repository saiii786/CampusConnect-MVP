/**
 * First screen for signed-out users: what the app is, and the way in (sign up / sign in).
 * The server-status card stays during development so testers can see the API is reachable.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { ServerStatusCard } from '@/components/server-status-card';
import { AppText, Button, Screen } from '@/components/ui';
import { BRAND_NAME, BRAND_TAGLINE } from '@/content/brand';
import { useTheme } from '@/theme/use-theme';

export default function WelcomeScreen() {
  const { spacing } = useTheme();
  return (
    <Screen>
      <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
        <AppText variant="title">{BRAND_NAME}</AppText>
        <AppText variant="heading" color="primary">
          {BRAND_TAGLINE}
        </AppText>
        <AppText color="textMuted">
          Earn from your skills. Hire people near you. Build a verified record of real work.
        </AppText>
      </View>
      <View style={{ gap: spacing.md }}>
        <Button label="Create an account" onPress={() => router.push('/sign-up')} />
        <Button label="I already have an account" variant="secondary" onPress={() => router.push('/sign-in')} />
      </View>
      {__DEV__ ? <ServerStatusCard /> : null}
    </Screen>
  );
}
