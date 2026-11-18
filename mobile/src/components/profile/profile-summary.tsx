/**
 * Profile header used by both "My profile" and other users' public profiles:
 * photo, name, badges, city/college, rating + completed jobs (public only), bio, skills, languages.
 */
import { View } from 'react-native';
import { AppText, Avatar, Chip, ChipList } from '@/components/ui';
import { useTheme } from '@/theme/use-theme';

export interface ProfileSummaryProps {
  displayName: string;
  avatarUrl: string | null;
  isStudent: boolean;
  emailVerified?: boolean;
  city: string | null;
  collegeName: string | null;
  bio: string | null;
  skills: string[];
  languages: string[];
  stats?: { ratingAverage: number | null; ratingCount: number; completedJobs: number };
}

export function ProfileSummary(p: ProfileSummaryProps) {
  const { spacing } = useTheme();
  const place = [p.collegeName, p.city].filter(Boolean).join(' · ');
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
        <Avatar name={p.displayName} url={p.avatarUrl} size={80} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="heading">{p.displayName}</AppText>
          {place ? <AppText color="textMuted">{place}</AppText> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {p.isStudent ? <Chip label="Student ✓" tone="success" /> : null}
            {p.emailVerified ? <Chip label="Email verified" tone="primary" /> : null}
          </View>
        </View>
      </View>

      {p.stats ? (
        <AppText color="textMuted">
          {p.stats.ratingAverage === null
            ? 'No reviews yet'
            : `★ ${p.stats.ratingAverage.toFixed(1)} (${p.stats.ratingCount} review${p.stats.ratingCount === 1 ? '' : 's'})`}
          {` · ${p.stats.completedJobs} job${p.stats.completedJobs === 1 ? '' : 's'} completed`}
        </AppText>
      ) : null}

      {p.bio ? <AppText>{p.bio}</AppText> : null}

      {p.skills.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">Skills</AppText>
          <ChipList items={p.skills} tone="primary" />
        </View>
      ) : null}
      {p.languages.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">Languages</AppText>
          <ChipList items={p.languages} />
        </View>
      ) : null}
    </View>
  );
}
