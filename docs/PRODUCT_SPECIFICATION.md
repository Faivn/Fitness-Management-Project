# Personal Fitness Workspace

## Product Specification, Workflow Catalogue, Business Rules and Acceptance Criteria

**Document status:** Working source of truth — React Native frontend and backend architecture selected\
**Version:** 1.2\
**Date:** October 2026\
**Product type:** Personal fitness management application with
conversational AI\
**Initial implementation target:** React Native application, with a secure
backend for persistence and AI orchestration

------------------------------------------------------------------------

## 1. Purpose of this document

This document defines the product we intend to build: a connected
personal fitness workspace that brings workout planning, workout
execution, scheduling, meal planning, running, hydration, intermittent
fasting, activity history and AI-assisted adjustments into one place.

It is written to be usable by a product designer, engineer, or coding
agent such as Claude working from the GitHub repository. It defines:

-   Product intent and scope.
-   User stories and workflow specifications.
-   Screen responsibilities and interactions.
-   Workflow states and transitions.
-   Data entities and relationships.
-   AI responsibilities and safety boundaries.
-   Business rules and failure handling.
-   Acceptance criteria and testing scenarios.
-   Flutter implementation guidance and repository expectations.

This is the product source of truth. Product requirements and workflow behaviour are defined in this document; the implementation decisions in Section 8 are now the selected baseline. Any later architecture change must be documented and justified rather than introduced silently.

## 2. Product vision

Create one personal fitness workspace where a user can plan fitness
activities, discuss goals with an AI companion, generate and approve
workout routines, execute workouts, record actual performance, adapt
when plans change, organise meals, and preserve a trustworthy history of
their fitness journey.

The app should reduce the manual work of connecting information across
ChatGPT, Notes, Notion, calendar/reminder tools and separate fasting or
fitness apps.

### 2.1 Core value proposition

**Plan your fitness, adapt when life happens, record what you actually
do, and keep the context of your journey in one place.**

### 2.2 Product principles

1.  **The workspace is the product; AI is an integrated assistant.** The
    dashboard and management workflows remain useful without chatting
    with AI for every action.
2.  **Conversation should create usable data.** Approved AI
    recommendations can become goals, routines, schedule entries and
    meal plans---not text that the user must manually copy elsewhere.
3.  **The user stays in control.** Generated plans and consequential
    changes require review and appropriate confirmation.
4.  **Planned and actual activity are different.** A scheduled workout
    is not proof that it happened. A meal plan is not proof that the
    user ate the meals.
5.  **History is durable.** New routines, new months and schedule
    changes must not silently erase completed workouts, logs or prior
    summaries.
6.  **Manual workflows remain available.** Users can create and edit
    routines without AI.
7.  **The system should be non-judgmental.** Missed workouts and changed
    plans are normal events to record, not reasons to shame the user.
8.  **Optional modules remain optional.** Hydration and fasting can be
    enabled or ignored.
9.  **AI is not the source of truth.** The backend and persisted records
    determine the actual state of routines, sessions and logs.
10. **Build the full intended experience through coherent implementation
    stages.** Implementation stages are not permission to remove the
    product's defining workflows from the vision.

## 3. Product scope and priority

### 3.1 Core workflows for the current product

  -------------------------------------------------------------------------
  ID                Workflow           Priority          Scope
  ----------------- ------------------ ----------------- ------------------
  WF-01             Lightweight        Core              Welcome, explain
                    onboarding                           the product, enter
                                                         workspace

  WF-02             AI conversation    Core              Discuss goals and
                    and goal setting                     context
                                                         conversationally

  WF-03             AI routine         Core              Generate, refine,
                    generation and                       approve and apply
                    approval                             structured workout
                                                         routines

  WF-04             Manual workout     Core supporting   Create or edit
                    creation and       workflow          routines without
                    editing                              AI

  WF-05             Daily overview     Core              One view of
                                                         today's activities
                                                         and relevant plan
                                                         information

  WF-06             Workout execution  Core              Record actual
                    and logging                          exercises, sets,
                                                         reps and weights

  WF-07             Missed workouts    Core              Preserve original
                    and rescheduling                     plan, reason, new
                                                         date and eventual
                                                         outcome

  WF-08             Spontaneous and    Core              Record unscheduled
                    historical workout                   or past activities
                    logging                              accurately

  WF-09             Exercise history   Core supporting   Show prior
                    and personal       capability        performance and
                    records                              preserve records

  WF-10             AI meal planning,  Core planned      Generate a meal
                    timetable and      capability        timetable and
                    shopping list                        shopping list
                                                         through
                                                         conversation

  WF-11             Unified schedule   Core supporting   Show planned
                    and reminders      capability        workouts/runs and
                                                         support relevant
                                                         reminders

  WF-12             Running and other  Included, exact   Schedule runs and
                    activity           depth to be       record activities
                    planning/logging   refined           where supported

  WF-13             Hydration          Optional module   Water goal, intake
                    management                           logging and
                                                         optional reminders

  WF-14             Intermittent       Optional module   Fasting
                    fasting                              schedule/status
                                                         and optional
                                                         reminders

  WF-15             Monthly review and Core history      Adjust future
                    AI-assisted        rule; reporting   plans while
                    adjustment         can evolve        preserving and
                                                         summarising prior
                                                         activity

  WF-16             Basic preferences  Supporting        Manage basic
                    and settings                         preferences and
                                                         enabled modules
  -------------------------------------------------------------------------

### 3.2 Explicitly deferred

These features are not part of the initial intended implementation
unless deliberately reprioritised:

-   Calorie tracking and daily calorie totals.
-   Protein/macronutrient tracking and nutrition dashboards.
-   Logging every meal actually consumed.
-   Food discovery engine.
-   Advanced food substitutions and availability-based discovery.
-   PDF/document upload and workout-plan extraction.
-   Advanced weekly, monthly and annual analytics dashboards.
-   Advanced body measurement or physique analytics.
-   Integrations with third-party fitness devices or health platforms.
-   Complex social features, sharing or coaching marketplace.

**Important meal-planning boundary:** The initial meal feature creates a
plan, timetable and shopping list. It does not require users to log
actual consumption and does not calculate or track calories. The app may
display general food guidance or meal descriptions, but it must not turn
meal planning into a calorie-tracking workflow.

### 3.3 Full product vision versus implementation stages

The full product vision includes all core and optional workflows
described here. Engineering can implement these in stages, but each
stage should preserve the architecture and data contracts needed by the
rest of the system.

Do not replace the intended product with a chatbot-only prototype or a
static dashboard. The core value comes from connected data and
workflows.

------------------------------------------------------------------------

# 4. Information architecture

The interface should provide a small, understandable navigation
structure. Exact visual styling is open to design work; the
responsibilities of each area are defined here.

## 4.1 Suggested primary navigation

1.  **Overview** --- today's plan, next activity and enabled daily
    summaries.
2.  **Workouts** --- routines, scheduled sessions, exercise logging and
    workout history.
3.  **Nutrition / Meal Plan** --- approved meal timetable and shopping
    list.
4.  **Schedule** --- upcoming gym sessions, runs, rest days and relevant
    reminders.
5.  **History** --- completed, missed, rescheduled and spontaneous
    activities; monthly records.
6.  **AI companion** --- persistent entry point accessible from the
    workspace.

Hydration and fasting can appear as modules/cards in Overview and their
own detail views. They do not need to occupy primary navigation if that
makes the interface crowded.

## 4.2 Shared interface requirements

-   Show loading, empty, error, draft, saved and completed states
    clearly.
-   Keep primary actions visible and labelled.
-   Distinguish a proposed plan from an active/saved plan.
-   Do not make AI chat the only way to access saved information.
-   Keep the user's place when opening an activity or returning from a
    detail screen.
-   Use consistent date, time, duration, weight and repetition formats.
-   Support accessible text, keyboard navigation where applicable, and
    usable touch targets.
-   On narrow screens, prioritise readable cards and clear action
    hierarchy over dense dashboards.

------------------------------------------------------------------------

# 5. Workflow specifications

Each workflow below defines its user story, journey, states, data,
rules, edge cases and acceptance criteria. Exact UI layout and styling
remain implementation/design decisions unless explicitly specified.

## WF-01 --- Lightweight onboarding

### Objective

Welcome the user, explain what the workspace does, and get them into the
product without a long questionnaire.

### User story

As a user, I want to understand the purpose of the app and start using
it immediately, so that I do not have to complete a lengthy profile
before I can benefit from it.

### Journey

1.  User opens the app for the first time.
2.  App displays a concise welcome screen.
3.  Screen explains that the app connects workouts, schedules, meal
    planning and an AI fitness companion.
4.  User selects **Get started**.
5.  App opens the Overview or a short first-use state with an obvious
    option to talk to the AI.
6.  Fitness preferences are gathered conversationally when needed, not
    through a mandatory onboarding form.

### Screens and interactions

-   Welcome screen: product name, short value proposition, primary Get
    started action.
-   Optional privacy/data note: explain that saved plans and activity
    history belong to the user's workspace.
-   No mandatory questionnaire for goals, equipment, training level,
    dietary preferences or schedule.

### State model

`not_started → welcome_viewed → workspace_entered`

Optional error state: `initialisation_failed`, with retry.

### Data requirements

-   User/account identifier, if authentication is required.
-   Onboarding completion flag and timestamp.
-   Basic app preferences only where needed.

### Business rules

-   Onboarding must be short.
-   Do not block access to the workspace because optional fitness
    details are missing.
-   AI asks for relevant missing context at the point it becomes
    necessary.
-   If authentication is required, keep sign-in distinct from fitness
    profiling.

### Edge cases

-   User closes the app during onboarding.
-   User returns after onboarding has been completed.
-   Local or network initialisation fails.
-   User has no goals or saved routines yet.

