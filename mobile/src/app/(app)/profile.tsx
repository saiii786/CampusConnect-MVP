/**
 * My profile (T2.7): summary, student badge status, portfolio (add/remove, max 10), and links to
 * edit, preview the public profile, and delete the account.
 */
import { PORTFOLIO_MAX_ITEMS } from '@cc/shared';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { ProfileSummary } from '@/components/profile/profile-summary';
import { AppText, Button, EmptyState, ErrorState, ImageTile, LoadingState, Notice, Screen } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { useSession } from '@/lib/auth/session';
import { useDeletePortfolioItem, usePortfolio } from '@/lib/users/users-api';
import { useTheme } from '@/theme/use-theme';

export default function MyProfileScreen() {
  const { spacing } = useTheme();
  const user = useSession((s) => s.user);
  const portfolio = usePortfolio();
  const removeItem = useDeletePortfolioItem();

  if (!user) return <LoadingState />;
  const { profile, student } = user;

  const confirmRemove = (id: string, title: string) =>
    Alert.alert('Remove from portfolio?', `"${title}" will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removeItem.mutate(id, { onError: (e) => Alert.alert('Could not remove', describeError(e)) }),
      },
    ]);

  const items = portfolio.data ?? [];
  return (
    <Screen>
      <ProfileSummary
        displayName={profile.displayName}
        avatarUrl={profile.avatarUrl}
        isStudent={student.verified}
        emailVerified={user.emailVerified}
        city={profile.city}
        collegeName={profile.collegeName}
        bio={profile.bio}
        skills={profile.skills}
        languages={profile.languages}
      />
      <View style={{ gap: spacing.sm }}>
        <Button label="Edit profile" onPress={() => router.push('/profile/edit')} />
        <Button label="See my public profile" variant="secondary" onPress={() => router.push({ pathname: '/users/[id]', params: { id: user.id } })}
        />
      </View>

      {student.verified ? (
        <Notice tone="success" title="Student badge ✓" message={`Verified with ${student.collegeEmail ?? 'your college email'}.`} />
      ) : (
        <Notice
          title="Are you a student?"
          message={
            student.pendingEmail
              ? `We sent a code to ${student.pendingEmail}. Enter it to get your Student badge.`
              : 'Verify your college email to get the Student badge — buyers looking to hire students will see it.'
          }
        >
          <Button
            label={student.pendingEmail ? 'Enter code' : 'Get the Student badge'}
            fullWidth={false}
            onPress={() => router.push('/profile/student')}
          />
        </Notice>
      )}

      <View style={{ gap: spacing.md }}>
        <AppText variant="heading">
          Portfolio ({items.length}/{PORTFOLIO_MAX_ITEMS})
        </AppText>
        {portfolio.isPending ? (
          <LoadingState />
        ) : portfolio.isError ? (
          <ErrorState error={portfolio.error} onRetry={() => portfolio.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No work added yet" message="Show photos of what you have done — paintings, dishes, code, repairs…" />
        ) : (
          items.map((item) => (
            <ImageTile key={item.id} url={item.imageUrl} title={item.title} description={item.description}>
              <Button
                label="Remove"
                variant="ghost"
                fullWidth={false}
                loading={removeItem.isPending && removeItem.variables === item.id}
                onPress={() => confirmRemove(item.id, item.title)}
              />
            </ImageTile>
          ))
        )}
        {items.length < PORTFOLIO_MAX_ITEMS ? (
          <Button label="Add work" variant="secondary" onPress={() => router.push('/profile/add-work')} />
        ) : null}
      </View>

      <Button label="Delete my account" variant="ghost" onPress={() => router.push('/profile/delete-account')} />
    </Screen>
  );
}
