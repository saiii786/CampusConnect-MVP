/**
 * Messages inbox (FR-250, FR-251): my conversations, most recent first, with unread counts.
 * Updates live (socket) and on pull-to-refresh.
 */
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { AppText, Avatar, Chip, EmptyState, ErrorState, LoadingState, PageFooter, Screen } from '@/components/ui';
import { useSession } from '@/lib/auth/session';
import { useConversations } from '@/lib/chat/chat-api';
import { formatShortTime } from '@/lib/chat/format';
import { useTheme } from '@/theme/use-theme';

export default function InboxScreen() {
  const { colors, radius, spacing } = useTheme();
  const me = useSession((s) => s.user?.id);
  const query = useConversations();
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
        renderItem={({ item: c }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${c.other.displayName} about ${c.listing.title}${c.unreadCount ? `, ${c.unreadCount} unread` : ''}`}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: pressed ? colors.primarySoft : colors.surface,
            })}
          >
            <Avatar name={c.other.displayName} url={c.other.avatarUrl} size={48} />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <AppText variant="label" numberOfLines={1} style={{ flex: 1 }}>
                  {c.other.displayName}
                </AppText>
                {c.lastMessage ? (
                  <AppText variant="caption" color="textMuted">
                    {formatShortTime(c.lastMessage.createdAt)}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {c.listing.title}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <AppText numberOfLines={1} style={{ flex: 1, fontWeight: c.unreadCount ? '700' : '400' }}>
                  {c.lastMessage ? `${c.lastMessage.senderId === me ? 'You: ' : ''}${c.lastMessage.body}` : 'No messages yet'}
                </AppText>
                {c.unreadCount ? <Chip label={String(c.unreadCount)} tone="primary" /> : null}
                {c.blocked ? <Chip label="Blocked" /> : null}
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          query.isPending ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : (
            <EmptyState title="No messages yet" message="Open a listing and tap Message, or send a quote on a job." />
          )
        }
        ListFooterComponent={<PageFooter query={query} />}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      />
    </Screen>
  );
}
