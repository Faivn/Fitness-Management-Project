import type {
  ActivityType,
  ConversationContext,
  DistanceUnit,
  GoalPriority,
  GoalStatus,
  MealPlanStatus,
  ProposalStatus,
  RecordSource,
  RoutineStatus,
  ScheduleChangeType,
  SessionStatus,
  SetLogStatus,
  UnitSystem,
  VolumeUnit,
  WeightUnit,
} from './enums.js';
import type { PersonalRecord } from './rules/personalRecords.js';
import type { PeriodSummary } from './rules/monthlySummary.js';
import type { ScheduleConflict } from './rules/schedule.js';
import type { MealPlanDraft } from './schemas/mealPlan.js';
import type { RoutinePlan } from './schemas/routine.js';
import type { GoalDraft } from './schemas/goals.js';

/** API response contracts (camelCase). The API maps database rows to these. */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface Profile {
  id: string;
  timezone: string;
  unitSystem: UnitSystem;
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  volumeUnit: VolumeUnit;
  onboardingCompletedAt: string | null;
  equipment: string[];
  trainingNotes: string | null;
  hydrationEnabled: boolean;
  fastingEnabled: boolean;
  workoutRemindersEnabled: boolean;
  workoutReminderLeadMinutes: number;
  updatedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  priority: GoalPriority;
  targetValue: number | null;
  targetUnit: string | null;
  targetDate: string | null;
  isMeasurable: boolean;
  source: 'manual' | 'ai';
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  metadata: {
    clarifyingQuestions?: string[];
    goalProposalId?: string;
    suggestedNextStep?: string;
  } | null;
}

export interface Conversation {
  id: string;
  context: ConversationContext;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

export interface GoalProposal {
  id: string;
  status: ProposalStatus;
  version: number;
  goals: GoalDraft[];
  conversationId: string | null;
  createdAt: string;
}

export interface RoutineProposal {
  id: string;
  status: ProposalStatus;
  version: number;
  mode: 'new' | 'adjust' | 'replace';
  targetRoutineId: string | null;
  plan: RoutinePlan | null;
  clarifyingQuestions: string[];
  conversationId: string | null;
  appliedRoutineId: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  appliedAt: string | null;
}

export interface Routine {
  id: string;
  title: string;
  status: RoutineStatus;
  source: 'manual' | 'ai';
  currentVersion: number;
  currentVersionId: string;
  plan: RoutinePlan;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineVersionSummary {
  id: string;
  versionNumber: number;
  changeReason: string | null;
  createdAt: string;
}

export interface SessionExercise {
  id: string;
  displayName: string;
  exerciseId: string | null;
  sortOrder: number;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeight: number | null;
  weightUnit: WeightUnit | null;
  restSeconds: number | null;
  instructions: string | null;
}

export interface SetLog {
  id: string;
  clientId: string;
  sessionId: string;
  sessionExerciseId: string | null;
  exerciseName: string;
  setNumber: number;
  actualReps: number | null;
  actualWeight: number | null;
  weightUnit: WeightUnit | null;
  status: SetLogStatus;
  notes: string | null;
  recordedAt: string;
  correctedAt: string | null;
}

export interface ScheduleChange {
  id: string;
  sessionId: string;
  changeType: ScheduleChangeType;
  oldDate: string | null;
  oldTime: string | null;
  newDate: string | null;
  newTime: string | null;
  reason: string | null;
  createdAt: string;
}

export interface WorkoutSession {
  id: string;
  title: string;
  activityType: ActivityType;
  source: RecordSource;
  status: SessionStatus;
  routineId: string | null;
  routineVersionId: string | null;
  originalPlannedDate: string | null;
  plannedDate: string | null;
  plannedTime: string | null;
  plannedDurationMinutes: number | null;
  plannedTimezone: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  actualDate: string | null;
  actualDurationSeconds: number | null;
  actualDistanceValue: number | null;
  actualDistanceUnit: DistanceUnit | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSessionDetail extends WorkoutSession {
  exercises: SessionExercise[];
  setLogs: SetLog[];
  scheduleChanges: ScheduleChange[];
  /** Most recent prior performance per exercise key (read-only context, WF-06). */
  previousPerformance: Record<string, { date: string; sets: Array<Pick<SetLog, 'setNumber' | 'actualReps' | 'actualWeight' | 'weightUnit'>> }>;
}

export interface ApplyResult {
  routine: Routine;
  sessionsCreated: number;
  conflicts: ScheduleConflict[];
}

export interface MealPlanEntryDto {
  id: string;
  date: string;
  slot: string;
  sortOrder: number;
  mealName: string;
  description: string | null;
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
  isSmoothie: boolean;
  notes: string | null;
}

export interface ShoppingListItemDto {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
}

export interface MealPlan {
  id: string;
  title: string;
  goalContext: string | null;
  startDate: string;
  endDate: string;
  status: MealPlanStatus;
  version: number;
  source: 'manual' | 'ai';
  slots: string[];
  approvedAt: string | null;
  createdAt: string;
  entries: MealPlanEntryDto[];
  shoppingList: ShoppingListItemDto[];
}

export interface MealPlanProposal {
  id: string;
  status: ProposalStatus;
  version: number;
  plan: MealPlanDraft | null;
  clarifyingQuestions: string[];
  appliedMealPlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HydrationDay {
  enabled: boolean;
  localDate: string;
  target: { dailyTarget: number; unit: VolumeUnit } | null;
  totalMl: number;
  entries: Array<{ id: string; quantity: number; unit: VolumeUnit; recordedAt: string }>;
}

export interface FastingState {
  enabled: boolean;
  schedule: { label: string | null; fastStartTime: string; fastHours: number } | null;
  activeFast: { id: string; startedAt: string; plannedHours: number } | null;
  recentFasts: Array<{ id: string; startedAt: string; endedAt: string | null; plannedHours: number }>;
}

export interface OverviewDay {
  localDate: string;
  timezone: string;
  sessions: WorkoutSession[];
  /** Past planned sessions still awaiting an outcome (never hidden automatically). */
  needsAttention: WorkoutSession[];
  isRestDay: boolean;
  hasActiveRoutine: boolean;
  meals: MealPlanEntryDto[];
  mealPlanId: string | null;
  hydration: HydrationDay | null;
  fasting: FastingState | null;
}

export interface MonthlyReviewDraft {
  draftId: string;
  periodStart: string;
  periodEnd: string;
  summary: PeriodSummary;
  narrative: string;
  observations: string[];
  aiAvailable: boolean;
}

export interface MonthlyReview {
  id: string;
  periodStart: string;
  periodEnd: string;
  summaryText: string;
  reflection: string | null;
  stats: PeriodSummary;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseHistory {
  exerciseKey: string;
  exerciseName: string;
  entries: Array<{
    sessionId: string;
    date: string;
    sets: Array<Pick<SetLog, 'id' | 'setNumber' | 'actualReps' | 'actualWeight' | 'weightUnit' | 'status'>>;
  }>;
  records: PersonalRecord[];
}

export interface ProposalConflictResponse {
  conflicts: ScheduleConflict[];
  messages: string[];
}
