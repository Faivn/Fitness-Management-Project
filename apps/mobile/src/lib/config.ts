/**
 * Public client configuration (compiled into the bundle). Only the Supabase
 * URL, the publishable key and the API base URL belong here — never the
 * service-role key or the Groq key, which stay on the server.
 */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, ''),
};

export const missingConfig: string[] = [
  !config.supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL',
  !config.supabaseKey && 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  !config.apiUrl && 'EXPO_PUBLIC_API_URL',
].filter((x): x is string => Boolean(x));

export const isConfigured = missingConfig.length === 0;
