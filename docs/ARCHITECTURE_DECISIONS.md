# Architecture Decisions

This file records implementation decisions and why they were made, as required by `PRODUCT_SPECIFICATION.md` §8.0.7 and §13–14. The Product Specification is still the source of truth for product behaviour. Where a decision below differs from wording in the specification, the difference and its reason are stated explicitly so the specification can be updated by the product owner.

Status values: **Accepted** (implemented), **Proposed** (implemented as a default, needs product-owner confirmation).

---

## ADR-001 — React Native with Expo (managed workflow, Expo Router)

**Status:** Accepted
**Context:** The specification selects React Native (§8.0, §14.1, §14.2). Parts of §8 still use Flutter wording (folder `apps/flutter_app/`, "widget tests", "Flutter client"); §14.1 says React Native is the selected frontend and Flutter must not be introduced.
**Decision:** The client is React Native + TypeScript using Expo SDK 58 and Expo Router (file-based navigation) in `apps/mobile/`, matching the folder rule in §8.0.7 ("`apps/mobile/` contains presentation and client-side workflow state only").
**Why Expo:** It builds iOS and Android without a local Xcode/Android Studio install (EAS Build), provides the needed native modules (SecureStore, notifications, crypto), and also runs on the web for quick previews.
**Spec wording to update:** §8 headings and §8.1–8.3, §11.2 and §13 item 1 refer to Flutter; read them as "the React Native client".

## ADR-002 — Groq as the AI provider (via its OpenAI-compatible API)

**Status:** Accepted (product-owner decision; **differs from the specification**, which names OpenAI in §8.0, §8.0.4, §8.0.5 and §8.4)
**History:** Groq was chosen first, OpenAI was briefly used, and the product owner has now settled on Groq. The specification text has not been edited; read its "OpenAI" wording as "the configured AI provider".
**Decision:** The API calls Groq from the server only (`apps/api/src/lib/ai.ts`) through its OpenAI-compatible Chat Completions endpoint, `{GROQ_BASE_URL}/chat/completions`, with Structured Outputs (`response_format: json_schema`). Configuration: `GROQ_API_KEY` (secret), `GROQ_BASE_URL` (default `https://api.groq.com/openai/v1`, must be https unless localhost) and `GROQ_MODEL` (default `openai/gpt-oss-120b`).
**Guarantees:**
- The key stays on the server, is sent only as the `Authorization` header to the configured base URL, and never appears in logs, responses or error messages.
- Every model response is re-validated with Zod and domain rules and treated as untrusted. After one repair retry, the API returns a safe "AI unavailable" error. Provider failures map to typed reasons: `auth_failed`, `rate_limited`, `timeout`, `provider_error`, `invalid_output`.
- AI output is only ever a `draft` proposal until the user approves that exact version.
**Strict mode:** `strict: false` is used because the schemas have legitimately optional fields. Zod validation provides the guarantee instead.

## ADR-003 — npm workspaces monorepo with a shared domain package

**Status:** Accepted
**Decision:** `apps/mobile`, `apps/api`, `packages/shared`, `supabase/`. `@mova/shared` holds domain enums, Zod schemas (requests and AI output), API response types, and pure business rules (session lifecycle, schedule generation, conflict detection, personal records, monthly summary aggregation, meal-list consolidation, unit conversion, fasting status, timezone maths). The API and the app validate with the same schemas, and the business rules are unit-tested outside the UI (§8.3, §10 maintainability).

## ADR-004 — One Vercel Function entry point

**Status:** Accepted
**Decision:** `apps/api/vercel.json` rewrites `/api/v1/:path*` to a single function, `api/router.ts`. A small typed router in `src/routes.ts` dispatches to modules in `src/modules/`. Handlers stay thin, as §8.0.7 requires.
**Why:** It keeps one cold-start path and avoids the per-deployment function limit on lower Vercel plans, while keeping the `/api/v1/...` surface from §8.0.8.

## ADR-005 — Planned and actual activity in one table; history tables insert-only

