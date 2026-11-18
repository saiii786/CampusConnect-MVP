/**
 * Edit my listing (FR-150, FR-151). Sends every field except the type; the location is only sent
 * when the owner pressed "Update to my current location" (the API keeps the stored pin otherwise).
 */
import type { UpdateListingInput } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { listingToFormValues, ListingForm } from '@/components/listings/listing-form';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { listingKeys, listingsApi, useListing } from '@/lib/listings/listings-api';

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const listing = useListing(id);

  if (listing.isPending) return <Screen><LoadingState /></Screen>;
  if (listing.isError) return <Screen><ErrorState error={listing.error} onRetry={() => listing.refetch()} /></Screen>;
  if (!listing.data.isOwner || listing.data.status === 'CLOSED') {
    return <Screen><EmptyState title="This listing cannot be edited" /></Screen>;
  }

  return (
    <Screen>
      <ListingForm
        mode="edit"
        submitLabel="Save changes"
        initial={listingToFormValues(listing.data)}
        onSubmit={async (body, { locationChanged }) => {
          const { type: _type, location, ...rest } = body as typeof body & { location?: unknown };
          const update = { ...rest, ...(locationChanged || body.workMode === 'REMOTE' ? { location } : {}) } as UpdateListingInput;
          const saved = await listingsApi.update(id, update);
          queryClient.setQueryData(listingKeys.detail(id), saved);
          await queryClient.invalidateQueries({ queryKey: listingKeys.all });
          router.back();
        }}
      />
    </Screen>
  );
}
