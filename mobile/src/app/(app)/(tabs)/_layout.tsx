/**
 * Bottom tabs (Phase 9A, T9A.3): Home · Messages · Post · Orders · Profile.
 * "Post" is not a screen of its own: tapping it opens the posting form on top of the current tab.
 * Messages shows the unread count; everything else (wallet, my listings, notifications…) is reached
 * from Home or Profile and opens as a normal stack screen above the tabs.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useUnread } from '@/lib/chat/chat-api';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icon = (outline: IconName, filled: IconName) =>
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    // The tab bar passes our theme's hex strings; Ionicons' prop type is narrower than ColorValue.
    return <Ionicons name={focused ? filled : outline} size={size} color={color as string} />;
  };

export default function TabsLayout() {
  const { colors } = useTheme();
  const unread = useUnread().data?.unreadMessages ?? 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.onAccent, fontFamily: fonts.semibold },
      }}
    >
      {/* Home and Profile draw their own header (greeting / profile card), like most apps. */}
      <Tabs.Screen name="index" options={{ title: 'Connect', headerShown: false, tabBarLabel: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Messages',
          tabBarIcon: icon('chatbubbles-outline', 'chatbubbles'),
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarAccessibilityLabel: unread > 0 ? `Messages, ${unread} unread` : 'Messages',
        }}
      />
      <Tabs.Screen
        name="post"
        options={{ title: 'Post', tabBarIcon: icon('add-circle-outline', 'add-circle'), tabBarAccessibilityLabel: 'Post a service or job' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/listings/new');
          },
        }}
      />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: icon('receipt-outline', 'receipt') }} />
      <Tabs.Screen name="profile" options={{ title: 'My profile', headerShown: false, tabBarLabel: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}
