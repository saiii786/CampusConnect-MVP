/**
 * Small rounded label: skills, languages and badges ("Student ✓").
 * `ChipList` wraps a list of chips onto multiple lines.
 */
import { View } from 'react-native';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export interface ChipProps {
  label: string;
  tone?: 'neutral' | 'success' | 'primary';
}

export function Chip({ label, tone = 'neutral' }: ChipProps) {
  const { colors, radius, spacing } = useTheme();
  const palette = {
    neutral: { bg: colors.surface, fg: 'text' as const },
    success: { bg: colors.successSoft, fg: 'success' as const },
    primary: { bg: colors.primarySoft, fg: 'primary' as const },
  }[tone];
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <AppText variant="caption" color={palette.fg}>
        {label}
      </AppText>
    </View>
  );
}

export function ChipList({ items, tone }: { items: string[]; tone?: ChipProps['tone'] }) {
  const { spacing } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {items.map((item) => (
        <Chip key={item} label={item} tone={tone} />
      ))}
    </View>
  );
}
