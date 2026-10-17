import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  ApplyResult,
  Conversation,
  ExerciseHistory,
  FastingState,
  Goal,
  GoalDraft,
  GoalProposal,
  HydrationDay,
  MealPlan,
  MealPlanDraft,
  MealPlanProposal,
  MonthlyReview,
  MonthlyReviewDraft,
  OverviewDay,
  PeriodSummary,
  PersonalRecord,
  PreferencesInput,
  Profile,
  Routine,
  RoutinePlan,
  RoutineProposal,
  RoutineVersionSummary,
  ScheduleConflict,
  SetLog,
  SetLogInput,
  ShoppingListItemDto,
  WorkoutSession,
  WorkoutSessionDetail,
} from '@mova/shared';
import { api } from '@/lib/api';

/**
 * Server state hooks. Screens always render the API's confirmed response —
 * after a mutation the relevant queries are refetched (spec §9 rule 3).
 */

export const qk = {
  profile: ['profile'] as const,
  overview: (date?: string) => ['overview', date ?? 'today'] as const,
  schedule: (from: string, to: string) => ['schedule', from, to] as const,
  sessions: (from: string, to: string) => ['sessions', from, to] as const,
  session: (id: string) => ['session', id] as const,
  goals: ['goals'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  goalProposal: (id: string) => ['goalProposal', id] as const,
  routines: ['routines'] as const,
  routine: (id: string) => ['routine', id] as const,
  routineProposals: ['routineProposals'] as const,
  routineProposal: (id: string) => ['routineProposal', id] as const,
  history: (from: string, to: string) => ['history', from, to] as const,
  exercises: ['exercises'] as const,
  exercise: (name: string) => ['exercise', name] as const,
  records: ['records'] as const,
  mealPlans: ['mealPlans'] as const,
  mealPlan: (id: string) => ['mealPlan', id] as const,
  mealProposal: (id: string) => ['mealProposal', id] as const,
  hydration: (date?: string) => ['hydration', date ?? 'today'] as const,
  fasting: ['fasting'] as const,
  reviews: ['reviews'] as const,
  review: (id: string) => ['review', id] as const,
};

/** Domain data that changes when plans, sessions or logs change. */
const ACTIVITY_KEYS: QueryKey[] = [['overview'], ['schedule'], ['sessions'], ['session'], ['history'], ['exercises'], ['exercise'], ['records'], ['routines'], ['routine']];

function useInvalidate() {
  const qc = useQueryClient();
  return (keys: QueryKey[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

// --- Profile ---------------------------------------------------------------

export const useProfile = (enabled = true) => useQuery({ queryKey: qk.profile, queryFn: () => api<Profile>('GET', 'profile'), enabled });

export function useCompleteOnboarding() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (timezone: string) => api<Profile>('POST', 'profile/onboarding', { timezone }),
    onSuccess: () => inv([qk.profile]),
  });
}

export function useUpdatePreferences() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (input: PreferencesInput) => api<Profile>('PATCH', 'preferences', input),
    onSuccess: () => inv([qk.profile, ['overview'], ['hydration'], ['fasting']]),
  });
}

// --- Overview & schedule ---------------------------------------------------

export const useOverview = (date?: string) =>
  useQuery({ queryKey: qk.overview(date), queryFn: () => api<OverviewDay>('GET', `overview${date ? `?date=${date}` : ''}`) });

export const useSchedule = (from: string, to: string) =>
  useQuery({
    queryKey: qk.schedule(from, to),
    queryFn: () => api<{ sessions: WorkoutSession[]; meals: OverviewDay['meals'] }>('GET', `schedule?from=${from}&to=${to}`),
  });

// --- Goals & AI ------------------------------------------------------------

export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: () => api<Goal[]>('GET', 'goals') });

export function useCreateGoal() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (input: GoalDraft & { idempotencyKey: string }) => api<Goal>('POST', 'goals', input),
    onSuccess: () => inv([qk.goals]),
  });
}

export function useUpdateGoal() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<GoalDraft> & { id: string; status?: Goal['status'] }) => api<Goal>('PATCH', `goals/${id}`, patch),
    onSuccess: () => inv([qk.goals]),
  });
}

export const useConversations = () =>
  useQuery({ queryKey: qk.conversations, queryFn: () => api<Array<{ id: string; context: string; updatedAt: string }>>('GET', 'ai/conversations') });

export const useConversation = (id: string | undefined) =>
  useQuery({ queryKey: qk.conversation(id ?? ''), queryFn: () => api<Conversation>('GET', `ai/conversations/${id}`), enabled: !!id });

