/**
 * First screen for signed-out users (redesigned in Phase 9A): logo, name and tagline, three reasons
 * to join, and the two ways in. In development builds a warning appears only when the API cannot be
 * reached (the full server status is under Profile → Developer).
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText, Button, Icon, type IconName, Notice, Screen } from '@/components/ui';
import { getApiBaseUrl } from '@/config/api-url';
import { BRAND_NAME, BRAND_TAGLINE } from '@/content/brand';
import { useServerHealth } from '@/lib/api/health';
import { useTheme } from '@/theme/use-theme';

const REASONS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'search-outline', title: 'Find help or work', text: 'Tuition, design, repairs, events — near you or online.' },
  { icon: 'shield-checkmark-outline', title: 'Pay safely', text: 'Money is held until you approve the work.' },
  { icon: 'ribbon-outline', title: 'Build your record', text: 'Every finished job adds to a verified work record.' },
];

function DevServerWarning() {
  const health = useServerHealth();
  if (!health.isError) return null;
  return (
    <Notice
      tone="warning"
      title="Development: server not reachable"
      message={`Start the API on your computer (npm run dev:api). Trying ${getApiBaseUrl()}`}
    >
      <Button label="Try again" variant="secondary" fullWidth={false} onPress={() => void health.refetch()} />
    </Notice>
  );
}

export default function WelcomeScreen() {
  const { colors, radius, spacing } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between', gap: spacing.xl, paddingTop: spacing.xl }}>
        <View style={{ gap: spacing.xl }}>
          <View style={{ gap: spacing.md }}>
            <Image
              source={require('../../../assets/images/logo-mark.png')}
              style={{ width: 88, height: 88, borderRadius: 22 }}
              accessibilityLabel={`${BRAND_NAME} logo`}
            />
            <View style={{ gap: spacing.xs }}>
              <AppText variant="title" style={{ fontSize: 36, lineHeight: 44 }}>
                {BRAND_NAME}
              </AppText>
              <AppText variant="heading" color="primary">
                {BRAND_TAGLINE}
              </AppText>
            </View>
          </View>

          <View style={{ gap: spacing.lg }}>
            {REASONS.map((r) => (
              <View key={r.title} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={r.icon} size={22} color="primary" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{r.title}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {r.text}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          {__DEV__ ? <DevServerWarning /> : null}
          <Button label="Create an account" onPress={() => router.push('/sign-up')} />
          <Button label="I already have an account" variant="secondary" onPress={() => router.push('/sign-in')} />
          <AppText variant="caption" color="textMuted" align="center">
            By continuing you agree to our{' '}
            <AppText variant="caption" color="primary" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} accessibilityRole="link">
              Terms
            </AppText>{' '}
            and{' '}
            <AppText variant="caption" color="primary" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} accessibilityRole="link">
              Privacy Policy
            </AppText>
            .
          </AppText>
        </View>
      </View>
    </Screen>
  );
}
