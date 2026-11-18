/**
 * T9.1: the offline banner follows TanStack Query's online state, and endless lists show
 * "loading more" / a retryable error instead of silently stopping.
 */
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { PageFooter } from '@/components/ui/page-footer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('OfflineBanner', () => {
  afterEach(async () => {
    await act(() => onlineManager.setOnline(true));
  });

  it('appears while offline and disappears when back online', async () => {
    await render(<OfflineBanner />);
    expect(screen.queryByText(/offline/)).toBeNull();
    await act(() => onlineManager.setOnline(false));
    expect(screen.getByText(/You're offline/)).toBeTruthy();
    await act(() => onlineManager.setOnline(true));
    expect(screen.queryByText(/offline/)).toBeNull();
  });
});

describe('PageFooter', () => {
  const base = { isFetchingNextPage: false, isFetchNextPageError: false, error: null, fetchNextPage: jest.fn() };

  it('shows nothing when idle', async () => {
    await render(<PageFooter query={base} />);
    expect(screen.queryByText('Loading more…')).toBeNull();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('shows "Loading more…" while the next page loads', async () => {
    await render(<PageFooter query={{ ...base, isFetchingNextPage: true }} />);
    expect(screen.getByText('Loading more…')).toBeTruthy();
  });

  it('shows the error with Try again, which fetches the page again', async () => {
    const fetchNextPage = jest.fn();
    await render(<PageFooter query={{ ...base, isFetchNextPageError: true, error: new Error('boom'), fetchNextPage }} />);
    await fireEvent.press(screen.getByText('Try again'));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
