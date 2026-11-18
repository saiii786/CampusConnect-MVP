/**
 * Post a service offer or a job request (FR-150, FR-151). Needs a verified email (the API says
 * AUTH_EMAIL_NOT_VERIFIED otherwise — shown with a link to verify).
 */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { EMPTY_LISTING_FORM, ListingForm } from '@/components/listings/listing-form';
import { Button, Notice, Screen } from '@/components/ui';
import { useSession } from '@/lib/auth/session';
import { listingKeys, listingsApi } from '@/lib/listings/listings-api';
import { useTheme } from '@/theme/use-theme';

export default function NewListingScreen() {
  const { spacing } = useTheme();
  const queryClient = useQueryClient();
  const verified = useSession((s) => s.user?.emailVerified);

  if (!verified) {
    return (
      <Screen>
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Notice tone="warning" title="Verify your email first" message="Posting needs a verified email address." />
          <Button label="Enter my code" onPress={() => router.replace('/verify-email')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ListingForm
        mode="create"
        submitLabel="Post"
        initial={EMPTY_LISTING_FORM}
        onSubmit={async (body) => {
          const created = await listingsApi.create(body);
          await queryClient.invalidateQueries({ queryKey: listingKeys.all });
          router.replace({ pathname: '/listings/[id]', params: { id: created.id } });
        }}
      />
    </Screen>
  );
}
