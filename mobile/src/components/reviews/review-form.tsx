/**
 * Leave a review for a completed order (FR-500): 1–5 stars (each a ≥ 48 px button) + optional comment.
 */
import { REVIEW_COMMENT_MAX } from '@cc/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Button, Notice, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { reviewsApi } from '@/lib/reviews/reviews-api';
import { MIN_TOUCH_SIZE } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export function ReviewForm({ orderId, otherName, onDone }: { orderId: string; otherName: string; onDone: () => void }) {
  const { colors, spacing } = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!rating) {
      setError('Choose 1 to 5 stars');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reviewsApi.create(orderId, { rating, comment: comment.trim() || null });
      onDone();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="heading">Review {otherName}</AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel="Rating" style={{ flexDirection: 'row' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ selected: rating === n }}
            accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
            onPress={() => setRating(n)}
            style={{ minWidth: MIN_TOUCH_SIZE, minHeight: MIN_TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppText style={{ fontSize: 30, color: n <= rating ? colors.primary : colors.borderStrong }}>★</AppText>
          </Pressable>
        ))}
      </View>
      <TextField
        label="Comment (optional)"
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={3}
        maxLength={REVIEW_COMMENT_MAX}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      {error ? <Notice tone="danger" message={error} /> : null}
      <Button label="Post review" loading={busy} onPress={() => void submit()} />
    </View>
  );
}