### Acceptance criteria

-   [ ] A first-time user can understand the app's purpose from the
    welcome screen.
-   [ ] The user can enter the workspace without completing a long
    fitness questionnaire.
-   [ ] Missing fitness preferences are collected contextually when
    needed.
-   [ ] Returning users are not shown mandatory onboarding repeatedly.
-   [ ] An initialisation failure presents a clear retry path.

------------------------------------------------------------------------

## WF-02 --- AI conversation and goal setting

### Objective

Let the user discuss their fitness goals naturally and have the AI
translate the conversation into explicit, reviewable goals and next
steps.

### User story

As a user, I want to explain what I want to achieve in my own words and
have the AI help clarify and organise my goals, so that I do not have to
translate every thought into structured fields myself.

### Journey

1.  User opens the AI companion from any relevant workspace area.
2.  User describes a goal, problem, schedule or desired change.
3.  System retrieves relevant saved profile details, active goals,
    routine and recent activity.
4.  AI identifies what is already known and what remains unclear.
5.  AI asks focused follow-up questions only where necessary.
6.  AI summarises its understanding of the user's goals and constraints.
7.  AI proposes one or more structured goals or next actions.
8.  User can correct, refine, accept or reject the proposal.
9.  Approved goals are saved and become available to the
    routine-generation workflow.

### Example

User: "I want to train four times a week, focus on upper and lower body,
and improve my running."

AI should establish relevant details such as available days, equipment
and experience if these are not already known. It should not ask for all
possible profile information if only a subset is necessary.

### Screens and interactions

-   Conversation thread.
-   Message composer.
-   Contextual question/answer interactions.
-   Goal proposal card with editable description, priority and optional
    target/timeframe.
-   Actions: Edit, Ask for changes, Approve, Reject.

### State model

`idle → interpreting_request → retrieving_context → clarifying (optional) → proposing_goals → awaiting_user_decision`

From `awaiting_user_decision`: - Edit/refine → `proposing_goals` -
Approve → `saving_goals → goals_saved` - Reject → `proposal_rejected` -
Cancel → `cancelled`

AI error: `assistant_error → retry_available`, preserving conversation
text.

### Data requirements

-   Conversation messages and timestamps.
-   User's relevant saved preferences and context.
-   Goal proposal ID and version.
-   Goal description, priority, status, optional measurable target and
    timeframe.
-   Approval status and approval timestamp.
-   Link from approved goal to later routine proposals.

### Business rules

-   Distinguish a user-stated aspiration from a measurable goal the AI
    proposes.
-   Do not invent user preferences, measurements, training history or
    achievements.
-   Goals remain proposals until the user approves them.
-   Do not create duplicate goals when the same request is retried.
-   Relevant context should be retrieved from persisted records, not
    only old conversation text.
-   The user can discuss goals without immediately creating a workout
    routine.

### Edge cases

-   Ambiguous goal.
-   Conflicting preferences.
-   User changes their mind mid-conversation.
-   AI service is unavailable.
-   User rejects all proposed goals.
-   User asks to update an existing goal rather than create a new one.

### Acceptance criteria

-   [ ] User can describe a goal in free text.
-   [ ] AI uses relevant saved context and asks focused questions where
    necessary.
-   [ ] AI presents goals in a structured, editable form.
-   [ ] No proposed goal is saved as approved without user action.
-   [ ] Approved goals are available to subsequent workflows.
-   [ ] A failed AI response does not erase the conversation or user
    input.

------------------------------------------------------------------------

## WF-03 --- AI routine generation and approval

### Objective

Convert a user's goals and preferences into a structured workout
routine, let the user refine it, and apply it to the workspace only
after explicit approval.

### User story

As a user, I want to discuss my goals with the AI, review and adjust a
proposed workout plan, and approve it so that the app can populate my
routines and schedule without manual copying.

### Entry points

-   AI companion: "Create a routine for me."
-   Goals area: "Build a routine for this goal."
-   Workout space: "Create routine with AI" or "Adjust current routine."

### Journey

1.  Identify whether the user wants a new routine, an adjustment, or a
    replacement.
2.  Retrieve goals, training preferences, equipment, available days,
    relevant limitations, existing routines and schedule.
3.  Ask for essential missing information.
4.  Generate a structured proposal containing goals, weekly training
    split, sessions and exercise details.
5.  Display the plan in an editable review interface.
6.  User requests changes through chat or edits fields directly.
7.  AI updates the proposal while preserving unaffected user edits.
8.  User reviews the final plan and intended changes.
9.  System validates required fields and checks schedule conflicts.
10. User confirms the changes to apply.
11. Backend saves the approved routine and creates the required
    scheduled session instances.
12. Overview, Workout space and Schedule reflect the saved state.
13. The AI can retrieve the active routine in future conversations.

### Required proposal content

-   Routine title and purpose.
-   Linked goal(s).
-   Training frequency and weekly split.
-   Proposed training days and optional session times.
-   Sessions and muscle/activity focus.
-   Exercises and order.
-   Target sets and reps or rep range.
-   Optional target weight, rest period, instructions and notes.
-   Progression guidance where useful and appropriate.
-   Assumptions and warnings requiring review.
-   Whether the proposal creates a new routine or affects an existing
    one.

### State model

`collecting_context → generating → draft → editing ↔ draft → awaiting_approval → validating → ready_to_apply → applying → applied`

Additional states: - `clarifying`: missing essential information. -
`generation_failed`: AI generation could not complete. -
`validation_failed`: proposal needs correction. - `rejected`: user
rejects the proposal. - `cancelled`: user abandons the workflow. -
`application_failed`: persistence failed or requires reconciliation.

No draft or rejected proposal may silently become an active routine.

### Data requirements

-   Routine proposal ID, owner, source, status, version and timestamps.
-   Proposed goals and links to existing goals.
-   Proposed sessions, weekly recurrence, days and times.
-   Proposed exercises, order, sets, reps, optional weight, rest and
    instructions.
-   User edits and unresolved warnings.
-   Approval event tied to the exact proposal version.
-   Application request and idempotency key.
-   Persisted routine and scheduled session IDs after successful
    application.

### Business rules

-   AI output must be structured and schema-validated.
-   User can edit directly or refine conversationally.
-   Regeneration must not silently discard manual edits.
-   User must review and approve before changes become active.
-   Schedule conflicts must be surfaced before applying changes.
-   Replacing a routine must preserve completed sessions and their logs.
-   The backend, not the AI, owns validation and persistence.
-   Repeated application requests must not create duplicate sessions.
-   After successful application, the AI must be able to retrieve the
    actual saved routine.

### Edge cases

-   Missing profile details.
-   Invalid or incomplete AI output.
-   User edits a plan and then asks for regeneration.
-   Existing routine would be replaced.
-   Proposed sessions overlap existing events.
-   User rejects the proposal.
-   Network failure during application.
-   Duplicate click or retry.
-   App closes while the save request is in progress.
-   User changes the schedule before the proposal is applied.

### Acceptance criteria

-   [ ] AI generates a structured proposal from the user's goal and
    relevant context.
-   [ ] User can inspect and edit goals, days, sessions and exercise
    details.
-   [ ] Chat-based refinements update the proposal without changing the
    active routine prematurely.
-   [ ] Manual edits to unaffected fields are preserved.
-   [ ] User explicitly approves the proposal and intended schedule
    changes.
-   [ ] Invalid proposals cannot be applied.
-   [ ] Conflicts are explained and resolved or explicitly handled.
-   [ ] Successful application creates a routine and its schedule
    instances.
-   [ ] The routine appears in the Workout space, Schedule and relevant
    Overview cards.
-   [ ] Retry does not create duplicate sessions.
-   [ ] Existing completed history remains unchanged.
-   [ ] AI errors preserve user input and provide a recovery path.

------------------------------------------------------------------------

## WF-04 --- Manual workout creation and editing

### Objective

Allow users to create and maintain routines without requiring AI.

### User story

As a user, I want to build or edit a workout manually so that I retain
control and can use the app even when I do not need AI assistance.

### Journey

1.  User opens Workout space.
2.  User selects Create routine or edits an existing routine.
3.  User enters a name and optional goal.
4.  User adds sessions/training days.
5.  User adds exercises and defines sets, reps, optional weight, rest
    and notes.
6.  User reviews the routine.
7.  User saves it as a draft or active routine.
8.  If activation creates schedule entries, the user reviews the
    schedule and confirms.
9.  Saved routine appears in the workspace.

### State model

`not_started → editing → validating → draft_saved` or
`ready_to_activate → active`

Existing routine:
`active → editing_copy → review_changes → saved_new_version`

### Data requirements

Same routine/session/exercise entities used by WF-03. Record source as
`manual`; preserve version and timestamps.

### Business rules

-   Manual and AI-generated routines must use the same underlying data
    model.
-   A user should not have to recreate an existing routine to make a
    small edit.
-   Editing a routine template must not rewrite completed workout logs.
-   Creating a template and scheduling sessions are distinct actions.
-   Validate required exercise fields before activation.

### Edge cases

-   Empty routine.
-   Duplicate exercise.
-   User leaves without saving.
-   Invalid target values.
-   Editing a routine with upcoming sessions.
-   Deleting an exercise already referenced by historical logs.

### Acceptance criteria

-   [ ] User can create, edit and save a routine without AI.
-   [ ] User can add, reorder and remove exercises.
-   [ ] Routine data is validated before activation.
-   [ ] Manual and AI-created routines appear consistently in the same
    views.
-   [ ] Historical logs remain available after routine edits.
-   [ ] Unsaved edits are not falsely reported as saved.

------------------------------------------------------------------------

## WF-05 --- Daily overview

