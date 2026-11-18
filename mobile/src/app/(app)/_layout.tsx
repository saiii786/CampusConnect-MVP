/**
 * Signed-in area. Only reachable while signed in (guarded in the root layout).
 * Phase 2+ turns this into tabs (Home, Search, Messages, Orders, Profile).
 */
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ title: 'CampusConnect' }} />
      <Stack.Screen name="verify-email" options={{ title: 'Verify your email' }} />
    </Stack>
  );
}
