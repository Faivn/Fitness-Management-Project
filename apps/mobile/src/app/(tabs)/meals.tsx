import { router } from 'expo-router';
import { Button, EmptyState, ErrorState, LoadingState, PressableCard, Row, Screen, Section, Text } from '@/components';
import { useMealPlans } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** WF-10 entry: the active plan opens directly; older plans stay as history. */
export default function Meals() {
  const plans = useMealPlans();
  if (plans.isPending) return <LoadingState />;
  if (plans.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(plans.error)} onRetry={() => plans.refetch()} />
      </Screen>
    );

  const active = plans.data.filter((p) => p.status === 'active');
  const past = plans.data.filter((p) => p.status !== 'active');

  return (
    <Screen refreshing={plans.isRefetching} onRefresh={() => plans.refetch()}>
      <Row>
        <Button label="Plan meals with AI" variant="brand" onPress={() => router.push('/meal/new')} />
      </Row>
      {active.length === 0 ? (
        <EmptyState
          mood="nutrition"
          title="No meal plan yet"
          body="Tell the AI your goal, location, foods you like and budget. You'll get a timetable and shopping list to review — no calorie counting."
        />
      ) : (
        <Section title="Current plan">
          {active.map((p) => (
            <PressableCard key={p.id} tone="brand" accessibilityLabel={`Open ${p.title}`} onPress={() => router.push(`/meal/${p.id}`)}>
              <Text variant="heading">{p.title}</Text>
              <Text variant="small" color="inkSecondary">
                {formatDate(p.startDate)} – {formatDate(p.endDate)}
              </Text>
            </PressableCard>
          ))}
        </Section>
      )}
      {past.length > 0 ? (
        <Section title="Previous plans">
          {past.map((p) => (
            <PressableCard key={p.id} accessibilityLabel={`Open ${p.title}`} onPress={() => router.push(`/meal/${p.id}`)}>
              <Text variant="bodyStrong">{p.title}</Text>
              <Text variant="small" color="inkTertiary">
                {formatDate(p.startDate)} – {formatDate(p.endDate)} · {p.status}
              </Text>
            </PressableCard>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
