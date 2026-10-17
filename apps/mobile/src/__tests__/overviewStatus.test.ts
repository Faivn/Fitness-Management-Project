/// <reference types="jest" />
import { overviewStatus, statusCopy } from '@/lib/overviewStatus';

const session = (id: string) => ({ id }) as never;

describe('overview status', () => {
  it('needs attention only when real sessions are waiting, and counts them', () => {
    const s = overviewStatus({ hasActiveRoutine: true, needsAttention: [session('a'), session('b')] });
    expect(s).toEqual({ kind: 'attention', count: 2 });
    const copy = statusCopy(s);
    expect(copy.body).toMatch(/two workouts/);
    expect(copy.action).toBe("Let's catch up");
  });

  it('is up to date only with an active routine and nothing outstanding, and has no action', () => {
    const s = overviewStatus({ hasActiveRoutine: true, needsAttention: [] });
    expect(s.kind).toBe('upToDate');
    expect(statusCopy(s).headline).toBe('Look at you!');
    expect(statusCopy(s).action).toBeUndefined();
  });

  it('is not configured, never "up to date", when there is no active routine', () => {
    const s = overviewStatus({ hasActiveRoutine: false, needsAttention: [] });
    expect(s.kind).toBe('unconfigured');
    expect(statusCopy(s).headline).not.toBe('Look at you!');
    expect(statusCopy(s).action).toBeUndefined();
  });

  it('uses singular copy for one workout and stays free of gendered address', () => {
    const copy = statusCopy({ kind: 'attention', count: 1 });
    expect(copy.body).toMatch(/one workout still waiting/);
    const all = ['attention', 'upToDate', 'unconfigured']
      .map((k) => statusCopy(k === 'attention' ? { kind: 'attention', count: 3 } : ({ kind: k } as never)))
      .map((c) => `${c.headline} ${c.body}`)
      .join(' ');
    expect(all).not.toMatch(/\b(girl|boy|sis|bro|queen|king|ma'am|sir)\b/i);
  });
});
