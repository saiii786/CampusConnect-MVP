/**
 * Create an account (FR-001, FR-005 age 18+, FR-604 terms). Validated with the same shared
 * schema the server uses. After sign-up the user is signed in; home asks them to verify their email.
 *
 * Date of birth is typed as YYYY-MM-DD (no extra native date-picker dependency for the MVP).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema } from '@cc/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { Button, Checkbox, Notice, Screen, TextField } from '@/components/ui';
import { authApi } from '@/lib/auth/auth-api';
import { session } from '@/lib/auth/session';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { useTheme } from '@/theme/use-theme';

/** The form holds `acceptTerms` as a boolean (unticked at first); it must be true to submit. */
const formSchema = signupSchema.extend({
  acceptTerms: z.boolean().refine((v) => v, 'You must accept the terms to continue'),
});

export default function SignUpScreen() {
  const { spacing } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '', displayName: '', dateOfBirth: '', acceptTerms: false },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const response = await authApi.signup({ ...values, acceptTerms: true });
      // The root layout now switches to the app; home shows the "verify your email" prompt.
      await session.signIn(response);
    } catch (error) {
      setFormError(
        applyServerErrors(error, setError, ['email', 'password', 'displayName', 'dateOfBirth', 'acceptTerms']),
      );
    }
  });
  const onSubmit = () => void submit();

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
        {formError ? <Notice tone="danger" message={formError} /> : null}
        <Controller
          control={control}
          name="displayName"
          render={({ field, fieldState }) => (
            <TextField
              label="Your name"
              hint="Shown on your profile"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              autoComplete="name"
              textContentType="name"
            />
          )}
        />
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
        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field, fieldState }) => (
            <TextField
              label="Date of birth"
              hint="YYYY-MM-DD, e.g. 2003-07-21. You must be 18 or older."
              placeholder="YYYY-MM-DD"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              keyboardType="numbers-and-punctuation"
              autoComplete="birthdate-full"
              maxLength={10}
            />
          )}
        />
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field, fieldState }) => (
            <Checkbox
              checked={field.value}
              onChange={field.onChange}
              label="I am 18 or older and I accept the Terms, Privacy Policy and Community Guidelines"
              error={fieldState.error?.message}
            />
          )}
        />
        <Button label="Create account" loading={formState.isSubmitting} onPress={onSubmit} />
      </View>
    </Screen>
  );
}