### Objective

Provide one useful view of today's plan and the next actions the user
may need to take.

### User story

As a user, I want to open the app and quickly see what is planned for
today, so that I do not have to check multiple tools.

### Information shown

-   Today's workout or rest day.
-   Planned workout time and start action.
-   Other scheduled activities, including running where applicable.
-   Today's meal timetable from the approved meal plan.
-   Hydration progress if enabled.
-   Fasting status if enabled.
-   Upcoming reminders.
-   A clear route to review missed, rescheduled or incomplete
    activities.

The overview must not show planned meals as meals consumed. It must not
display calorie totals in the initial meal-planning scope.

### Journey

1.  User opens Overview.
2.  System retrieves today's local-date records and enabled modules.
3.  User opens a workout, starts a session, views the meal timetable or
    checks an enabled module.
4.  After an action, the overview refreshes from persisted state.

### State model

`loading → populated` or `empty_day`; recoverable error:
`load_failed → retrying`.

### Data requirements

-   Local date/timezone.
-   Scheduled workout sessions and status.
-   Running/other activities.
-   Approved meal plan and timetable entries.
-   Hydration and fasting state if enabled.
-   Reminder records.

### Business rules

-   Display data from persisted records.
-   Rest days are valid planned days, not missing data.
-   Past-due sessions should not disappear automatically.
-   A moved workout should show its current scheduled date while its
    original history remains accessible.
-   Optional modules must not create empty or distracting panels when
    disabled.
-   Overview updates should reflect successful changes elsewhere in the
    app.

### Edge cases

-   No activities scheduled.
-   Several activities in one day.
-   Workout was moved to a different day.
-   User's timezone changes.
-   Data cannot load.
-   A plan exists but there is no activity scheduled today.

### Acceptance criteria

-   [ ] User can identify today's workout or rest day quickly.
-   [ ] Overview displays scheduled workouts and running activities.
-   [ ] Approved meal timetable is visible without requiring meal
    logging.
-   [ ] Enabled hydration and fasting modules display their current
    state.
-   [ ] Overview reflects saved changes after rescheduling or completing
    a workout.
-   [ ] Empty and error states are clear and actionable.

------------------------------------------------------------------------

## WF-06 --- Workout execution and logging

### Objective

Let users execute a scheduled routine and record what actually happened,
including real weights and repetitions.

### User story

As a user, I want to follow my workout and record actual sets, reps and
weights so that I can review my performance later and use previous
performance to inform future sessions.

### Journey

1.  User opens a scheduled workout or chooses Start routine.
2.  App displays the session's exercise list and relevant previous
    performance.
3.  User starts the session.
4.  User records actual sets, reps and weights for each exercise.
5.  User can add notes or mark a set/exercise as skipped where
    supported.
6.  User completes the session or leaves it incomplete.
7.  App saves actual completion date/time and performance logs.
8.  Workout history and relevant overview state update.

### State model

Session: `scheduled → in_progress → completed`

Alternative transitions: - `scheduled → missed` via WF-07. -
`in_progress → paused/incomplete` if the app supports explicit pause. -
`in_progress → abandoned/incomplete` if the user exits without
completing.

A session must not be marked completed solely because it was opened.

### Data requirements

-   Workout session ID and linked routine/version.
-   Planned date/time and actual start/end/completion timestamps.
-   Session status.
-   Exercise logs with exercise ID, set number, actual reps, actual
    weight and unit.
-   Optional notes, skipped status and user-entered effort fields if
    implemented.
-   Link to prior performance for display, not destructive overwrite.

### Business rules

-   Planned targets and actual values are stored separately.
-   Previous performance is read-only context for the current session.
-   User-entered values must persist across navigation and recoverable
    interruptions.
-   Completed session logs are immutable in history except through an
    explicit correction/edit action.
-   Units must be consistent and visible.
-   An incomplete session should not be represented as a fully completed
    workout.

### Edge cases

-   User completes only part of the routine.
-   User skips an exercise.
-   App closes during a workout.
-   User accidentally enters an incorrect weight.
-   A planned exercise was unavailable.
-   A session is completed on a different date.
-   Previous performance is unavailable.

### Acceptance criteria

-   [ ] User can start a scheduled workout.
-   [ ] Previous performance is shown when matching records exist.
-   [ ] User can log actual sets, reps and weights.
-   [ ] Logs persist after navigation or app restart.
-   [ ] Actual completion date is recorded.
-   [ ] Incomplete sessions are not falsely marked completed.
-   [ ] Corrections do not erase the original history without an
    explicit, auditable edit.

------------------------------------------------------------------------

## WF-07 --- Missed workouts and rescheduling

### Objective

Help the user adapt when a workout cannot happen as planned while
preserving the original schedule and what eventually happens.

### User story

As a user, I want to move a workout, record why it changed, and later
complete it on another day without losing the original plan or creating
a false record of completion.

### Journey

1.  User opens a scheduled session.
2.  User chooses Move to another day, Mark as missed/not completed, or
    Cancel where appropriate.
3.  For rescheduling, user selects a new date/time and may enter a
    reason.
4.  App checks conflicts and displays the proposed change.
5.  User confirms.
6.  App updates the current schedule and writes a schedule-change
    history record.
7.  The session remains linked to its routine and exercise targets.
8.  When the user completes it, actual completion is logged against the
    actual date.
9.  History shows original date, new date, reason where supplied, and
    final outcome.

### State model

`scheduled → rescheduling → scheduled_on_new_date`

Other outcomes: - `scheduled → missed` - `scheduled → cancelled` -
`scheduled_on_new_date → in_progress → completed` -
`missed → rescheduled` only through an explicit user action.

### Data requirements

-   Session ID.
-   Original planned date/time.
-   Current planned date/time.
-   Change timestamp and optional reason.
-   Previous and new values for relevant schedule fields.
-   Session status.
-   Actual completion date/time and logs when completed.

### Business rules

-   Never overwrite the original planned date without preserving it in
    history.
-   Rescheduling does not itself mean completion.
-   The workout's exercise details must remain intact when moved.
-   Conflict detection must be run against the proposed new date/time.
-   A reason is optional.
-   A missed session is not automatically cancelled.
-   Do not automatically compress missed sessions into the next day
    without the user's approval.
-   User can choose whether to reschedule, leave as missed or cancel.

### Edge cases

-   New date conflicts with another activity.
-   User moves a workout multiple times.
-   User completes the workout before updating its scheduled status.
-   User reschedules a session that was already marked missed.
-   User cancels a session after moving it.
-   User provides no reason.
-   User attempts to move a completed session.

### Acceptance criteria

-   [ ] User can move a scheduled workout to a new date/time.
-   [ ] User can optionally record a reason.
-   [ ] Original and new schedule details remain accessible in history.
-   [ ] Exercise targets remain intact after rescheduling.
-   [ ] A moved session is not marked completed until completion is
    recorded.
-   [ ] Actual completion date reflects when the workout happened.
-   [ ] Conflicts are surfaced before the schedule change is applied.
-   [ ] Repeated changes produce a coherent history rather than erasing
    earlier changes.

------------------------------------------------------------------------

## WF-08 --- Spontaneous and historical workout logging

### Objective

Allow users to record workouts that were not planned in advance or were
completed on a date other than the scheduled date.

### User story

As a user, I want to log an activity that happened spontaneously or
record a past workout so that my history reflects reality rather than
only the original schedule.

### Journey

1.  User chooses Log an unscheduled workout or Add past activity.
2.  User selects activity type, date and relevant details.
3.  User adds exercises and actual performance if applicable.
4.  User reviews and saves.
5.  App records the activity as completed/recorded without inventing a
    prior scheduled event.
6.  History and relevant progress records update.

### State model

`creating_activity → validating → saved`

Failure: `save_failed → retry_available`.

### Data requirements

-   Activity ID and owner.
-   Activity type.
-   Actual activity date/time.
-   Optional linked routine or session.
-   Exercises and actual logs where applicable.
-   Notes and creation timestamp.
-   Source marker such as `spontaneous` or `historical_entry`.

### Business rules

-   Do not create a fictional original schedule for an unscheduled
    activity.
-   Historical entries should distinguish activity date from entry
    creation date.
-   If an activity corresponds to a scheduled session, allow linking
    rather than creating a duplicate.
-   Past activity entry should not automatically alter other scheduled
    sessions.

### Edge cases

-   User logs the same activity twice.
-   User records an activity for a past date.
-   User is unsure of exact weights or reps.
-   A matching scheduled session already exists.
-   User edits a historical entry.

### Acceptance criteria

-   [ ] User can log an unscheduled activity.
-   [ ] User can record an activity date different from the date of data
    entry.
-   [ ] The system distinguishes planned sessions from spontaneous
    activities.
-   [ ] The user can record partial details without inventing unknown
    values.
-   [ ] Duplicate or matching scheduled activities can be identified and
    handled.
-   [ ] Historical activity appears in the correct timeline position.

------------------------------------------------------------------------

## WF-09 --- Exercise history and personal records

### Objective

Keep performance data available across sessions and routines.

### User story

As a user, I want to see what I lifted or completed previously so that I
can understand my performance and make informed decisions during future
workouts.

### Journey

1.  User opens an exercise or workout session.
2.  App retrieves matching prior exercise logs.
3.  App displays recent values and any supported personal records.
4.  User records current performance.
5.  App saves the new log and updates derived records if the calculation
    rules are defined.
6.  User can inspect prior records without changing them.

### State model

`no_history` or
`history_available → viewing_history → recording_current_performance → history_updated`

### Data requirements

-   Canonical exercise identifier where possible.
-   Exercise display name and variations.
-   Set logs, reps, weights and units.
-   Activity dates and session links.
-   Personal record type, value, unit and date if calculated.
-   Calculation method/version for derived records.

