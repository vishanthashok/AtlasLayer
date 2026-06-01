/**
 * Server-side environment validation.
 * Import and call `validateEnv()` in instrumentation.ts or at app startup.
 * Logs warnings for missing optional vars; throws for missing required vars.
 */

interface EnvSpec {
  key: string;
  required: boolean;
  description: string;
}

const ENV_SPEC: EnvSpec[] = [
  // AI
  { key: 'ANTHROPIC_API_KEY', required: false, description: 'Anthropic Claude API key (Parcelis + Fieldstone AI analysis)' },
  // Supabase
  { key: 'NEXT_PUBLIC_SUPABASE_URL', required: false, description: 'Supabase project URL' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: false, description: 'Supabase service-role key (server writes)' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: false, description: 'Supabase anon key (read-only fallback)' },
  // Maps
  { key: 'NEXT_PUBLIC_MAPBOX_TOKEN', required: false, description: 'Mapbox GL access token' },
  // Caching
  { key: 'UPSTASH_REDIS_REST_URL', required: false, description: 'Upstash Redis URL (falls back to in-memory)' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', required: false, description: 'Upstash Redis token' },
  // Security
  { key: 'CRON_SECRET', required: false, description: 'Secret for ConflictLens cron authorization (required in production)' },
];

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const warned: string[] = [];

  for (const spec of ENV_SPEC) {
    const val = process.env[spec.key];
    if (!val || val.length < 4) {
      if (spec.required) {
        missing.push(`  ✗ ${spec.key} — ${spec.description}`);
      } else {
        warned.push(`  ○ ${spec.key} — ${spec.description}`);
      }
    }
  }

  // CRON_SECRET is effectively required in production
  if (isProd && !process.env.CRON_SECRET) {
    console.warn('[env] WARNING: CRON_SECRET not set in production — ConflictLens refresh endpoint is unprotected');
  }

  if (warned.length > 0 && !isProd) {
    console.info('[env] Optional vars not set (features may be degraded):\n' + warned.join('\n'));
  }

  if (missing.length > 0) {
    throw new Error('[env] Required environment variables are missing:\n' + missing.join('\n'));
  }
}
