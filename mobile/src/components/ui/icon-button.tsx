/**
 * Round icon-only button (notifications bell, edit pencil…) with an optional count badge.
 * 44 px circle, touch area 48 px (hitSlop). `label` is what screen readers announce.
 */
import { Pressable, View } from 'react-native';
import { fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

export interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number;
  tinted?: boolean;
}

export function IconButton({ icon, label, onPress, badge, tinted = true }: IconButtonProps) {
  const { colors, radius } = useTheme();
  const count = badge && badge > 0 ? (badge > 99 ? '99+' : String(badge)) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} new` : label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.primarySoft : tinted ? colors.surface : 'transparent',
      })}
    >
      <Icon name={icon} size={22} color="text" />
      {count ? (
        <View
          style={{
            position: 'absolute',
            top: 2,
            right: 0,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 5,
            borderRadius: radius.pill,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.background,
          }}
        >
          <AppText style={{ fontSize: 10, lineHeight: 13, fontFamily: fonts.bold, color: colors.onAccent }} maxFontSizeMultiplier={1.2}>
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
