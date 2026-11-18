/**
 * Orders (FR-409): "I'm buying" (my orders) and "I'm selling" (my jobs), active or all.
 */
import { formatPaise } from '@cc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { AppText, Avatar, Chip, EmptyState, ErrorState, LoadingState, Screen, Segmented } from '@/components/ui';
import { useOrders } from '@/lib/orders/orders-api';
import { isActiveStatus, ORDER_STATUS_LABEL } from '@/lib/orders/format';
import { useTheme } from '@/theme/use-theme';

export default function OrdersScreen() {
  const { colors, radius, spacing } = useTheme();
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const query = useOrders(role, null);
  const all = query.data?.pages.flatMap((p) => p.items) ?? [];
  const items = scope === 'active' ? all.filter((o) => isActiveStatus(o.status)) : all;

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
            <View style={{ flex: 1, gap: 2 }}>
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
              title={role === 'buyer' ? 'No orders yet' : 'No jobs yet'}
              message={role === 'buyer' ? 'Book a service or accept a quote on your job request.' : 'Send quotes on job requests, or post a service.'}
            />
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
