# Mova — Mobbin UI Research

**Status:** Research input for design. This document does not change product requirements.
**Date:** 16 October 2026
**Platform researched:** iOS (Mobbin)
**Source of truth:** [`PRODUCT_SPECIFICATION.md`](../PRODUCT_SPECIFICATION.md). Where a pattern here conflicts with the specification, the specification wins.

---

## 1. Research goal

Study how established fitness and wellness apps handle the screens and journeys behind Mova's 16 workflows (WF-01 to WF-16), in order to identify:

- UI patterns worth reusing.
- Gaps where Mova can do better than existing apps.
- Patterns that would violate rules in the Product Specification.

## 2. The 10 apps studied

| # | App | Why it is relevant | Mova workflows |
|---|---|---|---|
| 1 | Fitbod | Generated workouts and a regeneration flow | WF-03, WF-04 |
| 2 | Hevy | Standard strength-logging table and a monthly report | WF-04, WF-06, WF-09, WF-15 |
| 3 | WHOOP | AI coach chat reachable from the home overview | WF-02, WF-05 |
| 4 | Strava | Manual and past activity entry, and personal records | WF-08, WF-09, WF-12 |
| 5 | Runna | A planned workout shown together with the run actually recorded | WF-05, WF-11, WF-12 |
| 6 | Centr | One calendar for workouts, meals and mind; meal plan; shopping list | WF-10, WF-11 |
| 7 | Wabi | AI-generated meal week and versioned AI proposals | WF-03, WF-10 |
| 8 | Zero | Fasting timer, schedule presets, editable start and goal | WF-14 |
| 9 | Finch | Mascot-led onboarding, notification-permission request, gentle tone | WF-01, WF-11 |
| 10 | Me+ | AI chat that returns a structured plan card with approve, edit and discard | WF-03, WF-13 |

Supporting references: Tonal, Ladder, Bevel, Nike Run Club, Peloton, Future, Gentler Streak, Recime, BitePal, Yazio, Noom, Google Health (Fitbit), Mindvalley, Tiimo, Urban Company, Any Distance and MyFitnessPal.

## 3. Searches used (iOS)

1. Flow: Fitbod plan generation (goals, equipment, days, then a workout to review).
2. Screen: active workout logging with previous weight/reps, kg/reps inputs and set checkmarks.
3. Screen: WHOOP Coach chat with prompt chips and composer.
4. Flow: Strava manually adding a past run.
5. Screen: weekly meal plan with day sections, meal slots and a shopping-list button.
6. Screen: Zero fasting timer with ring, start/end times and End Fast.
7. Screen: water tracker with goal in ml and quick-add.
8. Flow: Finch mascot onboarding to the home screen.
9. Screen: training calendar with planned, completed, missed and rest days.
10. Screen: bottom sheet to reschedule a workout.
11. Screen: monthly fitness recap.
12. Screen: AI plan card in chat with accept, edit and regenerate.
13. Screen: shopping list grouped by category.
14. Screen: settings with units, module toggles and reminders.

## 4. Pattern clusters by workflow

### A. AI companion and proposals (WF-02, WF-03, WF-10, WF-15)

