# Development Guide

How to run, test and deploy Mova. Product requirements live in [`PRODUCT_SPECIFICATION.md`](PRODUCT_SPECIFICATION.md); decisions in [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) (see ADR-016).

## What this is today

Mova is a **recruiter-facing, no-login demo**. It needs no backend, database, accounts, API keys or environment variables. The whole product runs in the browser:

- All data lives in browser **local storage** (key `mova.demo`, about 90 KB). It is seeded on first visit with two weeks of realistic history, an active routine, this week's meal plan, water, fasting and a saved review, all relative to today.
- The "AI companion" is a **deterministic demo assistant** (rule-based, offline). It is labelled as simulated in the app. Its goal, routine and meal suggestions are drafts that only change anything after explicit approval, exactly like a live AI would.
- Settings → **Reset demo data** clears local storage and re-seeds.
- Nothing sensitive is stored: no credentials, tokens or keys.

## Repository layout

```text
apps/
  mobile/        React Native (Expo SDK 58, Expo Router) app, the demo
    src/app/         screens (file-based routes)
    src/components/  design-system and domain components
    src/hooks/       React Query hooks (one per resource)
    src/lib/         data layer (api.ts), storage, copy (UX text), drafts, reminders
    src/theme/       design tokens
  api/           OPTIONAL reference backend (Vercel Functions + Supabase). Not used by the demo.
packages/
  shared/        Zod schemas, DTO types and pure business rules
  engine/        The product's use cases, written against a small database interface
    src/modules/     routines, sessions, schedule, meals, hydration, fasting, history, AI proposals
    src/local/       browser database (local storage), stored procedures, seed data, demo assistant
supabase/        Schema, RLS and SQL functions for the reference backend (PGlite tests)
docs/            Product brief, specification, research, ADRs, this guide
assets/          Mova mascot illustrations
```

### Design system

`DESIGN.md` (Oura-based) is the source of truth; `apps/mobile/src/theme/tokens.ts` implements it: sandstone page, cards one tone deeper (no borders or shadows), graphite pill actions, 24px cards, light-weight display type with one serif-italic phrase per heading (the greeting), eyebrow section labels, and mustard/amber/indigo used sparingly. AkkuratLL and Editorial New are not bundled, so the platform sans and serif are used. Where a spec value fails contrast (`ink-soft` text, hairline outlines), a darker value is used and noted in `tokens.ts`. The mascot is the SVG set in `assets/illustrations/mova`, recoloured to the palette and embedded with `npm run mascot:generate`.

### How the data layer works

`apps/mobile/src/lib/api.ts` exposes one function, `api(method, path, body)`, with the same routes and JSON contracts a server would. It calls the **engine** (`@mova/engine`) running on a **local database** (`createLocalApi`). The engine is the same code the reference backend runs; only the database differs (browser storage here, Postgres there). To reintroduce a backend, replace the body of `api()` with a `fetch` to it. No screen changes are needed.

The local database (`packages/engine/src/local`) emulates the small query surface the engine uses, plus ports of the SQL functions (routine/meal approval, rescheduling, idempotent retries) with the same rules: history is insert-only, a proposal is applied only from `draft` at the reviewed version, retries are idempotent. Stored data that is missing, corrupt or from an older version is replaced with fresh demo data.

## Prerequisites

Node.js 20 or later and npm. To run on a device or simulator: Expo Go or a development build.

## Install, test, typecheck, build

```bash
npm install
npm run typecheck      # builds shared + engine, then typechecks every workspace
npm test               # shared, engine, api (reference backend) and mobile tests
npm run test:db        # reference-backend schema tests (PGlite)
npm run build:web      # production web export → apps/mobile/dist
npm run mobile         # start Expo (press w for web)
```

## Deploying the demo (Vercel)

One static Vercel project from the repository root (`vercel.json`: `npm run build:web` → `apps/mobile/dist`, SPA rewrite). **No environment variables are needed.** Deploy with `vercel deploy --prod`.

## Optional reference backend

`apps/api` and `supabase/` are kept, unchanged in behaviour, so a real backend can come back later. They share the engine (`@mova/engine`) and schemas (`@mova/shared`). The demo does not call them. Summary:

- API: Vercel Functions, Supabase Auth token verification, Row Level Security, Groq for AI (streaming at `POST /api/v1/ai/turn/stream`), guest limits (`supabase/migrations/*_guest_demo.sql`). Variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL`, `APP_ORIGIN`, `API_ENV` (see `apps/api/.env.example`).
- Run it: `npm run api:dev`; tests: `npm test -w @mova/api`, `npm run test:db`.
- The existing Vercel project `mova-api` and the Supabase project belong to this reference backend and were not modified by the demo change.

## Manual QA script

1. First visit → Welcome → Open demo → optional Set up (try Save and Skip) → Overview is already populated.
2. Companion (floating button): "Plan my training week" → Draft a routine → review → Approve and schedule → it appears in Workouts and the schedule.
3. Companion: "Suggest a goal" → approve the suggested goal → Settings → Goals.
4. Workouts → New routine (manual) → save as draft, then schedule it.
5. Open today's session → Start workout → log sets → Finish. Move a session with a reason; its history shows both dates.
6. Schedule → add a run or activity. History → tap a stat card to filter.
7. Companion: "Plan my meals" → Draft a meal plan → approve → Meal plan tab: timetable and shopping list.
8. Overview: add water; Fasting: start and end a fast.
9. Refresh the page: everything is still there. Settings → Reset demo data restores the original data.

## Known gaps

- The demo assistant is rule-based and returns fixed templates; it does not read your free text beyond a few keywords.
- Data is per browser: another browser or device starts from the seed. Clearing site data resets it.
- Native builds have not been produced here (no Xcode/Android SDK); the web export and iOS JS bundle build.
- Reminders are local notifications only.


## First-run onboarding

New people see `/onboarding` once (name, "used a fitness app before?", "do you have a routine?"). Progress and answers are kept in AsyncStorage under `mova.onboarding` (`apps/mobile/src/lib/onboarding.ts`); the entry gate in `app/index.tsx` redirects until `completed` is true. The workspace itself starts empty (`createLocalApi({ sample: false })`); the engine's sample data is only used by its own tests. "Reset demo data" in Settings wipes the workspace and the onboarding answers, so onboarding runs again. The demo storage version was bumped to 2, which discards any sample-seeded data saved by earlier builds.
