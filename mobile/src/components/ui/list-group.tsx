/**
 * Settings-style list: a titled, rounded group of rows. Each row has an icon in a tinted square,
 * a title, an optional subtitle or value, and a chevron — how real apps present "My account" menus,
 * instead of a stack of full-width buttons.
 */
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const { colors, radius, spacing } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <AppText variant="caption" color="textMuted" style={{ marginLeft: spacing.xs, letterSpacing: 0.6 }}>
          {title.toUpperCase()}
        </AppText>
      ) : null}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 64 }} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export interface ListRowProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  tone?: 'default' | 'danger';
  loading?: boolean;
  onPress: () => void;
}

export function ListRow({ icon, title, subtitle, value, tone = 'default', loading, onPress }: ListRowProps) {
  const { colors, radius, spacing } = useTheme();
  const danger = tone === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, value, subtitle].filter(Boolean).join(', ')}
      accessibilityState={{ busy: !!loading }}
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 56,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: pressed ? colors.primarySoft : 'transparent',
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: danger ? colors.dangerSoft : colors.primarySoft,
        }}
      >
        <Icon name={icon} size={19} color={danger ? 'danger' : 'primary'} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText color={danger ? 'danger' : 'text'}>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="label" color="textMuted">
          {value}
        </AppText>
      ) : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : danger ? null : <Icon name="chevron-forward" size={18} color="textMuted" />}
    </Pressable>
  );
}
