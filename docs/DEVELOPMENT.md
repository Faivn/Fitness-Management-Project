# Development Guide

How to run, test and configure the Mova codebase. Product requirements live in [`PRODUCT_SPECIFICATION.md`](PRODUCT_SPECIFICATION.md), and implementation decisions in [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md).

## Repository layout

```text
apps/
  mobile/        React Native (Expo SDK 58, Expo Router) app
    src/app/         screens (file-based routes)
    src/components/  design-system and domain components
    src/hooks/       React Query hooks for every API resource
    src/lib/         API client, auth, secure storage, drafts, reminders
    src/theme/       design tokens
  api/           TypeScript API for Vercel Functions
    api/router.ts    single function entry (see vercel.json)
    src/modules/     domain use cases (thin handlers in src/routes.ts)
    src/lib/         Supabase (user-scoped) and Groq clients
    test/            end-to-end API tests on an embedded Postgres
packages/
  shared/        Zod schemas, DTO types and pure business rules (+ tests)
supabase/
  migrations/    schema, RLS policies, transactional functions
  tests/         database tests (PGlite) and test-only Supabase stubs
docs/            product brief, specification, research, ADRs, this guide
assets/          Mova mascot illustrations (used directly by the app)
```

## Prerequisites

- Node.js 20 or later (developed on Node 22) and npm.
- To run the app on a device or simulator: the **Expo Go** app or a development build. Building native binaries locally needs Xcode (iOS) or Android Studio with a JDK (Android). Alternatively, build in the cloud with EAS: `npx eas-cli build`.
- To run Supabase locally: the Supabase CLI and Docker. Neither is needed for the automated tests.

## Install, test, typecheck

```bash
npm install
```

```bash
npm test
```

```bash
npm run test:db
```

```bash
npm run typecheck
```

`npm test` builds `@mova/shared` and runs the shared-rule tests, the API end-to-end tests and the mobile component tests (jest-expo). `npm run test:db` applies every migration to an embedded Postgres and checks RLS, history integrity and idempotency.

## Public web preview (Vercel)

The website is the Expo web build, deployed as one static Vercel project from the **repository root** (`vercel.json`).

```bash
npm run build:web
```

This produces `apps/mobile/dist`. Vercel runs the same command.

- **Without backend variables**, the site is a **read-only sample preview**. Every screen shows a banner: sample data, nothing saved, AI not connected.
- **To go live**, set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL` in the Vercel project, then redeploy. Visitors then follow: Welcome → Get started → create account or sign in → optional "Set up your workspace" (first sign-in only) → workspace.
- To refresh the sample snapshot:

```bash
npm run sample:generate
```

## Verifying the live Supabase connection

With `apps/api/.env` filled in, the API running (`npm run api:dev`) and two **confirmed** test accounts in the gitignored `.env.test-accounts` (`TEST_ACCOUNT_A_EMAIL/PASSWORD` plus `TEST_ACCOUNT_C_EMAIL/PASSWORD`, or `…_B_…`):

```bash
npm run verify:live -w @mova/api
```

It signs in as both accounts and checks persistence, per-user isolation (through the API **and** through Supabase's own REST interface), privilege limits, idempotency and a real Groq-backed AI turn. It prints PASS/FAIL lines and never prints credentials. It creates a few labelled test rows.

## Configuration

### 1. Supabase

1. Create a **development** Supabase project, and a separate production project later (§8.0.3).
2. Apply the migrations: `npx supabase link --project-ref <ref>`, then `npx supabase db push`.
3. Under Authentication → Providers, keep **Email** enabled. Email confirmation is your choice: if it's on, new users confirm by email before their first sign-in. Under URL configuration, set the Site URL to the web URL and add `http://localhost:8081` and `mova://` as redirect URLs.
4. Generate typed database bindings once the project exists: `npx supabase gen types typescript --linked > apps/api/src/db/database.types.ts`. These are not generated yet; see "Known gaps".

### 2. API (`apps/api/.env`, and Vercel project environment variables)

Copy `apps/api/.env.example` to `apps/api/.env` and fill in:

| Variable | Secret? | Notes |
|---|---|---|
| `SUPABASE_URL` | No | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | No | Publishable/anon key, used together with each user's JWT so RLS applies |
| `GROQ_API_KEY` | **Yes** | Server only. Never put it in the app or in Git |
| `GROQ_BASE_URL` | No | Default `https://api.groq.com/openai/v1` (https required, or localhost for tests) |
| `GROQ_MODEL` | No | Default `openai/gpt-oss-120b` |
| `APP_ORIGIN` | No | Comma-separated browser origins for CORS (Expo web/dev). Native apps don't send an Origin header |
| `API_ENV` | No | `development` / `preview` / `production` |

Run locally:

```bash
npm run api:dev
```

This serves the same handler as Vercel at `http://localhost:3000/api/v1/*`. `GET /api/v1/health` is public; every other endpoint needs `Authorization: Bearer <supabase access token>`.

On Vercel, create a project with **Root Directory = `apps/api`** and set the variables above per environment.

### 3. Mobile app (`apps/mobile/.env`)

