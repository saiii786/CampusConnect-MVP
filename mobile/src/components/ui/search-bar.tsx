/**
 * Rounded search field with a magnifier and a clear button — no form label (the placeholder and
 * accessibility label say what it is), like the search boxes people know from other apps.
 */
import { Pressable, TextInput, View } from 'react-native';
import { MIN_TOUCH_SIZE } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Icon } from './icon';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, onSubmit, placeholder = 'Search' }: SearchBarProps) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: MIN_TOUCH_SIZE + 4,
        paddingLeft: spacing.md,
        paddingRight: spacing.xs,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Icon name="search" size={20} color="textMuted" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={() => onSubmit(value)}
        onBlur={() => onSubmit(value)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Search"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        maxFontSizeMultiplier={1.6}
        style={[typography.body, { flex: 1, color: colors.text, paddingVertical: spacing.sm }]}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => {
            onChangeText('');
            onSubmit('');
          }}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close-circle" size={20} color="textMuted" />
        </Pressable>
      ) : null}
    </View>
  );
}
