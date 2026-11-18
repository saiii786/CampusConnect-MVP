/**
 * Root layout: app-wide providers (server-data cache, navigation theme) and the root stack.
 * Routes are files in src/app/ (expo-router). Auth-gated route groups arrive in Phase 1.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createQueryClient } from '@/lib/query-client';

export default function RootLayout() {
  const scheme = useColorScheme();
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
