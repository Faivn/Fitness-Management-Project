import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { groupMealsByDay, type ShoppingListItemDto } from '@mova/shared';
import { Banner, Button, Card, ErrorState, LoadingState, Row, Screen, Section, Segmented, Text, TextField } from '@/components';
import { MealSlotCard } from '@/components/domain';
import { Icon } from '@/components/Status';
import { useAddShoppingItem, useDeleteShoppingItem, useMealPlan, useUpdateShoppingItem } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { colors, spacing, TOUCH_TARGET } from '@/theme/tokens';

/**
 * WF-10 approved plan: timetable by day and a category-grouped shopping list
 * (research: Centr, Recime). Ticking an item is shopping state — not a record
 * of eating anything.
 */
export default function MealPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = useMealPlan(id);
  const [tab, setTab] = useState<'timetable' | 'shopping'>('timetable');
  if (plan.isPending) return <LoadingState />;
  if (plan.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />
      </Screen>
    );
  const p = plan.data;
  return (
    <Screen refreshing={plan.isRefetching} onRefresh={() => plan.refetch()}>
      <Stack.Screen options={{ title: p.title }} />
      <Text variant="small" color="inkSecondary">
        {formatDate(p.startDate)} – {formatDate(p.endDate)} · {p.status === 'active' ? 'Current plan' : 'Archived — kept for your records'}
      </Text>
      {p.goalContext ? <Text variant="small">{p.goalContext}</Text> : null}
      <Segmented
        options={[
          { value: 'timetable', label: 'Timetable' },
          { value: 'shopping', label: `Shopping list (${p.shoppingList.filter((i) => !i.checked).length})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'timetable'
        ? groupMealsByDay(p.entries).map(([day, entries]) => (
            <Section key={day} title={formatDate(day)}>
              {entries.map((e) => (
                <MealSlotCard key={e.id} entry={e} />
              ))}
            </Section>
          ))
        : <ShoppingList planId={p.id} items={p.shoppingList} editable={p.status === 'active'} />}
    </Screen>
  );
}

function ShoppingList({ planId, items, editable }: { planId: string; items: ShoppingListItemDto[]; editable: boolean }) {
  const update = useUpdateShoppingItem(planId);
  const add = useAddShoppingItem(planId);
  const remove = useDeleteShoppingItem(planId);
  const [name, setName] = useState('');
  const [key, setKey] = useState(newIdempotencyKey);
  const groups = new Map<string, ShoppingListItemDto[]>();
  for (const i of items) groups.set(i.category ?? 'Other', [...(groups.get(i.category ?? 'Other') ?? []), i]);

  return (
    <View style={{ gap: spacing.lg }}>
      {[...groups.entries()].map(([cat, list]) => (
        <Card key={cat}>
          <Text variant="label">{cat}</Text>
          {list.map((i) => (
            <Row key={i.id} style={styles.item}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: i.checked }}
                accessibilityLabel={i.name}
                disabled={!editable}
                onPress={() => update.mutate({ id: i.id, checked: !i.checked })}
                style={styles.check}
              >
                <Icon name={i.checked ? 'checkbox' : 'square-outline'} size={22} color={i.checked ? 'positive' : 'inkSecondary'} />
              </Pressable>
              <Text variant="body" style={{ flex: 1, textDecorationLine: i.checked ? 'line-through' : 'none', color: i.checked ? colors.inkTertiary : colors.ink }}>
                {i.name}
              </Text>
              {i.quantity !== null ? (
                <Text variant="small" color="inkSecondary">
                  {i.quantity}
                  {i.unit ? ` ${i.unit}` : ''}
                </Text>
              ) : null}
              {editable ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${i.name}`} onPress={() => remove.mutate(i.id)} hitSlop={8}>
                  <Icon name="close" size={18} color="inkTertiary" />
                </Pressable>
              ) : null}
            </Row>
          ))}
        </Card>
      ))}
      {editable ? (
        <Card tone="subtle">
          <TextField label="Add an item" value={name} onChangeText={setName} placeholder="e.g. Ginger" />
          <Button
            label="Add"
            size="sm"
            disabled={!name.trim()}
            loading={add.isPending}
            onPress={() =>
              add.mutate(
                { name: name.trim(), idempotencyKey: key },
                {
                  onSuccess: () => {
                    setName('');
                    setKey(newIdempotencyKey());
                  },
                },
              )
            }
          />
        </Card>
      ) : null}
      {update.isError || add.isError || remove.isError ? <Banner tone="error">{errorMessage(update.error ?? add.error ?? remove.error)}</Banner> : null}
      <Text variant="caption" color="inkTertiary">
        Ticking items is just for shopping — Mova never treats planned meals as eaten.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { minHeight: TOUCH_TARGET },
  check: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});
