/**
 * Signed-in area. Only reachable while signed in (guarded in the root layout).
 * Opens the realtime connection for as long as the user is signed in.
 * Phase 9A turns this into bottom tabs (Home, Search, Post, Messages, Profile).
 */
import { Stack } from 'expo-router';
import { useRealtime } from '@/lib/realtime/realtime';

export default function AppLayout() {
  useRealtime();
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ title: 'CampusConnect' }} />
      <Stack.Screen name="search-filters" options={{ title: 'Filters', presentation: 'modal' }} />
      <Stack.Screen name="listings/new" options={{ title: 'Post' }} />
      <Stack.Screen name="listings/[id]" options={{ title: 'Listing' }} />
      <Stack.Screen name="listings/edit/[id]" options={{ title: 'Edit listing' }} />
      <Stack.Screen name="listing-quotes/[id]" options={{ title: 'Quotes received' }} />
      <Stack.Screen name="quote-form" options={{ title: 'Your quote' }} />
      <Stack.Screen name="my-quotes" options={{ title: 'My quotes' }} />
      <Stack.Screen name="my-listings" options={{ title: 'My listings' }} />
      <Stack.Screen name="book" options={{ title: 'Book' }} />
      <Stack.Screen name="accept-quote" options={{ title: 'Accept quote' }} />
      <Stack.Screen name="orders" options={{ title: 'Orders' }} />
      <Stack.Screen name="orders/[id]" options={{ title: 'Order' }} />
      <Stack.Screen name="inbox" options={{ title: 'Messages' }} />
      <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
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
