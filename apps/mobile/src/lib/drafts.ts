import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Local drafts: keep unsaved user input across navigation, network errors and
 * app restarts (spec §8.3, §10 reliability). Drafts are a convenience copy —
 * the server stays the source of truth once something is saved.
 */
export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(`draft:${key}`)
      .then((raw) => {
        if (!cancelled && raw) setValue(JSON.parse(raw) as T);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setRestored(true));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          AsyncStorage.setItem(`draft:${key}`, JSON.stringify(v)).catch(() => undefined);
        }, 250);
        return v;
      });
    },
    [key],
  );

  const clear = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await AsyncStorage.removeItem(`draft:${key}`).catch(() => undefined);
  }, [key]);

  return { value, setValue: update, clear, restored };
}