**Status:** Accepted
**Decision:** `workout_sessions` holds both planned sessions and unplanned activity (spontaneous or historical). Planned columns (`original_planned_date`, `planned_date`, `planned_time`) are separate from actual columns (`actual_date`, `actual_start_at`, `actual_end_at`, duration and distance). Unplanned rows have NULL planned dates, so no fictional plan is ever created (WF-08). The spec's conceptual `ActivityRecord` maps to these rows.
Guarantees enforced in the database:
- `original_planned_date` is immutable (trigger).
- A completed session cannot change status (trigger).
- `completed` requires `actual_date` (check constraint).
- `schedule_changes`, `workout_routine_versions`, `exercise_log_corrections`, `meal_plan_entries` and `conversation_messages` have no UPDATE or DELETE policies, so users cannot rewrite them.
- Replacing a routine retires only future scheduled sessions, and writes a `schedule_changes` row for each.

## ADR-006 — Routine activation creates a bounded window of sessions

**Status:** Proposed (spec §13 items 3–4)
**Decision:** Activating or approving a routine creates concrete sessions for a chosen window: default 4 weeks, 1–12 allowed, starting today or later. Occurrences come from a deterministic rule (`generateOccurrences`), and a unique key per version/session/day makes retries idempotent. Each new period is planned explicitly (for example after a monthly review), which keeps history and plans clearly separated.

## ADR-007 — Personal-record rules `pr-v1`

**Status:** Proposed (spec §13 item 5)
**Decision:** Records are recalculated from completed set logs that have known reps: heaviest weight (for at least 1 rep), most reps in a set, and best single-set volume. Units are converted only to compare; each record is reported in the unit it was logged in. Exercises are grouped by canonical id, otherwise by exact normalised name, so similar names are never merged. No estimated values such as an estimated 1RM are produced.

## ADR-008 — Fasting status: manual first, then schedule

**Status:** Proposed (spec §13 item 7)
**Decision:** A fast the user starts manually takes precedence. Otherwise the status is derived from the saved daily window and the local time. Only manually started and ended fasts are recorded in `fasting_sessions`; a planned window is never counted as a completed fast.

## ADR-009 — Visual identity

**Status:** Proposed (spec §13 item 11)
**Context:** `DESIGN.md` documents Klarna's marketing design system, including proprietary typefaces that are not licensed for reuse.
**Decision:** The app takes the structure of `DESIGN.md` — a violet-tinted ink instead of pure black, hairline-driven flat depth, a 4px spacing base, the 8/16/24/32/pill radius scale, pill buttons and one rationed brand colour. It does **not** use Klarna's brand colours or fonts. The brand colour comes from the Mova mascot illustrations (`#F477AD`, with soft `#FFD9EA` and wash `#FFF2F8`), and text uses the platform font stack. Tokens live in `apps/mobile/src/theme/tokens.ts`. UI patterns follow `docs/research/MOBBIN_RESEARCH.md`.

## ADR-010 — Timezone policy

**Status:** Accepted (spec §9 rule 14)
**Decision:** Scheduled items store the user's intended local date, an optional local time, and the IANA timezone they were planned in. "Today" is always computed in the profile timezone. Instants are derived from local values with DST-aware conversion (`zonedToUtc`).

## ADR-011 — Idempotency and transactions

**Status:** Accepted (spec §8.5, §9 rule 6)
**Decision:** Multi-row operations run as single Postgres functions with `SECURITY INVOKER`, so RLS still applies: applying a routine proposal, creating or versioning a routine, reschedule, miss/cancel, approving a meal plan, and correcting a set log. Each takes an idempotency key stored in `idempotency_keys`, so a retry returns the original result. Single-row creates use unique `(user_id, idempotency_key)` columns. Set logs are upserted by a client-generated `client_id`.

## ADR-012 — Session storage and client data access

**Status:** Accepted (spec §8.0.1–8.0.2)
**Decision:** The app uses Supabase only for authentication. The session is kept in the device keychain or keystore via `expo-secure-store`, chunked because of SecureStore's 2KB value limit, and in `localStorage` on web. All domain reads and writes go through the API with the user's access token. The API verifies the token with Supabase Auth and queries with a user-scoped client, so RLS always applies. The service-role key is not used anywhere.

