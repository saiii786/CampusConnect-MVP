/**
 * Round profile picture with an initials fallback (no photo, or the image fails to load).
 * `url` may be absolute or an API-relative path (resolved by resolveMediaUrl).
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { resolveMediaUrl } from '@/lib/api/media-url';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export interface AvatarProps {
  name: string;
  url: string | null | undefined;
  size?: number;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0]];
  return letters.join('').toUpperCase() || '?';
}

export function Avatar({ name, url, size = 72 }: AvatarProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const source = resolveMediaUrl(url);
  const style = { width: size, height: size, borderRadius: size / 2 };

  if (source && !failed) {
    return (
      <Image
        source={{ uri: source }}
        style={[style, { backgroundColor: colors.surface }]}
        contentFit="cover"
        accessibilityLabel={`Profile photo of ${name}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={`${name} (no profile photo)`}
      style={[style, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}
    >
      <AppText style={{ color: colors.primary, fontSize: size * 0.38, fontWeight: '700' }}>{initialsOf(name)}</AppText>
    </View>
  );
}
