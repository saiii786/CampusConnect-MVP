/**
 * Listing detail (T3.4): photos, title, price/budget, category, place/distance, description,
 * the person who posted it (→ public profile). Owners get Edit / Pause / Resume / Close and, for
 * job requests, "View quotes received". Others get "Send a quote" (job requests) or "Book"
 * (service offers), and "Message".
 */
import { formatPaise, type ListingDetailDto } from '@cc/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { AppText, Avatar, Button, Chip, EmptyState, ErrorState, LoadingState, Notice, Screen } from '@/components/ui';
import { ApiError, describeError } from '@/lib/api/api-error';
import { resolveMediaUrl } from '@/lib/api/media-url';
import { formatDistance, formatListingPrice, LISTING_TYPE_LABEL, WORK_MODE_LABEL } from '@/lib/listings/format';
import { useListing, useListingStatus } from '@/lib/listings/listings-api';
import { useSearchFilters } from '@/lib/listings/search-filters';
import { chatApi } from '@/lib/chat/chat-api';
import { useMyQuoteFor } from '@/lib/quotes/quotes-api';
import { useTheme } from '@/theme/use-theme';

/** What someone who does not own the listing can do: message, and quote (job requests). */
function VisitorActions({ listing: l }: { listing: ListingDetailDto }) {
  const { spacing } = useTheme();
  const myQuote = useMyQuoteFor(l.id);
  const [opening, setOpening] = useState(false);

  const message = async () => {
    setOpening(true);
    try {
      const c = await chatApi.start(l.id);
      router.push({ pathname: '/chat/[id]', params: { id: c.id } });
    } catch (error) {
      Alert.alert('Could not open chat', describeError(error));
    } finally {
      setOpening(false);
    }
  };

  if (l.status !== 'ACTIVE') return <Notice message="This listing is not open right now." />;
  return (
    <View style={{ gap: spacing.sm }}>
      {l.type === 'JOB_REQUEST' ? (
        myQuote.data && myQuote.data.status === 'ACTIVE' ? (
          <Notice title={`Your quote: ${formatPaise(myQuote.data.amountPaise)}`} message="You can edit or withdraw it in My quotes.">
            <Button label="My quotes" variant="secondary" fullWidth={false} onPress={() => router.push('/my-quotes')} />
          </Notice>
        ) : (
          <Button
            label="Send a quote"
            onPress={() => router.push({ pathname: '/quote-form', params: { listingId: l.id, title: l.title } })}
          />
        )
      ) : (
        <Button
          label={l.pricingType === 'QUOTE' ? 'Book (agreed price)' : 'Book'}
          onPress={() =>
            router.push({
              pathname: '/book',
              params: { listingId: l.id, title: l.title, pricingType: l.pricingType, pricePaise: l.pricePaise ? String(l.pricePaise) : '' },
            })
          }
        />
      )}
      <Button label="Message" variant={l.type === 'JOB_REQUEST' ? 'secondary' : 'primary'} loading={opening} onPress={() => void message()} />
      <Button
        label="Report this listing"
        variant="ghost"
        onPress={() => router.push({ pathname: '/report', params: { targetType: 'LISTING', targetId: l.id, label: `Report "${l.title}"` } })}
      />
    </View>
  );
}

export default function ListingDetailScreen() {
  const { colors, radius, spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const location = useSearchFilters((s) => s.location);
  const query = useListing(id, location);
  const status = useListingStatus(id);

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <Screen>
        {query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState title="Listing not available" message="It may have been paused or closed." />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )}
      </Screen>
    );
  }

  const l = query.data;
  const place = [WORK_MODE_LABEL[l.workMode], l.city, formatDistance(l.distanceKm)].filter(Boolean).join(' · ');
  const run = (action: 'pause' | 'resume' | 'close') =>
    status.mutate(action, { onError: (e) => Alert.alert('Not changed', describeError(e)) });
  const confirmClose = () =>
    Alert.alert('Close this listing?', 'It disappears from search and cannot be reopened.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close listing', style: 'destructive', onPress: () => run('close') },
    ]);

  return (
    <Screen>
      {l.imageUrls.length ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }}>
          {l.imageUrls.map((url, i) => (
            <Image
              key={url}
              source={{ uri: resolveMediaUrl(url) }}
              style={{ width: 360, aspectRatio: 4 / 3, marginLeft: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface }}
              contentFit="cover"
              accessibilityLabel={`Photo ${i + 1} of ${l.imageUrls.length}`}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Chip label={LISTING_TYPE_LABEL[l.type as keyof typeof LISTING_TYPE_LABEL]} tone="primary" />
          <Chip label={l.category.name} />
          {l.status !== 'ACTIVE' ? <Chip label={l.status === 'PAUSED' ? 'Paused' : 'Closed'} /> : null}
        </View>
        <AppText variant="title">{l.title}</AppText>
        <AppText variant="heading" color="primary">
          {formatListingPrice(l)}
        </AppText>
        <AppText color="textMuted">{place}</AppText>
        {l.radiusKm ? <AppText color="textMuted">Travels up to {l.radiusKm} km</AppText> : null}
        {l.preferredDate ? <AppText color="textMuted">Needed by {l.preferredDate}</AppText> : null}
      </View>

      <AppText>{l.description}</AppText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Posted by ${l.owner.displayName}. Open profile`}
        onPress={() => router.push({ pathname: '/users/[id]', params: { id: l.owner.id } })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface }}
      >
        <Avatar name={l.owner.displayName} url={l.owner.avatarUrl} size={48} />
        <View style={{ flex: 1 }}>
          <AppText variant="label">{l.owner.displayName}</AppText>
          <AppText variant="caption" color="textMuted">
            {l.owner.isStudent ? 'Student ✓ · ' : ''}View profile, reviews and portfolio
          </AppText>
        </View>
      </Pressable>

      {l.isOwner ? (
        <View style={{ gap: spacing.sm }}>
          {l.status !== 'CLOSED' ? (
            <Button label="Edit" onPress={() => router.push({ pathname: '/listings/edit/[id]', params: { id: l.id } })} />
          ) : null}
          {l.status === 'ACTIVE' ? (
            <Button label="Pause (hide for now)" variant="secondary" loading={status.isPending} onPress={() => run('pause')} />
          ) : null}
          {l.status === 'PAUSED' ? (
            <Button label="Resume" variant="secondary" loading={status.isPending} onPress={() => run('resume')} />
          ) : null}
          {l.status !== 'CLOSED' ? <Button label="Close listing" variant="ghost" onPress={confirmClose} /> : null}
        </View>
      ) : (
        <VisitorActions listing={l} />
      )}
      {l.isOwner && l.type === 'JOB_REQUEST' ? (
        <Button
          label="View quotes received"
          variant="secondary"
          onPress={() => router.push({ pathname: '/listing-quotes/[id]', params: { id: l.id } })}
        />
      ) : null}
    </Screen>
  );
}
