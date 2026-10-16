import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session storage for Supabase Auth. On iOS/Android the session is kept in
 * the OS keychain/keystore via SecureStore, split into chunks because
 * SecureStore values are limited to ~2KB. On web it falls back to
 * localStorage (the only option in a browser).
 */
const CHUNK = 1800;

async function getNative(key: string): Promise<string | null> {
  const countRaw = await SecureStore.getItemAsync(`${key}.n`);
  if (countRaw === null) return null;
  const count = Number(countRaw);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function removeNative(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(`${key}.n`);
  const count = countRaw ? Number(countRaw) : 0;
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  await SecureStore.deleteItemAsync(`${key}.n`);
}

async function setNative(key: string, value: string): Promise<void> {
  await removeNative(key);
  const count = Math.ceil(value.length / CHUNK);
  for (let i = 0; i < count; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  await SecureStore.setItemAsync(`${key}.n`, String(count));
}

/** SecureStore keys may only contain [A-Za-z0-9._-]. */
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureSessionStorage = {
  getItem: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null) : getNative(safe(key)),
  setItem: (key: string, value: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(key, value)) : setNative(safe(key), value),
  removeItem: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(key)) : removeNative(safe(key)),
};
