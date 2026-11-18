/**
 * Add a portfolio item (FR-051): choose a photo (resized before upload), title, optional description.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { PORTFOLIO_DESCRIPTION_MAX, PORTFOLIO_TITLE_MAX } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { Button, Notice, Screen, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { pickImage, uploadImage, type PickedImage } from '@/lib/uploads/upload-image';
import { queryKeys, usersApi } from '@/lib/users/users-api';
import { useTheme } from '@/theme/use-theme';

const formSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(PORTFOLIO_TITLE_MAX),
  description: z.string().max(PORTFOLIO_DESCRIPTION_MAX),
});

export default function AddWorkScreen() {
  const { colors, radius, spacing } = useTheme();
  const queryClient = useQueryClient();
  const [image, setImage] = useState<PickedImage | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', description: '' },
  });

  const choose = async () => {
    try {
      const picked = await pickImage();
      if (picked) setImage(picked);
    } catch (error) {
      setFormError(describeError(error));
    }
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    if (!image) {
      setFormError('Choose a photo first');
      return;
    }
    try {
      const uploadKey = await uploadImage(image.uri, 'PORTFOLIO');
      await usersApi.addPortfolioItem({ title: values.title, description: values.description, uploadKey });
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolio });
      router.back();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['title', 'description']));
    }
  });
  const onSubmit = () => void submit();

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        {formError ? <Notice tone="danger" message={formError} /> : null}
        {image ? (
          <Image
            source={{ uri: image.uri }}
            style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surface }}
            contentFit="cover"
            accessibilityLabel="Selected photo"
          />
        ) : null}
        <Button label={image ? 'Choose a different photo' : 'Choose a photo'} variant="secondary" onPress={choose} />
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <TextField
              label="Title"
              hint="e.g. Living-room wall painting, Birthday cake, College fest website"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              maxLength={PORTFOLIO_TITLE_MAX}
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <TextField
              label="Description (optional)"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              multiline
              numberOfLines={3}
              maxLength={PORTFOLIO_DESCRIPTION_MAX}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          )}
        />
        <Button label="Add to portfolio" loading={formState.isSubmitting} onPress={onSubmit} />
      </View>
    </Screen>
  );
}
