import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConversationMessage, GoalDraft } from '@mova/shared';
import { Banner, Button, Card, Chip, Row, Text, TextField } from '@/components';
import { AIDisclaimer, ProposalBanner } from '@/components/domain';
import { Mascot } from '@/components/Mascot';
import { useAiTurn, useApproveGoals, useConversation, useConversations, useGoalProposal, useRejectProposal } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { useDraft } from '@/lib/drafts';
import { colors, radii, spacing } from '@/theme/tokens';

const STARTERS = [
  'I want to train four times a week and improve my running',
  'Help me plan meals for a cutting phase',
  "I'm done with this month — help me review it",
];

/**
 * WF-02 AI companion. The composer text is kept as a draft until the server
 * confirms the message, so an AI or network failure never loses it.
 */
export default function Companion() {
  const params = useLocalSearchParams<{ id?: string }>();
  const conversations = useConversations();
  const [conversationId, setConversationId] = useState<string | undefined>(params.id);
  const conversation = useConversation(conversationId);
  const turn = useAiTurn();
  const draft = useDraft('companion-message', { text: '', clientMessageId: newIdempotencyKey() });
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Resume the most recent conversation by default.
  useEffect(() => {
    if (!conversationId && !params.id && conversations.data?.[0]) setConversationId(conversations.data[0].id);
  }, [conversations.data, conversationId, params.id]);

  const messages = conversation.data?.messages ?? [];
  const pendingText = turn.isPending ? turn.variables?.message : undefined;

  function send(text = draft.value.text) {
    const message = text.trim();
    if (!message) return;
    const clientMessageId = text === draft.value.text ? draft.value.clientMessageId : newIdempotencyKey();
    turn.mutate(
      { conversationId, message, clientMessageId },
      {
        onSuccess: (data) => {
          setConversationId(data.conversation.id);
          draft.setValue({ text: '', clientMessageId: newIdempotencyKey() });
          void draft.clear();
        },
        // On failure the draft (and its id) is kept, so "Send" retries the same message.
        onError: () => draft.setValue({ text: message, clientMessageId }),
      },
    );
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.page }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scroll} contentContainerStyle={styles.thread} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          <Row>
            <Button label="New conversation" size="sm" variant="ghost" onPress={() => setConversationId(undefined)} />
            <Button label="Create a routine" size="sm" variant="ghost" onPress={() => router.push('/routine/ai')} />
            <Button label="Plan meals" size="sm" variant="ghost" onPress={() => router.push('/meal/new')} />
          </Row>
          {messages.length === 0 && !pendingText ? (
            <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
              <Mascot mood="focus" size={110} />
              <Text variant="heading" align="center">
                What would you like to work on?
              </Text>
              <Text variant="small" color="inkSecondary" align="center">
                Tell me about your goals, schedule or meals in your own words. I'll ask only what I need.
              </Text>
              <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
                {STARTERS.map((s) => (
                  <Chip key={s} label={s} onPress={() => send(s)} />
                ))}
              </View>
            </View>
          ) : null}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {pendingText ? <MessageBubble message={{ id: 'pending', role: 'user', content: pendingText, createdAt: '', metadata: null }} /> : null}
          {turn.isPending ? (
            <Row>
              <Mascot mood="thinking" size={40} />
              <Text variant="small" color="inkTertiary">
                Thinking…
              </Text>
            </Row>
          ) : null}
          {turn.isError ? <Banner tone="error">{errorMessage(turn.error)}</Banner> : null}
        </ScrollView>
        <View style={styles.composer}>
          <TextField
            label="Message"
            placeholder="Message Mova…"
            value={draft.value.text}
            onChangeText={(text) => draft.setValue((d) => ({ ...d, text }))}
            multiline
            style={{ minHeight: 48, maxHeight: 140 }}
          />
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <AIDisclaimer />
            </View>
            <Button label={turn.isError ? 'Retry' : 'Send'} loading={turn.isPending} disabled={!draft.value.text.trim()} onPress={() => send()} />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const mine = message.role === 'user';
  const meta = message.metadata as (ConversationMessage['metadata'] & { routineProposalId?: string; mealPlanProposalId?: string }) | null;
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: spacing.sm }}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text variant="body" color={mine ? 'onInk' : 'ink'}>
          {message.content}
        </Text>
      </View>
      {meta?.clarifyingQuestions?.length ? (
        <View style={{ gap: spacing.xs, alignSelf: 'stretch' }}>
          {meta.clarifyingQuestions.map((q) => (
            <Text key={q} variant="small" color="inkSecondary">
              • {q}
            </Text>
          ))}
        </View>
      ) : null}
      {meta?.goalProposalId ? <GoalProposalCard id={meta.goalProposalId} /> : null}
      {meta?.routineProposalId ? (
        <Button label="Review routine proposal" size="sm" variant="secondary" onPress={() => router.push(`/proposal/routine/${meta.routineProposalId}`)} />
      ) : null}
      {meta?.mealPlanProposalId ? (
        <Button label="Review meal plan" size="sm" variant="secondary" onPress={() => router.push(`/proposal/meal/${meta.mealPlanProposalId}`)} />
      ) : null}
      {meta?.suggestedNextStep === 'create_routine' ? (
        <Button label="Draft a routine from this" size="sm" variant="brand" onPress={() => router.push('/routine/ai')} />
      ) : null}
      {meta?.suggestedNextStep === 'create_meal_plan' ? (
        <Button label="Draft a meal plan" size="sm" variant="brand" onPress={() => router.push('/meal/new')} />
      ) : null}
      {meta?.suggestedNextStep === 'monthly_review' ? (
        <Button label="Open monthly review" size="sm" variant="brand" onPress={() => router.push('/review/new')} />
      ) : null}
    </View>
  );
}

