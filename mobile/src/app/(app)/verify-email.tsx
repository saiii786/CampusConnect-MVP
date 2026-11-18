/**
 * Verify email (FR-003): enter the 6-digit code from the email, or ask for a new one
 * (server enforces a 60-second cooldown and 5 wrong attempts per code).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { verifyEmailSchema } from '@cc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { AppText, Button, Notice, Screen, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { authApi } from '@/lib/auth/auth-api';
import { session, useSession } from '@/lib/auth/session';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { useTheme } from '@/theme/use-theme';

export default function VerifyEmailScreen() {
  const { spacing } = useTheme();
  const email = useSession((s) => s.user?.email);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<{ busy: boolean; message: string | null }>({
    busy: false,
    message: null,
  });
  const { control, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      session.setUser(await authApi.verifyEmail(values));
      router.back();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['code']));
    }
  });

  const resend = async () => {
    setResendState({ busy: true, message: null });
    try {
      await authApi.resendVerification();
      setResendState({ busy: false, message: 'A new code is on its way.' });
    } catch (error) {
      setResendState({ busy: false, message: describeError(error) });
    }
  };
  const onSubmit = () => void submit();

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
        <AppText color="textMuted">
          Enter the 6-digit code we sent to {email ?? 'your email'}. It expires in 30 minutes.
        </AppText>
        {formError ? <Notice tone="danger" message={formError} /> : null}
        <Controller
          control={control}
          name="code"
          render={({ field, fieldState }) => (
            <TextField
              label="6-digit code"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              onSubmitEditing={onSubmit}
            />
          )}
        />
        <Button label="Verify" loading={formState.isSubmitting} onPress={onSubmit} />
        <Button label="Send a new code" variant="ghost" loading={resendState.busy} onPress={resend} />
        {resendState.message ? <Notice message={resendState.message} /> : null}
      </View>
    </Screen>
  );
}
