import { Stack, useLocalSearchParams } from 'expo-router';
import { ErrorState, FAB_CLEARANCE, FloatingChatButton, LoadingState, MealPlanView, Screen, Text } from '@/components';
import { useMealPlan } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** WF-10 plan screen (older and current plans): the same weekly view as the Meal plan tab. */
export default function MealPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = useMealPlan(id);
  if (plan.isPending) return <LoadingState />;
  if (plan.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />
      </Screen>
    );
  const p = plan.data;
  return (
    <Screen refreshing={plan.isRefetching} onRefresh={() => plan.refetch()} overlay={<FloatingChatButton />} endInset={FAB_CLEARANCE}>
      <Stack.Screen options={{ title: p.title }} />
      <Text variant="small" color="inkSecondary">
        {formatDate(p.startDate)} – {formatDate(p.endDate)} · {p.status === 'active' ? 'Current plan' : 'Archived — kept for your records'}
      </Text>
      {p.goalContext ? <Text variant="small">{p.goalContext}</Text> : null}
      <MealPlanView plan={p} />
    </Screen>
  );
}
