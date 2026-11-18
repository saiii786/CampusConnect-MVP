/**
 * Footer for endless lists (FlatList ListFooterComponent): shows "Loading more…" while the next
 * page loads, and an error with Try again if it failed — instead of silently stopping (T9.1).
 */
import { ErrorState, LoadingState } from './state-views';

interface NextPageQuery {
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  error: unknown;
  fetchNextPage: () => unknown;
}

export function PageFooter({ query }: { query: NextPageQuery }) {
  if (query.isFetchingNextPage) return <LoadingState label="Loading more…" />;
  if (query.isFetchNextPageError) return <ErrorState error={query.error} onRetry={() => void query.fetchNextPage()} />;
  return null;
}
