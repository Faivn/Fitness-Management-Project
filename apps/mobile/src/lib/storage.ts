import AsyncStorage from '@react-native-async-storage/async-storage';
import { memoryStorage, type StorageAdapter } from '@mova/engine';
import { Platform } from 'react-native';

/** The demo database lives under this single key. It holds no credentials or secrets. */
export const DEMO_STORAGE_KEY = 'mova.demo';

/**
 * Browser localStorage on the web. On iOS/Android (AsyncStorage is async) the
 * saved copy is read once at start-up and written through after each change.
 */
export async function openDemoStorage(): Promise<StorageAdapter> {
  if (Platform.OS === 'web') {
    const ls = (() => {
      try {
        return typeof localStorage === 'undefined' ? null : localStorage;
      } catch {
        return null; // blocked (e.g. some private modes): the demo runs in memory
      }
    })();
    if (!ls) return memoryStorage();
    return {
      load: () => {
        try {
          return ls.getItem(DEMO_STORAGE_KEY);
        } catch {
          return null;
        }
      },
      save: (v) => {
        try {
          ls.setItem(DEMO_STORAGE_KEY, v);
        } catch {
          /* storage full: keep working in memory */
        }
      },
      clear: () => {
        try {
          ls.removeItem(DEMO_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      },
    };
  }
  const initial = await AsyncStorage.getItem(DEMO_STORAGE_KEY).catch(() => null);
  const mem = memoryStorage(initial);
  return {
    load: mem.load,
    save: (v) => {
      mem.save(v);
      void AsyncStorage.setItem(DEMO_STORAGE_KEY, v).catch(() => undefined);
    },
    clear: () => {
      mem.clear();
      void AsyncStorage.removeItem(DEMO_STORAGE_KEY).catch(() => undefined);
    },
  };
}
