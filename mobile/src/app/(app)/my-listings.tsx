/**
 * My listings (T3.4): everything I posted, filterable by status, newest first.
 */
import type { ListingStatus } from '@cc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { ListingCard } from '@/components/listings/listing-card';
import { Button, EmptyState, ErrorState, LoadingState, PageFooter, Screen, Segmented } from '@/components/ui';
import { useMyListings } from '@/lib/listings/listings-api';
import { useTheme } from '@/theme/use-theme';

type Filter = 'ALL' | ListingStatus;

export default function MyListingsScreen() {
  const { spacing } = useTheme();
  const [filter, setFilter] = useState<Filter>('ALL');
  const results = useMyListings(filter === 'ALL' ? null : filter);
  const items = results.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
            <Button label="+ Post something new" onPress={() => router.push('/listings/new')} />
            <Segmented
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'PAUSED', label: 'Paused' },
                { value: 'CLOSED', label: 'Closed' },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.sm }}>
            <ListingCard listing={item} onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.id } })} />
          </View>
        )}
        ListEmptyComponent={
          results.isPending ? (
            <LoadingState />
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : (
            <EmptyState title="Nothing here yet" message="Post a service you offer, or a job you need done." />
          )
        }
        ListFooterComponent={<PageFooter query={results} />}
        onEndReached={() => {
          if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
        }}
        refreshControl={<RefreshControl refreshing={results.isRefetching} onRefresh={() => void results.refetch()} />}
      />
    </Screen>
  );
}
