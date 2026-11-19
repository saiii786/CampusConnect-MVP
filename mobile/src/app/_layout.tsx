/**
 * Root layout: app-wide providers + auth-based routing (T1.7).
 *
 * Routing by session status (Expo Router protected routes, SDK 58):
 *   restoring      → native splash screen stays visible (no flash of the wrong screen)
 *   signedOut      → (auth) group: welcome, sign in, sign up, forgot/reset password
 *   signedIn       → (app) group: home, verify email, … (later phases add tabs here)
 *   restoreFailed  → "can't reach the server" screen with Try again (offline at start-up)
 * When the status changes the router moves to the right group automatically, and the
 * server-data cache is cleared on sign-out so the next user never sees the previous user's data.
 */
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { session, useSession } from '@/lib/auth/session';
import { OfflineBanner } from '@/components/ui';
import { connectQueryToDevice, createQueryClient } from '@/lib/query-client';
import { fonts, palette } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Headers and screen backgrounds in the brand colours and font (ADR-030). */
function navigationTheme(mode: 'light' | 'dark'): Theme {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const c = palette[mode];
  const font = (fontFamily: string) => ({ fontFamily, fontWeight: 'normal' as const });
  return {
    ...base,
    colors: { ...base.colors, primary: c.primary, background: c.background, card: c.background, text: c.text, border: c.border, notification: c.accent },
    fonts: { regular: font(fonts.regular), medium: font(fonts.medium), bold: font(fonts.semibold), heavy: font(fonts.bold) },
  };
}
connectQueryToDevice();

export default function RootLayout() {
  const scheme = useColorScheme();
  const [queryClient] = useState(createQueryClient);
  const status = useSession((s) => s.status);
  // Brand font (ADR-030). If loading fails the app still opens with the system font.
  const [fontsLoaded, fontError] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    void session.restore();
  }, []);

  useEffect(() => {
    if (status !== 'restoring' && fontsReady) SplashScreen.hide();
  }, [status, fontsReady]);

  useEffect(
    () =>
      useSession.subscribe((next, prev) => {
        if (next.status === 'signedOut' && prev.status !== 'signedOut') queryClient.clear();
      }),
    [queryClient],
  );

  if (!fontsReady) return null; // splash screen is still showing

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navigationTheme(scheme === 'dark' ? 'dark' : 'light')}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={status === 'signedIn'} redirectTo="/welcome">
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'signedOut'}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'restoreFailed'}>
            <Stack.Screen name="reconnect" />
          </Stack.Protected>
          {/* Terms / privacy / guidelines: always reachable (FR-604). */}
          <Stack.Screen name="legal/[doc]" options={{ headerShown: true, title: '' }} />
        </Stack>
        <OfflineBanner />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
