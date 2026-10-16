import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Card, EmptyState, ErrorState, LoadingState, Row, Screen, Section, Segmented, Text, TextField } from '@/components';
import { useCreateGoal, useGoals, useUpdateGoal } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';

/** Goals: add manually, or ask the AI to revise them (WF-02, WF-16). */
export default function Goals() {
  const goals = useGoals();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [key, setKey] = useState(newIdempotencyKey);

  if (goals.isPending) return <LoadingState />;
  if (goals.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(goals.error)} onRetry={() => goals.refetch()} />
      </Screen>
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Goals' }} />
      <Button label="Talk goals through with the AI" variant="brand" onPress={() => router.push('/companion')} />
      {goals.data.length === 0 ? (
        <EmptyState mood="focus" title="No goals yet" body="Add one below, or describe what you want to achieve to the AI companion." />
      ) : (
        <Section title="Your goals">
          {goals.data.map((g) => (
            <Card key={g.id}>
              <Text variant="bodyStrong">{g.title}</Text>
              <Text variant="small" color="inkSecondary">
                {g.priority} priority · {g.source === 'ai' ? 'suggested by AI, approved by you' : 'added by you'}
                {g.targetValue ? ` · target ${g.targetValue} ${g.targetUnit ?? ''}` : ''}
                {g.targetDate ? ` by ${g.targetDate}` : ''}
              </Text>
              <Row>
                {g.status === 'active' ? <Button label="Mark achieved" size="sm" variant="secondary" onPress={() => update.mutate({ id: g.id, status: 'achieved' })} /> : <Text variant="caption" color="positive">Achieved</Text>}
                <Button label="Archive" size="sm" variant="ghost" onPress={() => update.mutate({ id: g.id, status: 'archived' })} />
              </Row>
            </Card>
          ))}
        </Section>
      )}
      <Section title="Add a goal">
        <TextField label="Goal" value={title} onChangeText={setTitle} placeholder="e.g. Run 5 km without stopping" />
        <Segmented label="Priority" options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} value={priority} onChange={setPriority} />
        <Button
          label="Add goal"
          disabled={!title.trim()}
          loading={create.isPending}
          onPress={() =>
            create.mutate(
              { title: title.trim(), priority, isMeasurable: false, idempotencyKey: key },
              {
                onSuccess: () => {
                  setTitle('');
                  setKey(newIdempotencyKey());
                },
              },
            )
          }
        />
      </Section>
      {create.isError || update.isError ? <Banner tone="error">{errorMessage(create.error ?? update.error)}</Banner> : null}
    </Screen>
  );
}
