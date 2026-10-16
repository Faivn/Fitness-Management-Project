import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { isLocalDate, todayIn, type MonthlyReviewDraft } from '@mova/shared';
import { Banner, Button, Card, Mascot, Row, Screen, Section, StatusBadge, Text, TextField } from '@/components';
import { AIDisclaimer } from '@/components/domain';
import { useGenerateReview, useProfile, useSaveReview } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { formatDate, monthBounds } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/**
 * WF-15 monthly review: summarise an explicit period from stored records,
 * let the user correct it and add a reflection, save it, then (optionally)
 * ask for a next-period plan. Source logs are never changed.
 */
export default function NewReview() {
  const params = useLocalSearchParams<{ start?: string; end?: string }>();
  const profile = useProfile();
  const bounds = monthBounds(todayIn(profile.data?.timezone ?? 'UTC'));
  const [start, setStart] = useState(params.start ?? bounds.start);
  const [end, setEnd] = useState(params.end ?? bounds.end);
  const [reflection, setReflection] = useState('');
  const [draft, setDraft] = useState<MonthlyReviewDraft | null>(null);
  const [text, setText] = useState('');
  const [key] = useState(newIdempotencyKey);
  const generate = useGenerateReview();
  const save = useSaveReview();

  const rangeError = !isLocalDate(start) || !isLocalDate(end) || start > end ? 'Enter a valid period (YYYY-MM-DD, start before end).' : undefined;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Monthly review' }} />
      <Row>
        <Mascot mood="checklist" size={72} />
        <Text variant="small" color="inkSecondary" style={{ flex: 1 }}>
          I'll summarise what you planned, completed, moved, missed and did spontaneously — only from what's recorded.
        </Text>
      </Row>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField label="From" value={start} onChangeText={setStart} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="To" value={end} onChangeText={setEnd} error={rangeError} />
        </View>
      </Row>
      <TextField label="Your reflection (optional)" placeholder="How did the month feel? What got in the way?" value={reflection} onChangeText={setReflection} multiline />
      <Button
        label={draft ? 'Regenerate summary' : 'Summarise this period'}
        variant="brand"
        disabled={!!rangeError}
        loading={generate.isPending}
        onPress={() =>
          generate.mutate(
            { periodStart: start, periodEnd: end, reflection: reflection || undefined },
            {
              onSuccess: (d) => {
                setDraft(d);
                setText(d.narrative);
              },
            },
          )
        }
      />
      {generate.isError ? <Banner tone="error">{errorMessage(generate.error)}</Banner> : null}

      {draft ? (
        <>
          {!draft.aiAvailable && !draft.summary.isEmpty ? (
            <Banner tone="info" title="Plain summary">
              The AI wasn't available, so this is a factual summary of your records. You can edit it before saving.
            </Banner>
          ) : null}
          <Card>
            <Text variant="label">
              {formatDate(draft.periodStart)} – {formatDate(draft.periodEnd)}
            </Text>
            <Row style={{ flexWrap: 'wrap', gap: spacing.md }}>
              <Count label="Planned" n={draft.summary.counts.planned} />
              <Count label="Completed" n={draft.summary.counts.completed} />
              <Count label="Moved" n={draft.summary.counts.rescheduled} />
              <Count label="Missed" n={draft.summary.counts.missed} />
              <Count label="Cancelled" n={draft.summary.counts.cancelled} />
              <Count label="Spontaneous" n={draft.summary.counts.spontaneous + draft.summary.counts.historicalEntries} />
              <Count label="Not recorded" n={draft.summary.counts.notRecorded} />
            </Row>
          </Card>
          {draft.observations.length ? (
            <Section title="Observations">
              {draft.observations.map((o) => (
                <Text key={o} variant="small">
                  • {o}
                </Text>
              ))}
            </Section>
          ) : null}
          <TextField label="Summary (you can edit this)" value={text} onChangeText={setText} multiline />
          <Section title={`Records included (${draft.summary.items.length})`}>
            {draft.summary.items.slice(0, 40).map((i) => (
              <Row key={i.sessionId} style={{ justifyContent: 'space-between' }}>
                <Text variant="small" style={{ flex: 1 }}>
                  {formatDate(i.actualDate ?? i.plannedDate ?? i.originalPlannedDate)} · {i.title}
                  {i.wasRescheduled ? ' (moved)' : ''}
                </Text>
                <StatusBadge status={i.outcome} />
              </Row>
            ))}
          </Section>
          {save.isError ? <Banner tone="error">{errorMessage(save.error)}</Banner> : null}
          {save.isSuccess ? (
            <>
              <Banner tone="success">Review saved. Your workout logs are unchanged.</Banner>
              <Button label="Plan next month with AI" variant="brand" fullWidth onPress={() => router.push(`/routine/ai?reviewId=${save.data.id}`)} />
              <Button label="Done" variant="ghost" fullWidth onPress={() => router.back()} />
            </>
          ) : (
            <Button
              label="Save review"
              fullWidth
              disabled={!text.trim()}
              loading={save.isPending}
              onPress={() => save.mutate({ draftId: draft.draftId, summaryText: text, reflection: reflection || undefined, idempotencyKey: key })}
            />
          )}
          <AIDisclaimer />
        </>
      ) : null}
    </Screen>
  );
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${n}`}>
      <Text variant="heading">{n}</Text>
      <Text variant="caption" color="inkTertiary">
        {label}
      </Text>
    </View>
  );
}
