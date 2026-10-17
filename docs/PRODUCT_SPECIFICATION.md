# Mova — Personal Fitness Workspace

## Product Specification: what the product does, how it behaves, and how it is built

**Document status:** Source of truth for the submitted product (describes what is built)\
**Version:** 2.0\
**Date:** October 2026\
**Product:** Mova, a calm, personal fitness workspace with a conversational AI companion\
**Platforms:** React Native (Expo) for web, iOS and Android; the submitted deployment is the web build\
**Live build:** https://mova-fitness.vercel.app

Version 1.2 of this document was a plan written before the product existed. Version 2.0 replaces it and describes the product as it is now built. The visual rules live in [`DESIGN.md`](../DESIGN.md); this document covers behaviour. Section 14 lists what changed from the plan and what is deliberately left out.

---

## 1. What Mova is

Mova brings workout planning, workout logging, scheduling, meal planning, fasting and an AI companion into one place, so the person does not have to juggle a notes app, a calendar, a fasting timer and a chat assistant.

**Core promise:** plan your fitness, adapt when life happens, record what you actually do, and keep your history in one place.

### 1.1 Principles (as built)

1. **The workspace is the product; the AI is a helper.** Every screen works without chatting. Routines, meals and fasting can all be created by hand.
2. **Conversation creates real data.** Goals, routines and meal plans suggested by the companion are saved by ticking the suggestion, and then appear on their own pages (Goals, Workouts, Meal plan). Nothing is only text to copy elsewhere.
3. **The user decides.** A suggestion is only saved when the user ticks it. Declining is one tap (Skip, Reject).
4. **Planned and actual are different.** A scheduled workout is not proof it happened; a meal plan is not proof anything was eaten.
5. **History is durable.** Completed workouts and logs are never erased by new routines, new plans or changes to the schedule.
6. **No blame.** Missed or moved workouts are normal. Copy is warm, gender-neutral and encouraging.
7. **Honest empty states.** Nothing is invented. A new person sees what is not set up yet and how to set it up.
8. **Fasting is optional** and is turned on from its own page.
9. **The AI is not the source of truth.** Saved records are. The AI only proposes, and its output is checked against a schema before it is used.

---

## 2. Who it is for and how it is used

A single person managing their own fitness. There are no accounts, teams, sharing or coaches. The first time the app opens, a short onboarding sets up a name and, if wanted, a first routine.

**Data location:** all data is stored on the person's device (browser storage on web). Nothing is uploaded except the text of a companion conversation, which is sent to the AI provider through Mova's own server endpoint (see section 9). Settings includes **Reset demo data**, which clears everything and returns to onboarding.

---

## 3. Navigation and structure

**Primary navigation:** a floating bar with **Overview**, **Workouts** and **Meal plan**, plus a round **Mova** button that opens the companion.

**Sheets:** secondary screens open as bottom sheets over the current page, which close with the close button, a swipe down, a tap on the dimmed area, or Escape. These are: Mova Companion, Settings, History, Schedule, New or Edit routine, Review routine, Catch up, Shopping list, Schedule activity, Exercise history, Workout detail.

**Header actions (sticky, 20px icons):**

| Page | Header actions |
|---|---|
| Overview | Avatar with name and today's long date on the left; **History** and **Settings** on the right |
| Workouts | **New routine** (plus) and **Schedule** (calendar) |
| Meal plan | **Shopping list** (cart) |

**Shared behaviours:** loading, empty and error states on every list; consistent dates ("Saturday, 17 October 2026"), weights and reps; touch targets of at least 44px; keyboard focus rings; reduced-motion respected.

---

## 4. Workflows

Each workflow gives the **user story**, what the person can do and the rules the product follows, and its **acceptance criteria**: statements that can be checked on the running product. A workflow is done when every criterion is true.

### WF-01 Onboarding

Three short screens, no navigation bar:

1. **Name.** "Skip for now" is available.
2. **Have you used a fitness app before?** No goes straight to the Overview. Yes asks the next question. Single-choice cards can be moved between with the arrow keys.
3. **Do you have a workout routine?** Yes opens a quick sheet to enter exercises, sets and reps. No opens the companion, which builds one.

A random friendly avatar is assigned (display only, not a link). The Overview reflects what was actually set up; no plan is created for someone who did not make one.


**User story.** As a new person, I want to get started in under a minute without creating an account, so that I can use the app straight away.

