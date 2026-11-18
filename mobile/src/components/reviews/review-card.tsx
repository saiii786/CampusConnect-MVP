/**
 * One review: stars, comment, who wrote it (as buyer/seller) and the public reply, if any.
 * Optional children (e.g. a reply form for the reviewed person).
 */
import type { ReviewDto } from '@cc/shared';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText, Avatar } from '@/components/ui';
import { useTheme } from '@/theme/use-theme';

export const starText = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

export function ReviewCard({ review, children }: { review: ReviewDto; children?: ReactNode }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar name={review.reviewer.displayName} url={review.reviewer.avatarUrl} size={32} />
        <View style={{ flex: 1 }}>
          <AppText variant="label">{review.reviewer.displayName}</AppText>
          <AppText variant="caption" color="textMuted">
            as {review.reviewerRole === 'BUYER' ? 'buyer' : 'seller'} · {review.orderTitle}
          </AppText>
        </View>
      </View>
      <AppText color="primary" accessibilityLabel={`${review.rating} out of 5 stars`}>
        {starText(review.rating)}
      </AppText>
      {review.comment ? <AppText>{review.comment}</AppText> : null}
      {review.reply ? (
        <View style={{ borderLeftWidth: 3, borderColor: colors.primary, paddingLeft: spacing.sm, marginTop: spacing.xs }}>
          <AppText variant="caption" color="textMuted">
            Reply
          </AppText>
          <AppText>{review.reply}</AppText>
        </View>
      ) : null}
      {children}
    </View>
  );
}
