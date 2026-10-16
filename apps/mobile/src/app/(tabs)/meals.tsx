import { router } from 'expo-router';
import { Button, Card, EmptyState, ErrorState, FAB_CLEARANCE, FloatingChatButton, LoadingState, MealPlanView, PressableCard, Screen, Section, Text } from '@/components';
import { useMealPlan, useMealPlans } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** WF-10 entry: plan prompt, then the current plan's weekly timetable and shopping list; older plans stay as history. */
export default function Meals() {
  const plans = useMealPlans();
  const active = plans.data?.find((p) => p.status === 'active');
  const current = useMealPlan(active?.id);
  if (plans.isPending) return <LoadingState />;
  if (plans.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(plans.error)} onRetry={() => plans.refetch()} />
      </Screen>
    );

  const past = plans.data.filter((p) => p.status !== 'active');

  return (
    <Screen
      refreshing={plans.isRefetching}
      onRefresh={() => Promise.all([plans.refetch(), current.refetch()])}
      overlay={<FloatingChatButton />}
      endInset={FAB_CLEARANCE}
    >
      <Card tone="brand" style={{ padding: 20, gap: 12, backgroundColor: '#F5D9E8' }}>
        <Text variant="title">Let's plan your week with Mova.</Text>
        <Text variant="body" color="inkSecondary">
          Plan your meals around your preferences and routine.
        </Text>
        <Button label="Plan my meals" variant="brand" fullWidth onPress={() => router.push('/meal/new')} />
      </Card>

      {!active ? (
        <EmptyState
          mood="nutrition"
          title="No meal plan yet"
          body="Tell the AI your goal, location, foods you like and budget. You'll get a timetable and shopping list to review — no calorie counting."
        />
      ) : (
        <Section title="Your weekly plan">
          {current.isPending ? <LoadingState /> : null}
          {current.isError ? <ErrorState message={errorMessage(current.error)} onRetry={() => current.refetch()} /> : null}
          {current.data ? <MealPlanView plan={current.data} /> : null}
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
