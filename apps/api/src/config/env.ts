import { z } from 'zod';

/**
 * Server configuration, validated once. Secrets (OPENAI_API_KEY) are read only
 * here and never returned by any endpoint or written to logs.
 */
const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(10).optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-5.5'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(45_000),
  /** Some reasoning models reject `temperature`; only send it when enabled. */
  OPENAI_SUPPORTS_TEMPERATURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  APP_ORIGIN: z.string().default(''),
  API_ENV: z.enum(['development', 'preview', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export class ConfigError extends Error {}

export function getEnv(source: Record<string, string | undefined> = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = envSchema.safeParse({
    ...source,
    // Accept Supabase's legacy key name without introducing a second source of truth.
    SUPABASE_PUBLISHABLE_KEY: source.SUPABASE_PUBLISHABLE_KEY ?? source.SUPABASE_ANON_KEY,
    OPENAI_API_KEY: source.OPENAI_API_KEY || undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new ConfigError(`Server configuration is incomplete or invalid: ${fields}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

export function allowedOrigins(env: Env): string[] {
  return env.APP_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
