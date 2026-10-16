import { z } from 'zod';
import {
  addShoppingItemSchema,
  aiTurnSchema,
  approveGoalProposalSchema,
  approveMealPlanSchema,
  approveRoutineProposalSchema,
  cancelSessionSchema,
  checkProposalConflictsSchema,
  completeOnboardingSchema,
  correctSetLogSchema,
  createGoalSchema,
  createManualRoutineSchema,
  editMealPlanProposalSchema,
  editRoutineProposalSchema,
  endFastSchema,
  fastingScheduleSchema,
  finishSessionSchema,
  generateMealPlanSchema,
  generateMonthlyReviewSchema,
  generateRoutineProposalSchema,
  hydrationEntrySchema,
  hydrationTargetSchema,
  localDate,
  logActivitySchema,
  markMissedSchema,
  preferencesSchema,
  reminderSchema,
  rescheduleSessionSchema,
  reviseMealPlanProposalSchema,
  reviseRoutineProposalSchema,
  saveMonthlyReviewSchema,
  scheduleActivitySchema,
  startFastSchema,
  startSessionSchema,
  updateGoalSchema,
  updateRoutineSchema,
  updateShoppingItemSchema,
  upsertSetLogsSchema,
  uuid,
} from '@mova/shared';
import type { AppContext } from './context.js';
import { Router } from './http/router.js';
import { aiTurn, getConversation, listConversations } from './modules/conversations.js';
import { endFast, getFastingState, setFastingSchedule, startFast } from './modules/fasting.js';
import { approveGoalProposal, createGoal, getGoalProposal, listGoals, rejectProposal, updateGoal } from './modules/goals.js';
import { getExerciseHistory, getHistory, getPersonalRecords, listExercises } from './modules/history.js';
import { addHydrationEntry, deleteHydrationEntry, getHydrationDay, setHydrationTarget } from './modules/hydration.js';
import {
  addShoppingItem,
  approveMealPlanProposal,
  deleteShoppingItem,
  editMealPlanProposal,
  generateMealPlanProposal,
  getMealPlan,
  getMealPlanProposal,
  listMealPlans,
  reviseMealPlanProposal,
  updateShoppingItem,
} from './modules/mealPlans.js';
import { generateMonthlyReview, getMonthlyReview, listMonthlyReviews, saveMonthlyReview } from './modules/monthlyReviews.js';
import { getOverview } from './modules/overview.js';
import { completeOnboarding, getProfile, updatePreferences } from './modules/profile.js';
import {
  approveRoutineProposal,
  checkProposalConflicts,
  editRoutineProposal,
  generateRoutineProposal,
  getRoutineProposal,
  listRoutineProposals,
  reviseRoutineProposal,
} from './modules/routineProposals.js';
import { createManualRoutine, getRoutine, listRoutines, saveRoutineVersion } from './modules/routines.js';
import { deleteReminder, getSchedule, listReminders, saveReminder } from './modules/schedule.js';
import {
  correctSetLog,
  finishSession,
  getSessionDetail,
  listSessions,
  logActivity,
  rescheduleSession,
  scheduleActivity,
  setSessionOutcome,
  startSession,
  upsertSetLogs,
} from './modules/sessions.js';

const rangeQuery = z.object({ from: localDate, to: localDate }).pipe(
  z.object({ from: localDate, to: localDate }).refine((r) => r.from <= r.to, 'from must be on or before to'),
);
const optionalDate = z.object({ date: localDate.optional() });
const idParam = (v: string | undefined) => uuid.parse(v);

/**
 * API surface (spec §8.0.8). Handlers stay thin: validate, then delegate to
 * modules. Every route requires an authenticated user (health is handled
 * before auth in app.ts).
 */
