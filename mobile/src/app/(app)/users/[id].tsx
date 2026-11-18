/**
 * Another user's public profile (FR-052): photo, name, badges, rating, completed jobs, bio,
 * skills, languages and portfolio. Never shows email/phone (the API does not send them).
 * Reviews and active listings are added in Phases 3 and 7.
 */
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ProfileSummary } from '@/components/profile/profile-summary';
import { AppText, EmptyState, ErrorState, ImageTile, LoadingState, Screen } from '@/components/ui';
import { ApiError } from '@/lib/api/api-error';
import { usePublicProfile } from '@/lib/users/users-api';
import { useTheme } from '@/theme/use-theme';

export default function PublicProfileScreen() {
  const { spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = usePublicProfile(id);

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <Screen>
          <EmptyState title="Profile not available" message="This account does not exist or is no longer active." />
        </Screen>
      );
    }
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const p = query.data;
  return (
    <Screen>
      <ProfileSummary
        displayName={p.displayName}
        avatarUrl={p.avatarUrl}
        isStudent={p.badges.includes('STUDENT')}
        emailVerified={p.badges.includes('EMAIL_VERIFIED')}
        city={p.city}
        collegeName={p.collegeName}
        bio={p.bio}
        skills={p.skills}
        languages={p.languages}
        stats={{ ratingAverage: p.rating.average, ratingCount: p.rating.count, completedJobs: p.completedJobs }}
      />
      <AppText variant="caption" color="textMuted">
        Member since {new Date(p.memberSince).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
      </AppText>
      <View style={{ gap: spacing.md }}>
        <AppText variant="heading">Portfolio</AppText>
        {p.portfolio.length === 0 ? (
          <EmptyState title="No portfolio yet" />
        ) : (
          p.portfolio.map((item) => (
            <ImageTile key={item.id} url={item.imageUrl} title={item.title} description={item.description} />
          ))
        )}
      </View>
    </Screen>
  );
}