/** Goal proposal: editable, and saved only on explicit approval (WF-02). */
function GoalProposalCard({ id }: { id: string }) {
  const proposal = useGoalProposal(id);
  const approve = useApproveGoals();
  const reject = useRejectProposal('goal-proposals');
  const [goals, setGoals] = useState<GoalDraft[] | null>(null);
  const [key] = useState(newIdempotencyKey);

  if (!proposal.data) return null;
  const p = proposal.data;
  const list = goals ?? p.goals;
  const editable = p.status === 'draft';

  return (
    <Card tone="brand" style={{ alignSelf: 'stretch' }}>
      <ProposalBanner version={p.version} status={p.status} />
      <Text variant="label">Suggested goals</Text>
      {list.map((g, i) =>
        editable ? (
          <View key={i} style={{ gap: spacing.xs }}>
            <TextField label={`Goal ${i + 1}`} value={g.title} onChangeText={(title) => setGoals(list.map((x, j) => (j === i ? { ...x, title } : x)))} />
            <Row>
              <Chip label={`Priority: ${g.priority}`} />
              {g.isMeasurable && g.targetValue ? <Chip label={`Target ${g.targetValue} ${g.targetUnit ?? ''}`} /> : <Chip label="Aspiration" />}
              <Button label="Remove" size="sm" variant="ghost" onPress={() => setGoals(list.filter((_, j) => j !== i))} />
            </Row>
          </View>
        ) : (
          <Text key={i} variant="body">
            • {g.title}
          </Text>
        ),
      )}
      {editable ? (
        <Row style={{ flexWrap: 'wrap' }}>
          <Button
            label="Approve goals"
            disabled={list.length === 0 || list.some((g) => !g.title.trim())}
            loading={approve.isPending}
            onPress={() => approve.mutate({ id, version: p.version, goals: list, idempotencyKey: key }, { onSuccess: () => proposal.refetch() })}
          />
          <Button label="Not now" variant="ghost" loading={reject.isPending} onPress={() => reject.mutate(id, { onSuccess: () => proposal.refetch() })} />
        </Row>
      ) : null}
      {approve.isError ? <Banner tone="error">{errorMessage(approve.error)}</Banner> : null}
      {p.status === 'applied' ? <Banner tone="success">Goals saved. You can find them in Settings → Goals.</Banner> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  thread: { padding: spacing.base, gap: spacing.md },
  bubble: { maxWidth: '88%', borderRadius: radii.md, padding: spacing.md },
  mine: { backgroundColor: colors.ink },
  theirs: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline },
  composer: { padding: spacing.base, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, backgroundColor: colors.canvas },
});