**Acceptance criteria**

1. Given a first visit, the app opens on the onboarding name screen with no navigation bar.
2. When I choose Skip for now, I reach the Overview without a name and see a neutral greeting.
3. When I answer that I have not used a fitness app, I go straight to the Overview and no routine, meal plan or goal exists.
4. When I answer yes and then say I have a routine, a sheet opens where I can enter exercises, sets and reps.
5. When I answer yes and then say I have no routine, the companion opens and offers to build one.
6. The two choice cards behave as a radio group: the arrow keys move the selection and Continue stays disabled until I answer.
7. A friendly avatar is assigned automatically and it is not a link to another page.
8. After onboarding, the Overview shows only what I actually set up.

### WF-02 AI companion (chat)

Opened from the Mova button as a bottom sheet. New chat erases past conversations and starts clean.

- **Acts instead of interviewing.** It asks at most one short question, only when it truly cannot continue. Otherwise it makes a sensible assumption, says what it assumed in one line, and proposes straight away.
- **Replies type themselves out.** Text appears a few characters at a time (shown whole under reduced motion). Any suggestion appears once the text is complete.
- **Suggestions pill.** A small shimmering **Suggestions** pill sits above the message bar. Tapping it (or the sparkle button in the bar) opens small boxes: *Create a workout routine*, *Create a meal plan*, *Suggest a goal*. Choosing one sends it.
- **Suggestions are one-tap.** Each suggestion is a plain white row with a radio on the right.
  - **Goals** appear one at a time. Tick to save, or Skip, then the next appears.
  - **Routines and meal plans** are drafted automatically after the request. Ticking saves them: a routine is scheduled for four weeks from today and shows on Workouts; a meal plan fills the Meal plan page.
  - After saving, the row simply shows a small grey "Saved". There are no green banners, priorities or versions.
- **Clashing routine.** If a ticked routine uses the same days as an existing one, a short prompt offers **Replace** or **Keep both**.
- The assistant never claims something was saved; the app saves on the tick.
- **No simulated answers.** If the AI endpoint is not available, the companion says the assistant is unavailable. An offline demo assistant exists only as an opt-in developer setting.


**User story.** As a person with a fitness goal, I want to ask the assistant for a routine, meal plan or goal and have it do it straight away, so that I don't have to answer a long list of questions.

**Acceptance criteria**

1. The companion opens as a bottom sheet from the Mova button and closes by the close button, a swipe down, the dimmed area or Escape.
2. New chat removes earlier conversations and shows an empty thread.
3. When I ask for a routine, a meal plan or a goal, the reply arrives with no more than one question and a suggestion row follows.
4. A new reply appears a few characters at a time; under reduced motion it appears all at once; the suggestion row appears only after the text is complete.
5. A Suggestions pill with a shimmer sits above the message bar; tapping it or the sparkle button shows small boxes (Create a workout routine, Create a meal plan, Suggest a goal) without any heading text; choosing one sends it.
6. A suggestion is a plain white row with a radio. Ticking it saves it and the row then shows a small grey 'Saved', with no green banner.
7. A ticked goal appears in Goals; a ticked routine appears on Workouts and is scheduled; a ticked meal plan fills the Meal plan page.
8. Suggested goals show one at a time; Skip moves to the next without saving.
9. If a ticked routine uses days an active routine already uses, a prompt offers Replace or Keep both.
10. The assistant never says something was saved and never shows a priority, version or a request to look in Settings.
11. If the AI endpoint is unavailable the companion says so; it never returns simulated answers.

### WF-03 AI routine generation and review

A routine request becomes a draft that is reviewed in a **Review routine** bottom sheet (opened from the Workouts page when a draft is waiting, or ticked directly in chat):

- One **summary card** with the routine name and three points: days a week, about how long a session is, and the focus.
- One **card per training day** (day, length, type, exercises as "Push-ups · 3 × 8–12"), each with an **edit icon** at the top right that edits only that day.
- **Ask for a change** is a button; tapping it reveals a field with Send and Cancel.
- **When should it start?** Start date and number of weeks (placeholder 1–12).
- **Approve and schedule** and **Reject** are pinned at the bottom.
- A short safety note appears only if the AI added one.


**User story.** As a person who asked the assistant for a routine, I want to look it over, change a day or ask for a change, and then approve it, so that I only keep a plan I am happy with.

**Acceptance criteria**