### Business rules

-   Do not assume two differently named exercises are identical without
    a reliable mapping.
-   Preserve original set logs.
-   Derived records should be recalculable from source logs where
    feasible.
-   Clearly distinguish recorded values from calculated estimates.
-   Advanced analytics and trend dashboards are deferred; reliable
    underlying history is not.

### Edge cases

-   Exercise name changes.
-   Exercise variation is similar but not identical.
-   Mixed units.
-   Incomplete historical logs.
-   User corrects a past entry.

### Acceptance criteria

-   [ ] Previous performance appears when a matching exercise record
    exists.
-   [ ] New logs do not overwrite older set logs.
-   [ ] Unknown historical values remain unknown.
-   [ ] Personal records, if displayed, have defined calculation rules.
-   [ ] Historical data remains available after routine changes.

------------------------------------------------------------------------

## WF-10 --- AI meal planning, timetable and shopping list

### Objective

Let the user describe their nutrition goal and food preferences
conversationally, then receive an organised meal timetable and shopping
list without requiring calorie tracking or meal-consumption logging.

### User story

As a user, I want to tell the AI about my fitness phase, location,
preferred foods, budget and routine, and receive practical meal
recommendations, a weekly timetable and shopping list that I can use
directly.

### Example request

"I am in a cutting phase, I live in Nigeria, I prefer these foods, and I
need a practical plan for the coming week. Suggest meals and smoothies,
organise them by day and time, and create a shopping list."

### Journey

1.  User opens the Meal Plan area or AI companion.
2.  User describes goals, food preferences, location/cuisine, budget,
    number of days and any relevant dietary constraints.
3.  AI retrieves relevant saved preferences and asks focused questions
    if necessary.
4.  AI proposes meals and snacks organised into a timetable.
5.  AI generates a consolidated shopping list based on the proposed
    meals.
6.  User reviews the plan, edits meals or requests changes.
7.  User approves the meal plan.
8.  App saves the plan and displays it in the Meal Plan area and daily
    overview.
9.  User can ask the AI to adjust a future plan or create the next
    week's/month's plan.
10. Old plans remain available as historical records.

### Required meal plan content

-   Plan title and date range.
-   Goal/context supplied by the user, such as cutting or general
    healthy eating.
-   Days of the week.
-   Meal slots such as breakfast, morning snack, lunch/afternoon snack,
    dinner/evening snack as relevant.
-   Meal names and descriptions.
-   Ingredients and approximate quantities where practical.
-   Smoothie recommendations where appropriate.
-   Shopping-list items consolidated across the plan.
-   Optional category and user notes.
-   Approval state and version.

Meal slots should be configurable rather than assuming every user needs
the same number of meals per day. The example "morning snacks, afternoon
snacks, night" illustrates the desired timetable format; the actual
slots should follow the user's preferences.

### What this workflow does not do

-   Does not require the user to log meals they consumed.
-   Does not calculate daily calories.
-   Does not track protein or macros.
-   Does not claim the user followed the plan.
-   Does not include a food discovery engine in the initial scope.
-   Does not automatically substitute unavailable foods using a
    discovery service.
-   Does not require a separate nutrition database for the first
    version.

### State model

`collecting_preferences → generating_plan → draft → editing ↔ draft → awaiting_approval → saving → saved`

Additional states: `generation_failed`, `rejected`, `cancelled`,
`save_failed`.

### Data requirements

-   Meal plan ID, user ID, title, context/goal, date range, status and
    version.
-   Daily timetable entries with date/day, meal slot, display order and
    planned meal.
-   Meal description and ingredient list.
-   Shopping-list items with item name, optional quantity/unit, category
    and linked plan/meal references.
-   User edits and approval timestamp.
-   Creation source (`AI` or `manual`).
-   Historical plan references.

### Business rules

-   The AI generates a plan; the user reviews it before it becomes the
    active approved plan.
-   The shopping list should be consolidated where possible so an
    ingredient used in several meals is not unnecessarily repeated.
-   Quantities should be shown only where the system can provide useful
    estimates; avoid false precision.
-   Do not show calorie or macro totals in the initial scope.
-   Do not represent a planned meal as a consumed meal.
-   Food suggestions should account for user-provided location,
    preferences and constraints.
-   The AI must not invent a user's allergies, budget or dietary
    restrictions.
-   If essential dietary constraints are unclear, ask before producing a
    confident recommendation.
-   Preserve old meal plans when generating a new week or month.
-   The shopping list should be linked to the relevant plan version.
-   The user can manually edit meal slots and shopping-list items.

### Edge cases

-   User gives insufficient preferences.
-   User changes the plan after the shopping list is generated.
-   Ingredient appears in multiple meals.
-   User requests an unrealistic or conflicting combination of
    constraints.
-   AI fails during generation.
-   User rejects the plan.
-   User generates a new month while an older plan remains in history.
-   Meal plan is saved but the UI fails to refresh.

### Acceptance criteria

-   [ ] User can request a meal plan through natural-language
    conversation.
-   [ ] AI can use stated goals, location/cuisine, preferences and
    budget where provided.
-   [ ] The result contains a timetable organised by day and meal slot.
-   [ ] Smoothie suggestions can be included where appropriate.
-   [ ] A consolidated shopping list is generated from the proposed
    meals.
-   [ ] User can review, edit, approve and save the plan.
-   [ ] Approved plan appears in the Meal Plan area and relevant daily
    overview.
-   [ ] The initial experience does not require calorie tracking or
    meal-consumption logging.
-   [ ] The app does not claim planned meals were eaten.
-   [ ] Creating a new plan does not erase earlier plans.

------------------------------------------------------------------------

## WF-11 --- Unified schedule and reminders

### Objective

Provide a coherent view of planned workouts, running and other supported
activities, with reminders where useful.

### User story

As a user, I want to see my planned activities together and receive
relevant reminders so that I can organise my fitness without checking
separate tools.

### Journey

1.  User opens Schedule.
2.  App shows calendar/list views of scheduled workouts and activities.
3.  User opens an event to view details.
4.  User can start a workout or request a reschedule.
5.  User configures supported reminders.
6.  Schedule updates after confirmed changes elsewhere.

### State model

`loading → calendar_loaded → event_selected → viewing_or_editing`

Reminder: `disabled → enabled → scheduled → delivered` or
`delivery_failed` where delivery status can be observed.

### Data requirements

-   Activity/session ID, type, planned date/time, timezone, status and
    source.
-   Reminder preference, lead time, channel and enabled state.
-   Link to the associated routine or activity.
-   Change history for rescheduled events.

### Business rules

-   Schedule entries must derive from persisted records.
-   Rescheduling must use WF-07 rules.
-   A reminder is not proof that an activity happened.
-   If notification permissions are unavailable, explain how the user
    can enable them.
-   Do not create duplicate reminders for the same event and
    configuration.
-   Meal timetable entries can be shown in Overview without necessarily
    creating notifications for every meal.

### Edge cases

-   Permission denied.
-   Timezone changes.
-   Event moved after a reminder was scheduled.
-   Duplicate calendar events.
-   Offline state.
-   Notification delivery cannot be verified.

### Acceptance criteria

-   [ ] User can view upcoming workouts and supported activities in one
    place.
-   [ ] Selecting an event opens its details and relevant actions.
-   [ ] Rescheduling updates the displayed date and associated reminder.
-   [ ] Reminder settings can be enabled or disabled.
-   [ ] Permission failures are explained without blocking the rest of
    the app.
-   [ ] Schedule does not treat a reminder as completion.

------------------------------------------------------------------------

## WF-12 --- Running and other activity planning/logging

### Objective

Include running as a first-class activity alongside gym workouts without
forcing every activity into a strength-training template.

### User story

As a user, I want to schedule running days and record that I completed a
run so that my activity history reflects my broader fitness routine.

### Journey

1.  User schedules a run manually or through AI-assisted planning.
2.  Run appears in the unified schedule and Overview.
3.  User starts or records the run.
4.  User records available details, such as date, duration, distance and
    notes, when known.
5.  User saves the activity.
6.  Activity appears in history and can be considered in future AI
    planning.

### State model

`planned → in_progress (optional) → completed`

Alternative states: `rescheduled`, `missed`, `cancelled`,
`historical_entry`.

### Data requirements

-   Activity ID, type, planned and actual dates.
-   Optional duration, distance, units and notes.
-   Status, source and creation timestamp.
-   Link to schedule and history.

### Business rules

-   Running is not required to have sets and reps.
-   Do not invent distance, pace or duration.
-   Planned and actual run dates must be distinct where they differ.
-   Running sessions use the shared scheduling/history rules.

### Edge cases

-   User does not know distance.
-   Run was spontaneous.
-   Run was moved.
-   User logs a run after the fact.
-   Duplicate run entry.

### Acceptance criteria

-   [ ] User can schedule a run.
-   [ ] Run appears in the shared schedule and daily overview.
-   [ ] User can record a completed run with partial details.
-   [ ] Unknown distance or duration remains unknown.
-   [ ] Running history is preserved alongside gym history.

------------------------------------------------------------------------

## WF-13 --- Hydration management (optional module)

### Objective

Allow the user to set a water goal, record water intake and optionally
receive reminders.

### User story

As a user, I want to record water intake and see my progress toward a
personal goal without being forced to use the feature if I do not need
it.

### Journey

1.  User enables hydration tracking.
2.  User sets or accepts an editable daily target.
3.  User records water intake.
4.  Overview updates the day's total and remaining amount.
5.  User can configure reminders or disable the module.

### State model

`disabled → enabled → target_configured → tracking`

Intake entry: `not_recorded → recorded → edited/deleted` through
explicit action.

### Data requirements

