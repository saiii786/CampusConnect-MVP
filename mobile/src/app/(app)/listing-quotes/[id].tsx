/**
 * Quotes received for my job request (FR-201, FR-203): compare price, message and each seller's
 * rating / completed jobs / badges; chat with a seller, open their profile, or decline the quote.
 * Accepting a quote (→ order) arrives in Phase 5.
 */
import type { QuoteDto } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { QuoteCard } from '@/components/quotes/quote-card';
import { Button, EmptyState, ErrorState, LoadingState, Notice, Screen } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { quoteKeys, quotesApi, useListingQuotes } from '@/lib/quotes/quotes-api';
import { useTheme } from '@/theme/use-theme';

export default function ListingQuotesScreen() {
  const { spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const quotes = useListingQuotes(id);

  const decline = (q: QuoteDto) =>
    Alert.alert(`Decline ${q.seller.displayName}'s quote?`, 'They will see it was declined.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: () =>
          void quotesApi
            .reject(q.id)
            .then(() => client.invalidateQueries({ queryKey: quoteKeys.all }))
            .catch((e: unknown) => Alert.alert('Not changed', describeError(e))),
      },
    ]);

  return (
    <Screen scroll={false}>
      <FlatList
        data={quotes.data ?? []}
        keyExtractor={(q) => q.id}
        contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }}
        ListHeaderComponent={<Notice message="Compare quotes, chat with sellers, then accept one (accepting arrives in the next update)." />}
        renderItem={({ item: q }) => (
          <QuoteCard quote={q} showSeller onSellerPress={() => router.push({ pathname: '/users/[id]', params: { id: q.seller.id } })}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {q.conversationId ? (
                <Button label="Chat" variant="secondary" fullWidth={false} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: q.conversationId! } })} />
              ) : null}
              {q.status === 'ACTIVE' ? <Button label="Decline" variant="ghost" fullWidth={false} onPress={() => decline(q)} /> : null}
            </View>
          </QuoteCard>
        )}
        ListEmptyComponent={
          quotes.isPending ? (
            <LoadingState />
          ) : quotes.isError ? (
            <ErrorState error={quotes.error} onRetry={() => quotes.refetch()} />
          ) : (
            <EmptyState title="No quotes yet" message="Sellers who are interested will send you quotes here." />
          )
        }
        refreshControl={<RefreshControl refreshing={quotes.isRefetching} onRefresh={() => void quotes.refetch()} />}
      />
    </Screen>
  );
}
