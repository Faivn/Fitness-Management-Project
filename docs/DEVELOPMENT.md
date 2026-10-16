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

## Configuration

### 1. Supabase

1. Create a **development** Supabase project, and a separate production project later (§8.0.3).
2. Apply the migrations: `npx supabase link --project-ref <ref>`, then `npx supabase db push`.
3. Under Authentication → URL configuration, add the app's redirect URLs (`mova://` and the Expo dev URLs). Email/password sign-in is used; while testing you can turn off email confirmation.
4. Generate typed database bindings once the project exists: `npx supabase gen types typescript --linked > apps/api/src/db/database.types.ts`. These are not generated yet; see "Known gaps".

### 2. API (`apps/api/.env`, and Vercel project environment variables)

Copy `apps/api/.env.example` to `apps/api/.env` and fill in:

| Variable | Secret? | Notes |
|---|---|---|
| `SUPABASE_URL` | No | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | No | Publishable/anon key, used together with each user's JWT so RLS applies |
| `GROQ_API_KEY` | **Yes** | Server only. Never put it in the app or in Git |
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

## Manual QA script (§11.4 essential scenarios)

1. Fresh install → Welcome → Get started → create an account → you land on Overview without a questionnaire.
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

- **No live services connected yet.** No Supabase project, Vercel project or Groq key is configured in this repository, so sign-in, the deployed API and real AI responses have **not** been exercised end to end. Everything that can be tested offline has been: embedded Postgres, scripted AI, and web and iOS bundling.
- **Generated Supabase types** are not committed (spec §8.0.3). They need a linked project; until then, DB rows are mapped to typed DTOs by hand in `apps/api/src/db/mappers.ts`.
- **Mobile UI tests** (§11.2) cover the key components so far (status labels, the planned-vs-actual card, unknown values, proposal and conflict labels, and the routine editor against the shared schema). Full screen-flow tests with mocked API responses are still to be added.
- **Native builds** have not been produced: this machine has no Xcode or Android SDK. The iOS JavaScript bundle builds successfully (`npx expo export --platform ios`).
- **Push notifications** are local-only (`expo-notifications`). Remote push channels are an open decision (§13 item 6).
- **Data export and deletion** expectations (§13 item 10) are not implemented.
- Decisions marked **Proposed** in `ARCHITECTURE_DECISIONS.md` need product-owner confirmation.