1. The review opens as a bottom sheet with a title, close button and pinned Approve and schedule and Reject buttons.
2. One summary card shows the routine name and three points: days a week, about how long a session is, and the focus.
3. Each training day has its own card with day, length, type and its exercises in the form 'Name · sets × reps'.
4. Each day card has an edit icon at the top right; tapping it opens only that day for editing, and Save returns to the review with the change shown; Cancel leaves the plan unchanged.
5. Ask for a change is a button; the text field appears only after I tap it, with Send and Cancel.
6. Start date and Weeks are shown under a divider; Weeks shows '1–12' as a placeholder when empty.
7. Approve and schedule creates the routine and its upcoming workouts and opens the routine page.
8. If the plan uses days an active routine uses, Approve shows the Replace or Keep both prompt instead of failing.
9. Reject discards the draft and it no longer appears on Workouts.

### WF-04 Manual routines

- **New routine** (Workouts header plus): routine name, optional purpose, one or more **training days**. Each day has a session name, **Day** and **Type** dropdowns side by side, and exercises (name, sets, reps min and max). Rest time, target weight, start time and duration are intentionally not asked; the person logs the weight they actually lifted.
- Exercises are removed with a minus beside the name field; **Add exercise** is a plain plus; **Add training day** adds another day.
- **Scheduling:** start date and weeks. Saving a new routine **makes it active and schedules it**.
- **Dropdowns** open in a top layer above all other content.
- **Clashes:** if the new routine uses days an active routine already uses, the prompt offers Replace (the old routine is switched off and its upcoming workouts are cancelled, history stays) or Keep both. This only appears when there is a clash.
- **Routine page:** weekly plan with an edit icon per day, an **Add training day** button for existing routines, and a pinned **Activate routine / Deactivate routine** button that flips with the routine's state. Deactivating cancels upcoming workouts but keeps everything done.
- Editing an active routine's day updates its upcoming workouts as well.


**User story.** As a person who already knows what they want to do, I want to build and edit my own routine, so that I don't need the assistant.

**Acceptance criteria**

1. New routine opens as a bottom sheet from the plus in the Workouts header.
2. A training day has a session name, a Day dropdown and a Type dropdown side by side, and exercises with name, sets, reps min and reps max; there are no time, duration, rest or target weight fields.
3. Dropdown lists open in a top layer: they are never clipped or covered by the fields, cards or buttons around them, and choosing an option closes the list.
4. A minus beside an exercise name removes that exercise; a plus adds one; Add training day adds another day.
5. Saving a new routine makes it active and schedules its workouts from the chosen start date for the chosen weeks.
6. If the new routine uses days an active routine uses, a short Replace or Keep both prompt appears; Replace switches the old routine off and cancels its upcoming workouts without touching completed ones; Keep both saves both.
7. With no shared days, no prompt appears.
8. On an existing routine's page I can edit a single day, add a training day, and the change updates its upcoming workouts when the routine is active.
9. A pinned button reads Activate routine for a draft and Deactivate routine for an active one, and switches label after I tap it.
10. Deactivating a routine cancels its upcoming workouts and keeps everything already done.

### WF-05 Overview

- **Header:** avatar, name, and the date ("Saturday, 17 October 2026"), with History and Settings.
- **Status section** (the focal point, centred, no card), with a large Mova illustration on a soft blob:
  - **Needs attention** (red-pink): "Oops, what's going on?", the real number of workouts waiting for an update, and a **Let's catch up** button. The button opens the Catch up sheet. It is the only state with a button.
  - **Up to date:** "Look at you!" with a happy Mova. No button.
  - **Not set up:** "Let's get you started", never labelled "up to date".
- **Training** card (left): today's workout title and "N exercises planned", opens the workout; "+N more today" when there are several; "Rest day" or "Nothing scheduled today" when appropriate; "No routine yet / Create one" or, when only a switched-off routine exists, "No active routine / Activate one".
- **Nutrition** card (right): "On the Menu", with the number of meals planned today; opens the Meal plan.
- **Fasting** card (full width): elapsed time against the goal and a progress ring; opens the Fasting page.
- Training and Nutrition sit side by side with equal widths: a coloured icon beside the small label (teal for Training, apricot for Nutrition), then title and detail. There are no arrows; the whole card is the tap target.


**User story.** As a person opening the app, I want to see at a glance how I am doing and what is on today, so that I know what to do next.

