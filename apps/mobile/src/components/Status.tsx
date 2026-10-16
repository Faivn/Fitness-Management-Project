import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import type { SessionStatus, SummaryOutcome } from '@mova/shared';
import { colors, radii, spacing } from '@/theme/tokens';
import { RuneIcon, type RuneIconName } from './RuneIcon';
import { Text } from './Text';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const STATUS: Record<SessionStatus | SummaryOutcome, { label: string; icon: RuneIconName; fg: keyof typeof colors; bg: string }> = {
  scheduled: { label: 'Planned', icon: 'schedule', fg: 'inkSecondary', bg: colors.surfaceSubtle },
  upcoming: { label: 'Upcoming', icon: 'schedule', fg: 'inkSecondary', bg: colors.surfaceSubtle },
  in_progress: { label: 'In progress', icon: 'play', fg: 'info', bg: colors.infoWash },
  completed: { label: 'Completed', icon: 'circle-check', fg: 'positive', bg: colors.positiveWash },
  incomplete: { label: 'Incomplete', icon: 'circle-dot', fg: 'warning', bg: colors.warningWash },
  missed: { label: 'Missed', icon: 'circle-alert', fg: 'warning', bg: colors.warningWash },
  cancelled: { label: 'Cancelled', icon: 'circle-x', fg: 'inkTertiary', bg: colors.surfaceSubtle },
  not_recorded: { label: 'Not recorded', icon: 'circle-question', fg: 'inkTertiary', bg: colors.surfaceSubtle },
  spontaneous: { label: 'Spontaneous', icon: 'bolt', fg: 'brandDeep', bg: colors.brandWash },
  historical_entry: { label: 'Added later', icon: 'clock', fg: 'brandDeep', bg: colors.brandWash },
};

/** Status is always icon + text, never colour alone (§10 accessibility). */
export function StatusBadge({ status }: { status: SessionStatus | SummaryOutcome }) {
  const s = STATUS[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]} accessibilityLabel={`Status: ${s.label}`}>
      <RuneIcon name={s.icon} size={14} color={s.fg} />
      <Text variant="caption" color={s.fg}>
        {s.label}
      </Text>
    </View>
  );
}

export function statusLabel(status: SessionStatus | SummaryOutcome): string {
  return STATUS[status].label;
}

export function Icon({ name, size = 20, color = 'ink' }: { name: IconName; size?: number; color?: keyof typeof colors }) {
  return <Ionicons name={name} size={size} color={colors[color]} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
});
