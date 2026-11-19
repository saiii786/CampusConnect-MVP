/** Section title with an optional action on the right ("Portfolio · Add", "Latest · See all"). */
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/use-theme';
import { AppText } from './app-text';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
      <AppText variant="heading" style={{ flexShrink: 1 }}>
        {title}
      </AppText>
      {action && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} hitSlop={12} style={{ paddingVertical: spacing.xs }}>
          <AppText variant="label" color="primary">
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
