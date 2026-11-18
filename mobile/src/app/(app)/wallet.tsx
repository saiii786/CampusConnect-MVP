/**
 * Wallet (FR-450, FR-453, FR-455): balance, money held in escrow, Add money, Withdraw, and the
 * full history of wallet movements. TEST MODE badge always visible.
 */
import { formatPaise } from '@cc/shared';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { AppText, Button, EmptyState, ErrorState, LoadingState, PageFooter, Screen, TestModeBadge } from '@/components/ui';
import { TRANSACTION_LABEL, useWallet, useWalletTransactions } from '@/lib/wallet/wallet-api';
import { useTheme } from '@/theme/use-theme';

export default function WalletScreen() {
  const { colors, radius, spacing } = useTheme();
  const wallet = useWallet();
  const history = useWalletTransactions();
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <TestModeBadge />
      <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs }}>
        <AppText variant="label" color="primary">
          Balance
        </AppText>
        {wallet.isPending ? (
          <LoadingState />
        ) : wallet.isError ? (
          <ErrorState error={wallet.error} onRetry={() => wallet.refetch()} />
        ) : (
          <>
            <AppText variant="title">{formatPaise(wallet.data.balancePaise)}</AppText>
            {wallet.data.inEscrowPaise ? (
              <AppText color="textMuted">{formatPaise(wallet.data.inEscrowPaise)} held safely in escrow for your orders</AppText>
            ) : null}
          </>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Add money" onPress={() => router.push('/add-money')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Withdraw" variant="secondary" onPress={() => router.push('/withdraw')} />
        </View>
      </View>
      <AppText variant="heading">History</AppText>
    </View>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
        renderItem={({ item: t }) => (
          <Pressable
            disabled={!t.orderId}
            accessibilityRole={t.orderId ? 'button' : undefined}
            onPress={() => t.orderId && router.push({ pathname: '/orders/[id]', params: { id: t.orderId } })}
            style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface }}
          >
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <AppText variant="label">{TRANSACTION_LABEL[t.kind]}</AppText>
              <AppText variant="caption" color="textMuted">
                {new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {t.orderId ? ' · view order' : ''}
              </AppText>
            </View>
            <AppText variant="label" color={t.amountPaise > 0 ? 'success' : 'text'}>
              {t.amountPaise > 0 ? '+' : '−'}
              {formatPaise(Math.abs(t.amountPaise))}
            </AppText>
          </Pressable>
        )}
        ListEmptyComponent={
          history.isPending ? (
            <LoadingState />
          ) : history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : (
            <EmptyState title="No money movements yet" message="Add test money to pay for orders safely." />
          )
        }
        ListFooterComponent={<PageFooter query={history} />}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={wallet.isRefetching || history.isRefetching}
            onRefresh={() => {
              void wallet.refetch();
              void history.refetch();
            }}
          />
        }
      />
    </Screen>
  );
}
