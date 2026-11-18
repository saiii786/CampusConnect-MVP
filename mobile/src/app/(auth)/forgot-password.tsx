/**
 * Forgot password, step 1 (FR-006): ask for the email and send a reset code. The server always
 * answers "accepted" (it never reveals whether an account exists), so the app does the same.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@cc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { AppText, Button, Notice, Screen, TextField } from '@/components/ui';
import { authApi } from '@/lib/auth/auth-api';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { useTheme } from '@/theme/use-theme';

export default function ForgotPasswordScreen() {
  const { spacing } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authApi.forgotPassword(values);
      router.push({ pathname: '/reset-password', params: { email: values.email } });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email']));
    }
  });
  const onSubmit = () => void submit();

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
        <AppText color="textMuted">
          Enter the email you signed up with. If it has an account, we&apos;ll send a 6-digit code to reset your
          password.
        </AppText>
        {formError ? <Notice tone="danger" message={formError} /> : null}
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              onSubmitEditing={onSubmit}
            />
          )}
        />
        <Button label="Send code" loading={formState.isSubmitting} onPress={onSubmit} />
      </View>
    </Screen>
  );
}