**Acceptance criteria**

1. The header shows my avatar, my name and today's date in the form 'Saturday, 17 October 2026', with History and Settings on the right.
2. If any workout is waiting for an update, the status says 'Oops, what's going on?', states the real number of workouts, and shows a Let's catch up button that opens the Catch up sheet.
3. If nothing is outstanding and a routine is active, the status says 'Look at you!' and shows no button.
4. If no routine is set up, the status says 'Let's get you started' and is never described as up to date.
5. Only the needs-attention state has a button.
6. The status text keeps the normal text colour in the up-to-date state; the illustration changes with the state (worried, happy, welcoming).
7. The Training card shows today's workout title and the number of exercises and opens that workout; with several workouts it adds '+N more today'.
8. The Training card shows Rest day or Nothing scheduled today when appropriate; with no routine it offers Create one; with only a switched-off routine it offers Activate one.
9. The Nutrition card says 'On the Menu' with the real number of meals planned today (or an honest empty message) and opens the Meal plan.
10. The Fasting card shows elapsed time against the goal and a progress ring, or a not-set-up message, and opens the Fasting slide.
11. Training and Nutrition cards are side by side with equal widths, an icon beside the label, and no arrows.

### WF-06 Workout detail and logging

A workout opens as a bottom sheet. The person can start it, record actual sets, reps and weight, skip a set, and finish. Completed values are shown as what was recorded, separate from the plan. **A completed workout leaves the Upcoming list**; its sets live on in Exercise history.


**User story.** As a person doing a workout, I want to record what I actually lifted, so that my history reflects reality rather than the plan.

**Acceptance criteria**

1. A workout opens as a bottom sheet.
2. I can start the workout, enter actual sets, reps and weight for each exercise, skip a set, and finish.
3. Recorded values are shown separately from the plan and a plan is never shown as done.
4. When I finish, the workout leaves the Upcoming list on Workouts.
5. The finished sets appear in Exercise history for that exercise.

### WF-07 Missed workouts and catch-up

Workouts still waiting for an update appear in the **Catch up** sheet, built from real data. For each: **Update it** (open the workout to log what was done) or **Move to another day**. The original planned date is kept. Moving a workout is not completing it.


**User story.** As a person who missed a session, I want an easy, blame-free way to fix it, so that my plan stays accurate.

**Acceptance criteria**

1. The Catch up sheet lists exactly the workouts waiting for an update, with date and title; with none it says all caught up.
2. The sheet starts with a kind, no-pressure sentence and has no blame wording.
3. Update it opens the workout so I can log what was done.
4. Move to another day lets me pick a new date; the workout returns to scheduled, keeps its original planned date, and the move is recorded.
5. A moved workout is not counted as completed.

### WF-08 Spontaneous and past activity

An activity done without a plan, or in the past, can be logged and is labelled as unplanned or added later. It never appears as if it was scheduled.


**User story.** As a person who trained without a plan, I want to log it anyway, so that my history is complete.

**Acceptance criteria**

1. I can log an activity that was not scheduled and one from an earlier date.
2. Such an activity is labelled as unplanned or added later and is never shown as if it had been scheduled.
3. It appears in History and in the spontaneous count.

### WF-09 Exercise history and personal records

Opened as a bottom sheet from the Workouts page. The link only appears once there is logged history. It lists exercises, then each exercise's sessions and personal records (heaviest weight, most reps, and so on), calculated from logged sets and grouped by exact exercise name.


**User story.** As a person who lifts, I want to see my past sets and best results per exercise, so that I can see progress.

**Acceptance criteria**

1. The Exercise history link on Workouts appears only when I have logged exercises.
2. It opens as a bottom sheet listing each exercise with the date last done, the number of sets and my best weight.
3. Opening an exercise shows my sessions of it, each with its sets, and my personal records.
4. Records are calculated from logged sets and only exactly matching exercise names are grouped together.

### WF-10 Meal plan

The **Meal plan** page is a two-slide pager. Tabs **Meals** and **Fasting** sit at the top with a rose line that slides with the swipe (not only on tap).

**Meals slide**
- A full **day card** listing that day's meals in order (slot, name, short description). The card keeps one fixed height (the height of the fullest day) so it does not jump between days.
- Beneath it, **day circles S M T W T F S**: tap one to show that day's card. Today is ringed; the selected day is filled.
- Previous plans are listed below and open read-only.
- Plans are 7 days. If the model leaves days or slots empty, the app asks once for the complete plan and fills any remaining gap from the nearest earlier meal for that slot, so no day is ever blank.
- No calories, macros or protein targets anywhere.

