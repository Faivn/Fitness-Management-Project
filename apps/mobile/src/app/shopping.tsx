import { EmptyState, ErrorState, LoadingState, Screen, SheetPage, ShoppingList } from '@/components';
import { useMealPlan, useMealPlans } from '@/hooks/api';
import { errorMessage } from '@/lib/api';

/** The active meal plan's shopping list, opened from the Meal plan header. */
function ShoppingBody() {
  const plans = useMealPlans();
  const active = plans.data?.find((p) => p.status === 'active');
  const plan = useMealPlan(active?.id);
  if (plans.isPending || (active && plan.isPending)) return <LoadingState />;
  if (plans.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(plans.error)} onRetry={() => plans.refetch()} />
      </Screen>
    );
  return (
    <Screen>
      {plan.data ? (
        plan.data.shoppingList.length === 0 && plan.data.status !== 'active' ? (
          <EmptyState mood="nutrition" title="Nothing to buy yet" body="Items from your meal plan will appear here." />
        ) : (
          <ShoppingList planId={plan.data.id} items={plan.data.shoppingList} editable={plan.data.status === 'active'} />
        )
      ) : (
        <EmptyState mood="nutrition" title="No meal plan yet" body="Once you have a meal plan, its shopping list lives here." />
      )}
    </Screen>
  );
}

export default function ShoppingSheet() {
  return (
    <SheetPage title="Shopping list">
      <ShoppingBody />
    </SheetPage>
  );
}
