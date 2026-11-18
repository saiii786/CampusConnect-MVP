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
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { session, useSession } from '@/lib/auth/session';
import { createQueryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const scheme = useColorScheme();
  const [queryClient] = useState(createQueryClient);
  const status = useSession((s) => s.status);

  useEffect(() => {
    void session.restore();
  }, []);

  useEffect(() => {
    if (status !== 'restoring') SplashScreen.hide();
  }, [status]);

  useEffect(
    () =>
      useSession.subscribe((next, prev) => {
        if (next.status === 'signedOut' && prev.status !== 'signedOut') queryClient.clear();
      }),
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
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
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
