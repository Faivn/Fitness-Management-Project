import { router } from 'expo-router';
import { addDays, todayIn } from '@mova/shared';
import { Button, Card, EmptyState, ErrorState, LoadingState, PressableCard, Row, Screen, Section, StatusBadge, Text } from '@/components';
import { ProposalBanner, SessionCard } from '@/components/domain';
import { useProfile, useRoutineProposals, useRoutines, useSessions } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { DAY_SHORT } from '@/lib/format';

/** Workouts: routines (AI or manual — same model), drafts awaiting review, upcoming sessions. */
export default function Workouts() {
  const profile = useProfile();
  const today = todayIn(profile.data?.timezone ?? 'UTC');
  const routines = useRoutines();
  const proposals = useRoutineProposals();
  const upcoming = useSessions(today, addDays(today, 13));

  if (routines.isPending) return <LoadingState />;
  if (routines.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(routines.error)} onRetry={() => routines.refetch()} />
      </Screen>
    );

  return (
    <Screen refreshing={routines.isRefetching} onRefresh={() => Promise.all([routines.refetch(), proposals.refetch(), upcoming.refetch()])}>
      <Row style={{ flexWrap: 'wrap' }}>
        <Button label="Create with AI" variant="brand" onPress={() => router.push('/routine/ai')} />
        <Button label="Build manually" variant="secondary" onPress={() => router.push('/routine/edit')} />
      </Row>

      {proposals.data && proposals.data.length > 0 ? (
        <Section title="Waiting for your review">
          {proposals.data.map((p) => (
            <PressableCard key={p.id} accessibilityLabel={`Review proposal ${p.plan?.title ?? ''}`} onPress={() => router.push(`/proposal/routine/${p.id}`)}>
              <ProposalBanner version={p.version} status={p.status} />
              <Text variant="heading">{p.plan?.title ?? 'Needs a few answers first'}</Text>
            </PressableCard>
          ))}
        </Section>
      ) : null}

      <Section title="Your routines">
        {routines.data.length === 0 ? (
          <EmptyState mood="planning" title="No routines yet" body="Your routines will appear here, whether the AI drafted them or you built them." />
        ) : (
          routines.data.map((r) => (
            <PressableCard key={r.id} accessibilityLabel={`Routine ${r.title}`} onPress={() => router.push(`/routine/${r.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="caption" color="inkTertiary">
                  {r.source === 'ai' ? 'Created with AI' : 'Built manually'} · v{r.currentVersion}
                </Text>
                <Text variant="caption" color={r.status === 'active' ? 'positive' : 'inkTertiary'}>
                  {r.status === 'active' ? 'Active' : 'Draft'}
                </Text>
              </Row>
              <Text variant="heading">{r.title}</Text>
              <Text variant="small" color="inkSecondary">
                {r.plan.sessions.map((s) => `${DAY_SHORT[s.dayOfWeek]} ${s.title}`).join(' · ')}
              </Text>
            </PressableCard>
          ))
        )}
      </Section>

      <Section title="Next two weeks" action={<Button label="Exercise history" size="sm" variant="ghost" onPress={() => router.push('/records')} />}>
        {upcoming.isError ? <ErrorState message={errorMessage(upcoming.error)} onRetry={() => upcoming.refetch()} /> : null}
        {upcoming.data?.filter((s) => s.plannedDate).length === 0 ? (
          <Card tone="subtle">
            <Text variant="small" color="inkSecondary">
              Nothing scheduled.
            </Text>
          </Card>
        ) : null}
        {upcoming.data
          ?.filter((s) => s.plannedDate)
          .map((s) => <SessionCard key={s.id} session={s} showDate />)}
      </Section>
      <StatusLegend />
    </Screen>
  );
}

function StatusLegend() {
  return (
    <Row style={{ flexWrap: 'wrap' }}>
      <StatusBadge status="scheduled" />
      <StatusBadge status="completed" />
      <StatusBadge status="missed" />
      <StatusBadge status="spontaneous" />
    </Row>
  );
}
