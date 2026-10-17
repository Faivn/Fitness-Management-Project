import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { groupMealsByDay, mealPlanSchema, type MealPlanDraft } from '@mova/shared';
import { Appear, Banner, Button, Card, ErrorState, LoadingState, Row, Screen, Section, Text, TextField } from '@/components';
import { ProposalBanner } from '@/components/domain';
import { useApproveMealPlan, useEditMealProposal, useMealProposal, useRejectProposal, useReviseMealProposal } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { validate } from '@/lib/validation';
import { spacing } from '@/theme/tokens';

/** WF-10 review: edit meals, ask for changes, approve the exact version shown. */
export default function MealProposalReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposal = useMealProposal(id);
  const edit = useEditMealProposal();
  const revise = useReviseMealProposal();
  const approve = useApproveMealPlan();
  const reject = useRejectProposal('meal-plan-proposals');
  const [instruction, setInstruction] = useState('');
  const [editing, setEditing] = useState<MealPlanDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [key] = useState(newIdempotencyKey);

  if (proposal.isPending) return <LoadingState />;
  if (proposal.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(proposal.error)} onRetry={() => proposal.refetch()} />
      </Screen>
    );
  const p = proposal.data;
  const draft = p.status === 'draft';
  const plan = editing ?? p.plan;

  function saveEdits() {
    if (!editing) return;
    const v = validate(mealPlanSchema, editing);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    edit.mutate({ id, version: p.version, plan: v.data }, { onSuccess: () => setEditing(null) });
  }

  return (
    <Screen
      footer={
        draft && p.plan && !editing ? (
          <>
            <Button
              label="Approve meal plan"
              fullWidth
              loading={approve.isPending}
              onPress={() => approve.mutate({ id, version: p.version, idempotencyKey: key }, { onSuccess: (m) => router.replace(`/meal/${m.id}`) })}
            />
            <Button label="Reject" variant="ghost" fullWidth loading={reject.isPending} onPress={() => reject.mutate(id, { onSuccess: () => router.back() })} />
          </>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Review meal plan' }} />
      <Appear variant="card">
        <ProposalBanner version={p.version} status={p.status} />
      </Appear>
      {p.clarifyingQuestions.length ? (
        <Card tone="brand">
          <Text variant="label">A few questions first</Text>
          {p.clarifyingQuestions.map((q) => (
            <Text key={q} variant="small">
              • {q}
            </Text>
          ))}
        </Card>
      ) : null}

      {plan ? (
        <>
          <Text variant="title">{plan.title}</Text>
          <Text variant="small" color="inkSecondary">
            {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
            {plan.goalContext ? ` · ${plan.goalContext}` : ''}
          </Text>
          {groupMealsByDay(plan.entries.map((e, index) => ({ ...e, index }))).map(([day, entries]) => (
            <Section key={day} title={formatDate(day)}>
              {entries.map((e) => (
                <Card key={e.index}>
                  <Text variant="caption" color="brandDeep">
                    {e.slot.toUpperCase()}
                    {e.isSmoothie ? ' · SMOOTHIE' : ''}
                  </Text>
                  {editing ? (
                    <>
                      <TextField
                        label="Meal"
                        value={e.mealName}
                        error={errors[`entries.${e.index}.mealName`]}
                        onChangeText={(mealName) => setEditing({ ...editing, entries: editing.entries.map((x, i) => (i === e.index ? { ...x, mealName } : x)) })}
                      />
                      <TextField
                        label="Description"
                        value={e.description ?? ''}
                        onChangeText={(description) => setEditing({ ...editing, entries: editing.entries.map((x, i) => (i === e.index ? { ...x, description } : x)) })}
                      />
                    </>
                  ) : (
                    <>
                      <Text variant="bodyStrong">{e.mealName}</Text>
                      {e.description ? (
                        <Text variant="small" color="inkSecondary">
                          {e.description}
                        </Text>
                      ) : null}
                      {e.ingredients.length ? (
                        <Text variant="caption" color="inkTertiary">
                          {e.ingredients.map((i) => [i.quantity, i.unit, i.name].filter(Boolean).join(' ')).join(', ')}
                        </Text>
                      ) : null}
                    </>
                  )}
                </Card>
              ))}
            </Section>
          ))}
          {!editing ? (
            <Section title="Shopping list preview">
              <Text variant="caption" color="inkTertiary">
                The list is rebuilt from approved meals.
              </Text>
              <View style={{ gap: spacing.xs }}>
                {plan.shoppingList.map((i, k) => (
                  <Text key={k} variant="small">
                    • {[i.quantity, i.unit, i.name].filter(Boolean).join(' ')}
                    {i.category ? ` (${i.category})` : ''}
                  </Text>
                ))}
              </View>
            </Section>
          ) : null}
          {plan.assumptions.length ? <Banner tone="info" title="Assumptions to check">{plan.assumptions.map((a) => `• ${a}`).join('\n')}</Banner> : null}
        </>
      ) : null}

      {draft && editing ? (
        <Row>
          <Button label="Save changes" loading={edit.isPending} onPress={saveEdits} />
          <Button label="Discard" variant="ghost" onPress={() => setEditing(null)} />
        </Row>
      ) : null}
      {draft && !editing ? (
        <>
          {p.plan ? <Button label="Edit meals" variant="secondary" onPress={() => setEditing(structuredClone(p.plan!))} /> : null}
          <Section title={p.plan ? 'Ask for changes' : 'Answer or add detail'}>
            <TextField label="Instruction" placeholder="e.g. Swap Tuesday dinner for fish pepper soup" value={instruction} onChangeText={setInstruction} multiline />
            {revise.isError ? <Banner tone="error">{errorMessage(revise.error)}</Banner> : null}
            <Button
              label="Update plan"
              variant="secondary"
              loading={revise.isPending}
              disabled={!instruction.trim()}
              onPress={() => revise.mutate({ id, version: p.version, instruction }, { onSuccess: () => setInstruction('') })}
            />
          </Section>
        </>
      ) : null}
      {edit.isError ? <Banner tone="error">{errorMessage(edit.error)}</Banner> : null}
      {approve.isError ? <Banner tone="error">{errorMessage(approve.error)}</Banner> : null}
    </Screen>
  );
}
