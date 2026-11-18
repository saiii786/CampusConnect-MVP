/**
 * Edit profile (FR-050): photo (saved immediately), name, bio, city, college, skills, languages.
 * Skills/languages are typed comma-separated and cleaned by the shared schema (trim, dedupe, limits).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BIO_MAX,
  CITY_MAX,
  COLLEGE_NAME_MAX,
  LANGUAGES_MAX,
  SKILLS_MAX,
  displayNameSchema,
  updateProfileSchema,
} from '@cc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, View } from 'react-native';
import { z } from 'zod';
import { AppText, Avatar, Button, Notice, Screen, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { useSession } from '@/lib/auth/session';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { pickImage, uploadImage } from '@/lib/uploads/upload-image';
import { usersApi } from '@/lib/users/users-api';
import { useTheme } from '@/theme/use-theme';

const splitTags = (text: string) => text.split(',').map((t) => t.trim()).filter(Boolean);

const formSchema = z
  .object({
    displayName: displayNameSchema,
    bio: z.string().max(BIO_MAX, `At most ${BIO_MAX} characters`),
    city: z.string().max(CITY_MAX, `At most ${CITY_MAX} characters`),
    collegeName: z.string().max(COLLEGE_NAME_MAX, `At most ${COLLEGE_NAME_MAX} characters`),
    skills: z.string(),
    languages: z.string(),
  })
  // Run the real API schema so every rule (tag length, counts…) matches the server exactly.
  .superRefine((v, ctx) => {
    const result = updateProfileSchema.safeParse({ skills: splitTags(v.skills), languages: splitTags(v.languages) });
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] === 'languages' ? 'languages' : 'skills';
        ctx.addIssue({ code: 'custom', path: [field], message: issue.message });
      }
    }
  });
type FormValues = z.infer<typeof formSchema>;

export default function EditProfileScreen() {
  const { spacing } = useTheme();
  const user = useSession((s) => s.user);
  const [formError, setFormError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const p = user?.profile;

  const { control, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: p?.displayName ?? '',
      bio: p?.bio ?? '',
      city: p?.city ?? '',
      collegeName: p?.collegeName ?? '',
      skills: p?.skills.join(', ') ?? '',
      languages: p?.languages.join(', ') ?? '',
    },
  });

  const submit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await usersApi.updateMe({
        displayName: v.displayName,
        bio: v.bio,
        city: v.city,
        collegeName: v.collegeName,
        skills: splitTags(v.skills),
        languages: splitTags(v.languages),
      });
      router.back();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['displayName', 'bio', 'city', 'collegeName', 'skills', 'languages']));
    }
  });
  const onSubmit = () => void submit();

  const changePhoto = async () => {
    try {
      const picked = await pickImage({ square: true });
      if (!picked) return;
      setPhotoBusy(true);
      const key = await uploadImage(picked.uri, 'AVATAR');
      await usersApi.updateMe({ avatarUploadKey: key });
    } catch (error) {
      Alert.alert('Photo not saved', describeError(error));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await usersApi.updateMe({ avatarUploadKey: null });
    } catch (error) {
      Alert.alert('Photo not removed', describeError(error));
    } finally {
      setPhotoBusy(false);
    }
  };

  const text = (
    name: keyof FormValues,
    label: string,
    extra: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
          {...extra}
        />
      )}
    />
  );

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
        <Avatar name={p?.displayName ?? ''} url={p?.avatarUrl} size={96} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label={p?.avatarUrl ? 'Change photo' : 'Add photo'} fullWidth={false} loading={photoBusy} onPress={changePhoto} />
          {p?.avatarUrl ? (
            <Button label="Remove" variant="ghost" fullWidth={false} disabled={photoBusy} onPress={removePhoto} />
          ) : null}
        </View>
      </View>

      <View style={{ gap: spacing.lg }}>
        {formError ? <Notice tone="danger" message={formError} /> : null}
        {text('displayName', 'Name', { autoComplete: 'name' })}
        {text('bio', 'About you', {
          hint: 'What you do, your experience, what kind of work you want',
          multiline: true,
          numberOfLines: 4,
          maxLength: BIO_MAX,
          style: { minHeight: 100, textAlignVertical: 'top' },
        })}
        {text('city', 'City / area', { hint: 'e.g. Hyderabad, Gachibowli' })}
        {text('collegeName', 'College (optional)')}
        {text('skills', 'Skills', { hint: `Separate with commas — up to ${SKILLS_MAX}, e.g. Painting, Tutoring`, autoCapitalize: 'words' })}
        {text('languages', 'Languages you speak', {
          hint: `Separate with commas — up to ${LANGUAGES_MAX}, e.g. Telugu, Hindi, English`,
          autoCapitalize: 'words',
        })}
        <Button label="Save" loading={formState.isSubmitting} onPress={onSubmit} />
        <AppText variant="caption" color="textMuted">
          Your email, phone and date of birth are never shown on your public profile.
        </AppText>
      </View>
    </Screen>
  );
}