**Shopping list** (cart in the header): the consolidated list for the active plan, grouped by category. Items can be ticked (shopping only, not eating), added and removed. An archived plan's list is read-only with no tick boxes.


**User story.** As a person who wants to eat to a plan, I want a week of meals and a shopping list, so that I know what to cook and buy.

**Acceptance criteria**

1. The Meal plan page has two slides, Meals and Fasting, with tabs on top; the rose line under the tabs moves continuously while I swipe and also when I tap a tab.
2. The tabs line shows only on this page and never on Overview or Workouts.
3. The Meals slide shows one day card listing that day's meals in order with slot, name and a short description.
4. The day card keeps one fixed height for every day, so nothing moves when I switch days.
5. Seven circles S M T W T F S sit beneath the card; tapping one shows that day's meals; today is ringed and the selected day is filled.
6. A generated 7-day plan has meals for every day and every slot; days the AI left empty are completed automatically.
7. A ticked suggestion in chat saves the plan and it fills this page.
8. The cart in the header opens the shopping list as a bottom sheet; on the active plan I can tick, add and remove items; on an archived plan the list is read-only and has no tick boxes.
9. Previous plans are listed and open read-only.
10. No calories, macros or protein appear anywhere on the page.

### WF-11 Schedule

The **Schedule** sheet (Workouts header) shows a week strip, the activities for the chosen day, and **Schedule a run or activity**.


**User story.** As a person with several activities, I want one place to see what is planned for each day, so that I can plan my week.

**Acceptance criteria**

1. The Schedule sheet opens from the calendar icon in the Workouts header.
2. A week strip lets me move between weeks and pick a day; the activities for the chosen day are listed or it says nothing is scheduled.
3. Cancelled workouts do not appear.

### WF-12 Running and other activities

**Schedule a run or activity** opens inside the same sheet flow: activity type, title and date only. There is no time or duration field. It then appears in Schedule and Overview.


**User story.** As a runner, I want to schedule a run or another activity, so that it shows in my plan.

**Acceptance criteria**

1. Schedule a run or activity opens as a bottom sheet over the Schedule sheet, not as a new page.
2. It asks only for activity type, title and date; there is no time or duration field.
3. The date cannot be before today.
4. After saving, the activity appears in Schedule and on Overview for that day, even if a workout is also planned that day.

### WF-13 Intermittent fasting

Lives on the **Fasting** slide of the Meal plan page (the old Settings switch was removed).

- **Off:** a centred prompt, "Intermittent fasting", with **Turn on fasting**.
- **Idle:** a clock-style dial (thin ring with 60 tick marks) reading "Upcoming fast, 16 hours", and **Start fasting**.
- **Fasting:** the same dial with a thin rose arc and a marker at its tip, ticks turning rose as time passes, the elapsed time as HH:MM:SS with the percentage, a "time left" pill, **Started** and **Goal** times, and **End fast**. The clock updates every second.
- **Fasting window:** a collapsible card to set the start time and length (1–72 hours).
- **Recorded fasts** are listed; a planned window is never counted as a completed fast. Only fasts started in the app are recorded.
- **Turn off fasting** is available at the bottom. No health claims are made.
- Overview's Fasting card opens this slide.


**User story.** As a person who fasts, I want a simple clock showing how far through my fast I am, so that I can follow it at a glance.

**Acceptance criteria**

1. With fasting off, the Fasting slide shows a centred prompt and a Turn on fasting button; turning it on needs no visit to Settings.
2. With no active fast, the dial shows 'Upcoming fast' with the number of hours and a Start fasting button.
3. After Start fasting, a thin ring with 60 tick marks shows a thin rose arc and a marker at its tip, the elapsed time as HH:MM:SS that updates every second, the percentage, a time-left pill, the Started and Goal times, and an End fast button.
4. Ticks turn rose as time passes.
5. End fast stops the fast and it appears under Recorded fasts.
6. A planned window is never counted as a recorded fast; only fasts started in the app are recorded.
7. I can set the window's start time and length (1 to 72 hours) in a collapsible card.
8. Turn off fasting is available at the bottom of the slide.
9. The slide scrolls when its content is taller than the screen.
10. Settings does not contain a fasting switch.

