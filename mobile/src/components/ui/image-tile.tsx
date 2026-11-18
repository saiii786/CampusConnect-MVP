/**
 * Rounded image with a caption — used for portfolio items. `url` may be absolute or API-relative.
 */
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { resolveMediaUrl } from '@/lib/api/media-url';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export interface ImageTileProps {
  url: string;
  title: string;
  description?: string | null;
  /** Optional actions under the caption (e.g. a Remove button). */
  children?: ReactNode;
}

export function ImageTile({ url, title, description, children }: ImageTileProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
      <Image
        source={{ uri: resolveMediaUrl(url) }}
        style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.border }}
        contentFit="cover"
        accessibilityLabel={title}
      />
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <AppText variant="label">{title}</AppText>
        {description ? <AppText color="textMuted">{description}</AppText> : null}
        {children}
      </View>
    </View>
  );
}