- **Structured plan card with three actions.** [Me+](https://mobbin.com/screens/e3d6a34a-b9a7-40c2-bee2-04ae1790d8d9) returns a schedule card in chat (times, items, repeat rule) with *Add to my schedule*, *Help me edit it* and *Discard plan*. Closest match to WF-03's Approve / Edit / Reject.
- **Versioned proposals.** [Wabi](https://mobbin.com/screens/fd8cb6af-b1ce-4a3e-aab2-1bb2a43cf988) shows each AI revision as a V1…V4 chip that can be reverted. Fits the specification's "approval event tied to the exact proposal version".
- **Answers grounded in the user's data, with a disclaimer.** [Google Health (Fitbit) Coach](https://mobbin.com/screens/ede64445-fa91-49a4-a7f2-cd1da4c03743) opens with "Looking at your data from May 30th…" and shows "Coach is AI and can make mistakes. Not for medical advice." Supports §7.2 (retrieve saved context) and §7.5 (fitness safety). [Mindvalley](https://mobbin.com/screens/04f358bd-347f-400a-8b9b-3a4484471e1f) uses a similar disclaimer with suggested follow-up questions.
- **AI entry point on the overview.** [WHOOP](https://mobbin.com/screens/d0972fb1-ab4c-4aa6-96e6-ef6947d9a631) places an "Ask WHOOP anything" bar on its home overview. The [chat](https://mobbin.com/screens/be86b426-71e2-4e2a-adea-a5bc28a2de15) opens with prompt chips and has a [conversation history sheet](https://mobbin.com/screens/01c31c01-d393-4c90-b0eb-6e3705acc735). Fits §4.1's "persistent entry point accessible from the workspace".
- **Generation loading state.** [Fitbod](https://mobbin.com/flows/d35822a8-9ed6-4724-89c5-7fcf77b837ac) shows a skeleton workout with spinners while generating.

### B. Workout execution, logging and history (WF-04, WF-06, WF-09)

- **Standard logging table.** [Hevy](https://mobbin.com/screens/b7c6155c-8453-4230-9c28-a12218a415d8) uses columns SET · PREVIOUS · KG · REPS · ✓, plus a warm-up row, per-exercise rest timer, notes, *Add Set*, an elapsed timer and *Finish*. The PREVIOUS column is WF-06's "previous performance as read-only context".
- **Unit toggle on the keypad.** [Ladder](https://mobbin.com/screens/3daed3ec-2832-48af-9f73-0aab0d428f51) has a custom keypad with an lb/kg switch and a *View History* button. Supports "units must be consistent and visible".
- **Empty state for previous performance.** [Bevel](https://mobbin.com/screens/c4ffd0fd-3863-4f0f-b94c-289b6768732d) shows "No previously recorded workout", covering WF-09's `no_history` state.
- **Actual vs target in history.** [Tonal](https://mobbin.com/screens/65d7538d-e628-4c08-9cff-c99245270609) shows reps as "23/16" (actual/target) per set — "planned targets and actual values are stored separately", made visible.
- **Generated workout overview.** [Fitbod](https://mobbin.com/flows/d70ee220-4cdd-48de-a419-b3ab3c8151a5) shows exercise cards ("4 sets • 8 reps • 32.5 lb"), supersets, a floating *Start Workout* button and an *Add an exercise* row. Manual and generated workouts share one layout, as WF-04 requires.

### C. Planned vs actual, schedule and rescheduling (WF-05, WF-07, WF-11, WF-12)

- **Planned card with the actual result inside it.** On [Runna](https://mobbin.com/screens/be9b0bcc-6c28-4abf-bde0-6b046df1207d)'s Today screen, the planned card ("Easy run · 3.5km") contains the run actually recorded (3.52 km · 51:35). The clearest visual model of "planned and actual are different" found.
- **Rest days as plan items, with progress counts.** [Nike Run Club](https://mobbin.com/screens/46bc8651-3696-456b-af8d-63ff218e4faf) lists "Rest Day" as a plan item and shows "Workouts Completed: 1 of 5". Matches WF-05's "rest days are valid planned days".
- **One calendar for everything.** [Centr](https://mobbin.com/screens/12af1edf-23b6-4421-971f-642aa09da194) uses a month grid with a legend for Movement, Meals and Mind. [Peloton](https://mobbin.com/screens/d539d7ba-721e-49a6-9efe-2e82f649463b) uses a date strip with a day-grouped list and collapses empty days to a single "No Classes" line.
- **Edit and history side by side.** [Future](https://mobbin.com/screens/02505ebf-b373-4f73-8a3a-d10d9ca3f409) places *Edit Schedule* and *View History* together under "This Week".
- **The confirm button repeats the change.** [Tiimo](https://mobbin.com/screens/507fbe83-f2e4-4df9-8b6b-6b153d6f4f2a)'s button reads "Move (5) to Friday, Jan 16". [Urban Company](https://mobbin.com/screens/d1585a95-688c-4ce2-8537-20b518cc4f55) adds a separate "Reason for rescheduling" sheet. Together they cover WF-07's confirmation and optional reason.

### D. Spontaneous and past activity logging (WF-08, WF-12)

- **Compact form for a past activity.** [Strava](https://mobbin.com/flows/271bbb54-9faf-413f-875f-68cf3b957f89): sport → date/time wheel ("Today at 6:30 AM") → duration → distance → pace → perceived exertion → private notes. *Save Activity* stays disabled until valid. [The Outsiders](https://mobbin.com/screens/31f0565d-108c-4728-9413-d907671bf3fb) and [Gentler Streak](https://mobbin.com/screens/06892307-6c60-4acd-8f30-fa4699c1afaa) use a similar grouped-row form.

### E. Meal plan and shopping list (WF-10)

- **AI-generated meal week.** [Wabi](https://mobbin.com/screens/a6147a60-54d3-46a6-9e80-4a6949846227) shows a titled week, day sections, cards with a slot label (BREAKFAST/LUNCH/DINNER), meal name and description, and a *Generate new week* button.
- **Flexible meal slots.** [Centr](https://mobbin.com/screens/705eaf3c-a294-402a-abd2-870d1eb06136) includes a "Post-Workout Meal" slot and a swap control on each meal. Supports "meal slots should be configurable".
- **Empty days and a week switcher.** [Recime](https://mobbin.com/screens/5780fcc2-a600-41d5-8dd3-5c232926f690) shows "No recipes yet" with a + for each day and arrows to change weeks. It also places a fasting window inside the meal plan.
- **Shopping list linked to its meals.** [Centr](https://mobbin.com/screens/3b5a73a0-bb8d-4cab-b9cf-b50686d23303) shows the source meals in a strip above category groups, each with "+ Add custom item". Maps to `source_meal_entry_ids` and manual editing. [Recime](https://mobbin.com/screens/c7692449-3f88-4ae5-9ca6-7d33d7bdf0bc) adds an item count and sort-by-aisle.

### F. Optional modules and settings (WF-13, WF-14, WF-16)

- **Module cards on the overview, including a not-set-up state.** [BitePal](https://mobbin.com/screens/9482d3a8-86d8-4714-bc92-e2d86d89d21c) has a water card with a tap-to-fill glass grid, and a fasting card reading "No fasting yet · Set up fasting goal". Its mascot speaks in the success toast.
- **Units always shown.** [Noom](https://mobbin.com/screens/5550764c-1424-4c32-ad79-c7f97a4b87e9) shows "1/8 glasses · 250 ml" with *Edit water goal*. [Yazio](https://mobbin.com/screens/4de789bb-e2fa-4434-953d-abb535fe8245) shows "Goal: 2.00 L".
- **Fasting.** [Zero](https://mobbin.com/screens/7bc4cd65-c967-4de4-9a8d-2eee11512c3d) shows a ring with elapsed time, STARTED and GOAL values with *Edit start* and *Edit goal*, *End Fast*, and week dots. Its [presets](https://mobbin.com/screens/eb97688d-0d13-49fd-828f-4dd90d41332e) cover 13/16/18/20/36/custom hours.
- **Settings.** [Yazio reminders](https://mobbin.com/screens/ceba01d2-f62f-4a12-85e1-c9cc77c80810) toggle each module with times nested underneath. [MyFitnessPal fasting settings](https://mobbin.com/screens/5dfe82cb-ca0c-498e-a18e-391970d07c77) pair the module toggle with an "Is it right for you?" link, which supports §7.5.

### G. Onboarding and mascot (WF-01)

- **Mascot-led onboarding with an in-context notification request.** [Finch](https://mobbin.com/flows/80ef83ef-f872-4825-b18d-6b193d60a9aa) shows "Get reminders from Lee" with a sample notification, *Turn on notifications* and *Maybe later* — useful for WF-11. The flow is 21 screens, far longer than WF-01 allows.
- **Mascot delivering insights.** [Any Distance](https://mobbin.com/screens/9752d9e4-8ca8-48af-b8e3-5a526d92b2f6) has its mascot deliver AI insights in a speech bubble. A model for how the Mova bubble could present AI messages.

### H. Monthly review (WF-15)

- [Hevy August Report](https://mobbin.com/screens/c36bab49-b726-4d33-a4ff-d192120ea3ce): month calendar, muscle distribution compared with the previous month, share button.
- [Tonal February Review](https://mobbin.com/screens/fc400513-e1be-49cc-9f5b-8cd6fd55f259): total volume with change vs previous period, achievements, active days.
- [Strava](https://mobbin.com/screens/97ab8653-80ea-4cd0-9145-fe05a4fd1d8b) and [Runna](https://mobbin.com/screens/1955e917-b83f-4dc4-a2a3-df744943d66d): personal-record badges, each dated.

## 5. Key observations

1. **No app showed rescheduling history.** None of the fitness screens found keep the original date, new date, reason and final outcome together. Runna comes closest by showing planned and actual together. WF-07's "coherent history" is a gap Mova can fill.
2. **Most AI coaches answer in text only.** WHOOP, Fitbit and Mindvalley reply in prose. Only Me+ and Wabi turn AI output into data the user can approve. Mova's proposal → approval model is a differentiator, so its proposal card deserves the most design attention.
3. **Monthly reviews celebrate and leave out misses.** Every recap found shows volume, streaks and PRs; none shows missed or rescheduled sessions. WF-15 requires an accurate, non-judgmental breakdown of planned, completed, missed, rescheduled and spontaneous activity.
4. **Most meal apps include calorie tracking.** Patterns that fit WF-10's scope come from recipe and meal-plan apps (Centr, Wabi, Recime), not diet trackers.
5. **Most training apps use dark themes.** Fitbod, WHOOP, Ladder, Zero and Peloton Strength+ lean dark. The Mova mascot is soft pink, closer in mood to Finch, BitePal and Gentler Streak. This is input to the open design-system decision (§13 item 11), not a decision.

## 6. Patterns that would conflict with the specification

| Pattern | Where | Rule it conflicts with |
|---|---|---|
| "Refresh… any changes you made may be erased" | [Fitbod](https://mobbin.com/flows/d35822a8-9ed6-4724-89c5-7fcf77b837ac) | WF-03: regeneration must not silently discard manual edits |
| Calorie and macro diary with *Log* buttons | [MyFitnessPal](https://mobbin.com/screens/32b82d20-deb0-493f-a643-c170d9e46b8b) | §3.2: calorie/macro tracking and meal-consumption logging are deferred |
| A checkmark on a planned meal | [Centr](https://mobbin.com/screens/705eaf3c-a294-402a-abd2-870d1eb06136) | WF-10: a planned meal is not a consumed meal |
| Distance and time default to "0.00 km" / "00:00:00" | [Strava](https://mobbin.com/flows/271bbb54-9faf-413f-875f-68cf3b957f89) | §9.11 and WF-12: unknown values remain unknown |
| Quantities like "14⅓ oz" | [Centr](https://mobbin.com/screens/3b5a73a0-bb8d-4cab-b9cf-b50686d23303) | WF-10: avoid false precision |
| Physiological claims such as "Anabolic" and fat-burning zones | [Zero](https://mobbin.com/screens/7bc4cd65-c967-4de4-9a8d-2eee11512c3d) | WF-14 and §7.5: no claims of medical suitability |
| 21-screen onboarding | [Finch](https://mobbin.com/flows/80ef83ef-f872-4825-b18d-6b193d60a9aa) | WF-01: onboarding must be short |

## 7. Design recommendations

These are recommendations for design exploration. They do not add requirements.

1. **Proposal card (WF-02, WF-03, WF-10, WF-15).** Base it on Me+'s card and Wabi's version chips. Show the version, assumptions, warnings, and whether it creates a new routine or replaces an existing one. Actions: *Approve*, *Edit*, *Ask for changes*, *Reject*. Label it clearly as a proposal so it never reads as a saved plan. Show an AI/medical disclaimer in the style of Fitbit.
2. **Planned card with the actual result inside it (WF-05, WF-06, WF-12).** Follow Runna's pattern, and show target/actual the way Tonal does in history.
3. **Reschedule sheet (WF-07).** Calendar with a confirm button that repeats the change (Tiimo), an optional reason (Urban Company), and a conflict warning before confirming. Add a small change timeline on the session ("Planned Tue → moved to Thu · reason") so earlier moves are never lost.
4. **Logging screen (WF-06, WF-09).** Hevy-style table with a PREVIOUS column, a visible unit toggle (Ladder) and Bevel's no-history state. Values should persist as they are entered so they survive navigation and app restarts.
5. **Past activity form (WF-08, WF-12).** Strava-style grouped rows, with unknown fields left empty ("Not recorded") rather than defaulting to zero.
6. **Meal plan (WF-10).** Day sections with configurable slot labels (Wabi, Centr), visible empty days (Recime), and a category-grouped shopping list showing its source meals and rounded quantities. No checkmarks on meals and no calorie figures.
7. **Optional modules (WF-13, WF-14, WF-16).** Overview cards appear only when a module is enabled. Use Zero's ring with editable start and goal, but neutral wording. Always show units. In settings, one toggle per module with its reminder times nested beneath.
8. **Onboarding (WF-01).** Two or three screens: mascot welcome, optional privacy note, *Get started*. Ask for notification permission later, in context, when the user first sets up a reminder.
9. **Monthly review (WF-15).** Break the period down into planned, completed, missed, rescheduled and spontaneous, with a distinct "not recorded" state for missing data. Use the mascot to frame missed sessions kindly. Keep PRs and comparisons secondary.

## 8. Candidate reusable components

| Component | Purpose | Main workflows |
|---|---|---|
| `ProposalCard` | AI proposal with version chip and approve/edit/reject | WF-02, WF-03, WF-10, WF-15 |
| `PlannedActualCard` | Planned session with the recorded result nested inside | WF-05, WF-06, WF-12 |
| `SetLogTable` | Set rows with PREVIOUS, weight, reps and completion | WF-06, WF-09 |
| `UnitKeypad` | Numeric entry with visible unit toggle | WF-06, WF-13 |
| `RescheduleSheet` | Date/time picker, optional reason, conflict warning, descriptive confirm button | WF-07 |
| `ChangeHistoryTimeline` | Original date, moves, reasons and outcome | WF-07, WF-11 |
| `WeekStrip` | Day selector with status markers | WF-05, WF-11 |
| `ModuleCard` | Overview card for an enabled optional module | WF-05, WF-13, WF-14 |
| `FastingRing` | Current fasting state with editable start and goal | WF-14 |
| `GlassGrid` | Tap-to-add hydration entry with explicit units | WF-13 |
| `MealSlotCard` | Meal entry with configurable slot label | WF-10 |
| `GroupedShoppingList` | Category-grouped items linked to source meals | WF-10 |
| `MascotSpeechBubble` | Mova bubble presenting guidance or AI messages | WF-01, WF-15 |
| `AIEntryBar` | Persistent entry point to the AI companion | WF-02 |
| `AIDisclaimer` | Short AI and not-medical-advice notice | WF-02, WF-03, WF-10 |

---

*Screen references link to Mobbin and require a Mobbin account to view.*
