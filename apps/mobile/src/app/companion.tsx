import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConversationMessage, GoalDraft } from '@mova/shared';
import { Appear, Banner, Button, Card, Chip, Composer, IconButton, Row, RuneIcon, SheetPage, Text, TextAction, TextField, ThinkingIndicator } from '@/components';
import { AIDisclaimer, ProposalBanner } from '@/components/domain';
import { Mascot } from '@/components/Mascot';
import { useAiTurn, useApproveGoals, useClearConversations, useConversation, useConversations, useGenerateMealPlan, useGenerateRoutineProposal, useGoalProposal, useProfile, useRejectProposal } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useDraft } from '@/lib/drafts';
import { appToday } from '@/lib/today';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * WF-02 AI companion. The composer text is kept as a draft until the server
 * confirms the message, so an AI or network failure never loses it.
 */
export default function Companion() {
  const params = useLocalSearchParams<{ id?: string; intent?: string }>();
  const conversations = useConversations();
  const [conversationId, setConversationId] = useState<string | undefined>(params.id);
  const conversation = useConversation(conversationId);
  const turn = useAiTurn();
  const clearChats = useClearConversations();
  const draft = useDraft('companion-message', { text: '', clientMessageId: newIdempotencyKey() });
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Messages already on screen when a conversation loads appear in place; later ones animate in.
  const known = useRef<{ id?: string; ids: Set<string> | null }>({ ids: null });
  const following = useRef(true);
  const [picker, setPicker] = useState(false);
  const draftRoutine = useGenerateRoutineProposal();
  const draftMeals = useGenerateMealPlan();
  const profile = useProfile();

  // Resume the most recent conversation by default.
  useEffect(() => {
    if (!conversationId && !params.id && conversations.data?.[0]) setConversationId(conversations.data[0].id);
  }, [conversations.data, conversationId, params.id]);

  // Opening a conversation (or starting one) lands on the latest message and follows from there.
  const loaded = !!conversation.data;
  useEffect(() => {
    following.current = true;
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(t);
  }, [conversationId, loaded]);

  const messages = conversation.data?.messages ?? [];
  if (known.current.id !== conversationId) known.current = { id: conversationId, ids: null };
  if (known.current.ids === null && (conversation.data || !conversationId)) known.current.ids = new Set(messages.map((m) => m.id));
  const isNew = (id: string) => known.current.ids !== null && !known.current.ids.has(id);
  const pendingText = turn.isPending ? turn.variables?.message : undefined;

  // Opened from onboarding or an empty state with an intent: start clean and ask the first question.
  const started = useRef(false);
  useEffect(() => {
    if (!params.intent || started.current) return;
    started.current = true;
    const opener = params.intent === 'meal' ? 'Help me create a meal plan' : 'Help me create a workout routine';
    clearChats.mutate(undefined, {
      onSettled: () => {
        setConversationId(undefined);
        send(opener, true);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.intent]);

  /** New chat erases the past conversation(s), then shows a clean thread. */
  function startNewChat() {
    clearChats.mutate(undefined, {
      onSettled: () => {
        setConversationId(undefined);
        known.current = { ids: null };
        draft.setValue({ text: '', clientMessageId: newIdempotencyKey() });
        void draft.clear();
      },
    });
  }

  function send(text = draft.value.text, fresh = false) {
    const message = text.trim();
    if (!message) return;
    const clientMessageId = text === draft.value.text ? draft.value.clientMessageId : newIdempotencyKey();
    following.current = true; // sending re-engages follow-along
    turn.mutate(
      { conversationId: fresh ? undefined : conversationId, message, clientMessageId },
      {
        onSuccess: (data) => {
          setConversationId(data.conversation.id);
          const last = [...data.conversation.messages].reverse().find((m) => m.role === 'assistant');
          const step = (last?.metadata as { suggestedNextStep?: string } | null)?.suggestedNextStep;
          if (step === 'create_routine' || step === 'create_meal_plan' || step === 'monthly_review') setPicker(true);
          draft.setValue({ text: '', clientMessageId: newIdempotencyKey() });
          void draft.clear();
        },
        // On failure the draft (and its id) is kept, so "Send" retries the same message.
        onError: () => draft.setValue({ text: message, clientMessageId }),
      },
    );
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const nextStep = (lastAssistant?.metadata as { suggestedNextStep?: string } | null)?.suggestedNextStep;
  const request = messages.filter((m) => m.role === 'user').map((m) => m.content).join('. ');
  const options: Array<{ label: string; hint?: string; onPress: () => void; loading?: boolean }> = [];
  if (nextStep === 'create_routine')
    options.push({
      label: copy.ai.draftRoutine,
      hint: 'Uses what you told me',
      loading: draftRoutine.isPending,
      onPress: () => draftRoutine.mutate({ request: request || 'Three sessions a week', mode: 'new' }, { onSuccess: (p) => { setPicker(false); router.push(`/proposal/routine/${p.id}`); } }),
    });
  if (nextStep === 'create_meal_plan')
    options.push({
      label: copy.ai.draftMeals,
      hint: 'Uses what you told me',
      loading: draftMeals.isPending,
      onPress: () =>
        draftMeals.mutate(
          { request: request || 'Weekly meal plan', startDate: appToday(profile.data?.timezone ?? 'UTC'), days: 7 },
          { onSuccess: (p) => { setPicker(false); router.push(`/proposal/meal/${p.id}`); } },
        ),
    });
  if (nextStep === 'monthly_review') options.push({ label: 'Open monthly review', onPress: () => { setPicker(false); router.push('/review/new'); } });
  options.push(
    { label: 'Create a workout routine', onPress: () => { setPicker(false); send('Help me create a workout routine'); } },
    { label: 'Create a meal plan', onPress: () => { setPicker(false); send('Help me create a meal plan'); } },
    { label: 'Suggest a goal', onPress: () => { setPicker(false); send('Suggest a goal for me'); } },
    { label: 'Ask a fitness question', hint: 'Type it in the box', onPress: () => setPicker(false) },
  );

  return (
    <SheetPage
      title="Mova Companion"
      hideTitle
      action={<IconButton icon="chat-plus" label="New chat" variant="solid" size={36} onPress={startNewChat} />}
    >
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.thread}
          scrollEventThrottle={64}
          // Follow new content only while the reader is at the live edge.
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            following.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
          }}
          onContentSizeChange={() => following.current && scroll.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && !pendingText ? (
            <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
              <Mascot mood="welcome" size={110} />
              <Text variant="heading" align="center">
                {copy.ai.emptyTitle}
              </Text>
              <Text variant="small" color="inkSecondary" align="center">
                {copy.ai.emptyBody}
              </Text>
            </View>
          ) : null}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              animate={m.role === 'assistant' && isNew(m.id)}
            />
          ))}
          {pendingText ? <MessageBubble message={{ id: 'pending', role: 'user', content: pendingText, createdAt: '', metadata: null }} animate /> : null}
          {turn.isPending ? (
            <Appear>
              <ThinkingIndicator />
            </Appear>
          ) : null}
          {turn.isError ? (
            <Appear>
              <Banner tone="error">{errorMessage(turn.error)}</Banner>
            </Appear>
          ) : null}
        </ScrollView>
        <View style={styles.composer}>
          <Composer
            value={draft.value.text}
            onChangeText={(text) => draft.setValue((d) => ({ ...d, text }))}
            onSend={() => send()}
            onOptions={() => setPicker(true)}
            sending={turn.isPending}
            placeholder={copy.ai.placeholder}
          />
          <AIDisclaimer />
        </View>
      </KeyboardAvoidingView>
      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={() => setPicker(false)}>
          <Pressable accessible={false} style={styles.sheet} onPress={() => undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="title" style={{ flex: 1 }}>
                What would you like to do?
              </Text>
              <IconButton icon="close" label="Close" variant="plain" onPress={() => setPicker(false)} />
            </View>
            {options.map((o) => (
              <Pressable
                key={o.label}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                disabled={o.loading}
                onPress={o.onPress}
                style={({ pressed }) => [styles.option, { opacity: pressed || o.loading ? 0.7 : 1 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{o.loading ? 'Working…' : o.label}</Text>
                  {o.hint ? (
                    <Text variant="small" color="inkTertiary">
                      {o.hint}
                    </Text>
                  ) : null}
                </View>
                <RuneIcon name="chevron-right" size={20} color="inkTertiary" />
              </Pressable>
            ))}
            {draftRoutine.isError || draftMeals.isError ? <Banner tone="error">{errorMessage(draftRoutine.error ?? draftMeals.error)}</Banner> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
    </SheetPage>
  );
}

function MessageBubble({ message, animate = false, cardDelay = 120 }: { message: ConversationMessage; animate?: boolean; cardDelay?: number }) {
  const mine = message.role === 'user';
  const meta = message.metadata as (ConversationMessage['metadata'] & { routineProposalId?: string; mealPlanProposalId?: string }) | null;
  return (
    <Appear enabled={animate} style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: spacing.sm }}>
      <View
        style={[styles.bubble, mine ? styles.mine : styles.theirs]}
        // The finished reply is announced once; partial text is not read out token by token.
        accessibilityLiveRegion={!mine && animate ? 'polite' : 'none'}
      >
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
      {meta?.goalProposalId ? (
        <Appear variant="card" enabled={animate} delay={cardDelay} style={{ alignSelf: 'stretch' }}>
          <GoalProposalCard id={meta.goalProposalId} />
        </Appear>
      ) : null}
      {meta?.routineProposalId ? (
        <Appear variant="card" enabled={animate} delay={cardDelay}>
          <Button label={copy.ai.reviewRoutine} size="sm" variant="secondary" onPress={() => router.push(`/proposal/routine/${meta.routineProposalId}`)} />
        </Appear>
      ) : null}
      {meta?.mealPlanProposalId ? (
        <Appear variant="card" enabled={animate} delay={cardDelay}>
          <Button label={copy.ai.reviewMeals} size="sm" variant="secondary" onPress={() => router.push(`/proposal/meal/${meta.mealPlanProposalId}`)} />
        </Appear>
      ) : null}
    </Appear>
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
    <Card tone="assist" style={{ alignSelf: 'stretch' }}>
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
  bubble: { maxWidth: '88%', borderRadius: radii.xl, padding: spacing.base },
  mine: { backgroundColor: colors.rose },
  theirs: { backgroundColor: colors.lilacWash },
  composer: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(42, 34, 48, 0.45)', justifyContent: 'flex-end', padding: spacing.base },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radii.sheet, padding: spacing.lg, gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.base, borderRadius: radii.lg, backgroundColor: colors.well },
});
