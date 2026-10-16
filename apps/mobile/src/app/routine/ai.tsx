import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Appear, Banner, Button, ThinkingIndicator, Chip, Mascot, Row, Screen, Segmented, Text, TextField } from '@/components';
import { AIDisclaimer } from '@/components/domain';
import { useGenerateRoutineProposal, useGoals, useRoutines } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { useDraft } from '@/lib/drafts';

/** WF-03 entry: describe what you want; the AI drafts a proposal for review. */
export default function RoutineWithAi() {
  const params = useLocalSearchParams<{ routineId?: string; reviewId?: string }>();
  const goals = useGoals();
  const routines = useRoutines();
  const generate = useGenerateRoutineProposal();
  const draft = useDraft('routine-request', '');
  const [mode, setMode] = useState<'new' | 'adjust' | 'replace'>(params.routineId ? 'adjust' : 'new');
  const [target, setTarget] = useState<string | undefined>(params.routineId);
  const [goalIds, setGoalIds] = useState<string[]>([]);

  function submit() {
    generate.mutate(
      {
        request: draft.value,
        mode,
        targetRoutineId: mode === 'new' ? undefined : target,
        goalIds,
        monthlyReviewId: params.reviewId,
      },
      {
        onSuccess: (p) => {
          void draft.clear();
          router.replace(`/proposal/routine/${p.id}`);
        },
      },
    );
  }

  const activeRoutines = routines.data?.filter((r) => r.status === 'active') ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Create with AI' }} />
      <Mascot mood="planning" size={96} />
      <Text variant="small" color="inkSecondary">
        Describe your goal, available days, equipment and anything to avoid. I'll ask if something essential is missing. Nothing is
        scheduled until you review and approve the proposal.
      </Text>
      {params.reviewId ? <Banner tone="info" title="Based on your monthly review">The proposal will use your saved review as context.</Banner> : null}
      {activeRoutines.length > 0 ? (
        <Segmented
          label="What should this do?"
          options={[
            { value: 'new', label: 'New routine' },
            { value: 'adjust', label: 'Adjust existing' },
            { value: 'replace', label: 'Replace existing' },
          ]}
          value={mode}
          onChange={setMode}
        />
      ) : null}
      {mode !== 'new' ? (
        <Row style={{ flexWrap: 'wrap' }}>
          {activeRoutines.map((r) => (
            <Chip key={r.id} label={r.title} selected={target === r.id} onPress={() => setTarget(r.id)} />
          ))}
        </Row>
      ) : null}
      {goals.data && goals.data.length > 0 ? (
        <>
          <Text variant="label">Link to goals (optional)</Text>
          <Row style={{ flexWrap: 'wrap' }}>
            {goals.data.map((g) => (
              <Chip
                key={g.id}
                label={g.title}
                selected={goalIds.includes(g.id)}
                onPress={() => setGoalIds((ids) => (ids.includes(g.id) ? ids.filter((x) => x !== g.id) : [...ids, g.id]))}
              />
            ))}
          </Row>
        </>
      ) : null}
      <TextField
        label="Your request"
        placeholder="e.g. Four sessions a week — upper/lower split plus one easy run. Mon, Tue, Thu, Sat. Dumbbells and a barbell at the gym."
        value={draft.value}
        onChangeText={draft.setValue}
        multiline
      />
      {generate.isError ? (
        <Appear>
          <Banner tone="error">{errorMessage(generate.error)}</Banner>
        </Appear>
      ) : null}
      {generate.isPending ? (
        <Appear>
          <ThinkingIndicator label="Drafting your routine" />
        </Appear>
      ) : null}
      <Button
        label="Draft my routine"
        variant="brand"
        fullWidth
        loading={generate.isPending}
        disabled={draft.value.trim().length < 5 || (mode !== 'new' && !target)}
        onPress={submit}
      />
      <AIDisclaimer />
    </Screen>
  );
}