## ADR-013 — Testing approach without a live Supabase project

**Status:** Accepted
**Decision:** The real migrations are run in an embedded Postgres (PGlite) together with test-only stubs for `auth.uid()` and the Supabase roles (`supabase/tests/supabase-stubs.sql`). Database tests exercise RLS, triggers and RPCs directly. API tests run the real HTTP handler against the same database through a minimal Supabase-compatible query client (`apps/api/test/support/pgSupabase.ts`), with a scripted AI. This covers the §11.3 integration scenarios without network access. It does **not** replace a test against a real Supabase project; see `docs/DEVELOPMENT.md`.

## ADR-014 — Short email sign-in, then an optional first-use step

**Status:** Accepted (spec WF-01, §8.0.2)
**History:** An interim version used Supabase anonymous sessions with no sign-in. The product owner chose user accounts instead, so anonymous sign-ins are disabled again (`supabase/config.toml`).
**Decision:** Entry flow is Welcome → **Get started** → create an account or sign in (email and password, Supabase Auth; spec §8.0.2). After an account's first sign-in comes a short **"Set up your workspace"** screen (`/get-started`), and then the workspace.
- That screen is WF-01's "short first-use state with an obvious option to talk to the AI". Every field is optional: a goal, units, equipment and notes for the AI. **Skip for now** enters the workspace immediately, so there is no mandatory questionnaire.
- It saves through the existing goal and preference endpoints, then sets `profiles.onboarding_completed_at` on the server. Returning users therefore go straight to their workspace on any device.
- Sign-in is kept separate from fitness profiling, as WF-01 requires.
- If email confirmation is on in the Supabase project, sign-up shows "check your email". On web, the confirmation link returns to the same site (`emailRedirectTo`).

## ADR-015 — Public web deployment and the read-only sample preview

**Status:** Accepted
**Decision:**
- The web experience is the Expo web export, deployed as a single static Vercel project from the repo root (`vercel.json`: `npm run build:web` → `apps/mobile/dist`, with an SPA rewrite to `index.html`). The API remains a separate Vercel project (Root Directory `apps/api`, ADR-004) for when the backend is connected.
- When the app has no backend configuration (no `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `EXPO_PUBLIC_API_URL`), it runs a **read-only sample preview**. It serves `apps/mobile/src/sample/snapshot.json`, which is generated from the real API by `npm run sample:generate`: real handler, migrations, RLS and functions on an embedded Postgres, with a canned sample AI. A banner on every screen labels it as sample data. Saving shows a clear "read-only preview" message, and no AI is called.
- Setting the three variables in the Vercel project and redeploying switches the same site to the live app, with sign-in (ADR-014).
**Replaces:** the earlier local "demo login" approach, which was removed.

## ADR-016 — Recruiter demo: local-storage engine, no backend or accounts

- **Status:** Accepted.
- **Context:** Mova is shown to recruiters. Sign-up, a hosted database and a paid AI key are friction and cost, and a public AI endpoint is an abuse risk.
- **Decision:** Extract the use cases into `@mova/engine`, written against a small `Db` interface. The app runs the engine in the browser on a local-storage database (`createLocalApi`), seeded with realistic data, with a deterministic, clearly-labelled demo assistant instead of a live AI. Accounts, Supabase Auth, anonymous sessions, the API client, the read-only sample snapshot and secure-storage code were removed from the app. The app has one AI entry point: the floating companion; routine and meal drafts are created from inside it.
- **Why not a fresh local implementation:** reusing the engine keeps one set of business rules (approval gates, immutable history, idempotency). `apps/api` and `supabase/` remain as an optional reference backend that shares the engine, so a server can return by swapping `api()` in `apps/mobile/src/lib/api.ts`.
- **Consequences:** Data is per browser and disposable; AI is simulated; nothing sensitive is stored. Approval flows are unchanged: AI output is a draft until the user approves it.
