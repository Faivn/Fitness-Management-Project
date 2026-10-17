/// <reference types="jest" />
import { AVATAR_ACCESSORIES, AVATAR_PALETTES, parseAvatar, randomAvatar } from '@/lib/avatar';

describe('avatar character', () => {
  it('picks a valid random character', () => {
    for (let i = 0; i < 50; i++) {
      const a = randomAvatar();
      expect(AVATAR_PALETTES).toContain(a.palette);
      expect(AVATAR_ACCESSORIES).toContain(a.accessory);
    }
  });

  it('covers every combination when the random source sweeps', () => {
    const seen = new Set<string>();
    for (let i = 0; i < AVATAR_PALETTES.length; i++)
      for (let j = 0; j < AVATAR_ACCESSORIES.length; j++) {
        const seq = [i / AVATAR_PALETTES.length + 0.001, j / AVATAR_ACCESSORIES.length + 0.001];
        let n = 0;
        const a = randomAvatar(() => seq[n++]!);
        seen.add(`${a.palette}/${a.accessory}`);
      }
    expect(seen.size).toBe(AVATAR_PALETTES.length * AVATAR_ACCESSORIES.length);
  });

  it('keeps a stored character and replaces missing or invalid ones', () => {
    const kept = parseAvatar(JSON.stringify({ palette: 'lilac', accessory: 'cat' }));
    expect(kept).toEqual({ avatar: { palette: 'lilac', accessory: 'cat' }, created: false });
    expect(parseAvatar(null).created).toBe(true);
    expect(parseAvatar('not json').created).toBe(true);
    expect(parseAvatar(JSON.stringify({ palette: 'neon', accessory: 'cat' })).created).toBe(true);
  });
});
