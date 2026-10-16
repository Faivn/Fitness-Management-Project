import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { config } from './config';
import { secureSessionStorage } from './secureStorage';

/**
 * Supabase is used on the client ONLY for authentication (spec §8.0.1). All
 * domain reads and writes go through the Mova API. When it is not configured
 * (or in local demo mode) a placeholder client is created and never used.
 */
export const supabase = createClient(
  config.supabaseUrl || 'http://not-configured.invalid',
  config.supabaseKey || 'not-configured',
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
