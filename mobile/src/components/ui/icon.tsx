/**
 * App icons (Ionicons, bundled with Expo — free). Always decorative unless a parent gives it a label:
 * the pressable around it carries the accessible name.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ColorName } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color = 'text' }: { name: IconName; size?: number; color?: ColorName }) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={colors[color]} accessible={false} importantForAccessibility="no" />;
}
