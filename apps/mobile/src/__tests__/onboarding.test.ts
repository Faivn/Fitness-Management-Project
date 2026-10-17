/// <reference types="jest" />
import { initialOnboarding, parseOnboarding, STEPS } from '@/lib/onboarding';

describe('onboarding state', () => {
  it('starts from the welcome for missing, corrupt or outdated data', () => {
    expect(parseOnboarding(null)).toEqual(initialOnboarding);
    expect(parseOnboarding('nope')).toEqual(initialOnboarding);
    expect(parseOnboarding(JSON.stringify({ v: 0, name: 'Old', completed: true }))).toEqual(initialOnboarding);
    expect(initialOnboarding.step).toBe('name');
    expect(initialOnboarding.completed).toBe(false);
  });

  it('keeps valid answers and repairs invalid fields', () => {
    const s = parseOnboarding(JSON.stringify({ v: 1, name: '  Faith ', step: 'bogus', usedApp: true, hasRoutine: 'maybe', completed: false }));
    expect(s.name).toBe('Faith');
    expect(s.step).toBe('name');
    expect(s.usedApp).toBe(true);
    expect(s.hasRoutine).toBeNull();
  });

  it('knows its three steps in order', () => {
    expect([...STEPS]).toEqual(['name', 'experience', 'routine']);
  });
});