### WF-14 Monthly review

From History ("New review") the person can generate a summary of a month from their own records, edit it, and save it. Saved reviews are listed in History.


**User story.** As a person who wants to look back, I want a summary of my month, so that I can plan the next one.

**Acceptance criteria**

1. From History, New review creates a summary for the selected month from my own records.
2. I can edit the text and save it; saved reviews are listed in History and can be updated.
3. The summary uses only recorded data and invents nothing.

### WF-15 Settings

A bottom sheet with: units (weight kg/lb, distance km/mi), time zone (with "use this device's time zone"), goals, training equipment, workout reminders, and **Reset demo data** (with a two-button confirm, Confirm and Cancel, side by side).


**User story.** As a person using the app, I want to set my units and basics in one place, so that the app fits me.

**Acceptance criteria**

1. Settings opens as a bottom sheet from the header.
2. I can change weight (kg or lb) and distance (km or mi) units; the change applies immediately.
3. I can set my time zone, including with one tap to use the device's time zone.
4. I can edit goals and training equipment and switch workout reminders on or off.
5. Reset demo data asks for confirmation with Confirm and Cancel side by side with equal width; Confirm clears everything and returns to onboarding.

### History

A bottom sheet with a month picker, summary counts (planned, completed, moved, missed, spontaneous) that also act as filters, the activity list for the month, and saved reviews, with dividers between sections.


**User story.** As a person reviewing my progress, I want to see what I planned, did, moved or missed, so that I understand my month.

**Acceptance criteria**

1. History opens as a bottom sheet with a month picker.
2. The counts for planned, completed, moved, missed and spontaneous are shown and each acts as a filter for the list below.
3. Sections are separated by dividers and saved reviews are listed at the end.
4. There is no Exercise history button in History; that lives on Workouts.

---

## 5. Domain model (summary)

Profile and preferences; goals; conversations and messages; goal, routine and meal-plan proposals (draft, applied or rejected); routines and routine versions; workout sessions (planned and actual kept separately); session exercises; exercise logs and corrections; schedule changes (every move or cancellation is recorded); activities; meal plans, entries and shopping items; monthly summaries; fasting records; reminders.

**Historical integrity:** completed sessions keep the targets they were done with; new routine versions only replace future scheduled sessions; schedule changes keep the original date, new date and reason.

---

## 6. AI behaviour

- **Provider:** Groq (OpenAI-compatible Chat Completions), model set by environment (default `openai/gpt-oss-120b`), called from the server endpoint `/api/ai`. The key never reaches the app.
- **Structured output:** every call asks for JSON matching a schema, and the reply is validated with the same schema. An invalid reply gets one repair attempt, then fails clearly.
- **Responsibilities:** talk about goals and constraints; propose up to five goals; draft a routine; draft a meal plan; revise a draft; write a monthly summary.
- **Limits:** the AI proposes only. It does not save, schedule or edit records; the app does that when the person ticks or approves.
- **Safety:** not medical advice; no extreme recommendations; asks about injuries only when relevant; never calculates calories, macros or protein; no claim that fasting or any diet suits everyone; missed workouts are never framed as failure.
- **Completeness:** meal plans are checked for every day and slot (see WF-10).
- **Long answers:** the server allows long replies; an answer cut off by length counts as invalid and is retried.

---

## 7. Architecture (as built)

```
apps/mobile      Expo / React Native app (web, iOS, Android), TypeScript
packages/shared  Schemas (Zod), types, pure rules (scheduling, conflicts, fasting, meal grouping)
packages/engine  Domain engine: the same use cases as the server, run on-device against local storage
api/ai.mjs       Serverless endpoint that calls Groq with the server-side key
apps/api         Reference server implementation (Postgres/Supabase + Groq), not used by the submitted build
```

- **Data flow:** screens call the engine through a thin client. The engine validates input with the shared schemas, applies business rules, and writes to local storage. There is no account system and no remote database in the submitted build.
- **AI flow:** engine → `createRemoteAi` → `POST /api/ai` → Groq → validated JSON. If the endpoint is missing, the engine reports "AI unavailable".
- **Deployment:** static web export on Vercel plus the `/api/ai` function. Environment variables (server only): `GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL`.
- **Local development:** `node scripts/ai-proxy.mjs` serves the same endpoint locally from `apps/api/.env`.
- **Fonts and design:** Inter; berry-rose palette; floating navigation; bottom sheets. See `DESIGN.md`.