/** "New chat": deletes every past conversation so the next message starts clean. */
export function useClearConversations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ cleared: number }>('DELETE', 'ai/conversations'),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['conversation'] });
      qc.setQueryData(qk.conversations, []);
    },
  });
}

export function useAiTurn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { conversationId?: string; message: string; clientMessageId: string; context?: string }) =>
      api<{ conversation: Conversation; goalProposal: GoalProposal | null }>('POST', 'ai/turn', input),
    onSuccess: (data) => {
      qc.setQueryData(qk.conversation(data.conversation.id), data.conversation);
      void qc.invalidateQueries({ queryKey: qk.conversations });
    },
  });
}

export const useGoalProposal = (id: string | undefined) =>
  useQuery({ queryKey: qk.goalProposal(id ?? ''), queryFn: () => api<GoalProposal>('GET', `goal-proposals/${id}`), enabled: !!id });

export function useApproveGoals() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; version: number; goals: GoalDraft[]; idempotencyKey: string }) =>
      api<Goal[]>('POST', `goal-proposals/${id}/approve`, body),
    onSuccess: () => inv([qk.goals, ['goalProposal']]),
  });
}

export function useRejectProposal(kind: 'goal-proposals' | 'routine-proposals' | 'meal-plan-proposals') {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api<{ id: string }>('POST', `${kind}/${id}/reject`, {}),
    onSuccess: () => inv([['goalProposal'], ['routineProposal'], qk.routineProposals, ['mealProposal']]),
  });
}

// --- Routines & proposals --------------------------------------------------

export const useRoutines = () => useQuery({ queryKey: qk.routines, queryFn: () => api<Routine[]>('GET', 'routines') });

export const useRoutine = (id: string | undefined) =>
  useQuery({
    queryKey: qk.routine(id ?? ''),
    queryFn: () => api<Routine & { versions: RoutineVersionSummary[] }>('GET', `routines/${id}`),
    enabled: !!id,
  });

export function useCreateRoutine() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: { plan: RoutinePlan; activate: boolean; schedule?: { startDate: string; weeks: number }; acceptConflicts?: boolean; idempotencyKey: string }) =>
      api<{ routine: Routine; sessionsCreated: number }>('POST', 'routines', body),
    onSuccess: () => inv(ACTIVITY_KEYS),
  });
}

export function useSaveRoutineVersion() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; plan: RoutinePlan; changeReason?: string; rescheduleFuture: boolean; activate?: boolean; schedule?: { startDate: string; weeks: number }; acceptConflicts?: boolean; idempotencyKey: string }) =>
      api<{ routine: Routine; sessionsCreated: number; sessionsRetired: number }>('POST', `routines/${id}/versions`, body),
    onSuccess: () => inv(ACTIVITY_KEYS),
  });
}

export const useRoutineProposals = () =>
  useQuery({ queryKey: qk.routineProposals, queryFn: () => api<RoutineProposal[]>('GET', 'routine-proposals') });

export const useRoutineProposal = (id: string | undefined) =>
  useQuery({ queryKey: qk.routineProposal(id ?? ''), queryFn: () => api<RoutineProposal>('GET', `routine-proposals/${id}`), enabled: !!id });

export function useGenerateRoutineProposal() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: { request: string; mode: 'new' | 'adjust' | 'replace'; targetRoutineId?: string; goalIds?: string[]; monthlyReviewId?: string }) =>
      api<RoutineProposal>('POST', 'routine-proposals', body),
    onSuccess: () => inv([qk.routineProposals, qk.conversations]),
  });
}

function useProposalUpdate<TBody>(path: (id: string) => string, method: 'PATCH' | 'POST') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: TBody & { id: string }) => api<RoutineProposal>(method, path(id), body),
    onSuccess: (p) => qc.setQueryData(qk.routineProposal(p.id), p),
  });
}

export const useEditRoutineProposal = () => useProposalUpdate<{ version: number; plan: RoutinePlan }>((id) => `routine-proposals/${id}`, 'PATCH');
export const useReviseRoutineProposal = () =>
  useProposalUpdate<{ version: number; instruction: string }>((id) => `routine-proposals/${id}/revise`, 'POST');

export function useCheckProposalConflicts() {
  return useMutation({
    mutationFn: ({ id, schedule }: { id: string; schedule: { startDate: string; weeks: number } }) =>
      api<{ occurrences: number; conflicts: ScheduleConflict[] }>('POST', `routine-proposals/${id}/conflicts`, { schedule }),
  });
}

export function useApproveRoutineProposal() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; version: number; schedule: { startDate: string; weeks: number }; acceptConflicts: boolean; idempotencyKey: string }) =>
      api<ApplyResult>('POST', `routine-proposals/${id}/approve`, body),
    onSuccess: () => inv([...ACTIVITY_KEYS, qk.routineProposals, ['routineProposal']]),
  });
}

