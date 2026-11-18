/**
 * My quotes as a seller (FR-200): status of each, open the job or the chat, edit or withdraw
 * while still open.
 */
import type { MyQuoteDto } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { QuoteCard } from '@/components/quotes/quote-card';
import { AppText, Button, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { quoteKeys, quotesApi, useMyQuotes } from '@/lib/quotes/quotes-api';
import { useTheme } from '@/theme/use-theme';

export default function MyQuotesScreen() {
  const { spacing } = useTheme();
  const client = useQueryClient();
  const quotes = useMyQuotes();

  const withdraw = (q: MyQuoteDto) =>
    Alert.alert('Withdraw this quote?', 'You can send a new one later while the job is open.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () =>
          void quotesApi
            .withdraw(q.id)
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
        renderItem={({ item: q }) => (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label" numberOfLines={2}>
              {q.listing.title} · {q.listing.ownerName}
            </AppText>
            <QuoteCard quote={q} showSeller={false}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Button label="Job" variant="secondary" fullWidth={false} onPress={() => router.push({ pathname: '/listings/[id]', params: { id: q.listing.id } })} />
                {q.conversationId ? (
                  <Button label="Chat" variant="secondary" fullWidth={false} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: q.conversationId! } })} />
                ) : null}
                {q.status === 'ACTIVE' ? (
                  <>
                    <Button
                      label="Edit"
                      variant="ghost"
                      fullWidth={false}
                      onPress={() =>
                        router.push({
                          pathname: '/quote-form',
                          params: {
                            listingId: q.listingId,
                            quoteId: q.id,
                            amountPaise: String(q.amountPaise),
                            message: q.message,
                            etaDate: q.etaDate ?? '',
                            title: q.listing.title,
                          },
                        })
                      }
                    />
                    <Button label="Withdraw" variant="ghost" fullWidth={false} onPress={() => withdraw(q)} />
                  </>
                ) : null}
              </View>
            </QuoteCard>
          </View>
        )}
        ListEmptyComponent={
          quotes.isPending ? (
            <LoadingState />
          ) : quotes.isError ? (
            <ErrorState error={quotes.error} onRetry={() => quotes.refetch()} />
          ) : (
            <EmptyState title="No quotes sent yet" message="Browse Job requests and send a quote for work you can do." />
          )
        }
        refreshControl={<RefreshControl refreshing={quotes.isRefetching} onRefresh={() => void quotes.refetch()} />}
      />
    </Screen>
  );
}
