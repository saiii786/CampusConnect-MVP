/**
 * Signed-in area. Only reachable while signed in (guarded in the root layout).
 * Phase 9A turns this into bottom tabs (Home, Search, Post, Messages, Profile).
 */
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ title: 'CampusConnect' }} />
      <Stack.Screen name="search-filters" options={{ title: 'Filters', presentation: 'modal' }} />
      <Stack.Screen name="listings/new" options={{ title: 'Post' }} />
      <Stack.Screen name="listings/[id]" options={{ title: 'Listing' }} />
      <Stack.Screen name="listings/edit/[id]" options={{ title: 'Edit listing' }} />
      <Stack.Screen name="my-listings" options={{ title: 'My listings' }} />
      <Stack.Screen name="verify-email" options={{ title: 'Verify your email' }} />
      <Stack.Screen name="profile" options={{ title: 'My profile' }} />
      <Stack.Screen name="profile/edit" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="profile/student" options={{ title: 'Student badge' }} />
      <Stack.Screen name="profile/add-work" options={{ title: 'Add work to portfolio' }} />
      <Stack.Screen name="profile/delete-account" options={{ title: 'Delete account' }} />
      <Stack.Screen name="users/[id]" options={{ title: 'Profile' }} />
    </Stack>
  );
}
