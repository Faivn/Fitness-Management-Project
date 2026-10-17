import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/** A friendly round character, drawn from a palette and an accessory. Stored on this device only. */
export const AVATAR_KEY = 'mova.avatar';

export const AVATAR_PALETTES = ['rose', 'lilac', 'peach', 'mint', 'blush', 'mauve'] as const;
export const AVATAR_ACCESSORIES = ['bear', 'cat', 'bunny', 'bun', 'sprout', 'bow', 'none'] as const;

export type AvatarConfig = { palette: (typeof AVATAR_PALETTES)[number]; accessory: (typeof AVATAR_ACCESSORIES)[number] };

const pick = <T,>(list: readonly T[], rand: () => number): T => list[Math.floor(rand() * list.length) % list.length]!;

export function randomAvatar(rand: () => number = Math.random): AvatarConfig {
  return { palette: pick(AVATAR_PALETTES, rand), accessory: pick(AVATAR_ACCESSORIES, rand) };
}

/** Anything missing or from an older version gets a fresh random character. */
export function parseAvatar(raw: string | null, rand: () => number = Math.random): { avatar: AvatarConfig; created: boolean } {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<AvatarConfig>) : null;
    if (v && AVATAR_PALETTES.includes(v.palette as never) && AVATAR_ACCESSORIES.includes(v.accessory as never)) {
      return { avatar: v as AvatarConfig, created: false };
    }
  } catch {
    // fall through to a new character
  }
  return { avatar: randomAvatar(rand), created: true };
}

/** The visitor's character: picked at random the first time, then kept. */
export function useAvatar(): AvatarConfig | null {
  const [avatar, setAvatar] = useState<AvatarConfig | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(AVATAR_KEY)
      .catch(() => null)
      .then((raw) => {
        const { avatar: a, created } = parseAvatar(raw);
        if (created) void AsyncStorage.setItem(AVATAR_KEY, JSON.stringify(a)).catch(() => undefined);
        if (live) setAvatar(a);
      });
    return () => {
      live = false;
    };
  }, []);
  return avatar;
}
