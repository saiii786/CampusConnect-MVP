/**
 * Orders (FR-409): "I'm buying" (my orders) and "I'm selling" (my jobs), active or all.
 */
import { formatPaise } from '@cc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { AppText, Avatar, Chip, EmptyState, ErrorState, LoadingState, PageFooter, Screen, Segmented } from '@/components/ui';
import { useOrders } from '@/lib/orders/orders-api';
import { isActiveStatus, ORDER_STATUS_LABEL } from '@/lib/orders/format';
import { useTheme } from '@/theme/use-theme';

export default function OrdersScreen() {
  const { colors, radius, spacing } = useTheme();
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const query = useOrders(role, scope);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            <Segmented
              options={[
                { value: 'buyer', label: "I'm buying" },
                { value: 'seller', label: "I'm selling" },
              ]}
              value={role}
              onChange={setRole}
            />
            <Segmented
              options={[
                { value: 'active', label: 'Active' },
                { value: 'all', label: 'All' },
              ]}
              value={scope}
              onChange={setScope}
            />
          </View>
        }
        renderItem={({ item: o }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${o.title}, ${ORDER_STATUS_LABEL[o.status]}, ${formatPaise(o.amountPaise)}`}
            onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.id } })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: pressed ? colors.primarySoft : colors.surface,
            })}
          >
            <Avatar name={o.other.displayName} url={o.other.avatarUrl} size={44} />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <AppText variant="label" numberOfLines={2}>
                {o.title}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {o.role === 'BUYER' ? 'Seller' : 'Buyer'}: {o.other.displayName}
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <AppText color="primary">{formatPaise(o.amountPaise)}</AppText>
                <Chip label={ORDER_STATUS_LABEL[o.status]} tone={isActiveStatus(o.status) ? 'primary' : 'neutral'} />
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
            <EmptyState
              title={
                scope === 'active'
                  ? role === 'buyer' ? 'No active orders' : 'No active jobs'
                  : role === 'buyer' ? 'No orders yet' : 'No jobs yet'
              }
              message={
                scope === 'active'
                  ? 'Finished and cancelled ones are under "All".'
                  : role === 'buyer' ? 'Book a service or accept a quote on your job request.' : 'Send quotes on job requests, or post a service.'
              }
            />
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
