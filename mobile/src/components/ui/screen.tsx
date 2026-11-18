/**
 * Base screen container: safe-area padding, theme background, optional scrolling.
 * Every screen starts with <Screen>.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/use-theme';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Max content width so tablets/web don't stretch forms across the screen. */
  maxWidth?: number;
}

export function Screen({ children, scroll = true, maxWidth = 560 }: ScreenProps) {
  const { colors, spacing } = useTheme();
  const content = (
    <View style={[styles.content, { padding: spacing.lg, gap: spacing.lg, maxWidth }]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.grow} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { width: '100%', alignSelf: 'center', flexGrow: 1 },
});
