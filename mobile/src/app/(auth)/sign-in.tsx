/**
 * Sign in (FR-001). On success the session is stored and the root layout switches to the app.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@cc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button, Notice, Screen, TextField } from '@/components/ui';
import { authApi } from '@/lib/auth/auth-api';
import { session } from '@/lib/auth/session';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { useTheme } from '@/theme/use-theme';

export default function SignInScreen() {
  const { spacing } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await session.signIn(await authApi.login(values));
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'password']));
    }
  });
  const onSubmit = () => void submit();

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
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
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              label="Password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={onSubmit}
            />
          )}
        />
        <Button label="Sign in" loading={formState.isSubmitting} onPress={onSubmit} />
        <Button label="Forgot your password?" variant="ghost" onPress={() => router.push('/forgot-password')} />
        <Button label="New here? Create an account" variant="ghost" onPress={() => router.replace('/sign-up')} />
      </View>
    </Screen>
  );
}
