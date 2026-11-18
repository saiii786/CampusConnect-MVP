/**
 * "TEST MODE — no real money" badge, shown on every money screen (FR-455, ADR-004).
 */
import { View } from 'react-native';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export function TestModeBadge() {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="Test mode. No real money is used."
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.warningSoft,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <AppText variant="label" color="warning">
        TEST MODE — no real money
      </AppText>
    </View>
  );
}