// --- Sessions --------------------------------------------------------------

export const useSessions = (from: string, to: string) =>
  useQuery({ queryKey: qk.sessions(from, to), queryFn: () => api<WorkoutSession[]>('GET', `workout-sessions?from=${from}&to=${to}`) });

export const useSession = (id: string | undefined) =>
  useQuery({ queryKey: qk.session(id ?? ''), queryFn: () => api<WorkoutSessionDetail>('GET', `workout-sessions/${id}`), enabled: !!id });

function useSessionMutation<TBody, TResult = WorkoutSession>(path: (id: string) => string, method: 'POST' | 'PATCH' = 'POST') {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: TBody & { id: string }) => api<TResult>(method, path(id), body),
    onSuccess: () => inv(ACTIVITY_KEYS),
  });
}

export const useStartSession = () => useSessionMutation<{ startedAt?: string }>((id) => `workout-sessions/${id}/start`);
export const useFinishSession = () =>
  useSessionMutation<{ outcome: 'completed' | 'incomplete'; notes?: string; durationSeconds?: number; distanceValue?: number; distanceUnit?: 'km' | 'mi'; idempotencyKey: string }>(
    (id) => `workout-sessions/${id}/finish`,
  );
export const useReschedule = () =>
  useSessionMutation<{ newDate: string; newTime?: string; reason?: string; acceptConflicts?: boolean; idempotencyKey: string }, WorkoutSessionDetail>(
    (id) => `workout-sessions/${id}/reschedule`,
    'PATCH',
  );
export const useMarkMissed = () =>
  useSessionMutation<{ reason?: string; idempotencyKey: string }, WorkoutSessionDetail>((id) => `workout-sessions/${id}/missed`);
export const useCancelSession = () =>
  useSessionMutation<{ reason?: string; idempotencyKey: string }, WorkoutSessionDetail>((id) => `workout-sessions/${id}/cancel`);

export function useSaveSets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, logs }: { id: string; logs: SetLogInput[] }) => api<SetLog[]>('POST', `workout-sessions/${id}/logs`, { logs }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.session(v.id) }),
  });
}

export function useCorrectSet() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; actualReps?: number | null; actualWeight?: number | null; weightUnit?: 'kg' | 'lb' | null; status?: 'completed' | 'skipped'; correctionReason?: string }) =>
      api<SetLog>('PATCH', `workout-logs/${id}`, body),
    onSuccess: () => inv(ACTIVITY_KEYS),
  });
}

export function useScheduleActivity() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: { activityType: string; title: string; plannedDate: string; plannedTime?: string; durationMinutes?: number; notes?: string; acceptConflicts?: boolean; idempotencyKey: string }) =>
      api<WorkoutSession>('POST', 'workout-sessions', body),
    onSuccess: () => inv(ACTIVITY_KEYS),
  });
}

export function useLogActivity() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ session: WorkoutSession; linked: boolean }>('POST', 'activities', body),
    onSuccess: () => inv(ACTIVITY_KEYS),
  });
}

// --- History & records -----------------------------------------------------

export const useHistory = (from: string, to: string) =>
  useQuery({ queryKey: qk.history(from, to), queryFn: () => api<{ summary: PeriodSummary; sessions: WorkoutSession[] }>('GET', `history?from=${from}&to=${to}`) });

export const useExercises = () =>
  useQuery({ queryKey: qk.exercises, queryFn: () => api<Array<{ exerciseKey: string; exerciseName: string; lastDate: string; sets: number }>>('GET', 'exercises') });

export const useExerciseHistory = (name: string | undefined) =>
  useQuery({
    queryKey: qk.exercise(name ?? ''),
    queryFn: () => api<ExerciseHistory>('GET', `exercises/history?name=${encodeURIComponent(name ?? '')}`),
    enabled: !!name,
  });

export const usePersonalRecords = () => useQuery({ queryKey: qk.records, queryFn: () => api<PersonalRecord[]>('GET', 'personal-records') });

// --- Meal planning ---------------------------------------------------------

export const useMealPlans = () =>
  useQuery({
    queryKey: qk.mealPlans,
    queryFn: () => api<Array<{ id: string; title: string; startDate: string; endDate: string; status: string }>>('GET', 'meal-plans'),
  });

export const useMealPlan = (id: string | undefined) =>
  useQuery({ queryKey: qk.mealPlan(id ?? ''), queryFn: () => api<MealPlan>('GET', `meal-plans/${id}`), enabled: !!id });

