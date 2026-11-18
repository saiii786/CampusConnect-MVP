/**
 * Student badge (FR-004): step 1 — enter the college email (code is sent there);
 * step 2 — enter the 6-digit code. The step is chosen from `student.pendingEmail`.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { confirmStudentVerificationSchema, startStudentVerificationSchema } from '@cc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { AppText, Button, Notice, Screen, TextField } from '@/components/ui';
import { useSession } from '@/lib/auth/session';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { usersApi } from '@/lib/users/users-api';
import { useTheme } from '@/theme/use-theme';

function EmailStep({ initialEmail, onSent }: { initialEmail?: string; onSent: () => void }) {
  const { spacing } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(startStudentVerificationSchema),
    defaultValues: { collegeEmail: initialEmail ?? '' },
  });
  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await usersApi.startStudent(values);
      onSent();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['collegeEmail']));
    }
  });
  const onSubmit = () => void submit();

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText color="textMuted">
        Enter your college email address (for example ending in .ac.in, .edu or .edu.in). We&apos;ll send a code to it.
        It is never shown to other users.
      </AppText>
      {formError ? <Notice tone="danger" message={formError} /> : null}
      <Controller
        control={control}
        name="collegeEmail"
        render={({ field, fieldState }) => (
          <TextField
            label="College email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={onSubmit}
          />
        )}
      />
      <Button label="Send code" loading={formState.isSubmitting} onPress={onSubmit} />
    </View>
  );
}

function CodeStep({ pendingEmail, onChangeEmail }: { pendingEmail: string; onChangeEmail: () => void }) {
  const { spacing } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(confirmStudentVerificationSchema),
    defaultValues: { code: '' },
  });
  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await usersApi.confirmStudent(values);
      router.back();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['code']));
    }
  });
  const onSubmit = () => void submit();

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText color="textMuted">Enter the 6-digit code we sent to {pendingEmail}. It expires in 30 minutes.</AppText>
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
      <Button label="Use a different college email" variant="ghost" onPress={onChangeEmail} />
    </View>
  );
}

export default function StudentBadgeScreen() {
  const student = useSession((s) => s.user?.student);
  const [changingEmail, setChangingEmail] = useState(false);

  return (
    <Screen>
      {student?.verified ? (
        <Notice tone="success" title="You have the Student badge ✓" message={`Verified with ${student.collegeEmail}.`} />
      ) : student?.pendingEmail && !changingEmail ? (
        <CodeStep pendingEmail={student.pendingEmail} onChangeEmail={() => setChangingEmail(true)} />
      ) : (
        <EmailStep onSent={() => setChangingEmail(false)} />
      )}
    </Screen>
  );
}