Copy `apps/mobile/.env.example` to `apps/mobile/.env`:

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public values only.
- `EXPO_PUBLIC_API_URL`: the API base URL (for example `http://<your-LAN-IP>:3000` when using a phone with a local API).

Then start the app:

```bash
npm run mobile
```

Without configuration the app shows a "not configured" screen listing the missing variables.

## Vercel environment variables

Two Vercel projects are involved (ADR-004 / ADR-015), both deployed to production: the website `mova-fitness` (https://mova-fitness.vercel.app) and the API `mova-api` (https://mova-api.vercel.app).

**API project `mova-api`** (Root Directory `apps/api`, framework preset "Other"). Set for Production (and Preview if wanted):

| Variable | Value | Secret? |
|---|---|---|
| `SUPABASE_URL` | `https://vuwaaopqzzxjuykverkm.supabase.co` | No |
| `SUPABASE_PUBLISHABLE_KEY` | the project's publishable key (`sb_publishable_…`) | No (public by design) |
| `GROQ_API_KEY` | your Groq key | **Yes — mark Sensitive** |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | No |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | No |
| `APP_ORIGIN` | the website URL, e.g. `https://mova-fitness.vercel.app` (comma-separate several) | No |
| `API_ENV` | `production` | No |

**Website project `mova-fitness`** (repo root). Set, then redeploy, to switch from the sample preview to the live app:

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://vuwaaopqzzxjuykverkm.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (public; it is compiled into the bundle) |
| `EXPO_PUBLIC_API_URL` | the `mova-api` production URL, with no trailing slash |

Never set a service-role key anywhere, and never give `GROQ_API_KEY` an `EXPO_PUBLIC_` prefix.

## Manual QA script (§11.4 essential scenarios)

1. Fresh visit → Welcome → Get started → create an account → "Set up your workspace" (optional, or Skip) → Overview. Sign out and sign in again: you go straight to your workspace with your data, and onboarding isn't shown again.
2. Companion: "I want to train four times a week and improve my running" → approve the suggested goals.
3. Workouts → Create with AI → review → edit a field → Check my schedule → Approve and schedule.
4. Workouts → Build manually → save as a draft (no sessions created).
5. Open today's session → Start workout → log sets (kill the app mid-way and reopen: sets are still there) → Finish.
6. Move a session with a reason → its history shows the original and new dates → complete it on the new day.
7. Log activity → a past run with an unknown distance → it shows as "Added later" with no planned date.
8. Meal plan with AI: a Nigerian-food cutting week → approve → timetable and consolidated shopping list, with no calories.
9. Settings → enable hydration and fasting → log water → disable hydration → the overview hides it and the history remains.
10. History → Monthly review → summarise → save → "Plan next month with AI".
11. Turn on airplane mode during a save → the error banner keeps your input → retry → no duplicate records.

## Known gaps and blockers

- **Production is connected to the live backend.** `mova-fitness` is built with the three `EXPO_PUBLIC_*` variables below and talks to `mova-api`, which holds the server-side variables (including `GROQ_API_KEY`, stored as Sensitive). For `mova-api` the project settings are: Root Directory `apps/api`, install `cd ../.. && npm ci`, build `cd ../.. && npm run build:shared && mkdir -p apps/api/public && printf "User-agent: *\nDisallow: /\n" > apps/api/public/robots.txt`, output directory `public`. Deploy each project with `vercel deploy --prod` from the repository root (the root `.vercel/repo.json` links `mova-fitness`; for `mova-api` set `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`). In Supabase → Authentication → URL Configuration, the Site URL is the website URL and `http://localhost:8081/**` stays in Redirect URLs for local development.
- **Generated Supabase types** are not committed (spec §8.0.3). They need a linked project; until then, DB rows are mapped to typed DTOs by hand in `apps/api/src/db/mappers.ts`.
- **Mobile UI tests** (§11.2) cover the key components so far (status labels, the planned-vs-actual card, unknown values, proposal and conflict labels, and the routine editor against the shared schema). Full screen-flow tests with mocked API responses are still to be added.
- **Native builds** have not been produced: this machine has no Xcode or Android SDK. The iOS JavaScript bundle builds successfully (`npx expo export --platform ios`).
- **Push notifications** are local-only (`expo-notifications`). Remote push channels are an open decision (§13 item 6).
- **Data export and deletion** expectations (§13 item 10) are not implemented.
- Decisions marked **Proposed** in `ARCHITECTURE_DECISIONS.md` need product-owner confirmation.

## AI companion streaming

`POST /api/v1/ai/turn/stream` is the streaming twin of `POST /api/v1/ai/turn` (newline-delimited JSON: `delta` events with the reply so far, then `done` with the saved conversation, or `error`). Groq only streams tokens when no `response_format` is set, so the stream route puts the JSON schema in the prompt and still validates the final output with Zod (one schema-enforced repair attempt). Approval flows are unchanged: goal, routine and meal-plan suggestions stay drafts until the user approves them. The app falls back to the plain endpoint if the stream route is unavailable. Motion respects the OS reduced-motion setting.