-   Module enabled state.
-   Daily target and unit.
-   Intake entries with quantity, unit, timestamp and local date.
-   Reminder configuration.

### Business rules

-   Goal is user-configurable.
-   Use explicit units and avoid silently mixing millilitres, litres and
    fluid ounces.
-   Do not shame the user for missing a target.
-   Do not claim medical suitability of a generic hydration target.
-   Module can be disabled without deleting historical records.

### Acceptance criteria

-   [ ] User can enable/disable hydration.
-   [ ] User can set a daily goal.
-   [ ] User can log intake and see the updated total.
-   [ ] Unit conversions are consistent.
-   [ ] Optional reminders can be configured.
-   [ ] Disabling the module does not erase historical intake records.

------------------------------------------------------------------------

## WF-14 --- Intermittent fasting (optional module)

### Objective

Allow the user to define a fasting schedule and see the current fasting
window without making fasting mandatory.

### User story

As a user, I want to configure an optional fasting schedule and see its
current status in my workspace.

### Journey

1.  User enables the fasting module.
2.  User defines the preferred fasting/eating window.
3.  App displays the current status based on local time and saved
    schedule.
4.  User can start, end or adjust a fast where manual tracking is
    supported.
5.  Optional reminders are configured.
6.  Overview reflects the current status.

### State model

`disabled → enabled → schedule_configured → not_fasting / fasting`

Transitions between fasting states should follow the saved schedule or
explicit user action.

### Data requirements

-   Module enabled state.
-   Schedule definition and timezone.
-   Start/end timestamps for recorded fasting sessions where supported.
-   Reminder preferences.

### Business rules

-   Fasting is optional.
-   The app must not present fasting as medically suitable for everyone.
-   Do not automatically modify meal plans solely because a fasting
    schedule exists.
-   Make it easy to pause or disable the module.
-   Preserve historical records if the module is disabled.

### Acceptance criteria

-   [ ] User can enable/disable fasting.
-   [ ] User can configure a schedule.
-   [ ] Current status reflects the configured schedule and local time.
-   [ ] Optional reminders can be managed.
-   [ ] Disabling fasting does not delete historical records.

------------------------------------------------------------------------

## WF-15 --- Monthly review and AI-assisted adjustment

### Objective

Allow the user to close out a month, review what happened, preserve a
month-level summary, and ask the AI to adjust the next month's routine
without destroying historical logs.

### User story

As a user, I want to tell the AI that I am finished with a month and ask
it to help plan the next month, so that the app preserves a clear record
of the previous month and helps me move forward.

### Critical rule

**A new month or a new routine must never wipe previous workout logs.**
Logs are durable historical records. A summary is an additional record,
not a replacement for source data.

### Journey

1.  User tells the AI: "I'm done with this month. Summarise my activity
    and help me plan next month."
2.  System retrieves records for the selected month: planned sessions,
    completed sessions, missed/rescheduled events, actual exercise logs,
    running activities and relevant reflections.
3.  AI prepares a summary grounded in persisted records.
4.  Summary distinguishes completed activity, missed sessions, schedule
    changes and unknown/missing data.
5.  User reviews and saves the monthly summary.
6.  User asks for next month's adjustments.
7.  AI proposes changes based on goals, actual activity and user
    feedback.
8.  User reviews and approves the new plan.
9.  New routine/version and future sessions are created or updated
    according to the user's choices.
10. Prior logs, schedule history and monthly summary remain accessible.

### State model

`month_open → review_requested → gathering_records → summary_draft → summary_review → summary_saved`

Plan adjustment:
`adjustment_requested → generating_next_period_plan → draft → approved → applied`

### Data requirements

-   Month/period identifier and timezone.
-   Source activity IDs included in the summary.
-   Counts and descriptions of completed, missed, rescheduled and
    spontaneous activities where records support them.
-   Relevant performance observations.
-   User reflections and feedback.
-   Summary content, version and creation timestamp.
-   New routine proposal and linked next-period sessions.
-   Link between the summary and the records it summarises.

### Business rules

-   Never delete or overwrite activity logs to create a summary.
-   Summary must be grounded in actual saved records.
-   Do not count a scheduled workout as completed without completion
    evidence.
-   Distinguish no activity from missing data.
-   User can correct a summary or add a reflection.
-   Generating the next month's plan does not automatically erase the
    prior plan.
-   Past completed sessions retain the routine/version and targets that
    applied when they occurred.
-   Future sessions may be updated only through the approved change
    process.
-   A new month does not have to start exactly on the first calendar
    day; the period should be explicit.

### Edge cases

-   Some sessions have incomplete logs.
-   User did not use the app for part of the month.
-   User asks for a summary twice.
-   User corrects an old workout after a summary exists.
-   AI cannot retrieve some records.
-   New plan conflicts with existing future sessions.
-   User wants a new plan but does not want to change their current
    active routine.

### Acceptance criteria

-   [ ] User can request a summary for a defined period.
-   [ ] Summary uses persisted records rather than assumptions from
    conversation alone.
-   [ ] Summary distinguishes planned, completed, missed, rescheduled
    and spontaneous activities.
-   [ ] User can review and save the summary.
-   [ ] Source logs remain available and unchanged by summarisation.
-   [ ] User can ask for a next-period plan based on the summary and
    current goals.
-   [ ] New plan requires review and approval before being applied.
-   [ ] Completed sessions and historical routine versions remain
    intact.
-   [ ] Repeated summary generation does not duplicate or destroy
    historical records.

------------------------------------------------------------------------

## WF-16 --- Basic preferences and settings

### Objective

Allow the user to manage core preferences and optional modules without
creating an unnecessarily complex settings system.

### User story

As a user, I want to update basic preferences and control optional
modules so that the workspace continues to reflect my needs.

### Initial settings

-   Preferred units where relevant.
-   Timezone/date display if not reliably inferred.
-   Basic workout preferences and available equipment.
-   Enabled/disabled state for hydration and fasting.
-   Reminder preferences.
-   Ability to update saved goals or ask the AI to revise them.

### State model

`viewing_settings → editing → saving → saved`

Failure: `save_failed → retry`.

### Data requirements

-   User preference record.
-   Unit and timezone preferences.
-   Optional module flags.
-   Reminder preferences.
-   Updated timestamps.

### Business rules

-   Optional modules can be disabled independently.
-   Changes to preferences should affect future recommendations, not
    rewrite historical records.
-   Important schedule changes must go through the relevant confirmation
    flow.
-   Do not require a complete profile to access basic settings.

### Acceptance criteria

-   [ ] User can view and edit supported preferences.
-   [ ] Changes persist.
-   [ ] Disabling optional modules does not erase their historical
    records.
-   [ ] Preference changes affect future AI recommendations where
    relevant.
-   [ ] Historical activity remains tied to the context and routine
    version that applied at the time.

------------------------------------------------------------------------

# 6. Cross-workflow domain model

The data model should represent durable records and explicit
relationships. It should not make the AI conversation transcript the
only place where a routine or activity exists.

## 6.1 Core entities

### User

-   `id`
-   `created_at`
-   `timezone`
-   `preferred_units`
-   `onboarding_completed_at`

### UserPreference

-   `id`
-   `user_id`
-   `category`
-   `key`
-   `value`
-   `updated_at`

Use typed fields or validated structured values in production; the
key/value representation is conceptual.

### FitnessGoal

-   `id`
-   `user_id`
-   `title`
-   `description`
-   `status`
-   `priority`
-   `target_value` (optional)
-   `target_unit` (optional)
-   `target_date` (optional)
-   `created_at`
-   `updated_at`

### Conversation

-   `id`
-   `user_id`
-   `created_at`
-   `updated_at`
-   `context_type` (general, workout, meal plan, monthly review)
-   `linked_entity_id` (optional)

### ConversationMessage

-   `id`
-   `conversation_id`
-   `role`
-   `content`
-   `created_at`
-   `metadata` (validated structured data, optional)

### RoutineProposal

-   `id`
-   `user_id`
-   `title`
-   `status`
-   `version`
-   `source`
-   `conversation_id`
-   `created_at`
-   `updated_at`
-   `approved_at` (optional)
-   `applied_at` (optional)

### WorkoutRoutine

-   `id`
-   `user_id`
-   `title`
-   `status`
-   `current_version`
-   `source`
-   `created_at`
-   `updated_at`

### WorkoutRoutineVersion

-   `id`
-   `routine_id`
-   `version_number`
-   `goal_snapshot`
-   `plan_data`
-   `created_at`
-   `change_reason` (optional)

A version preserves the plan definition that was current at a point in
time.

### WorkoutSession

-   `id`
-   `user_id`
-   `routine_id` (optional)
-   `routine_version_id` (optional)
-   `title`
-   `activity_type`
-   `planned_start_at` (optional)
-   `planned_end_at` (optional)
-   `actual_start_at` (optional)
-   `actual_end_at` (optional)
-   `status`
-   `source`
-   `created_at`
-   `updated_at`

### SessionExercise

-   `id`
-   `session_id`
-   `exercise_id` (optional)
-   `display_name`
-   `sort_order`
-   `target_sets`
-   `target_reps_min` (optional)
-   `target_reps_max` (optional)
-   `target_weight` (optional)
-   `weight_unit` (optional)
-   `rest_seconds` (optional)
-   `instructions` (optional)

### ExerciseLog

-   `id`
-   `session_id`
-   `session_exercise_id` (optional)
-   `exercise_id` (optional)
-   `exercise_name_snapshot`
-   `set_number`
-   `actual_reps` (optional)
-   `actual_weight` (optional)
-   `weight_unit` (optional)
-   `status`
-   `notes` (optional)
-   `recorded_at`

### ScheduleChange

