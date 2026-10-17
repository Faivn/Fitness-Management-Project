import { router } from 'expo-router';
import { View } from 'react-native';
import { appToday } from '@/lib/today';
import { addDays } from '@mova/shared';
import { Button, Card, Divider, EmptyState, ErrorState, LoadingState, PressableCard, Row, RuneIcon, Screen, Section, Text, TextAction } from '@/components';
import { useExercises, useProfile, useRoutineProposals, useRoutines, useSessions } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { copy } from '@/lib/copy';
import { ACTIVITY_LABELS, DAY_SHORT, formatDate, formatTimeRange } from '@/lib/format';
import { colors, radii, spacing } from '@/theme/tokens';

/** Workouts: drafts awaiting review, routines (AI or manual — same model), upcoming sessions. */
export default function Workouts() {
  const profile = useProfile();
  const today = appToday(profile.data?.timezone ?? 'UTC');
  const routines = useRoutines();
  const proposals = useRoutineProposals();
  const exercises = useExercises();
  const upcoming = useSessions(today, addDays(today, 13));

  if (routines.isPending) return <LoadingState />;
  if (routines.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(routines.error)} onRetry={() => routines.refetch()} />
      </Screen>
    );

  const upcomingList = (upcoming.data ?? [])
    .filter((s) => s.plannedDate)
    .sort((a, b) => `${a.plannedDate}${a.plannedTime ?? ''}`.localeCompare(`${b.plannedDate}${b.plannedTime ?? ''}`));

  return (
    <Screen
      refreshing={routines.isRefetching}
      onRefresh={() => Promise.all([routines.refetch(), proposals.refetch(), upcoming.refetch()])}
    >
      {proposals.data?.map((p) => (
        <PressableCard key={p.id} accessibilityLabel={`Review proposal ${p.plan?.title ?? ''}`} onPress={() => router.push(`/proposal/routine/${p.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="heading">Routine proposal</Text>
            <View style={{ backgroundColor: colors.infoWash, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
              <Text variant="caption" color="info">
                Needs review
              </Text>
            </View>
          </Row>
          <Text variant="bodyStrong">{p.plan?.title ?? 'Needs a few answers first'}</Text>
          <Text variant="small" color="inkTertiary">
            {copy.ai.draftLabel}
          </Text>
        </PressableCard>
      ))}

      <Section title="Your routines">
        {routines.data.length === 0 ? (
          <EmptyState mood="planning" title={copy.empty.routines} />
        ) : (
          routines.data.map((r) => (
            <PressableCard key={r.id} accessibilityLabel={`Routine ${r.title}`} onPress={() => router.push(`/routine/${r.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="caption" color="inkTertiary">
                  {r.status === 'active' ? 'ACTIVE' : 'DRAFT'} · {r.source === 'ai' ? 'FROM COMPANION' : 'MANUAL'}
                </Text>
                <View style={{ backgroundColor: r.status === 'active' ? colors.positiveWash : colors.surfaceSubtle, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                  <Text variant="caption" color={r.status === 'active' ? 'positive' : 'inkTertiary'}>
                    {r.status === 'active' ? 'Active' : 'Draft'}
                  </Text>
                </View>
              </Row>
              <Text variant="heading">{r.title}</Text>
              {r.plan.sessions.map((s, i) => (
                <Text key={i} variant="small" color="inkTertiary">
                  {DAY_SHORT[s.dayOfWeek]} · {s.title}
                </Text>
              ))}
            </PressableCard>
          ))
        )}
      </Section>

      <Divider />

      <Section title="Upcoming workouts">
        {upcoming.isError ? <ErrorState message={errorMessage(upcoming.error)} onRetry={() => upcoming.refetch()} /> : null}
        {upcoming.data && upcomingList.length === 0 ? (
          <Card tone="subtle">
            <Text variant="small" color="inkSecondary">
              Nothing scheduled.
            </Text>
          </Card>
        ) : null}
        {upcomingList.map((s) => (
          <PressableCard key={s.id} accessibilityLabel={`${s.title}, ${formatDate(s.plannedDate)}`} onPress={() => router.push(`/session/${s.id}`)}>
            <Text variant="small" color="inkTertiary">
              {ACTIVITY_LABELS[s.activityType]} · {formatDate(s.plannedDate)}
            </Text>
            <Text variant="heading">{s.title}</Text>
            <Text variant="small" color="inkTertiary">
              {formatTimeRange(s.plannedTime, s.plannedDurationMinutes)}
            </Text>
          </PressableCard>
        ))}
      </Section>

      {(exercises.data?.length ?? 0) > 0 ? (
        <>
          <Divider />
          <TextAction label="Exercise history" onPress={() => router.push('/records')} />
        </>
      ) : null}
    </Screen>
  );
}
