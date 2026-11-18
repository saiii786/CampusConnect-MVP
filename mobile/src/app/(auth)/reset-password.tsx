/**
 * Forgot password, step 2 (FR-006): enter the emailed code and a new password.
 * Success signs out every device (server side) and sends the user to sign in.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@cc/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, View } from 'react-native';
import { AppText, Button, Notice, Screen, TextField } from '@/components/ui';
import { authApi } from '@/lib/auth/auth-api';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { useTheme } from '@/theme/use-theme';

export default function ResetPasswordScreen() {
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: params.email ?? '', code: '', newPassword: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authApi.resetPassword(values);
      Alert.alert('Password changed', 'Sign in with your new password.');
      router.dismissTo('/sign-in');
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'code', 'newPassword']));
    }
  });
  const onSubmit = () => void submit();

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
        <AppText color="textMuted">Check your email for a 6-digit code. It expires in 15 minutes.</AppText>
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
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          )}
        />
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
            />
          )}
        />
        <Controller
          control={control}
          name="newPassword"
          render={({ field, fieldState }) => (
            <TextField
              label="New password"
              hint="At least 8 characters"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
          )}
        />
        <Button label="Change password" loading={formState.isSubmitting} onPress={onSubmit} />
      </View>
    </Screen>
  );
}
