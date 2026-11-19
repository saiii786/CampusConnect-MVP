/**
 * One listing in a list (browse, search, my listings). Card with a thumbnail (photo, or a tinted
 * tile with an icon so every card lines up), title, price/budget, category + place, and the person
 * who posted it with their Student badge. Shows the status when it is not ACTIVE.
 */
import type { ListingSummaryDto } from '@cc/shared';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { AppText, Avatar, Chip, Icon } from '@/components/ui';
import { resolveMediaUrl } from '@/lib/api/media-url';
import { formatDistance, formatListingPrice, LISTING_TYPE_LABEL, WORK_MODE_LABEL } from '@/lib/listings/format';
import { useTheme } from '@/theme/use-theme';

const THUMB = 92;

export function ListingCard({ listing, onPress }: { listing: ListingSummaryDto; onPress: () => void }) {
  const { colors, radius, spacing } = useTheme();
  const place = [listing.city ?? WORK_MODE_LABEL[listing.workMode], formatDistance(listing.distanceKm)].filter(Boolean).join(' · ');
  const price = formatListingPrice(listing);
  const isJob = listing.type === 'JOB_REQUEST';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${LISTING_TYPE_LABEL[listing.type as keyof typeof LISTING_TYPE_LABEL]}: ${listing.title}, ${price}, ${listing.category.name}, ${place}, by ${listing.owner.displayName}${listing.owner.isStudent ? ', verified student' : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.primarySoft : colors.surfaceRaised,
      })}
    >
      {listing.coverImageUrl ? (
        <Image
          source={{ uri: resolveMediaUrl(listing.coverImageUrl) }}
          style={{ width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: colors.surface }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={{
            width: THUMB,
            height: THUMB,
            borderRadius: radius.md,
            backgroundColor: isJob ? colors.accentSoft : colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={isJob ? 'clipboard-outline' : 'sparkles-outline'} size={30} color={isJob ? 'warning' : 'primary'} />
        </View>
      )}

      <View style={{ flex: 1, gap: spacing.xxs, justifyContent: 'space-between' }}>
        <View style={{ gap: spacing.xxs }}>
          <AppText variant="label" numberOfLines={2} style={{ fontSize: 15, lineHeight: 21 }}>
            {listing.title}
          </AppText>
          <AppText variant="heading" color="primary" style={{ fontSize: 17, lineHeight: 24 }}>
            {price}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name={listing.workMode === 'REMOTE' ? 'globe-outline' : 'location-outline'} size={13} color="textMuted" />
            <AppText variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {listing.category.name} · {place}
            </AppText>
          </View>
        </View>
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
