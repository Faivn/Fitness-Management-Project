import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { groupMealsByWeekday, WEEKDAY_NAMES, type MealPlan, type ShoppingListItemDto } from '@mova/shared';
import { useAddShoppingItem, useDeleteShoppingItem, useUpdateShoppingItem } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { colors, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { Button } from './Button';
import { ExpandableCard, UnderlineTabs } from './controls';
import { TextField } from './Form';
import { Banner } from './States';
import { Card, Divider, Row } from './Layout';
import { RuneIcon } from './RuneIcon';
import { Text } from './Text';

/**
 * Weekly plan: a Timetable / Shopping list switch. The timetable is a
 * recurring Monday–Sunday week (first day open, the rest collapsed).
 * Ticking a shopping item is shopping state — never a record of eating.
 */
export function MealPlanView({ plan }: { plan: MealPlan }) {
  const [tab, setTab] = useState<'timetable' | 'shopping'>('timetable');
  const byWeekday = new Map(groupMealsByWeekday(plan.entries));
  const firstDay = [...byWeekday.keys()][0];
  return (
    <View style={{ gap: spacing.base }}>
      <UnderlineTabs
        tabs={[
          { key: 'timetable', label: 'Timetable' },
          { key: 'shopping', label: `Shopping list (${plan.shoppingList.filter((i) => !i.checked).length})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'timetable' ? (
        WEEKDAY_NAMES.map((name, wd) => {
          const entries = byWeekday.get(wd) ?? [];
          return (
            <ExpandableCard key={name} title={name} defaultExpanded={wd === firstDay}>
              {entries.length === 0 ? (
                <Text variant="small" color="inkTertiary">
                  Nothing planned.
                </Text>
              ) : (
                entries.map((e, i) => (
                  <View key={e.id}>
                    {i > 0 ? <Divider /> : null}
                    <Text variant="caption" color="brandDeep">
                      {e.slot.toUpperCase()}
                      {e.isSmoothie ? ' · SMOOTHIE' : ''}
                    </Text>
                    <Text variant="body">{e.mealName}</Text>
                    {e.description ? (
                      <Text variant="small" color="inkSecondary">
                        {e.description}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
            </ExpandableCard>
          );
        })
      ) : (
        <ShoppingList planId={plan.id} items={plan.shoppingList} editable={plan.status === 'active'} />
      )}
    </View>
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
                <View style={[styles.box, i.checked && { backgroundColor: colors.positive, borderColor: colors.positive }]}>{i.checked ? <RuneIcon name="check" size={14} color="onInk" /> : null}</View>
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
                  <RuneIcon name="close" size={18} color="inkTertiary" />
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
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.inkSecondary, alignItems: 'center', justifyContent: 'center' },
  item: { minHeight: TOUCH_TARGET },
  check: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});
