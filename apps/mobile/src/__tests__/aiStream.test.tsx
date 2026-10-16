import { createNdjsonParser } from '@/lib/aiStream';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn(), refreshSession: jest.fn() } } }));
jest.mock('@/sample/sampleApi', () => ({ SampleWriteError: class extends Error {}, sampleApi: jest.fn() }));

describe('createNdjsonParser', () => {
  it('emits complete events even when chunks split lines mid-way', () => {
    const events: unknown[] = [];
    const p = createNdjsonParser((e) => events.push(e));
    p.push('{"type":"delta","text":"Hel');
    expect(events).toEqual([]);
    p.push('lo"}\n{"type":"delta","text":"Hello wor"}\n{"type":"do');
    expect(events).toEqual([
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: 'Hello wor' },
    ]);
    p.push('ne","conversation":{"id":"c"},"goalProposal":null}\n');
    p.end();
    expect(events.at(-1)).toMatchObject({ type: 'done', conversation: { id: 'c' } });
  });

  it('ignores malformed lines and flushes a final line without a newline', () => {
    const events: unknown[] = [];
    const p = createNdjsonParser((e) => events.push(e));
    p.push('not json\n{"type":"error","code":"ai_unavailable","message":"x"}');
    p.end();
    expect(events).toEqual([{ type: 'error', code: 'ai_unavailable', message: 'x' }]);
  });
});
