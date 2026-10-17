# Mova — Product Brief

**Product name:** Mova  
**Tagline:** Your fitness, moving with you.  
**Product category:** Personal fitness management workspace  
**Status:** Built and deployed (https://mova-fitness.vercel.app)  
**Version:** 2.0

---

## 1. Product Overview

Mova is a personal fitness management workspace that brings workout planning, activity tracking, scheduling, meal planning, intermittent fasting, and progress reviews into one calm, connected experience. It runs as a React Native app on the web today, with iOS and Android from the same code.

Rather than treating fitness as a collection of disconnected tasks, Mova helps users manage the complete journey: setting goals, creating routines, planning activities, recording what actually happens, adapting to changes, and reflecting on progress over time.

The product combines conversational AI with structured personal records. Users can talk to the Mova companion, which acts on a request straight away: it drafts a routine, a week of meals or a goal, and the person saves it with a single tick. They can also build everything by hand, organise their schedules, log what they actually did, and use their accumulated history to make informed adjustments.

Mova needs no account. Records stay on the person's device; only the text of a companion conversation is sent, through Mova's own server, to the AI provider.

Mova is built around a simple idea: **your fitness plan should work with your real life, not against it.**

## 2. Problem Statement

Managing a personal fitness journey often involves multiple disconnected tools.

A person might use an AI assistant to develop a workout plan, a notes application to save it, a workout tracker to record exercises and weights, a calendar to manage sessions, and another application to organise meals or reminders.

Although each tool may solve part of the problem, the overall experience remains fragmented.

This creates several challenges:

- **Fragmented information:** Fitness goals, workout routines, activity records, meal plans, and reminders live in different places.
- **Plans disconnected from reality:** A planned workout may be missed, rescheduled, shortened, or replaced by a spontaneous session without the original plan reflecting what happened.
- **Lost context:** Changing a routine or starting a new month can make it difficult to maintain continuity between previous plans, actual activities, and future decisions.
- **Manual coordination:** Users must repeatedly move information between applications and remember what they planned to do.
- **Limited contextual assistance:** Generic AI-generated plans may not account for a person's actual workout history, schedule changes, preferences, and previously recorded activities.
- **Difficult progress reviews:** Understanding progress requires piecing together information about planned sessions, completed workouts, missed activities, and changes over time.

Mova addresses these problems by bringing fitness planning and execution into one connected, persistent system.

## 3. Product Vision

To make personal fitness easier to manage through an intelligent, connected workspace that understands individual goals, preserves activity history, adapts to real-life changes, and supports continuous improvement.

## 4. Product Mission

Help people plan, manage, and understand their fitness journeys without having to coordinate multiple disconnected tools or lose track of their progress when life changes their plans.

## 5. Intended Users

Mova is designed for people who want to manage their fitness journey with greater structure, flexibility, and personalisation.

### Primary user

An individual who independently manages their fitness goals and needs one place to organise routines, workouts, schedules, activities, and progress.

This user may:

- Follow a structured gym or strength-training routine.
- Combine gym workouts with running or other physical activities.
- Need to adapt workouts around a changing schedule.
- Want to preserve exercise history, weights, sets, repetitions, and personal records.
- Use AI to plan routines or think through fitness goals.
- Need help organising meals and related activities.
- Want to understand what they have actually accomplished rather than simply what they intended to do.

### Broader intended audience

Mova may also serve people with different levels of fitness experience, including beginners who need guidance and more experienced individuals who want a better way to coordinate their routines and records.

These are intended user groups, not yet validated market segments.

## 6. Core Product Capabilities

### 6.1 Conversational AI and goal setting

Users can discuss their fitness goals, preferences, routines, and constraints with an AI companion.

The companion asks at most one short question, and only when it cannot continue without it. Otherwise it makes a sensible assumption, says so in one line, and proposes immediately. Replies appear as if typed, and a small shimmering Suggestions pill above the message bar offers ready-made requests such as creating a routine, a meal plan or a goal.

### 6.2 AI-assisted workout planning

Mova can generate workout routines based on the information available about a user's goals and preferences.

Suggestions appear as a simple row with a radio. Ticking it saves it and places it on the right page: goals in Goals, routines on Workouts (scheduled for four weeks), meal plans on the Meal plan page. A routine can also be opened in a review sheet with a short summary, one card per training day with its own edit icon, and an Ask for a change button.

AI-generated plans and proposed changes must not become saved commitments unless the user ticks or approves them.

### 6.3 Workout creation and management

Users can create and edit workouts manually as well as through AI assistance.

They can organise exercises, add or edit training days, activate or deactivate a routine, and make changes without depending on AI. Saving a new routine makes it active. If it shares days with an active routine, a short prompt offers to replace the old one or keep both.

### 6.4 Workout execution and logging

Mova distinguishes between a workout that was planned and a workout that was actually completed.

Users can record completed exercises and relevant performance details, including weights, sets, repetitions, and other supported activity information.

They can also record spontaneous workouts and enter historical activities when appropriate. A completed workout leaves the Upcoming list and its sets live on in Exercise history. Planned weights are not asked for; people log the weight they actually lift.

### 6.5 Flexible scheduling and rescheduling

Users can manage their fitness schedule when life interrupts their plans.

Mova supports missed sessions, rescheduling, and changes to planned activities while preserving the original plan and the relevant history.

A missed or rescheduled workout must not silently become a completed workout, and rescheduling must not erase the record of the original planned date.

### 6.6 Persistent activity history and progress

Mova maintains a continuing record of planned workouts, completed activities, and relevant changes.

Users can review exercise history, compare recorded performance, and maintain personal records.

Past activity records must remain available when a routine changes or a new planning period begins.

### 6.7 Meal planning and nutrition organisation

Mova supports AI-assisted meal planning around users' preferences and familiar foods.

The Meal plan page is a two-slide pager. The Meals slide shows a full card of the day's meals with day circles (S M T W T F S) beneath it to switch days; the card keeps one fixed height. A cart icon in the header opens the shopping list. Plans always cover every day of the week.

The initial nutrition scope focuses on planning and organisation rather than calorie or macronutrient tracking.

### 6.8 Unified schedule and reminders

Mova brings planned workouts, running sessions, and other supported activities into a connected schedule.

Reminders help users keep track of planned activities and related commitments.

### 6.9 Running and other physical activities

Users can plan and record running and other supported activities alongside their gym workouts.

These activities should contribute to the user's overall fitness history rather than remain isolated from the rest of the workspace.

### 6.10 Optional intermittent fasting

Fasting is optional and lives on the second slide of the Meal plan page. It is turned on there, not in Settings. A centred, clock-style dial (a thin ring with tick marks) shows the elapsed time, percentage, time left, and start and goal times, with a single Start or End button. Only fasts started in the app are recorded, and no health claims are made.

### 6.11 Monthly reviews and AI-assisted adjustments

Mova helps users review their fitness activity over a selected period and use that history to inform future plans.

Reviews should distinguish between what was planned, completed, missed, rescheduled, and performed spontaneously.

AI-assisted adjustments should be grounded in the user's saved records, with proposed changes presented for approval before they are saved.

## 7. Product Principles

### 7.1 One connected workspace

Fitness information should work together across planning, scheduling, execution, nutrition organisation, and progress reviews.

### 7.2 Plans and reality are different

A planned workout is not proof that the workout happened. Mova must preserve this distinction throughout the product.

### 7.3 User control comes first

AI should assist, recommend, and organise. Users retain control over their plans: nothing the AI proposes is saved until the user ticks or approves it, and declining is always one tap.

### 7.4 History must persist

Changing a routine, missing a session, or beginning a new month must not erase meaningful historical activity.

### 7.5 Adapt to real life

Mova should support missed sessions, rescheduling, spontaneous workouts, and changing goals without forcing users to restart their fitness journey.

### 7.6 Contextual intelligence

AI assistance should use relevant saved information and activity history where available, rather than treating every interaction as an isolated request.

### 7.7 Structure with flexibility

Mova should provide enough structure to help users stay organised while allowing them to create, edit, and record activities manually.

### 7.8 Transparent records

Users should be able to understand what was planned, what changed, what happened, and how their records inform future recommendations.

### 7.9 Act first, keep it calm

The assistant should do the useful thing quickly instead of questioning the person. The interface is quiet: bottom sheets instead of new pages, plain wording, no blame, no streaks, and no alarming colours beyond a gentle red-pink when something needs attention.

## 8. Product Scope

Mova's intended scope covers the complete personal fitness management experience, including the following areas.

**Core capabilities**

- Lightweight onboarding and preferences.
- Conversational AI and goal setting.
- AI-generated routines with review and approval.
- Manual workout creation and editing.
- Daily overview and workout execution.
- Missed-workout handling and rescheduling.
- Spontaneous and historical activity logging.
- Exercise history and personal records.
- AI-assisted meal planning and shopping lists.
- Unified schedules and reminders.
- Running and other activity planning and logging.
- Monthly reviews and AI-assisted plan adjustments.
- Optional intermittent fasting.
- Basic settings and preferences.

The product should be designed as a connected system, not as a collection of unrelated standalone features.

### Explicitly deferred capabilities

The following are outside the initial defined scope unless separately prioritised:

- Advanced analytics beyond the defined progress and review requirements.
- External wearable and fitness-device integrations.
- Social networking and community features.
- Document imports for creating fitness plans.
- A dedicated food discovery or substitution engine.
- Calorie and macronutrient tracking.
- Meal-consumption logging.
- Hydration tracking (planned originally, not part of the product).
- User accounts and syncing across devices.

These exclusions establish the current scope; they do not imply that every other capability must be postponed until a later version.

## 9. Key Product Rules

The following rules underpin the product's behaviour:

1. AI-generated routines, meal plans, goals and proposed edits are saved only when the user ticks or approves them.
2. Planned sessions and actual completed sessions must be represented separately.
3. Original planned dates and relevant rescheduling or missed-workout history must be preserved.
4. Historical workout logs must not be erased when routines change or new months begin.
5. Spontaneous and historical activities must be distinguishable from originally scheduled workouts.
6. Monthly reviews must be grounded in saved records and accurately represent planned, completed, missed, rescheduled, and spontaneous activities.
7. Meal planning must support timetables and shopping lists without introducing out-of-scope calorie or macronutrient tracking.
8. Users must retain manual control over workout creation and management.
9. A new routine is active when saved; routines that share days prompt Replace or Keep both, and a routine can be activated or deactivated manually.
10. A completed workout leaves the Upcoming list and is kept in Exercise history.
11. The assistant never claims something was saved; the app saves it on the tick.
12. Meal plans cover every day of the plan.

The detailed functional requirements, workflows, edge cases, acceptance criteria, data behaviours, and technical implementation guidance are maintained in the Product Specification.

## 10. Technology Direction

Mova's technology as built is:

| Layer | Technology |
|---|---|
| App | React Native with Expo (web today; iOS and Android from the same code), TypeScript |
| Shared rules and schemas | A shared TypeScript package with Zod validation |
| Domain engine | A TypeScript engine that runs the product's use cases on the device against local storage |
| Data | On the person's device; no accounts and no remote database in the submitted build |
| AI | Groq (OpenAI-compatible API), called only from a server endpoint so the key never reaches the app |
| Hosting | Vercel: static web build plus one serverless function for the AI |
| Reference server | A Postgres (Supabase) implementation of the same use cases, kept for a future account-based version |
| Version control | GitHub |

The AI key is held only in the server environment (`GROQ_API_KEY`) and is never in the client application. The AI endpoint currently has no per-visitor rate limit.

The detailed architecture belongs in the Product Specification.

## 11. Success Criteria

Mova should be evaluated against whether it solves the underlying coordination problem, not merely whether users can generate a workout plan.

The product's success criteria include:

- **Connected management:** Users can manage the defined fitness workflows in one workspace instead of coordinating disconnected tools.
- **Reliable records:** Planned sessions, completed activities, missed workouts, rescheduling, and spontaneous activities remain distinguishable and accessible.
- **Continuity:** Users can change routines and planning periods without losing historical records.
- **User control:** AI-generated plans and changes are saved only when the user ticks or approves them.
- **Actionable assistance:** The assistant produces a usable routine, meal plan or goal from one request, without an interview, and the result appears on its own page.
- **Practical organisation:** Users can manage schedules, reminders, meal timetables, and shopping lists within the intended product scope.
- **Adaptability:** Users can respond to changes in their schedule without compromising the integrity of their activity history.

Alongside these, a new person should be able to set up in under a minute, and a missed workout should be fixable in two taps from the Overview. Specific measurable targets should be defined through product testing and evaluation rather than invented before a baseline has been established.

## 12. Product Documentation

Mova is documented through four complementary files:

- **[README](../README.md):** The personal story behind Mova, the problem that inspired it, and a high-level introduction to the project.
- **[Product Brief](PRODUCT_BRIEF.md):** The product vision, problem statement, intended users, capabilities, principles, scope, and technology direction.
- **[Product Specification](PRODUCT_SPECIFICATION.md):** The detailed behaviour of the built product: workflows with user stories and acceptance criteria, business rules, AI behaviour, architecture and known limitations.
- **[Design Guide](../DESIGN.md):** Visual design: colour, type, layout and components.

The Product Specification is the detailed source of truth for product behaviour. This brief provides an overview and must not be used as a substitute for the complete specification.

---

**Mova — Your fitness, moving with you.**