export const useMealProposal = (id: string | undefined) =>
  useQuery({ queryKey: qk.mealProposal(id ?? ''), queryFn: () => api<MealPlanProposal>('GET', `meal-plan-proposals/${id}`), enabled: !!id });

export function useGenerateMealPlan() {
  return useMutation({
    mutationFn: (body: { request: string; startDate: string; days: number }) => api<MealPlanProposal>('POST', 'meal-plan-proposals', body),
  });
}

export function useEditMealProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; version: number; plan: MealPlanDraft }) => api<MealPlanProposal>('PATCH', `meal-plan-proposals/${id}`, body),
    onSuccess: (p) => qc.setQueryData(qk.mealProposal(p.id), p),
  });
}

export function useReviseMealProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; version: number; instruction: string }) => api<MealPlanProposal>('POST', `meal-plan-proposals/${id}/revise`, body),
    onSuccess: (p) => qc.setQueryData(qk.mealProposal(p.id), p),
  });
}

export function useApproveMealPlan() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; version: number; idempotencyKey: string }) => api<MealPlan>('POST', `meal-plan-proposals/${id}/approve`, body),
    onSuccess: () => inv([qk.mealPlans, ['mealPlan'], ['mealProposal'], ['overview'], ['schedule']]),
  });
}

export function useUpdateShoppingItem(planId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; checked?: boolean; name?: string; quantity?: number | null; unit?: string | null }) =>
      api<ShoppingListItemDto>('PATCH', `shopping-items/${id}`, patch),
    onSuccess: () => inv([qk.mealPlan(planId)]),
  });
}

export function useAddShoppingItem(planId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: { name: string; quantity?: number; unit?: string; category?: string; idempotencyKey: string }) =>
      api<ShoppingListItemDto>('POST', `meal-plans/${planId}/shopping-items`, body),
    onSuccess: () => inv([qk.mealPlan(planId)]),
  });
}

export function useDeleteShoppingItem(planId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api<{ id: string }>('DELETE', `shopping-items/${id}`),
    onSuccess: () => inv([qk.mealPlan(planId)]),
  });
}

// --- Optional modules -------------------------------------------------------

export const useHydration = (enabled = true) => useQuery({ queryKey: qk.hydration(), queryFn: () => api<HydrationDay>('GET', 'hydration'), enabled });

export function useHydrationMutations() {
  const inv = useInvalidate();
  const after = { onSuccess: () => inv([['hydration'], ['overview']]) };
  return {
    setTarget: useMutation({ mutationFn: (b: { dailyTarget: number; unit: 'ml' | 'l' | 'fl_oz' }) => api<HydrationDay>('PUT', 'hydration/target', b), ...after }),
    add: useMutation({ mutationFn: (b: { quantity: number; unit: 'ml' | 'l' | 'fl_oz'; idempotencyKey: string }) => api<HydrationDay>('POST', 'hydration/entries', b), ...after }),
    remove: useMutation({ mutationFn: (id: string) => api<HydrationDay>('DELETE', `hydration/entries/${id}`), ...after }),
  };
}

export const useFasting = (enabled = true) => useQuery({ queryKey: qk.fasting, queryFn: () => api<FastingState>('GET', 'fasting'), enabled });

export function useFastingMutations() {
  const inv = useInvalidate();
  const after = { onSuccess: () => inv([qk.fasting, ['overview']]) };
  return {
    setSchedule: useMutation({ mutationFn: (b: { label?: string; fastStartTime: string; fastHours: number }) => api<FastingState>('PUT', 'fasting/schedule', b), ...after }),
    start: useMutation({ mutationFn: (b: { plannedHours: number; idempotencyKey: string }) => api<FastingState>('POST', 'fasting/start', b), ...after }),
    end: useMutation({ mutationFn: () => api<FastingState>('POST', 'fasting/end', {}), ...after }),
  };
}

// --- Monthly reviews -------------------------------------------------------

export const useReviews = () => useQuery({ queryKey: qk.reviews, queryFn: () => api<MonthlyReview[]>('GET', 'monthly-reviews') });
export const useReview = (id: string | undefined) =>
  useQuery({ queryKey: qk.review(id ?? ''), queryFn: () => api<MonthlyReview>('GET', `monthly-reviews/${id}`), enabled: !!id });

export function useGenerateReview() {
  return useMutation({
    mutationFn: (b: { periodStart: string; periodEnd: string; reflection?: string }) => api<MonthlyReviewDraft>('POST', 'monthly-reviews/generate', b),
  });
}

export function useSaveReview() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { draftId: string; summaryText: string; reflection?: string; idempotencyKey: string }) => api<MonthlyReview>('POST', 'monthly-reviews', b),
    onSuccess: () => inv([qk.reviews]),
  });
}
