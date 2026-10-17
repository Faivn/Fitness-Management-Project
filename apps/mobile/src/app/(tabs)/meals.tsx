import { router } from 'expo-router';
import { EmptyState, ErrorState, LoadingState, MealPlanView, PressableCard, Screen, Section, Text } from '@/components';
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
    >
      {!active ? (
        <EmptyState mood="nutrition" title="No meal plan" body="Ask the companion to draft one." />
      ) : (
        <Section title="This week">
          {current.isPending ? <LoadingState /> : null}
          {current.isError ? <ErrorState message={errorMessage(current.error)} onRetry={() => current.refetch()} /> : null}
          {current.data ? <MealPlanView plan={current.data} hideShopping /> : null}
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
