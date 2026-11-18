/**
 * Home for signed-in users (placeholder until Phase 3 adds the feed). Greets the user, prompts
 * for email verification (FR-003) and profile completion, links to "My profile", offers sign-out.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { ServerStatusCard } from '@/components/server-status-card';
import { AppText, Avatar, Button, Notice, Screen } from '@/components/ui';
import { session, useSession } from '@/lib/auth/session';
import { useTheme } from '@/theme/use-theme';

export default function HomeScreen() {
  const { spacing } = useTheme();
  const user = useSession((s) => s.user);
  const name = user?.profile.displayName || 'there';
  const profileIncomplete = !!user && (!user.profile.avatarUrl || user.profile.skills.length === 0);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
        <Avatar name={name} url={user?.profile.avatarUrl} size={56} />
        <View style={{ flex: 1 }}>
          <AppText variant="title">Hi, {name} 👋</AppText>
          <AppText color="textMuted">{user?.email}</AppText>
        </View>
      </View>

      {user && !user.emailVerified ? (
        <Notice
          tone="warning"
          title="Verify your email"
          message="We sent a 6-digit code to your email. You need to verify before you can post or order."
        >
          <Button label="Enter code" fullWidth={false} onPress={() => router.push('/verify-email')} />
        </Notice>
      ) : null}

      {profileIncomplete ? (
        <Notice
          title="Complete your profile"
          message="Add a photo and your skills so people know what you can do. Students can also get the Student badge."
        >
          <Button label="Go to my profile" fullWidth={false} onPress={() => router.push('/profile')} />
        </Notice>
      ) : (
        <Button label="My profile" variant="secondary" onPress={() => router.push('/profile')} />
      )}

      <AppText color="textMuted">Posting jobs, offering services and finding work arrive in the next updates.</AppText>

      {__DEV__ ? <ServerStatusCard /> : null}

      <Button label="Sign out" variant="ghost" onPress={() => session.signOut()} />
    </Screen>
  );
}
