/**
 * Notifications (FR-550): newest first, unread in bold; tapping opens the related screen and
 * marks it read; "Mark all as read". Updates live through the socket.
 */
import type { NotificationDto } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { AppText, Button, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { formatShortTime } from '@/lib/chat/format';
import { hrefForLink, notificationKeys, notificationsApi, useNotifications } from '@/lib/notifications/notifications-api';
import { useTheme } from '@/theme/use-theme';

export default function NotificationsScreen() {
  const { colors, radius, spacing } = useTheme();
  const client = useQueryClient();
  const query = useNotifications();
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = query.data?.pages[0]?.unreadCount ?? 0;

  const refresh = () => void client.invalidateQueries({ queryKey: notificationKeys.all });

  const open = (n: NotificationDto) => {
    if (!n.read) void notificationsApi.markRead([n.id]).then(refresh);
    const href = hrefForLink(n.link);
    if (href) router.push(href);
  };

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
        ListHeaderComponent={
          unread ? <Button label={`Mark all as read (${unread})`} variant="ghost" fullWidth={false} onPress={() => void notificationsApi.markRead().then(refresh)} /> : undefined
        }
        renderItem={({ item: n }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}`}
            onPress={() => open(n)}
            style={({ pressed }) => ({
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: pressed ? colors.primarySoft : n.read ? colors.surface : colors.primarySoft,
              gap: 2,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <AppText variant="label" style={{ flex: 1, fontWeight: n.read ? '500' : '700' }}>
                {n.title}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {formatShortTime(n.createdAt)}
              </AppText>
            </View>
            {n.body ? <AppText color="textMuted" numberOfLines={2}>{n.body}</AppText> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          query.isPending ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : (
            <EmptyState title="No notifications yet" message="Quotes, bookings, order updates and messages show up here." />
          )
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      />
    </Screen>
  );
}
