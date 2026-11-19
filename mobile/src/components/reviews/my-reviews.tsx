/**
 * "Reviews about me" on My profile: each review with a one-time public reply box (FR-502),
 * and "Share my work record" (FR-053) which shares the public link.
 */
import type { ReviewDto } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { AppText, Button, EmptyState, ErrorState, LoadingState, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { reviewKeys, reviewsApi, useUserReviews, workRecordUrl } from '@/lib/reviews/reviews-api';
import { useTheme } from '@/theme/use-theme';
import { ReviewCard } from './review-card';

function ReplyBox({ review, userId }: { review: ReviewDto; userId: string }) {
  const { spacing } = useTheme();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (review.reply) return null;
  if (!open) return <Button label="Reply" variant="ghost" fullWidth={false} onPress={() => setOpen(true)} />;
  return (
    <View style={{ gap: spacing.sm }}>
      <TextField label="Your public reply" value={text} onChangeText={setText} multiline maxLength={1000} />
      <Button
        label="Post reply"
        fullWidth={false}
        loading={busy}
        disabled={!text.trim()}
        onPress={() => {
          setBusy(true);
          reviewsApi
            .reply(review.id, text.trim())
            .then(() => client.invalidateQueries({ queryKey: reviewKeys.forUser(userId) }))
            .catch((e: unknown) => Alert.alert('Reply not posted', describeError(e)))
            .finally(() => setBusy(false));
        }}
      />
    </View>
  );
}

export function MyReviews({ userId, displayName }: { userId: string; displayName: string }) {
  const { spacing } = useTheme();
  const reviews = useUserReviews(userId);
  const items = reviews.data?.items ?? [];

  const share = () =>
    void Share.share({
      message: `${displayName}'s verified work record on Connect: ${workRecordUrl(userId)}`,
    }).catch(() => undefined);

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="heading">Reviews about me</AppText>
      <Button label="Share my work record" variant="secondary" onPress={share} />
      <AppText variant="caption" color="textMuted">
        A public page listing the jobs you completed here, with ratings — useful for your CV.
      </AppText>
      {reviews.isPending ? (
        <LoadingState />
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No reviews yet" message="Complete orders to collect reviews." />
      ) : (
        items.map((r) => (
          <ReviewCard key={r.id} review={r}>
            <ReplyBox review={r} userId={userId} />
          </ReviewCard>
        ))
      )}
    </View>
  );
}
