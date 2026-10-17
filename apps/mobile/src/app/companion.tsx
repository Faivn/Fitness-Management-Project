import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConversationMessage } from '@mova/shared';
import { Appear, Banner, Composer, IconButton, SheetPage, Text, ThinkingIndicator } from '@/components';
import { GoalSuggestions, MealSuggestion, RoutineSuggestion, ShimmerPill, StreamedText, SuggestionChips } from '@/components/ChatSuggestions';
import { Mascot } from '@/components/Mascot';
import { useAiTurn, useClearConversations, useConversation, useConversations, useGenerateMealPlan, useGenerateRoutineProposal, useProfile } from '@/hooks/api';
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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [streamed, setStreamed] = useState<Set<string>>(new Set());
  // Drafts the assistant made from the conversation; each is a one-tap suggestion under the thread.
  const [drafts, setDrafts] = useState<Array<{ kind: 'routine' | 'meal'; id: string }>>([]);
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
          const request = data.conversation.messages.filter((m) => m.role === 'user').map((m) => m.content).join('. ');
          // Act straight away: draft what was asked for instead of asking the user to pick a button.
          if (step === 'create_routine')
            draftRoutine.mutate({ request: request || 'Three sessions a week', mode: 'new' }, { onSuccess: (p) => setDrafts((d) => [...d, { kind: 'routine', id: p.id }]) });
          if (step === 'create_meal_plan')
            draftMeals.mutate({ request: request || 'Weekly meal plan', startDate: appToday(profile.data?.timezone ?? 'UTC'), days: 7 }, { onSuccess: (p) => setDrafts((d) => [...d, { kind: 'meal', id: p.id }]) });
          if (step === 'monthly_review') router.push('/review/new');
          setSuggestionsOpen(false);
          draft.setValue({ text: '', clientMessageId: newIdempotencyKey() });
          void draft.clear();
        },
        // On failure the draft (and its id) is kept, so "Send" retries the same message.
        onError: () => draft.setValue({ text: message, clientMessageId }),
      },
    );
  }

  // Drafted suggestions wait until the latest reply has finished typing itself out.
  const latest = [...messages].reverse().find((m) => m.role === 'assistant');
  const draftsReady = !latest || !isNew(latest.id) || streamed.has(latest.id);
  const busy = turn.isPending || draftRoutine.isPending || draftMeals.isPending;
  const SUGGESTIONS = ['Create a workout routine', 'Create a meal plan', 'Suggest a goal'];

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
              onStreamed={(id) => setStreamed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))}
            />
          ))}
          {pendingText ? <MessageBubble message={{ id: 'pending', role: 'user', content: pendingText, createdAt: '', metadata: null }} animate /> : null}
          {busy ? (
            <Appear>
              <ThinkingIndicator />
            </Appear>
          ) : null}
          {draftsReady ? drafts.map((d) => (d.kind === 'routine' ? <RoutineSuggestion key={d.id} id={d.id} /> : <MealSuggestion key={d.id} id={d.id} />)) : null}
          {turn.isError || draftRoutine.isError || draftMeals.isError ? (
            <Appear>
              <Banner tone="error">{errorMessage(turn.error ?? draftRoutine.error ?? draftMeals.error)}</Banner>
            </Appear>
          ) : null}
        </ScrollView>
        <View style={styles.composer}>
          <ShimmerPill open={suggestionsOpen} onPress={() => setSuggestionsOpen((o) => !o)} />
          {suggestionsOpen ? (
            <SuggestionChips
              items={SUGGESTIONS}
              onPick={(t) => {
                setSuggestionsOpen(false);
                send(t);
              }}
            />
          ) : null}
          <Composer
            value={draft.value.text}
            onChangeText={(text) => draft.setValue((d) => ({ ...d, text }))}
            onSend={() => send()}
            onOptions={() => setSuggestionsOpen((o) => !o)}
            sending={busy}
            placeholder={copy.ai.placeholder}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </SheetPage>
  );
}

function MessageBubble({ message, animate = false, cardDelay = 120, onStreamed }: { message: ConversationMessage; animate?: boolean; cardDelay?: number; onStreamed?: (id: string) => void }) {
  const mine = message.role === 'user';
  // New assistant replies type themselves out; anything attached to them appears once the text is complete.
  const [done, setDone] = useState(mine || !animate);
  const meta = message.metadata as (ConversationMessage['metadata'] & { routineProposalId?: string; mealPlanProposalId?: string }) | null;
  return (
    <Appear enabled={animate} style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: spacing.sm }}>
      <View
        style={[styles.bubble, mine ? styles.mine : styles.theirs]}
        // The finished reply is announced once; partial text is not read out token by token.
        accessibilityLiveRegion={!mine && animate ? 'polite' : 'none'}
      >
        {mine ? (
          <Text variant="body" color="onInk">
            {message.content}
          </Text>
        ) : (
          <StreamedText
            text={message.content}
            enabled={animate}
            onDone={() => {
              setDone(true);
              onStreamed?.(message.id);
            }}
          />
        )}
      </View>
      {done && meta?.clarifyingQuestions?.length ? (
        <View style={{ gap: spacing.xs, alignSelf: 'stretch' }}>
          {meta.clarifyingQuestions.map((q) => (
            <Text key={q} variant="small" color="inkSecondary">
              • {q}
            </Text>
          ))}
        </View>
      ) : null}
      {done && meta?.goalProposalId ? (
        <Appear variant="card" enabled={animate} delay={cardDelay} style={{ alignSelf: 'stretch' }}>
          <GoalSuggestions id={meta.goalProposalId} />
        </Appear>
      ) : null}
      {done && meta?.routineProposalId ? <RoutineSuggestion id={meta.routineProposalId} /> : null}
      {done && meta?.mealPlanProposalId ? <MealSuggestion id={meta.mealPlanProposalId} /> : null}
    </Appear>
  );
}

const styles = StyleSheet.create({
  thread: { padding: spacing.base, gap: spacing.md },
  bubble: { maxWidth: '88%', borderRadius: radii.xl, padding: spacing.base },
  mine: { backgroundColor: colors.rose },
  theirs: { backgroundColor: colors.lilacWash },
  composer: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.xs },
});