---

## 8. Global business rules

1. A proposal is never saved until the person ticks or approves it.
2. Planned and actual records are stored separately.
3. Completed history is never deleted by routine changes; deactivating or replacing a routine cancels only upcoming sessions.
4. A new routine is active when saved; an existing routine can be activated or deactivated manually.
5. Routines that share days prompt Replace or Keep both; no prompt without a clash.
6. A completed workout leaves Upcoming and is kept in Exercise history.
7. Meal plans always cover every day of the plan; shopping ticks are not meals eaten.
8. Fasting is optional and recorded only when started in the app.
9. The AI never states that something was saved; the app does.
10. All dates use the person's time zone.

---

## 9. Non-functional requirements

- **Reliability:** failures never lose typed text; every list has loading, empty and error states; AI failures are explained, not hidden.
- **Privacy and security:** data stays on the device; the AI key is server-only; request size and reply length are capped. The AI endpoint has no per-visitor rate limit yet (see section 13).
- **Performance:** subset Inter fonts, non-blocking font load, static hosting.
- **Accessibility:** labelled controls, 44px targets, visible focus, text and colour never alone (a check mark accompanies selected states), live regions for replies, reduced-motion support, minimum contrast of 4.5:1 for text.
- **Responsive:** designed mobile-first; checked at phone width.

---

## 10. Testing

- **Shared rules:** scheduling, conflicts, fasting status, personal records, meal-plan grouping and gap-filling (33 tests).
- **Engine:** the full domain flows against in-memory storage, including routine activation, replace-on-clash, adding a day to an active routine, live-AI parsing and fallback, and meal plans (19 tests).
- **App:** shell rules, formatting, the status logic for the Overview, and component behaviour (30 tests).
- **Reference server:** the HTTP API suite (54 tests).
- **Manual checks** done in the browser for each screen: onboarding, three Overview states and the Catch up sheet, the routine editor and dropdowns, clash prompt, activation toggle, the Meal plan slider and fasting dial, companion suggestions and typing effect, and a live AI request on the deployed site.

---

## 11. Success criteria

The product succeeds when a person can: set up in under a minute; get a routine from the companion in one request and see it on Workouts; log what they actually did; recover from a missed workout without friction; see a full week of meals and a shopping list; run a fast on a simple clock; and trust that nothing was saved or deleted without their say.

---

## 12. Out of scope

Calorie, macro or protein tracking; logging every meal eaten; food discovery and substitutions; document upload; advanced analytics and body measurement; device or health-platform integrations; social features and coaching; accounts, sync across devices, and push notifications from a server.

---

## 13. Known limitations

- Data lives in one browser or device; clearing site data or resetting removes it.
- The AI endpoint has no rate limiting, so a public deployment could be used by others against the provider quota.
- Goals still list inside Settings.
- A meal plan that the model leaves incomplete is filled with repeated meals rather than new ones.
- Reminders depend on browser or device notification permission.

---

## 14. Changes from version 1.2

| Area | Version 1.2 (plan) | Version 2.0 (built) |
|---|---|---|
| Name | Personal Fitness Workspace | Mova |
| Client | Described Flutter guidance | React Native (Expo), web first |
| Accounts and backend | Authenticated users, Postgres persistence | No accounts; on-device storage; reference server kept for later |
| AI provider | OpenAI | Groq through a server endpoint |
| AI confirmation | Review and approve every proposal on a separate page | Tick a one-tap suggestion in chat; routines also have a review sheet |
| Chat style | Up to three clarifying questions | At most one question; acts first |
| Fasting | Settings switch and a page | Second slide of the Meal plan page with a clock dial; turned on there |
| Meal plan | Timetable and shopping list tabs | Meals/Fasting slider, fixed day card with day circles, cart in the header |
| Routine editor | Time, duration, rest and target weight | Day, type and exercises only; weights are logged, not planned |
| Routine states | Draft or active, set when saving | Saving makes it active; manual Activate/Deactivate; Replace or Keep both on clashes |
| Upcoming workouts | Not specified | Completed workouts leave the list; history is in Exercise history |
| Secondary screens | Full pages | Bottom sheets |
| Overview | Greeting plus cards | Status section with three states, Training and Nutrition side by side, Fasting card |
