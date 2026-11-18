/**
 * Terms of Use, Privacy Policy, Community Guidelines (FR-604). Reachable signed in AND signed out
 * (root-level route, outside the protected groups), e.g. from the sign-up checkbox.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AppText, EmptyState, Screen } from '@/components/ui';
import { LEGAL_DOCS, type LegalDocId } from '@/content/legal';
import { useTheme } from '@/theme/use-theme';

export default function LegalScreen() {
  const { spacing } = useTheme();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = LEGAL_DOCS[doc as LegalDocId];
  if (!content) return <Screen><EmptyState title="Page not found" /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: content.title }} />
      <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <AppText variant="caption" color="textMuted">
          Last updated {content.updated}
        </AppText>
        {content.sections.map((s) => (
          <View key={s.heading} style={{ gap: spacing.xs }}>
            <AppText variant="heading">{s.heading}</AppText>
            <AppText>{s.body}</AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}
