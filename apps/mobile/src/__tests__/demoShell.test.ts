/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === '__tests__' ? [] : files(p)) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const sources = files(SRC).map((p) => ({ path: p.slice(SRC.length + 1), text: readFileSync(p, 'utf8') }));

describe('demo shell', () => {
  it('opens the companion only from the nav button and from places that ask for a plan', () => {
    const entries = sources.filter((s) => /router\.push\(['"`]\/companion/.test(s.text)).map((s) => s.path).sort();
    expect(entries).toEqual(['app/(tabs)/index.tsx', 'app/onboarding.tsx', 'components/FloatingNav.tsx']);
    expect(sources.some((s) => /FloatingChatButton/.test(s.text))).toBe(false);
  });

  it('has no separate AI buttons or screens', () => {
    const offenders = sources.filter((s) => /(Create|Plan|Draft|Adjust|Ask|Talk)[^'"`\n]{0,30}with (the )?AI|routine\/ai|meal\/new/i.test(s.text)).map((s) => s.path);
    expect(offenders).toEqual([]);
  });

  it('needs no accounts, backend client or environment variables', () => {
    const offenders = sources.filter((s) => /@supabase|supabase\.auth|signIn|signUp|EXPO_PUBLIC_|SecureStore|useAuth/.test(s.text)).map((s) => s.path);
    expect(offenders).toEqual([]);
  });

  it('keeps shared UX copy in one module', () => {
    const copy = sources.find((s) => s.path === 'lib/copy.ts')!.text;
    expect(copy).toMatch(/Demo assistant: replies are simulated/);
  });
});
