/**
 * Report a user, listing, message or review (FR-600). Params: targetType, targetId, label
 * (what is being reported, shown at the top). An admin reviews every report.
 */
import { REPORT_DETAILS_MAX, ReportReason, type CreateReportInput } from '@cc/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppText, Button, Notice, Screen, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { api } from '@/lib/api/client';
import { MIN_TOUCH_SIZE } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SCAM', label: 'Scam or asking for money/OTP' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'ABUSE', label: 'Harassment or abuse' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate content' },
  { value: 'FAKE_PROFILE', label: 'Fake profile' },
  { value: 'SAFETY', label: 'Safety concern' },
  { value: 'OTHER', label: 'Something else' },
];

export default function ReportScreen() {
  const { colors, radius, spacing } = useTheme();
  const p = useLocalSearchParams<{ targetType: CreateReportInput['targetType']; targetId: string; label?: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) {
      setError('Choose a reason');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/reports', { targetType: p.targetType, targetId: p.targetId, reason, details: details.trim() || undefined });
      Alert.alert('Thank you', 'Our team will review this report. You can also block the person from the chat.');
      router.back();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        {p.label ? <AppText variant="heading">{p.label}</AppText> : null}
        <View accessibilityRole="radiogroup" accessibilityLabel="Reason" style={{ gap: spacing.sm }}>
          {REASONS.map((r) => {
            const selected = r.value === reason;
            return (
              <Pressable
                key={r.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setReason(r.value)}
                style={{
                  minHeight: MIN_TOUCH_SIZE,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : 'transparent',
                }}
              >
                <AppText color={selected ? 'primary' : 'text'}>{r.label}</AppText>
              </Pressable>
            );
          })}
        </View>
        <TextField
          label="What happened? (optional)"
          value={details}
          onChangeText={setDetails}
          multiline
          numberOfLines={4}
          maxLength={REPORT_DETAILS_MAX}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        {error ? <Notice tone="danger" message={error} /> : null}
        <Button label="Send report" variant="danger" loading={busy} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}
