import { dayPart } from '@/lib/greeting';

describe('dayPart', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 16, h, m);
  it('greets by the visitor’s local time', () => {
    expect(dayPart(at(0))).toBe('morning');
    expect(dayPart(at(11, 59))).toBe('morning');
    expect(dayPart(at(12))).toBe('afternoon');
    expect(dayPart(at(17, 59))).toBe('afternoon');
    expect(dayPart(at(18))).toBe('evening');
    expect(dayPart(at(23, 30))).toBe('evening');
  });
});
