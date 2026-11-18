/**
 * Home = Browse (T3.4): search box, Services | Job requests, "Near me", filters, endless list.
 * Also shows the verify-email / complete-profile prompts and quick links (post, my listings, profile).
 * Phase 9A replaces the link row with bottom tabs.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { ListingCard } from '@/components/listings/listing-card';
import { AppText, Button, EmptyState, ErrorState, LoadingState, Notice, Screen, Segmented, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { useSession } from '@/lib/auth/session';
import { useListingSearch } from '@/lib/listings/listings-api';
import { activeFilterCount, toSearchQuery, useSearchFilters } from '@/lib/listings/search-filters';
import { getCurrentLocation } from '@/lib/location/current-location';
import { useTheme } from '@/theme/use-theme';

export default function BrowseScreen() {
  const { spacing } = useTheme();
  const user = useSession((s) => s.user);
  const filters = useSearchFilters();
  const [text, setText] = useState(filters.q);
  const [locating, setLocating] = useState(false);
  const query = toSearchQuery(filters);
  const results = useListingSearch(query);
  const items = results.data?.pages.flatMap((p) => p.items) ?? [];
  const filterCount = activeFilterCount(filters);

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
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button label="+ Post" fullWidth={false} onPress={() => router.push('/listings/new')} />
        <Button label="My listings" variant="secondary" fullWidth={false} onPress={() => router.push('/my-listings')} />
        <Button label="Profile" variant="secondary" fullWidth={false} onPress={() => router.push('/profile')} />
      </View>

      {user && !user.emailVerified ? (
        <Notice tone="warning" title="Verify your email" message="You need to verify your email before you can post.">
          <Button label="Enter code" fullWidth={false} onPress={() => router.push('/verify-email')} />
        </Notice>
      ) : null}

      <TextField
        label="Search"
        placeholder="e.g. painting, tuition, cake, website"
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => filters.set({ q: text })}
        onBlur={() => filters.set({ q: text })}
        returnKeyType="search"
        autoCapitalize="none"
      />
      <Segmented
        options={[
          { value: 'SERVICE_OFFER', label: 'Services' },
          { value: 'JOB_REQUEST', label: 'Job requests' },
        ]}
        value={filters.type}
        onChange={(type) => filters.set({ type })}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          label={filters.nearMe ? `Near me · ${filters.radiusKm} km ✓` : 'Near me'}
          variant={filters.nearMe ? 'primary' : 'secondary'}
          fullWidth={false}
          loading={locating}
          onPress={() => void toggleNearMe()}
        />
        <Button
          label={filterCount ? `Filters (${filterCount})` : 'Filters'}
          variant="secondary"
          fullWidth={false}
          onPress={() => router.push('/search-filters')}
        />
      </View>
      {filters.categoryName ? (
        <AppText variant="caption" color="textMuted">
          Category: {filters.categoryName}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={header}
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
            <EmptyState
              title="Nothing found"
              message={filters.nearMe ? 'Try a bigger distance in Filters, or turn off "Near me".' : 'Try other words or fewer filters.'}
            />
          )
        }
        onEndReached={() => {
          if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={results.isFetchingNextPage ? <LoadingState label="Loading more…" /> : undefined}
        refreshControl={<RefreshControl refreshing={results.isRefetching} onRefresh={() => void results.refetch()} />}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}
