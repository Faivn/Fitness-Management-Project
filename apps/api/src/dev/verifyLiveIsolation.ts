/**
 * DEVELOPMENT TOOL — live verification against the real Supabase project and
 * the locally running API (`npm run api:dev`, with apps/api/.env set up).
 *
 * Signs in as two confirmed test accounts (credentials come from the
 * gitignored `.env.test-accounts` at the repo root; nothing is printed) and
 * checks authentication, persistence, per-user isolation through the API AND
 * through Supabase's own REST interface, privilege limits, idempotency and
 * the Groq-backed AI turn. It creates a few clearly labelled test rows.
 *
 * Run: npm run verify:live -w @mova/api
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const envOf = (f: string) => Object.fromEntries(readFileSync(f, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const api = envOf(join(root, 'apps/api/.env'));
const acct = envOf(join(root, '.env.test-accounts'));
const SB = api.SUPABASE_URL!, KEY = api.SUPABASE_PUBLISHABLE_KEY!, API = 'http://localhost:3000/api/v1';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

async function signIn(email: string, password: string) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j: any = await r.json();
  return { ok: r.ok, status: r.status, token: j.access_token as string | undefined, id: j.user?.id as string | undefined, err: j.error_code ?? j.msg };
}
const call = async (token: string | null, method: string, path: string, body?: unknown) => {
  const r = await fetch(`${API}/${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, body: j };
};
const rest = async (token: string | null, path: string, init: RequestInit = {}) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json', ...(init.headers as any) } });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, body: j };
};

const SECOND = acct.TEST_ACCOUNT_C_EMAIL ? 'C' : 'B';
const secondEmail = (acct.TEST_ACCOUNT_C_EMAIL ?? acct.TEST_ACCOUNT_B_EMAIL)!;
const secondPassword = (acct.TEST_ACCOUNT_C_PASSWORD ?? acct.TEST_ACCOUNT_B_PASSWORD)!;
const A = await signIn(acct.TEST_ACCOUNT_A_EMAIL!, acct.TEST_ACCOUNT_A_PASSWORD!);
check('sign in A (email confirmed, password accepted)', A.ok, A.ok ? '' : `status ${A.status} ${A.err}`);
const B = await signIn(secondEmail, secondPassword);
check(`sign in ${SECOND} (second account: email confirmed, password accepted)`, B.ok, B.ok ? '' : `status ${B.status} ${B.err}`);
const wrong = await signIn(acct.TEST_ACCOUNT_A_EMAIL!, 'definitely-wrong-password');
check('wrong password is rejected', !wrong.ok && wrong.status === 400);
if (!A.ok || !B.ok) { console.log(`\n${pass} passed, ${fail} failed (stopped: cannot continue without both accounts)`); process.exit(1); }

// ---- API: auth required
check('API rejects requests with no token', (await call(null, 'GET', 'profile')).status === 401);
check('API rejects a garbage token', (await call('not.a.token', 'GET', 'profile')).status === 401);

// ---- A's data (created earlier through the UI)
const aSessions = (await call(A.token!, 'GET', 'workout-sessions?from=2026-01-01&to=2027-12-31')).body as any[];
const aGoals = (await call(A.token!, 'GET', 'goals')).body as any[];
const aRoutines = (await call(A.token!, 'GET', 'routines')).body as any[];
const aProfile = (await call(A.token!, 'GET', 'profile')).body;
check('A has saved data (goal, routine, sessions, onboarding done)', aGoals.length >= 1 && aRoutines.length >= 1 && aSessions.length >= 1 && !!aProfile.onboardingCompletedAt, `${aGoals.length} goals, ${aRoutines.length} routines, ${aSessions.length} sessions`);
check('A preferences persisted (pounds)', aProfile.weightUnit === 'lb');
const aSess = aSessions[0]!, aGoal = aGoals[0]!, aRoutine = aRoutines[0]!;

// ---- B sees none of it, through the API
const bProfile = (await call(B.token!, 'GET', 'profile')).body;
check("B's profile is B's own, not A's", bProfile.id === B.id && bProfile.id !== A.id);
const bSessions = (await call(B.token!, 'GET', 'workout-sessions?from=2026-01-01&to=2027-12-31')).body as any[];
check('B lists none of A\'s sessions', bSessions.every((s) => !aSessions.some((x) => x.id === s.id)), `B has ${bSessions.length}`);
check('B lists none of A\'s goals', ((await call(B.token!, 'GET', 'goals')).body as any[]).every((g) => g.id !== aGoal.id));
check('B lists none of A\'s routines', ((await call(B.token!, 'GET', 'routines')).body as any[]).length === 0);
check('B sees none of A\'s exercise history or records', ((await call(B.token!, 'GET', 'exercises')).body as any[]).length === 0 && ((await call(B.token!, 'GET', 'personal-records')).body as any[]).length === 0);
check("B cannot open A's session by id (404)", (await call(B.token!, 'GET', `workout-sessions/${aSess.id}`)).status === 404);
check("B cannot open A's routine by id (404)", (await call(B.token!, 'GET', `routines/${aRoutine.id}`)).status === 404);
check("B cannot start A's session", [403, 404, 422].includes((await call(B.token!, 'POST', `workout-sessions/${aSess.id}/start`, {})).status));
check("B cannot reschedule A's session", [403, 404, 422].includes((await call(B.token!, 'PATCH', `workout-sessions/${aSess.id}/reschedule`, { newDate: '2026-12-01', idempotencyKey: 'iso-test-12345678' })).status));
check("B cannot edit A's goal", [403, 404].includes((await call(B.token!, 'PATCH', `goals/${aGoal.id}`, { title: 'hijacked' })).status));
const hijack = await call(B.token!, 'POST', `workout-sessions/${aSess.id}/logs`, { logs: [{ clientId: 'iso-hijack-12345', exerciseName: 'Hijack', setNumber: 1, actualReps: 1 }] });
check("B cannot write set logs onto A's session", hijack.status >= 400, `status ${hijack.status}`);
check("A's goal title unchanged after B's attempt", ((await call(A.token!, 'GET', 'goals')).body as any[]).find((g) => g.id === aGoal.id)?.title === aGoal.title);

// ---- B writes; A must not see it (and vice versa)
const bGoal = await call(B.token!, 'POST', 'goals', { title: 'B-only isolation test goal', priority: 'low', isMeasurable: false, idempotencyKey: `iso-b-goal-${Date.now()}` });
check('B can save their own goal', bGoal.status === 201);
check("A cannot see B's goal", ((await call(A.token!, 'GET', 'goals')).body as any[]).every((g) => g.title !== 'B-only isolation test goal'));

// ---- Direct database API (PostgREST) with each user's JWT and with no user at all
const bRestSessions = await rest(B.token!, 'workout_sessions?select=id');
check('direct REST as B: workout_sessions has none of A\'s rows', bRestSessions.status === 200 && (bRestSessions.body as any[]).every((r) => !aSessions.some((x) => x.id === r.id)), `${(bRestSessions.body as any[]).length} rows`);
const bRestGoals = await rest(B.token!, 'fitness_goals?select=id,user_id');
check('direct REST as B: fitness_goals contains only B\'s rows', (bRestGoals.body as any[]).every((r) => r.user_id === B.id));
const bInsertFake = await rest(B.token!, 'fitness_goals', { method: 'POST', body: JSON.stringify({ user_id: A.id, title: 'forged' }) });
check('direct REST as B: cannot insert a row owned by A (RLS)', bInsertFake.status >= 400);
const bUpdateA = await rest(B.token!, `fitness_goals?id=eq.${aGoal.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'forged' }), headers: { prefer: 'return=representation' } });
check("direct REST as B: updating A's goal changes nothing", bUpdateA.status < 300 ? (bUpdateA.body as any[]).length === 0 : true);
const bDeleteHist = await rest(B.token!, `schedule_changes?id=not.is.null`, { method: 'DELETE', headers: { prefer: 'return=representation' } });
check('direct REST: nobody can delete schedule history (no policy)', bDeleteHist.status >= 400 || (bDeleteHist.body as any[]).length === 0);
const anon = await rest(null, 'fitness_goals?select=id');
check('direct REST with only the publishable key (no user): no data', anon.status >= 400 || (Array.isArray(anon.body) && anon.body.length === 0), `status ${anon.status}`);
const anonRpc = await rest(null, 'rpc/reschedule_session', { method: 'POST', body: JSON.stringify({ p_session_id: aSess.id, p_new_date: '2026-12-01', p_new_time: null, p_reason: null, p_idempotency_key: 'anon-iso-123' }) });
check('direct REST: domain function not callable without a user', anonRpc.status >= 400, `status ${anonRpc.status}`);
const trig = await rest(A.token!, 'rpc/handle_new_user', { method: 'POST', body: '{}' });
check('direct REST: handle_new_user() is not callable by users', trig.status >= 400, `status ${trig.status}`);
const bRpcOnA = await rest(B.token!, 'rpc/reschedule_session', { method: 'POST', body: JSON.stringify({ p_session_id: aSess.id, p_new_date: '2026-12-01', p_new_time: null, p_reason: null, p_idempotency_key: 'b-on-a-123456' }) });
check("direct REST: B cannot reschedule A's session via the database function", bRpcOnA.status >= 400, `status ${bRpcOnA.status}`);
const aStill = (await call(A.token!, 'GET', `workout-sessions/${aSess.id}`)).body;
check("A's session is unchanged after all of B's attempts", aStill.plannedDate === aSess.plannedDate && aStill.status === aSess.status);

// ---- Idempotency on live Supabase
const key = `iso-idem-${Date.now()}`;
const g1 = await call(A.token!, 'POST', 'goals', { title: 'Idempotency check', priority: 'low', isMeasurable: false, idempotencyKey: key });
const g2 = await call(A.token!, 'POST', 'goals', { title: 'Idempotency check', priority: 'low', isMeasurable: false, idempotencyKey: key });
check('retrying a save with the same idempotency key creates no duplicate', g1.status === 201 && g2.body?.id === g1.body?.id);

// ---- Real Groq call through the API, stored in Supabase
const ai = await call(A.token!, 'POST', 'ai/turn', { message: 'I want to run a 5k in six weeks. I can train three days a week.', clientMessageId: `iso-ai-${Date.now()}` });
check('AI turn via API: real Groq reply saved to the conversation', ai.status === 200 && ai.body?.conversation?.messages?.at(-1)?.role === 'assistant', `status ${ai.status}`);
if (ai.status === 200) {
  const last = ai.body.conversation.messages.at(-1);
  console.log('      assistant said:', JSON.stringify(last.content).slice(0, 160));
  const goalsAfter = ((await call(A.token!, 'GET', 'goals')).body as any[]).length;
  check('AI-proposed goals are NOT saved without approval', ai.body.goalProposal ? goalsAfter === aGoals.length + 1 /* the idempotency goal */ : true, `goals now ${goalsAfter}`);
}
const bConv = (await call(B.token!, 'GET', 'ai/conversations')).body as any[];
check("B cannot see A's AI conversation", bConv.length === 0 || bConv.every((c) => c.id !== ai.body?.conversation?.id));

console.log(`\n${pass} passed, ${fail} failed`);
