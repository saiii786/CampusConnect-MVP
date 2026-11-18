/**
 * Create/edit form for service offers and job requests (FR-150, FR-151). Used by
 * listings/new and listings/edit/[id].
 *
 * - Money is typed in rupees and sent as paise.
 * - Validated with the SAME shared schema the API uses (createListingSchema) before anything is
 *   uploaded; server errors are mapped back onto the fields.
 * - Photos: up to 5. New photos are uploaded on submit; existing ones are kept by their key.
 * - On-site work needs a location: "Use my current location" (also fills the city if empty).
 */
import {
  createListingSchema,
  LISTING_MAX_IMAGES,
  rupeesToPaise,
  SERVICE_RADIUS_MAX_KM,
  type CreateListingInput,
  type ListingType,
  type PricingType,
  type WorkMode,
} from '@cc/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppText, Button, Notice, Segmented, TextField } from '@/components/ui';
import { ApiError, describeError } from '@/lib/api/api-error';
import { resolveMediaUrl } from '@/lib/api/media-url';
import { paiseToRupeesText } from '@/lib/listings/format';
import { getCurrentLocation } from '@/lib/location/current-location';
import { pickImage, uploadImage } from '@/lib/uploads/upload-image';
import { useTheme } from '@/theme/use-theme';
import { CategoryPicker } from './category-picker';

export interface FormPhoto {
  /** Existing photo: its storage key + URL. New photo: local file uri. */
  key?: string;
  url?: string;
  localUri?: string;
}

export interface ListingFormValues {
  type: ListingType;
  categoryId: string | null;
  title: string;
  description: string;
  pricingType: PricingType;
  priceRupees: string;
  budgetMinRupees: string;
  budgetMaxRupees: string;
  preferredDate: string;
  workMode: WorkMode;
  city: string;
  location: { lat: number; lng: number } | null;
  radiusKm: string;
  photos: FormPhoto[];
}

export const EMPTY_LISTING_FORM: ListingFormValues = {
  type: 'SERVICE_OFFER',
  categoryId: null,
  title: '',
  description: '',
  pricingType: 'FIXED',
  priceRupees: '',
  budgetMinRupees: '',
  budgetMaxRupees: '',
  preferredDate: '',
  workMode: 'ONSITE',
  city: '',
  location: null,
  radiusKm: '',
  photos: [],
};

/** Where each API field's error is shown. */
const FIELD_OF: Record<string, keyof ListingFormValues> = {
  pricePaise: 'priceRupees',
  budgetMinPaise: 'budgetMinRupees',
  budgetMaxPaise: 'budgetMaxRupees',
  imageUploadKeys: 'photos',
};

type Errors = Partial<Record<keyof ListingFormValues, string>>;

/** Convert form values to the API body (without photos). Returns null fields for unparsable money. */
export function buildListingBody(v: ListingFormValues): { body: Record<string, unknown>; errors: Errors } {
  const errors: Errors = {};
  const money = (text: string, field: keyof ListingFormValues): number | null => {
    if (!text.trim()) return null;
    const paise = rupeesToPaise(text);
    if (paise === null) errors[field] = 'Enter an amount in rupees, e.g. 1500';
    return paise;
  };
  const common = {
    type: v.type,
    categoryId: v.categoryId ?? '',
    title: v.title,
    description: v.description,
    workMode: v.workMode,
    city: v.city.trim() || null,
    location: v.workMode === 'ONSITE' ? v.location : null,
  };
  const body =
    v.type === 'SERVICE_OFFER'
      ? {
          ...common,
          pricingType: v.pricingType,
          pricePaise: v.pricingType === 'QUOTE' ? null : money(v.priceRupees, 'priceRupees'),
          radiusKm: v.workMode === 'ONSITE' && v.radiusKm.trim() ? Number(v.radiusKm) : null,
        }
      : {
          ...common,
          pricingType: 'QUOTE',
          budgetMinPaise: money(v.budgetMinRupees, 'budgetMinRupees'),
          budgetMaxPaise: money(v.budgetMaxRupees, 'budgetMaxRupees'),
          preferredDate: v.preferredDate.trim() || null,
        };
  return { body, errors };
}

export interface ListingFormProps {
  initial: ListingFormValues;
  /** Editing: the type cannot change and an unchanged location is not re-sent. */
  mode: 'create' | 'edit';
  submitLabel: string;
  /** Receives a fully validated body including uploaded photo keys. `locationChanged` is for edits. */
  onSubmit: (body: CreateListingInput, meta: { locationChanged: boolean }) => Promise<void>;
}

