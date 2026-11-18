/**
 * One quote: amount, status, message, finish-by date, and (for the job owner) the seller's trust
 * signals — rating, completed jobs, badges (FR-201). Actions are passed in as children.
 */
import { formatPaise, type QuoteDto } from '@cc/shared';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Avatar, Chip } from '@/components/ui';
import { useTheme } from '@/theme/use-theme';

export const QUOTE_STATUS_LABEL: Record<QuoteDto['status'], string> = {
  ACTIVE: 'Open',
  WITHDRAWN: 'Withdrawn',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
  NOT_SELECTED: 'Not selected',
};

export function QuoteCard({ quote, showSeller, onSellerPress, children }: {
  quote: QuoteDto;
  showSeller: boolean;
  onSellerPress?: () => void;
  children?: ReactNode;
}) {
  const { colors, radius, spacing } = useTheme();
  const s = quote.seller;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
      {showSeller ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${s.displayName}, open profile`}
          onPress={onSellerPress}
          style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}
        >
          <Avatar name={s.displayName} url={s.avatarUrl} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label">{s.displayName}</AppText>
            <AppText variant="caption" color="textMuted">
              {s.rating.average === null ? 'No reviews yet' : `★ ${s.rating.average.toFixed(1)} (${s.rating.count})`} · {s.completedJobs} job
              {s.completedJobs === 1 ? '' : 's'} done
            </AppText>
          </View>
          {s.badges.includes('STUDENT') ? <Chip label="Student ✓" tone="success" /> : null}
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="heading" color="primary">
          {formatPaise(quote.amountPaise)}
        </AppText>
        <Chip label={QUOTE_STATUS_LABEL[quote.status]} tone={quote.status === 'ACTIVE' ? 'primary' : 'neutral'} />
      </View>
      <AppText>{quote.message}</AppText>
      {quote.etaDate ? (
        <AppText variant="caption" color="textMuted">
          Can finish by {quote.etaDate}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}