export function buildRoutes(): Router<AppContext> {
  const r = new Router<AppContext>();

  // Profile & preferences (WF-01, WF-16)
  r.on('GET', 'profile', ({ ctx }) => getProfile(ctx));
  r.on('POST', 'profile/onboarding', (q) => completeOnboarding(q.ctx, q.input(completeOnboardingSchema).timezone));
  r.on('GET', 'preferences', ({ ctx }) => getProfile(ctx));
  r.on('PATCH', 'preferences', (q) => updatePreferences(q.ctx, q.input(preferencesSchema)));

  // Overview & schedule (WF-05, WF-11)
  r.on('GET', 'overview', (q) => getOverview(q.ctx, q.queryInput(optionalDate).date));
  r.on('GET', 'schedule', (q) => {
    const { from, to } = q.queryInput(rangeQuery);
    return getSchedule(q.ctx, from, to);
  });
  r.on('GET', 'reminders', ({ ctx }) => listReminders(ctx));
  r.on('POST', 'reminders', (q) => saveReminder(q.ctx, q.input(reminderSchema)), 201);
  r.on('DELETE', 'reminders/:id', (q) => deleteReminder(q.ctx, idParam(q.params.id)));

  // Goals & AI companion (WF-02)
  r.on('GET', 'goals', (q) => listGoals(q.ctx, q.query.get('includeArchived') === 'true'));
  r.on('POST', 'goals', (q) => createGoal(q.ctx, q.input(createGoalSchema)), 201);
  r.on('PATCH', 'goals/:id', (q) => updateGoal(q.ctx, idParam(q.params.id), q.input(updateGoalSchema)));
  r.on('GET', 'goal-proposals/:id', (q) => getGoalProposal(q.ctx, idParam(q.params.id)));
  r.on('POST', 'goal-proposals/:id/approve', (q) => approveGoalProposal(q.ctx, idParam(q.params.id), q.input(approveGoalProposalSchema)));
  r.on('POST', 'goal-proposals/:id/reject', (q) => rejectProposal(q.ctx, 'goal_proposals', idParam(q.params.id)));
  r.on('POST', 'ai/turn', (q) => aiTurn(q.ctx, q.input(aiTurnSchema)));
  r.on('GET', 'ai/conversations', ({ ctx }) => listConversations(ctx));
  r.on('GET', 'ai/conversations/:id', (q) => getConversation(q.ctx, idParam(q.params.id)));

  // Routine proposals (WF-03)
  r.on('GET', 'routine-proposals', ({ ctx }) => listRoutineProposals(ctx));
  r.on('POST', 'routine-proposals', (q) => generateRoutineProposal(q.ctx, q.input(generateRoutineProposalSchema)), 201);
  r.on('GET', 'routine-proposals/:id', (q) => getRoutineProposal(q.ctx, idParam(q.params.id)));
  r.on('PATCH', 'routine-proposals/:id', (q) => {
    const b = q.input(editRoutineProposalSchema);
    return editRoutineProposal(q.ctx, idParam(q.params.id), b.version, b.plan);
  });
  r.on('POST', 'routine-proposals/:id/revise', (q) => {
    const b = q.input(reviseRoutineProposalSchema);
    return reviseRoutineProposal(q.ctx, idParam(q.params.id), b.version, b.instruction);
  });
  r.on('POST', 'routine-proposals/:id/conflicts', (q) => checkProposalConflicts(q.ctx, idParam(q.params.id), q.input(checkProposalConflictsSchema).schedule));
  r.on('POST', 'routine-proposals/:id/approve', (q) => approveRoutineProposal(q.ctx, idParam(q.params.id), q.input(approveRoutineProposalSchema)));
  r.on('POST', 'routine-proposals/:id/reject', (q) => rejectProposal(q.ctx, 'routine_proposals', idParam(q.params.id)));

  // Routines (WF-04)
  r.on('GET', 'routines', ({ ctx }) => listRoutines(ctx));
  r.on('POST', 'routines', (q) => createManualRoutine(q.ctx, q.input(createManualRoutineSchema)), 201);
  r.on('GET', 'routines/:id', (q) => getRoutine(q.ctx, idParam(q.params.id)));
  r.on('POST', 'routines/:id/versions', (q) => saveRoutineVersion(q.ctx, idParam(q.params.id), q.input(updateRoutineSchema)), 201);

  // Sessions, logging, rescheduling (WF-06, WF-07, WF-12)
  r.on('GET', 'workout-sessions', (q) => {
    const { from, to } = q.queryInput(rangeQuery);
    return listSessions(q.ctx, from, to);
  });
  r.on('GET', 'workout-sessions/:id', (q) => getSessionDetail(q.ctx, idParam(q.params.id)));
  r.on('POST', 'workout-sessions', (q) => scheduleActivity(q.ctx, q.input(scheduleActivitySchema)), 201);
  r.on('POST', 'workout-sessions/:id/start', (q) => startSession(q.ctx, idParam(q.params.id), q.input(startSessionSchema).startedAt));
  r.on('POST', 'workout-sessions/:id/logs', (q) => upsertSetLogs(q.ctx, idParam(q.params.id), q.input(upsertSetLogsSchema).logs));
  r.on('POST', 'workout-sessions/:id/finish', (q) => finishSession(q.ctx, idParam(q.params.id), q.input(finishSessionSchema)));
  r.on('PATCH', 'workout-sessions/:id/reschedule', (q) => rescheduleSession(q.ctx, idParam(q.params.id), q.input(rescheduleSessionSchema)));
  r.on('POST', 'workout-sessions/:id/missed', (q) => {
    const b = q.input(markMissedSchema);
    return setSessionOutcome(q.ctx, idParam(q.params.id), 'missed', b.reason, b.idempotencyKey);
  });
  r.on('POST', 'workout-sessions/:id/cancel', (q) => {
    const b = q.input(cancelSessionSchema);
    return setSessionOutcome(q.ctx, idParam(q.params.id), 'cancelled', b.reason, b.idempotencyKey);
  });
  r.on('PATCH', 'workout-logs/:id', (q) => correctSetLog(q.ctx, idParam(q.params.id), q.input(correctSetLogSchema)));
  r.on('POST', 'activities', (q) => logActivity(q.ctx, q.input(logActivitySchema)), 201);

  // History & personal records (WF-09)
  r.on('GET', 'history', (q) => {
    const { from, to } = q.queryInput(rangeQuery);
    return getHistory(q.ctx, from, to);
  });
  r.on('GET', 'exercises', ({ ctx }) => listExercises(ctx));
  r.on('GET', 'exercises/history', (q) => getExerciseHistory(q.ctx, z.string().min(1).max(120).parse(q.query.get('name'))));
  r.on('GET', 'personal-records', ({ ctx }) => getPersonalRecords(ctx));

  // Meal planning (WF-10)
  r.on('GET', 'meal-plans', ({ ctx }) => listMealPlans(ctx));
  r.on('GET', 'meal-plans/:id', (q) => getMealPlan(q.ctx, idParam(q.params.id)));
  r.on('POST', 'meal-plan-proposals', (q) => generateMealPlanProposal(q.ctx, q.input(generateMealPlanSchema)), 201);
  r.on('GET', 'meal-plan-proposals/:id', (q) => getMealPlanProposal(q.ctx, idParam(q.params.id)));
  r.on('PATCH', 'meal-plan-proposals/:id', (q) => {
    const b = q.input(editMealPlanProposalSchema);
    return editMealPlanProposal(q.ctx, idParam(q.params.id), b.version, b.plan);
  });
  r.on('POST', 'meal-plan-proposals/:id/revise', (q) => {
    const b = q.input(reviseMealPlanProposalSchema);
    return reviseMealPlanProposal(q.ctx, idParam(q.params.id), b.version, b.instruction);
  });
  r.on('POST', 'meal-plan-proposals/:id/approve', (q) => {
    const b = q.input(approveMealPlanSchema);
    return approveMealPlanProposal(q.ctx, idParam(q.params.id), b.version, b.idempotencyKey);
  });
  r.on('POST', 'meal-plan-proposals/:id/reject', (q) => rejectProposal(q.ctx, 'meal_plan_proposals', idParam(q.params.id)));
  r.on('POST', 'meal-plans/:id/shopping-items', (q) => addShoppingItem(q.ctx, idParam(q.params.id), q.input(addShoppingItemSchema)), 201);
  r.on('PATCH', 'shopping-items/:id', (q) => updateShoppingItem(q.ctx, idParam(q.params.id), q.input(updateShoppingItemSchema)));
  r.on('DELETE', 'shopping-items/:id', (q) => deleteShoppingItem(q.ctx, idParam(q.params.id)));

  // Hydration (WF-13) & fasting (WF-14)
  r.on('GET', 'hydration', (q) => getHydrationDay(q.ctx, q.queryInput(optionalDate).date));
  r.on('PUT', 'hydration/target', (q) => {
    const b = q.input(hydrationTargetSchema);
    return setHydrationTarget(q.ctx, b.dailyTarget, b.unit);
  });
  r.on('POST', 'hydration/entries', (q) => addHydrationEntry(q.ctx, q.input(hydrationEntrySchema)), 201);
  r.on('DELETE', 'hydration/entries/:id', (q) => deleteHydrationEntry(q.ctx, idParam(q.params.id)));
  r.on('GET', 'fasting', ({ ctx }) => getFastingState(ctx));
  r.on('PUT', 'fasting/schedule', (q) => setFastingSchedule(q.ctx, q.input(fastingScheduleSchema)));
  r.on('POST', 'fasting/start', (q) => startFast(q.ctx, q.input(startFastSchema)));
  r.on('POST', 'fasting/end', (q) => endFast(q.ctx, q.input(endFastSchema).endedAt));

  // Monthly review (WF-15)
  r.on('GET', 'monthly-reviews', ({ ctx }) => listMonthlyReviews(ctx));
  r.on('POST', 'monthly-reviews/generate', (q) => generateMonthlyReview(q.ctx, q.input(generateMonthlyReviewSchema)));
  r.on('POST', 'monthly-reviews', (q) => saveMonthlyReview(q.ctx, q.input(saveMonthlyReviewSchema)), 201);
  r.on('GET', 'monthly-reviews/:id', (q) => getMonthlyReview(q.ctx, idParam(q.params.id)));

  return r;
}
