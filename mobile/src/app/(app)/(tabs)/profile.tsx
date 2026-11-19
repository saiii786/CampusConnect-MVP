/**
 * My profile (T2.7, redesigned in Phase 9A): profile card, Student badge prompt, grouped menus
 * (my activity, my profile, help & legal, account), portfolio strip, reviews about me.
 * Development builds add a "Developer" group with the server status.
 */
import { formatPaise, PORTFOLIO_MAX_ITEMS } from '@cc/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { shareWorkRecord, MyReviews } from '@/components/reviews/my-reviews';
import {
  AppText,
  Avatar,
  Button,
  Chip,
  ErrorState,
  Icon,
  IconButton,
  ListGroup,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { getApiBaseUrl } from '@/config/api-url';
import { describeError } from '@/lib/api/api-error';
import { useServerHealth } from '@/lib/api/health';
import { resolveMediaUrl } from '@/lib/api/media-url';
import { session, useSession } from '@/lib/auth/session';
import { useNotificationCount } from '@/lib/notifications/notifications-api';
import { useDeletePortfolioItem, usePortfolio } from '@/lib/users/users-api';
import { useWallet } from '@/lib/wallet/wallet-api';
import { useTheme } from '@/theme/use-theme';

const TILE = 120;

function DeveloperGroup() {
  const health = useServerHealth();
  const status = health.isPending ? 'Checking…' : health.isError ? 'Not reachable' : 'Connected';
  return (
    <ListGroup title="Developer (only in development builds)">
      <ListRow icon="pulse-outline" title={`Server: ${status}`} subtitle={getApiBaseUrl()} value="Check" onPress={() => void health.refetch()} />
    </ListGroup>
  );
}

export default function MyProfileScreen() {
  const { colors, radius, spacing } = useTheme();
  const user = useSession((s) => s.user);
  const portfolio = usePortfolio();
  const removeItem = useDeletePortfolioItem();
  const wallet = useWallet();
  const notifications = useNotificationCount();

  if (!user) return <Screen><LoadingState /></Screen>;
  const { profile, student } = user;
  const items = portfolio.data ?? [];
  const place = [profile.collegeName, profile.city].filter(Boolean).join(' · ');

  const portfolioOptions = (id: string, title: string) =>
    Alert.alert(title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove from portfolio',
        style: 'destructive',
        onPress: () => removeItem.mutate(id, { onError: (e) => Alert.alert('Could not remove', describeError(e)) }),
      },
    ]);

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You can sign in again any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void session.signOut() },
    ]);

  return (
    <Screen>
      {/* Profile card */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm }}>
        <Avatar name={profile.displayName} url={profile.avatarUrl} size={72} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="heading" numberOfLines={2}>
            {profile.displayName}
          </AppText>
          {place ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {place}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {student.verified ? <Chip label="Student ✓" tone="success" /> : null}
            {user.emailVerified ? <Chip label="Email verified" tone="primary" /> : <Chip label="Email not verified" />}
          </View>
        </View>
        <IconButton icon="create-outline" label="Edit profile" onPress={() => router.push('/profile/edit')} />
      </View>

      {!user.emailVerified ? (
        <Button label="Verify your email" onPress={() => router.push('/verify-email')} />
      ) : null}

      {!student.verified ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={student.pendingEmail ? 'Enter your Student badge code' : 'Get the Student badge'}
          onPress={() => router.push('/profile/student')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: pressed ? colors.primarySoft : colors.accentSoft,
          })}
        >
          <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="school-outline" size={22} color="onAccent" />
          </View>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="label">{student.pendingEmail ? 'Enter your Student badge code' : 'Are you a student?'}</AppText>
            <AppText variant="caption" color="textMuted">
              {student.pendingEmail ? `We sent a code to ${student.pendingEmail}.` : 'Verify your college email — buyers who hire students will see the badge.'}
            </AppText>
          </View>
          <Icon name="chevron-forward" size={18} color="textMuted" />
        </Pressable>
      ) : null}

      <ListGroup title="My activity">
        <ListRow icon="albums-outline" title="My listings" subtitle="Services and job requests you posted" onPress={() => router.push('/my-listings')} />
        <ListRow icon="pricetags-outline" title="My quotes" subtitle="Quotes you sent on job requests" onPress={() => router.push('/my-quotes')} />
        <ListRow
          icon="wallet-outline"
          title="Wallet"
          subtitle="Test-mode money for safe payments"
          value={wallet.data ? formatPaise(wallet.data.balancePaise) : undefined}
          onPress={() => router.push('/wallet')}
        />
        <ListRow
          icon="notifications-outline"
          title="Notifications"
          value={notifications.data?.unreadCount ? `${notifications.data.unreadCount} new` : undefined}
          onPress={() => router.push('/notifications')}
        />
      </ListGroup>

      <ListGroup title="My profile">
        <ListRow icon="person-outline" title="Edit profile" subtitle="Photo, bio, skills, city" onPress={() => router.push('/profile/edit')} />
        <ListRow icon="eye-outline" title="See my public profile" onPress={() => router.push({ pathname: '/users/[id]', params: { id: user.id } })} />
        <ListRow
          icon="share-social-outline"
          title="Share my work record"
          subtitle="A public page of your completed jobs — for your CV"
          onPress={() => shareWorkRecord(user.id, profile.displayName)}
        />
        {student.verified ? (
          <ListRow icon="school-outline" title="Student badge" value="Verified" onPress={() => router.push('/profile/student')} />
        ) : null}
      </ListGroup>

      {/* Portfolio strip */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title={`Portfolio · ${items.length}/${PORTFOLIO_MAX_ITEMS}`}
          action={items.length < PORTFOLIO_MAX_ITEMS ? 'Add work' : undefined}
          onAction={() => router.push('/profile/add-work')}
        />
        {portfolio.isPending ? (
          <LoadingState />
        ) : portfolio.isError ? (
          <ErrorState error={portfolio.error} onRetry={() => portfolio.refetch()} />
        ) : items.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add your first work to the portfolio"
            onPress={() => router.push('/profile/add-work')}
            style={({ pressed }) => ({
              alignItems: 'center',
              gap: spacing.xs,
              padding: spacing.lg,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.borderStrong,
              backgroundColor: pressed ? colors.primarySoft : 'transparent',
            })}
          >
            <Icon name="images-outline" size={28} color="primary" />
            <AppText variant="label">Add your first work</AppText>
            <AppText variant="caption" color="textMuted" align="center">
              Photos of what you have done — paintings, dishes, code, repairs…
            </AppText>
          </Pressable>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -spacing.lg }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
          >
            {items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. Options`}
                onPress={() => portfolioOptions(item.id, item.title)}
                style={{ width: TILE, gap: spacing.xs }}
              >
                <Image
                  source={{ uri: resolveMediaUrl(item.imageUrl) }}
                  style={{ width: TILE, height: TILE, borderRadius: radius.md, backgroundColor: colors.surface }}
                  contentFit="cover"
                  transition={150}
                />
                <AppText variant="caption" numberOfLines={2}>
                  {item.title}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <MyReviews userId={user.id} />

      <ListGroup title="Help & legal">
        <ListRow icon="document-text-outline" title="Terms of service" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
        <ListRow icon="lock-closed-outline" title="Privacy policy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
        <ListRow icon="shield-checkmark-outline" title="Community guidelines" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'guidelines' } })} />
      </ListGroup>

      <ListGroup title="Account">
        <ListRow icon="log-out-outline" title="Sign out" onPress={confirmSignOut} />
        <ListRow icon="trash-outline" title="Delete my account" tone="danger" onPress={() => router.push('/profile/delete-account')} />
      </ListGroup>

      {__DEV__ ? <DeveloperGroup /> : null}

      <AppText variant="caption" color="textMuted" align="center" style={{ paddingBottom: spacing.md }}>
        Connect · India&apos;s freelance platform for all
      </AppText>
    </Screen>
  );
}
