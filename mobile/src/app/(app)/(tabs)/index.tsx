/**
 * Home = Browse (T3.4, redesigned in Phase 9A): greeting + notifications bell, search bar,
 * Services | Job requests, filter chips (near me, filters) and category chips, then the listing feed.
 * Wallet / My listings / My quotes live under the Profile tab.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { ListingCard } from '@/components/listings/listing-card';
import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  FilterChip,
  IconButton,
  LoadingState,
  Notice,
  PageFooter,
  Screen,
  SearchBar,
  SectionHeader,
  Segmented,
} from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { useSession } from '@/lib/auth/session';
import { useNotificationCount } from '@/lib/notifications/notifications-api';
import { useListingSearch } from '@/lib/listings/listings-api';
import { activeFilterCount, toSearchQuery, useSearchFilters } from '@/lib/listings/search-filters';
import { getCurrentLocation } from '@/lib/location/current-location';
import { useCategories } from '@/lib/users/users-api';
import { useTheme } from '@/theme/use-theme';

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function BrowseScreen() {
  const { spacing } = useTheme();
  const user = useSession((s) => s.user);
  const filters = useSearchFilters();
  const [text, setText] = useState(filters.q);
  const [locating, setLocating] = useState(false);
  const query = toSearchQuery(filters);
  const results = useListingSearch(query);
  const notificationCount = useNotificationCount();
  const categories = useCategories();
  const items = results.data?.pages.flatMap((p) => p.items) ?? [];
  const filterCount = activeFilterCount(filters) - (filters.nearMe ? 1 : 0) - (filters.categoryId ? 1 : 0);
  const firstName = user?.profile.displayName.split(' ')[0] ?? '';
  const allCategories = categories.data?.groups.flatMap((g) => g.categories) ?? [];
  const isServices = filters.type === 'SERVICE_OFFER';

  const toggleNearMe = async () => {
    if (filters.nearMe) {
      filters.set({ nearMe: false, sort: filters.sort === 'distance' ? 'newest' : filters.sort });
      return;
    }
    setLocating(true);
    try {
      const here = await getCurrentLocation();
      if (!here) {
        Alert.alert('Location is off', 'Allow location access to see work near you, or filter by city instead.');
        return;
      }
      filters.set({ nearMe: true, sort: 'distance', location: { lat: here.lat, lng: here.lng } });
    } catch (error) {
      Alert.alert('Could not get your location', describeError(error));
    } finally {
      setLocating(false);
    }
  };

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText color="textMuted">{greeting()}{firstName ? ',' : ''}</AppText>
          <AppText variant="title" numberOfLines={1}>
            {firstName || 'Welcome'} 👋
          </AppText>
        </View>
        <IconButton
          icon="notifications-outline"
          label="Notifications"
          badge={notificationCount.data?.unreadCount}
          onPress={() => router.push('/notifications')}
        />
      </View>

      {user && !user.emailVerified ? (
        <Notice tone="warning" title="Verify your email" message="You need to verify your email before you can post or message.">
          <Button label="Enter code" fullWidth={false} onPress={() => router.push('/verify-email')} />
        </Notice>
      ) : null}

      <SearchBar
        value={text}
        onChangeText={setText}
        onSubmit={(q) => filters.set({ q })}
        placeholder={isServices ? 'Search services: tuition, logo, cake…' : 'Search jobs: painting, website, event…'}
      />

      <Segmented
        options={[
          { value: 'SERVICE_OFFER', label: 'Services' },
          { value: 'JOB_REQUEST', label: 'Job requests' },
        ]}
        value={filters.type}
        onChange={(type) => filters.set({ type })}
      />

      {/* Filters, then one chip per category — scroll sideways. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.lg }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs }}
      >
        <FilterChip
          icon="location-outline"
          label={filters.nearMe ? `Near me · ${filters.radiusKm} km` : 'Near me'}
          selected={filters.nearMe}
          loading={locating}
          onPress={() => void toggleNearMe()}
        />
        <FilterChip
          icon="options-outline"
          label={filterCount > 0 ? `Filters · ${filterCount}` : 'Filters'}
          selected={filterCount > 0}
          onPress={() => router.push('/search-filters')}
        />
        {allCategories.map((c) => {
          const selected = filters.categoryId === c.id;
          return (
            <FilterChip
              key={c.id}
              label={c.name}
              selected={selected}
              onPress={() => filters.set(selected ? { categoryId: null, categoryName: null } : { categoryId: c.id, categoryName: c.name })}
            />
          );
        })}
      </ScrollView>

      <SectionHeader
        title={filters.categoryName ?? (filters.nearMe ? 'Near you' : isServices ? 'Latest services' : 'Latest job requests')}
        action={filters.q || filters.categoryId || filterCount > 0 ? 'Clear' : undefined}
        onAction={() => {
          setText('');
          filters.reset();
        }}
      />
    </View>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.md }}>
            <ListingCard listing={item} onPress={() => router.push({ pathname: '/listings/[id]', params: { id: item.id } })} />
          </View>
        )}
        ListEmptyComponent={
          results.isPending ? (
            <LoadingState />
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : (
            <EmptyState
              icon={isServices ? 'briefcase-outline' : 'clipboard-outline'}
              title={filters.q || filters.categoryId || filters.nearMe ? 'Nothing found' : isServices ? 'No services yet' : 'No job requests yet'}
              message={
                filters.nearMe
                  ? 'Try a bigger distance in Filters, or turn off "Near me".'
                  : filters.q || filters.categoryId
                    ? 'Try other words or another category.'
                    : 'Be the first — tap Post to offer what you are good at.'
              }
              action={
                !filters.q && !filters.categoryId && !filters.nearMe ? (
                  <Button label={isServices ? 'Offer a service' : 'Post a job'} fullWidth={false} onPress={() => router.push('/listings/new')} />
                ) : undefined
              }
            />
          )
        }
        onEndReached={() => {
          if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PageFooter query={results} />}
        refreshControl={<RefreshControl refreshing={results.isRefetching} onRefresh={() => void results.refetch()} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