-   `id`
-   `session_id`
-   `old_start_at` (optional)
-   `new_start_at` (optional)
-   `reason` (optional)
-   `change_type`
-   `created_at`
-   `actor`

### ActivityRecord

-   `id`
-   `user_id`
-   `activity_type`
-   `planned_session_id` (optional)
-   `activity_date`
-   `recorded_at`
-   `duration_seconds` (optional)
-   `distance_value` (optional)
-   `distance_unit` (optional)
-   `notes` (optional)
-   `source`

### MealPlan

-   `id`
-   `user_id`
-   `title`
-   `goal_context`
-   `start_date`
-   `end_date`
-   `status`
-   `version`
-   `source`
-   `created_at`
-   `approved_at` (optional)

### MealPlanEntry

-   `id`
-   `meal_plan_id`
-   `date` or `day_of_week`
-   `meal_slot`
-   `sort_order`
-   `meal_name`
-   `description`
-   `ingredients` (structured list)
-   `notes` (optional)

### ShoppingListItem

-   `id`
-   `meal_plan_id`
-   `name`
-   `quantity` (optional)
-   `unit` (optional)
-   `category` (optional)
-   `checked` (optional UI state)
-   `source_meal_entry_ids` (optional list)

Checking an item off a shopping list is not meal-consumption logging.

### MonthlySummary

-   `id`
-   `user_id`
-   `period_start`
-   `period_end`
-   `summary_text`
-   `source_record_ids`
-   `version`
-   `created_at`
-   `updated_at`

### HydrationEntry (optional module)

-   `id`
-   `user_id`
-   `quantity`
-   `unit`
-   `recorded_at`
-   `local_date`

### FastingSchedule / FastingSession (optional module)

Store configured windows separately from actual recorded sessions. Do
not treat a planned window as proof that a fast was completed.

### Reminder

-   `id`
-   `user_id`
-   `linked_entity_type`
-   `linked_entity_id`
-   `scheduled_at`
-   `channel`
-   `enabled`
-   `status`

## 6.2 Historical integrity requirements

1.  Completed session logs must not be overwritten when a routine
    changes.
2.  Schedule changes must retain the old and new values.
3.  Routine versions must be retained when a meaningful plan change
    occurs.
4.  Monthly summaries must reference their source records.
5.  Meal plans must retain prior approved versions.
6.  A new routine must not rewrite the exercise targets that applied to
    completed sessions.
7.  Deletion, correction and archival are different operations and must
    not be conflated.
8.  Where deletion is supported, its impact on related records must be
    explicit.

------------------------------------------------------------------------

# 7. AI architecture and behaviour

## 7.1 Responsibilities of the AI layer

The AI may: - Interpret natural-language requests. - Ask clarifying
questions. - Summarise goals and constraints. - Generate structured
routine and meal-plan proposals. - Suggest edits and explain
trade-offs. - Draft monthly summaries grounded in retrieved records. -
Propose future schedule adjustments.

The AI must not independently: - Claim a routine or meal plan was saved
without backend confirmation. - Mark an activity completed based only on
a proposed schedule. - Delete historical records to simplify a new
plan. - Bypass user approval for consequential changes. - Invent
weights, workout completion, food consumption or monthly activity. -
Expose secret API keys to the Flutter client.

## 7.2 Recommended request lifecycle

1.  Flutter sends the user's message to the authenticated backend.
2.  Backend verifies the user and retrieves relevant domain context.
3.  Backend sends the request and relevant context to the AI provider.
4.  AI returns conversational content and/or a structured proposal.
5.  Backend validates the structured output against a schema and
    business rules.
6.  Flutter displays the proposal and lets the user review it.
7.  User approves a specific proposal version.
8.  Flutter sends the approval/application request to the backend.
9.  Backend revalidates ownership, version, permissions, conflicts and
    idempotency.
10. Backend persists changes and returns authoritative saved records.
11. Flutter refreshes relevant views using the confirmed response.

## 7.3 Tool/action design

Potential backend operations include:

-   `get_fitness_context`
-   `create_goal_proposal`
-   `generate_routine_proposal`
-   `revise_routine_proposal`
-   `validate_routine_proposal`
-   `check_schedule_conflicts`
-   `apply_approved_routine`
-   `create_meal_plan_proposal`
-   `revise_meal_plan`
-   `save_approved_meal_plan`
-   `get_activity_history`
-   `generate_monthly_summary`
-   `get_application_status`

Names are illustrative. Implement typed request/response contracts and
explicit authorisation rather than exposing unrestricted database
actions to the model.

## 7.4 AI output validation

-   Use structured outputs or a strict schema for plans.
-   Validate required fields and allowed values on the backend.
-   Reject malformed data safely.
-   Treat model output as untrusted input.
-   Keep secret keys on the server.
-   Do not execute arbitrary code or database queries generated by the
    model.
-   Log operational metadata without unnecessarily storing sensitive
    conversation content.
-   Provide clear fallback states when the AI service is unavailable.

## 7.5 AI and fitness safety

-   Ask about relevant limitations when needed.
-   Do not present uncertain recommendations as medical advice.
-   Avoid extreme or unsupported exercise and nutrition recommendations.
-   Make meal plans practical and responsive to stated preferences.
-   Do not imply a cutting phase or fasting schedule is medically
    suitable for every person.
-   Let the user reject or modify recommendations.
-   Keep user-entered information intact if generation fails.

------------------------------------------------------------------------

# 8. Technical implementation guidance for Flutter

## 8.0 Selected implementation architecture

The following backend and data-platform choices are the implementation baseline. The frontend is React Native. Flutter and Next.js Web are not part of the current implementation scope unless the product owner explicitly revisits that decision.

| Layer | Selected technology | Responsibility |
|---|---|---|
| Client | React Native | Mobile application frontend |
| API backend | TypeScript on Node.js, deployed as Vercel Functions | Authentication verification, domain validation, AI orchestration and all domain writes |
| API validation | Zod schemas | Validate request bodies, query parameters and AI-generated structured data |
| Authentication | Supabase Auth, using `@supabase/supabase-js` in the Flutter client | Sign-in, sign-out, session persistence, token refresh and issuing access tokens |
| Relational database | Supabase-hosted PostgreSQL | Durable domain records, relationships, constraints, transactions and historical records |
| Database access | Supabase JavaScript client from the API, scoped to the authenticated user's JWT | Apply Postgres Row Level Security (RLS) to normal user requests |
| AI provider | OpenAI API through the official TypeScript SDK and Responses API | Conversational assistance and structured workout/meal-plan proposals |
| Database schema management | Supabase CLI migrations committed to Git | Reproducible schema, indexes, constraints, grants and RLS policies |
| Source of truth | GitHub repository | Product specification, Flutter code, API code, migrations and tests |

