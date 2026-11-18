/**
 * One listing in a list (browse, search, my listings): photo, title, price/budget, category,
 * place/distance, owner with Student badge, and the status when it is not ACTIVE.
 */
import type { ListingSummaryDto } from '@cc/shared';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { AppText, Avatar, Chip } from '@/components/ui';
import { resolveMediaUrl } from '@/lib/api/media-url';
import { formatDistance, formatListingPrice, LISTING_TYPE_LABEL, WORK_MODE_LABEL } from '@/lib/listings/format';
import { useTheme } from '@/theme/use-theme';

export function ListingCard({ listing, onPress }: { listing: ListingSummaryDto; onPress: () => void }) {
  const { colors, radius, spacing } = useTheme();
  const place = [WORK_MODE_LABEL[listing.workMode], listing.city, formatDistance(listing.distanceKm)]
    .filter(Boolean)
    .join(' · ');
  const price = formatListingPrice(listing);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${LISTING_TYPE_LABEL[listing.type as keyof typeof LISTING_TYPE_LABEL]}: ${listing.title}, ${price}, ${place}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.primarySoft : colors.surface,
      })}
    >
      {listing.coverImageUrl ? (
        <Image
          source={{ uri: resolveMediaUrl(listing.coverImageUrl) }}
          style={{ width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.border }}
          contentFit="cover"
        />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" numberOfLines={2}>
          {listing.title}
        </AppText>
        <AppText color="primary">{price}</AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {listing.category.name} · {place}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <Avatar name={listing.owner.displayName} url={listing.owner.avatarUrl} size={22} />
          <AppText variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
            {listing.owner.displayName}
          </AppText>
          {listing.owner.isStudent ? <Chip label="Student ✓" tone="success" /> : null}
          {listing.status !== 'ACTIVE' ? <Chip label={listing.status === 'PAUSED' ? 'Paused' : 'Closed'} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
