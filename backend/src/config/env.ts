/**
 * Environment configuration — validated once at startup (NFR-01).
 *
 * The server refuses to start if a required variable is missing or invalid, and prints
 * exactly which ones are wrong. There are no fallback secrets anywhere (the old codebase's
 * `'default-secret-key'` fallback allowed token forgery).
 *
 * Variables are added here in the roadmap phase that first needs them; every variable must
 * also be listed in backend/.env.example and docs/ARCHITECTURE.md §11.
 */
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose']).default('log'),
  /** Emit JSON log lines (recommended in production). */
  LOG_JSON: booleanFromString.default(false),
  /** Pooled connection used by the running app. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Direct (non-pooled) connection used by Prisma migrations. */
  DIRECT_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Comma-separated list of allowed browser origins. Mobile apps do not need CORS. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  /** Rate limit applied to every endpoint by default (per IP, per minute). */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
});

export type AppEnv = z.infer<typeof envSchema>;

export class InvalidEnvironmentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'InvalidEnvironmentError';
  }
}

/**
 * Parse and validate environment variables. Never logs values (they may be secrets) —
 * only the names of the variables that are wrong and why.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const name = issue.path.join('.') || '(root)';
      return `${name}: ${issue.message}`;
    });
    throw new InvalidEnvironmentError(problems);
  }
  return Object.freeze(result.data);
}