Official implementation references:
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Next.js documentation](https://nextjs.org/docs)
- [React Native documentation](https://reactnative.dev/docs/getting-started)
- [Supabase Auth architecture](https://supabase.com/docs/guides/auth/architecture)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [OpenAI API platform](https://platform.openai.com/docs/overview)

### 8.0.1 Request and data flow

1. The selected client (React Native) signs the user in through Supabase Auth and securely retains the session using the appropriate supported SDK or client library.
2. For domain operations, the client calls the Vercel API over HTTPS and sends the Supabase access token as `Authorization: Bearer <access_token>`.
3. The API verifies the token with Supabase Auth before processing the request. It must derive the user ID from the verified token; it must never trust a `user_id` supplied in the request body.
4. The API creates a Supabase client for that request using the publishable/anon key plus the verified user's access token. Database queries therefore run in the user's authorization context and are subject to RLS.
5. For AI requests, the API fetches only the user's relevant persisted context, calls OpenAI from the server, validates the returned structure, and stores a proposal as pending.
6. The Flutter app presents the proposal. Only a separate, authenticated approval request can apply it.
7. The API performs the approved database changes, returns the persisted records, and the Flutter app refreshes from that confirmed response.

All domain reads and writes go through the API in the first implementation. The client may use Supabase Auth directly for authentication, but it must not call OpenAI directly or bypass the domain API to mutate workout, schedule, meal-plan, or history records.

### 8.0.2 Authentication and authorization decisions

- Use Supabase Auth for email/password authentication initially. Add magic-link or social sign-in only if deliberately prioritised.
- Configure the Supabase site URL and allowed redirect URLs for local development and the deployed client.
- Keep a `profiles`/`users` domain row linked to `auth.users.id` by UUID. Use that same UUID as the owner key for private records.
- Every private table must have RLS enabled and policies that scope access to `auth.uid()`.
- The API verifies access tokens and derives identity from the verified claims. A valid token is required for every non-health endpoint.
- Do not accept user IDs as proof of authorization. Every lookup and mutation must enforce ownership.
- Do not use the Supabase service-role key for ordinary user requests. Prefer a user-scoped Supabase client so RLS applies. If a future administrative job genuinely requires elevated access, isolate it in a separate, explicitly reviewed module and never expose its key to the client.
- Authentication failures return `401`; authenticated but unauthorized operations return `403` or a non-disclosing `404` as appropriate.
- The app must support sign-out and expired-session recovery without losing a user's unsaved form input.

### 8.0.3 PostgreSQL and migration decisions

- Supabase PostgreSQL is the persistent database; do not use in-memory state, local-only storage, or AI conversation history as the system of record.
- Store schema changes in `supabase/migrations/` and commit every migration to Git. Do not rely on untracked dashboard-only schema edits.
- Use UUID primary keys for user-owned domain entities, foreign keys for relationships, timestamps, appropriate check constraints, and indexes for user/date/status queries.
- Add `user_id` ownership columns to private records where appropriate and create RLS policies for each allowed operation.
- Use database transactions for multi-record state changes. For operations such as applying a routine and creating its scheduled sessions, use a transaction-safe SQL function/RPC or an equivalent transaction-capable server-side implementation.
- Keep completed workout logs and prior routine/meal-plan versions. Prefer archival/status changes over destructive deletion for historical entities.
- Generate and commit or reproducibly regenerate TypeScript database types from the Supabase schema.
- Use separate development and production Supabase projects when the app is deployed for real use; never test destructive migrations against production first.

### 8.0.4 OpenAI integration decisions

- Call OpenAI only from the TypeScript backend using the official `openai` SDK and the Responses API.
- Keep `OPENAI_API_KEY` in Vercel environment variables. It must never appear in Flutter code, browser bundles, logs, Git history, or public repository files.
- Configure the model through a server-side `OPENAI_MODEL` environment variable so the model can be changed without a client release.
- Use structured outputs and/or allowlisted function tools for routines, meal plans, schedule suggestions and monthly summaries. Validate every model response again with Zod and domain rules on the server.
- The model may propose actions but must not execute arbitrary SQL, select arbitrary users, or write directly to the database.
- The backend supplies relevant user context from PostgreSQL rather than assuming the model remembers previous conversations.
- Save assistant messages and proposals where useful, but treat persisted domain records—not the transcript—as authoritative.
- A generated routine or meal plan remains `pending_approval` until the user approves the exact proposal/version. Applying it is a separate API operation.
- Never mark a workout complete merely because it was planned, discussed, or suggested by AI.
- Set sensible request limits and handle provider timeouts, rate limits, invalid structured output, and unavailable-service errors. Do not report success until persistence is confirmed.

### 8.0.5 Environment variables

Configure these in Vercel project settings and in an ignored local `.env` file for development. Commit only placeholder names in `.env.example`.

| Variable | Purpose | Secret? |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | No, but configure server-side |
| `SUPABASE_PUBLISHABLE_KEY` | Public/publishable key used with the user's JWT | Not a secret; never treat it as authorization by itself |
| `OPENAI_API_KEY` | OpenAI server API credential | **Yes — server only** |
| `OPENAI_MODEL` | Selected model identifier | No |
| `APP_ORIGIN` | Allowed client origin for CORS checks | No |
| `API_ENV` | Environment label such as development or production | No |

Do not add real credentials to `.env.example`. Do not put a service-role key or OpenAI key in Flutter compile-time variables. If the Supabase project still uses the legacy `anon` key name, document that mapping rather than introducing a second source of truth.

### 8.0.6 Deployment boundary

- The TypeScript API is deployed as a Vercel project whose Root Directory is `apps/api`.
- Deploy the API on Vercel and distribute the React Native client through the appropriate mobile channels.
- Configure the client API base URL to point to the deployed Vercel API.
- Configure CORS to allow only the deployed client origin(s), while retaining local development origins only in development.
- Place the Vercel Function region as close as practical to the Supabase database region to reduce request latency.
- Use separate Vercel environments and Supabase projects/credentials for development and production where practical.

## 8.0.7 Repository and folder structure

Use a monorepo so the product specification, chosen client, TypeScript API and database migrations stay versioned together.

```text
/
├── README.md
├── docs/
│   ├── PRODUCT_SPECIFICATION.md
│   └── ARCHITECTURE_DECISIONS.md
├── apps/
│   ├── flutter_app/
│   │   ├── pubspec.yaml
│   │   ├── lib/
│   │   │   ├── app/
│   │   │   ├── core/
│   │   │   └── features/
│   │   │       ├── onboarding/
│   │   │       ├── overview/
│   │   │       ├── ai_companion/
│   │   │       ├── goals/
│   │   │       ├── workouts/
│   │   │       ├── schedule/
│   │   │       ├── meal_planning/
│   │   │       ├── activity_history/
│   │   │       ├── hydration/
│   │   │       ├── fasting/
│   │   │       └── settings/
│   │   ├── test/
│   │   └── integration_test/
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vercel.json
│       ├── api/
│       │   └── v1/
│       │       ├── health.ts
│       │       ├── profile.ts
│       │       ├── goals/
│       │       ├── ai/
│       │       ├── routines/
│       │       ├── workout-sessions/
│       │       ├── workout-logs/
│       │       ├── activities/
│       │       ├── meal-plans/
│       │       ├── schedule/
│       │       ├── monthly-reviews/
│       │       └── preferences/
│       ├── src/
│       │   ├── config/
│       │   ├── middleware/
│       │   │   ├── authenticate.ts
│       │   │   ├── cors.ts
│       │   │   └── error-handler.ts
│       │   ├── lib/
│       │   │   ├── openai.ts
│       │   │   └── supabase.ts
│       │   ├── schemas/
│       │   ├── modules/
│       │   │   ├── goals/
│       │   │   ├── workouts/
│       │   │   ├── activities/
│       │   │   ├── meal-plans/
│       │   │   ├── schedule/
│       │   │   └── monthly-reviews/
│       │   └── shared/
│       └── test/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── tests/
├── .github/
│   └── workflows/
├── .env.example
└── .gitignore
```

Folder rules:
- `apps/mobile/` contains presentation and client-side workflow state only. Do not place server secrets or authoritative domain rules in either client.
- `apps/api/api/` contains thin Vercel Function entry points. Handlers delegate to `src/modules/`; they must not become large files containing business logic.
- `apps/api/src/modules/` contains domain use cases and orchestration; `schemas/` contains Zod request and model-output schemas.
- `supabase/migrations/` is the canonical source for schema, indexes, constraints, grants, RLS and SQL functions.
- `docs/PRODUCT_SPECIFICATION.md` is the product source of truth. `docs/ARCHITECTURE_DECISIONS.md` records why architecture choices were made and any later changes.
- Do not commit `.env`, real credentials, generated secrets, or personal production data.

## 8.0.8 Initial API surface

The API is versioned under `/api/v1`. Exact payloads must be typed and validated, but the first implementation should cover these domain operations:

| Area | Example operations |
|---|---|
| Health | `GET /api/v1/health` |
| Profile and preferences | `GET/PATCH /api/v1/profile`, `GET/PATCH /api/v1/preferences` |
| Goals | `GET/POST /api/v1/goals`, `PATCH /api/v1/goals/:id` |
| AI companion | `POST /api/v1/ai/turn`, `GET /api/v1/ai/conversations/:id` |
| Routine proposals | `POST /api/v1/routine-proposals`, `POST /api/v1/routine-proposals/:id/approve` |
| Routines | `GET/POST /api/v1/routines`, `GET /api/v1/routines/:id` |
| Workout sessions | `GET /api/v1/workout-sessions`, `PATCH /api/v1/workout-sessions/:id/reschedule` |
| Workout logging | `POST /api/v1/workout-sessions/:id/logs`, `POST /api/v1/workout-logs/spontaneous` |
| Activity | `GET/POST /api/v1/activities` |
| Meal planning | `POST /api/v1/meal-plan-proposals`, `POST /api/v1/meal-plan-proposals/:id/approve`, `GET /api/v1/meal-plans` |
| Schedule | `GET /api/v1/schedule`, `GET /api/v1/reminders` |
| Monthly review | `POST /api/v1/monthly-reviews/generate`, `GET /api/v1/monthly-reviews/:id` |

The health endpoint may be public and must return no sensitive configuration. All other endpoints require authentication. Validate IDs, ownership, input schemas and workflow state transitions on the server. Use pagination for growing histories and idempotency keys for retriable create/apply operations.

This section provides direction rather than locking the project into an
unreviewed technology stack.

## 8.1 Architectural boundaries

Use clear boundaries between:

-   **Presentation:** Flutter screens, components, navigation and UI
    state.
-   **Application/domain logic:** workflow state transitions, validation
    and use cases.
-   **Data layer:** repositories, API clients, persistence and
    serialisation.
-   **Backend:** authentication, AI orchestration, authoritative
    validation, persistence and scheduling logic.

Avoid placing AI business rules entirely inside widget code. Widgets
should display state and invoke application actions; business rules
should be testable independently of the UI.

## 8.2 Suggested feature structure

``` text
lib/
  app/
    app.dart
    router.dart
    theme/
  core/
    errors/
    networking/
    time/
    validation/
    widgets/
  features/
    onboarding/
      data/
      domain/
      presentation/
    overview/
      data/
      domain/
      presentation/
    ai_companion/
      data/
      domain/
      presentation/
    goals/
      data/
      domain/
      presentation/
    workouts/
      data/
      domain/
      presentation/
    schedule/
      data/
      domain/
      presentation/
    meal_planning/
      data/
      domain/
      presentation/
    activity_history/
      data/
      domain/
      presentation/
    hydration/
      data/
      domain/
      presentation/
    fasting/
      data/
      domain/
      presentation/
    settings/
      data/
      domain/
      presentation/
```

The exact folder convention can be adjusted to the chosen
state-management and routing libraries, but feature boundaries should
remain understandable.

## 8.3 Flutter implementation requirements

-   Use typed models for domain entities and API responses.
-   Keep server response parsing and validation separate from UI
    widgets.
-   Use a consistent state-management approach across features.
-   Represent loading, success, empty and error states explicitly.
-   Handle date/time values with a clear timezone policy.
-   Do not hardcode API secrets in the Flutter application.
-   Use repositories or equivalent abstractions so UI tests do not
    require a live backend.
-   Make form validation and core business logic unit-testable.
-   Preserve unsaved user input through recoverable network errors.
-   Avoid duplicating business logic between AI-created and manually
    created routines.

## 8.4 Backend requirements

The selected backend is TypeScript/Node.js on Vercel Functions, with Supabase Auth and Supabase PostgreSQL. OpenAI calls are server-side only.

The backend is responsible for:
- Verifying the Supabase access token on all protected routes.
- Deriving the authenticated user ID from verified identity, never from request input.
- Applying domain rules and workflow state transitions.
- Retrieving only relevant user-owned context for AI calls.
- Validating all client input and model output.
- Creating pending proposals, then applying them only after explicit approval.
- Persisting durable domain records and returning authoritative saved state.
- Checking schedule conflicts and preserving historical records.
- Using idempotency for retriable state-changing operations.
- Returning consistent errors and safe operational logs.

Keep Vercel Function handlers thin. Put business logic in `apps/api/src/modules/`, shared validation in `apps/api/src/schemas/`, authentication middleware in `apps/api/src/middleware/`, and provider clients in `apps/api/src/lib/`. Never expose OpenAI credentials or privileged database credentials to the Flutter client.

## 8.5 Data consistency and transactions

Applying an approved routine may require several writes: routine
version, goals links, scheduled sessions and approval metadata.

The backend should use a database transaction or a recoverable
application process so the system does not leave an active routine with
missing sessions or create duplicate sessions on retry.

For long-running AI operations, separate proposal generation from
application. Generating a proposal should not hold a database
transaction open.

------------------------------------------------------------------------

# 9. Global business rules

These rules apply across the application.

1.  **User ownership:** Every private record must be scoped to the
    authenticated user.
2.  **Explicit approval:** AI-generated plans remain proposals until the
    relevant approval action.
3.  **Persisted truth:** UI success states reflect backend-confirmed
    state.
4.  **Planned versus actual:** Schedule, execution and historical record
    are distinct concepts.
5.  **No silent history loss:** New plans and summaries do not erase
    prior records.
6.  **Idempotency:** Retried state-changing requests must not create
    duplicates.
7.  **Version awareness:** Changes apply to the version the user
    reviewed; stale proposals must be revalidated.
8.  **Conflict handling:** Schedule changes are checked before
    application.
9.  **Optional modules:** Disabling a module does not automatically
    delete its history.
10. **Meal-plan boundary:** A planned meal is not proof of consumption;
    calories and macros are outside the initial scope.
11. **Partial data:** Unknown values remain unknown rather than being
    invented.
12. **Error recovery:** AI or network failure must preserve user-entered
    information where possible.
13. **Accessibility:** Interactive controls need clear labels and
    accessible focus behaviour.
14. **Timezone correctness:** Scheduled activities use the user's
    intended local date/time.
15. **Auditability:** Meaningful changes to schedules and routines
    retain sufficient metadata to explain what happened.

------------------------------------------------------------------------

# 10. Global non-functional requirements

## Reliability

-   Recover safely from failed network calls.
-   Avoid duplicate records on retry.
-   Preserve drafts and incomplete user input where practical.
-   Keep routine and history data consistent.

## Security and privacy

-   Keep AI API secrets on the server.
-   Enforce user-level authorisation on every private data operation.
-   Avoid logging secrets.
-   Minimise sensitive data sent to the AI provider to what is
    necessary.
-   Define deletion/export expectations before production release.

## Performance

-   Load the main workspace without waiting for a new AI response.
-   Show loading feedback for long-running operations.
-   Fetch history in manageable ranges when records grow.
-   Avoid regenerating an entire plan for a minor local UI edit.

## Accessibility

-   Support readable text and sufficient contrast.
-   Label form controls and buttons clearly.
-   Provide accessible feedback for errors and save success.
-   Avoid relying on colour alone to communicate session status.

## Maintainability

-   Keep domain models and business rules testable outside widgets.
-   Use consistent naming for states, IDs, dates and statuses.
-   Document API contracts.
-   Add automated tests for state transitions and historical integrity.
-   Keep design tokens and shared components centralised.

------------------------------------------------------------------------

# 11. Testing strategy

## 11.1 Unit tests

Test: - State transition rules. - Routine and meal-plan schema
validation. - Date and timezone handling. - Schedule conflict
detection. - Idempotency behaviour. - Exercise-log calculations where
implemented. - Monthly summary aggregation from records. - Preservation
of prior routine versions.

## 11.2 Widget/UI tests

Test: - Welcome screen and entry to workspace. - AI conversation
loading, draft and error states. - Proposal review and approval
controls. - Exercise editing and workout logging. - Rescheduling form
and conflict messaging. - Meal timetable and shopping-list editing. -
Daily overview with enabled/disabled modules. - Empty and error states.

## 11.3 Integration tests

Test: - AI proposal → approval → persisted routine → schedule/overview
refresh. - Manual routine creation → schedule → workout logging. -
Rescheduling → history record → actual completion on new date. -
Spontaneous workout → activity history. - Meal-plan generation →
approval → timetable and shopping list. - Month summary → new plan
without deletion of old logs. - Network failure → retry without
duplicate writes.

## 11.4 Essential end-to-end scenarios

1.  New user enters the app without completing a long questionnaire.
2.  User discusses goals with AI and approves a generated routine.
3.  User manually creates a routine without AI.
4.  User completes a workout and logs actual weights/reps.
5.  User misses a workout, reschedules it, records a reason and later
    completes it.
6.  User logs an unscheduled run or workout.
7.  User generates a Nigerian-food meal plan and shopping list without
    calorie tracking.
8.  User enables hydration and fasting, then disables one module without
    losing its history.
9.  User closes out a month, saves a summary and generates next month's
    plan.
10. Application fails during a save, then recovers without duplicate or
    inconsistent records.

------------------------------------------------------------------------

# 12. Definition of product success

The product should be judged by whether it successfully connects the
user's fitness workflow, not by the number of screens or AI messages.

The system is demonstrating its intended value when a user can:

-   Enter the app quickly.
-   Explain a goal conversationally.
-   Generate and approve a usable workout routine.
-   See that routine populate the workspace.
-   Execute the workout and record actual performance.
-   Move or miss a session without losing history.
-   Record spontaneous activities.
-   Generate a practical meal timetable and shopping list without being
    forced to track calories or meals consumed.
-   Use a shared schedule and optional hydration/fasting tools.
-   Close out a month, preserve its records and plan the next month
    without wiping historical data.

## Core product promise

**One connected workspace for planning fitness, adapting when life
happens, recording what actually happens, and carrying the context
forward.**

------------------------------------------------------------------------

# 13. Decisions to confirm before implementation

The backend, database, authentication provider and AI integration are selected in Section 8. Remaining decisions are:

1. Flutter state-management and routing libraries.
2. The exact Flutter Web hosting target and production domain; this is separate from the Vercel API deployment.
3. Exact workout recurrence and scheduling rules.
4. Whether routine activation generates a fixed number of weeks of sessions or uses a recurring template plus rolling instances.
5. Exact personal-record calculation rules.
6. Supported reminder channels and notification permissions.
7. Exact fasting-window behaviour and whether fasting sessions are manually started or schedule-derived.
8. How meal quantities should be represented and how shopping-list quantities are consolidated.
9. Whether monthly summaries are generated only on request or can also be suggested at month-end.
10. Data export/deletion requirements.
11. Final visual identity and design-system decisions.

Implementation should not reopen already selected architecture choices without documenting a reason and updating this specification.

------------------------------------------------------------------------

# 14. Instructions for coding agents working in this repository

Use this document as the product source of truth.

Before implementing a workflow: 1. Read this specification and the
relevant existing code. 2. Identify the workflow ID and its acceptance
criteria. 3. Inspect the current architecture and reuse established
patterns. 4. Identify any unresolved decision that blocks correct
implementation. 5. Implement the smallest coherent vertical slice of the
specified workflow without breaking its end-to-end contract. 6. Add or
update unit, widget, integration and/or end-to-end tests as appropriate.
7. Verify historical integrity, explicit approval and error recovery for
state-changing workflows. 8. Update documentation when an implementation
decision changes the specification.

Do not: - Replace the product with a chatbot-only demo. - silently omit
a required workflow. - implement AI output as unstructured text when
structured data is required. - hardcode API secrets into Flutter. -
delete historical workout records when a new routine or month is
created. - add calorie tracking or meal-consumption logging to the
initial meal-planning workflow. - claim that a save succeeded before the
backend confirms it. - invent missing user data. - make broad
architecture changes unrelated to the workflow without documenting the
reason.

When a requirement is ambiguous, identify the ambiguity and propose a
decision rather than silently inventing product behaviour.


## 14.1 Additional architecture rules for coding agents

- Preserve the selected backend stack: TypeScript/Node.js Vercel Functions, Supabase Auth, Supabase PostgreSQL, and server-side OpenAI API.
- React Native is the selected frontend. Do not introduce Next.js Web or Flutter unless the product owner explicitly revisits the decision.
- Do not connect the Flutter client directly to OpenAI.
- Do not put privileged Supabase credentials or the OpenAI API key in any client application or use a privileged database identity as the default for user-facing API routes.
- Keep migrations, RLS policies and SQL functions versioned under `supabase/`.
- Verify authentication, RLS, cross-user isolation, approval flows, idempotency and historical preservation with automated tests before declaring a workflow complete.
- Keep AI output as a proposal until the user approves it and the backend confirms persistence.
- Do not silently change the API contract or database schema; update tests and documentation alongside implementation.


## 14.2 Frontend decision status

- **Current preference:** React Native; Flutter is deferred to a possible later phase.
- **Not yet finalised:** whether the first release is browser-first (Next.js Web) or mobile-first (React Native).
- **Recommendation based on the stated need:** if users should open a URL and use the workspace without downloading an app, choose Next.js Web. React Native is appropriate when an installable mobile application is the immediate priority; it does not replace the need for a web frontend.
- **Do not build both clients in the first pass** unless the product owner explicitly expands scope. Select one client before generating the application scaffold.
- The backend, Supabase database/authentication, and OpenAI integration can be reused if a second client is added later.
