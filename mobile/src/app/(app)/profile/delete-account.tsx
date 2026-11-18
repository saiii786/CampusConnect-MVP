/**
 * Delete account (FR-009): explains what happens, asks for the password, then signs out.
 * The server refuses while orders are still open (ACCOUNT_HAS_OPEN_ORDERS).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { deleteAccountSchema } from '@cc/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, View } from 'react-native';
import { AppText, Button, Notice, Screen, TextField } from '@/components/ui';
import { ApiError } from '@/lib/api/api-error';
import { session } from '@/lib/auth/session';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { usersApi } from '@/lib/users/users-api';
import { useTheme } from '@/theme/use-theme';

export default function DeleteAccountScreen() {
  const { spacing } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  });

  const submit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await usersApi.deleteAccount(password);
      Alert.alert('Account deleted', 'Your account has been deleted.');
      await session.signOut();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH_PASSWORD_INCORRECT') {
        setError('password', { type: 'server', message: error.message });
        return;
      }
      setFormError(applyServerErrors(error, setError, ['password']));
    }
  });

  const confirm = () =>
    Alert.alert('Delete your account?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void submit() },
    ]);

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        <Notice
          tone="warning"
          title="This cannot be undone"
          message={
            'Your profile, photos and portfolio are removed and you are signed out everywhere. ' +
            'Finished jobs and reviews stay for the other person, shown as "Deleted user". ' +
            'You cannot delete your account while you have open orders.'
          }
        />
        {formError ? <Notice tone="danger" message={formError} /> : null}
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              label="Your password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              secureTextEntry
              autoComplete="current-password"
            />
          )}
        />
        <Button label="Delete my account" variant="danger" loading={formState.isSubmitting} onPress={confirm} />
        <AppText variant="caption" color="textMuted">
          You can sign up again later with the same email.
        </AppText>
      </View>
    </Screen>
  );
}