export function ListingForm({ initial, mode, submitLabel, onSubmit }: ListingFormProps) {
  const { colors, radius, spacing } = useTheme();
  const [v, setV] = useState<ListingFormValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [locationChanged, setLocationChanged] = useState(false);
  const set = <K extends keyof ListingFormValues>(key: K, value: ListingFormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const fillCurrentLocation = async () => {
    setBusy('location');
    try {
      const here = await getCurrentLocation();
      if (!here) {
        Alert.alert('Location is off', 'Allow location access in your phone settings, or choose "Remote".');
        return;
      }
      setV((prev) => ({ ...prev, location: { lat: here.lat, lng: here.lng }, city: prev.city || here.city || '' }));
      setErrors((prev) => ({ ...prev, location: undefined, city: undefined }));
      setLocationChanged(true);
    } catch (error) {
      Alert.alert('Could not get your location', describeError(error));
    } finally {
      setBusy(null);
    }
  };

  const addPhoto = async () => {
    try {
      const picked = await pickImage();
      if (picked) set('photos', [...v.photos, { localUri: picked.uri }]);
    } catch (error) {
      Alert.alert('Photo not added', describeError(error));
    }
  };

  const submit = async () => {
    setFormError(null);
    const { body, errors: moneyErrors } = buildListingBody(v);
    const parsed = createListingSchema.safeParse(body);
    const next: Errors = { ...moneyErrors };
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const apiField = String(issue.path[0] ?? '');
        const field = (FIELD_OF[apiField] ?? apiField) as keyof ListingFormValues;
        // When editing, an unknown (unchanged) location is fine — the server keeps the stored one.
        if (mode === 'edit' && field === 'location' && !locationChanged) continue;
        next[field] ??= issue.message;
      }
    }
    if (Object.values(next).some(Boolean)) {
      setErrors(next);
      setFormError('Please fix the highlighted fields');
      return;
    }

    setBusy('submit');
    try {
      const keys: string[] = [];
      for (const photo of v.photos) {
        keys.push(photo.key ?? (await uploadImage(photo.localUri!, 'LISTING')));
      }
      const validated = (parsed.success ? parsed.data : body) as CreateListingInput;
      await onSubmit({ ...validated, imageUploadKeys: keys }, { locationChanged });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED' && Array.isArray(error.details)) {
        const serverErrors: Errors = {};
        for (const issue of error.details as { path: string; message: string }[]) {
          const apiField = issue.path.split('.')[0] ?? '';
          serverErrors[(FIELD_OF[apiField] ?? apiField) as keyof ListingFormValues] = issue.message;
        }
        setErrors(serverErrors);
      }
      setFormError(describeError(error));
    } finally {
      setBusy(null);
    }
  };

  const text = (field: keyof ListingFormValues, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <TextField
      label={label}
      value={v[field] as string}
      onChangeText={(t) => set(field, t as never)}
      error={errors[field]}
      {...extra}
    />
  );

  const isOffer = v.type === 'SERVICE_OFFER';
  return (
    <View style={{ gap: spacing.lg }}>
      {mode === 'create' ? (
        <Segmented
          label="What are you posting?"
          options={[
            { value: 'SERVICE_OFFER', label: 'I offer a service' },
            { value: 'JOB_REQUEST', label: 'I need someone' },
          ]}
          value={v.type}
          onChange={(type) => setV((p) => ({ ...p, type, pricingType: type === 'JOB_REQUEST' ? 'QUOTE' : 'FIXED' }))}
        />
      ) : null}

      <CategoryPicker value={v.categoryId} onChange={(c) => set('categoryId', c?.id ?? null)} error={errors.categoryId} />

      {text('title', 'Title', {
        hint: isOffer ? 'e.g. Wall painting for homes' : 'e.g. Need a logo for my shop',
        maxLength: 100,
      })}
      {text('description', 'Description', {
        hint: isOffer ? 'What you do, experience, what is included' : 'What you need done, size of the job, any details',
        multiline: true,
        numberOfLines: 5,
        maxLength: 2000,
        style: { minHeight: 120, textAlignVertical: 'top' },
      })}

      {isOffer ? (
        <>
          <Segmented
            label="Pricing"
            options={[
              { value: 'FIXED', label: 'Fixed price' },
              { value: 'HOURLY', label: 'Per hour' },
              { value: 'QUOTE', label: 'Ask for quote' },
            ]}
            value={v.pricingType}
            onChange={(p) => set('pricingType', p)}
            error={errors.pricingType}
          />
          {v.pricingType !== 'QUOTE'
            ? text('priceRupees', v.pricingType === 'HOURLY' ? 'Price per hour (₹)' : 'Price (₹)', { keyboardType: 'decimal-pad' })
            : null}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>{text('budgetMinRupees', 'Budget from (₹)', { keyboardType: 'decimal-pad' })}</View>
            <View style={{ flex: 1 }}>{text('budgetMaxRupees', 'Budget up to (₹)', { keyboardType: 'decimal-pad' })}</View>
          </View>
          {text('preferredDate', 'Needed by (optional)', { hint: 'YYYY-MM-DD', placeholder: 'YYYY-MM-DD', maxLength: 10 })}
        </>
      )}

      <Segmented
        label="Where is the work done?"
        options={[
          { value: 'ONSITE', label: 'On-site' },
          { value: 'REMOTE', label: 'Remote / online' },
        ]}
        value={v.workMode}
        onChange={(m) => set('workMode', m)}
      />
      {v.workMode === 'ONSITE' ? (
        <View style={{ gap: spacing.md }}>
          <Button
            label={v.location || (mode === 'edit' && !locationChanged) ? 'Update to my current location' : 'Use my current location'}
            variant="secondary"
            loading={busy === 'location'}
            onPress={fillCurrentLocation}
          />
          {v.location ? (
            <AppText variant="caption" color="success">
              Location set. Others only see your city and the distance — never your exact location.
            </AppText>
          ) : mode === 'edit' && !locationChanged ? (
            <AppText variant="caption" color="textMuted">
              Keeping the saved location.
            </AppText>
          ) : null}
          {errors.location ? (
            <AppText variant="caption" color="danger">
              {errors.location}
            </AppText>
          ) : null}
          {text('city', 'City / area', { hint: 'e.g. Hyderabad, Kukatpally' })}
          {isOffer
            ? text('radiusKm', `How far will you travel? (km, optional, max ${SERVICE_RADIUS_MAX_KM})`, { keyboardType: 'number-pad' })
            : null}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">
          Photos ({v.photos.length}/{LISTING_MAX_IMAGES})
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {v.photos.map((p, i) => (
            <Pressable
              key={p.key ?? p.localUri}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              onPress={() => set('photos', v.photos.filter((_, j) => j !== i))}
            >
              <Image
                source={{ uri: p.localUri ?? resolveMediaUrl(p.url!) }}
                style={{ width: 88, height: 88, borderRadius: radius.md, backgroundColor: colors.surface }}
                contentFit="cover"
              />
              <AppText variant="caption" color="danger" align="center">
                Remove
              </AppText>
            </Pressable>
          ))}
        </View>
        {v.photos.length < LISTING_MAX_IMAGES ? <Button label="Add photo" variant="ghost" fullWidth={false} onPress={addPhoto} /> : null}
        {errors.photos ? (
          <AppText variant="caption" color="danger">
            {errors.photos}
          </AppText>
        ) : null}
      </View>

      {formError ? <Notice tone="danger" message={formError} /> : null}
      <Button label={submitLabel} loading={busy === 'submit'} onPress={() => void submit()} />
    </View>
  );
}

/** Form values from an existing listing (edit screen). */
export function listingToFormValues(l: {
  type: string;
  category: { id: string };
  title: string;
  description: string;
  pricingType: PricingType;
  pricePaise: number | null;
  budgetMinPaise: number | null;
  budgetMaxPaise: number | null;
  preferredDate: string | null;
  workMode: WorkMode;
  city: string | null;
  radiusKm: number | null;
  imageUrls: string[];
  imageKeys: string[];
}): ListingFormValues {
  return {
    type: l.type as ListingType,
    categoryId: l.category.id,
    title: l.title,
    description: l.description,
    pricingType: l.pricingType,
    priceRupees: paiseToRupeesText(l.pricePaise),
    budgetMinRupees: paiseToRupeesText(l.budgetMinPaise),
    budgetMaxRupees: paiseToRupeesText(l.budgetMaxPaise),
    preferredDate: l.preferredDate ?? '',
    workMode: l.workMode,
    city: l.city ?? '',
    location: null,
    radiusKm: l.radiusKm ? String(l.radiusKm) : '',
    photos: l.imageKeys.map((key, i) => ({ key, url: l.imageUrls[i] })),
  };
}
