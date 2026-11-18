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

/** Placeholder secrets in .env.example contain this text; production refuses them. */
export const PLACEHOLDER_MARKER = 'change-me';

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

  // ── Auth (Phase 1, ADR-017) ──────────────────────────────────────────────
  /** Signs access tokens (HS256). ≥ 32 characters; generate with `openssl rand -base64 48`. */
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  /** Keys the HMAC used to store one-time email codes. ≥ 32 characters, different from JWT_ACCESS_SECRET. */
  CODE_HASH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  /**
   * Stricter per-IP limit (per minute) on signup, login, refresh, forgot/reset password and
   * code resends (FR-603). Kept moderate because a whole college can share one Wi-Fi IP.
   */
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  /**
   * How emails are sent. `console` prints them to the server log (development/test only;
   * refused in production because real users would never receive their codes). Provider
   * drivers are added when PRD Q3 is decided.
   */
  MAIL_DRIVER: z.enum(['console']).default('console'),

  // ── Image storage (Phase 2, ADR-019) ─────────────────────────────────────
  /**
   * `local` = files saved on this server's disk and served by the API (development/tests only;
   * refused in production because free hosting disks are wiped on restart).
   * `supabase` = Supabase Storage (free 1 GB), the app uploads straight to it.
   */
  STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
  /** Folder for the local driver (relative to the backend folder). */
  STORAGE_LOCAL_DIR: z.string().min(1).default('.uploads'),
  /** Supabase project URL, e.g. https://abcd.supabase.co (supabase driver). */
  SUPABASE_URL: z.url({ protocol: /^https?$/ }).optional(),
  /** Server-side only. NEVER put this in the mobile app. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  /** Public bucket for images, e.g. `media`. */
  STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,62}$/).optional(),

  // ── Payments (Phase 6, ADR-004, ADR-024) ────────────────────────────────
  /**
   * `fake` = built-in fake checkout page (development/tests; refused in production).
   * `razorpay` = Razorpay **test mode** (real hosted checkout, fake money).
   */
  PAYMENT_GATEWAY: z.enum(['fake', 'razorpay']).default('fake'),
  /** Must be a TEST key (`rzp_test_…`) — live keys are refused (ADR-004: no real money). */
  RAZORPAY_KEY_ID: z
    .string()
    .regex(/^rzp_test_/, 'must be a Razorpay TEST key (rzp_test_…) — live keys are not allowed')
    .optional(),
  RAZORPAY_KEY_SECRET: z.string().min(8).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(8).optional(),
  /** Public https URL of this API (e.g. https://campusconnect-api.onrender.com). Used for gateway redirects. */
  PUBLIC_API_URL: z.url({ protocol: /^https?$/ }).optional(),
}).superRefine((env, ctx) => {
  if (env.PAYMENT_GATEWAY === 'razorpay') {
    for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'is required when PAYMENT_GATEWAY=razorpay' });
    }
  }
  if (env.NODE_ENV === 'production' && env.PAYMENT_GATEWAY === 'fake') {
    ctx.addIssue({ code: 'custom', path: ['PAYMENT_GATEWAY'], message: 'the fake gateway is not allowed in production' });
  }
  if (env.STORAGE_DRIVER === 'supabase') {
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STORAGE_BUCKET'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'is required when STORAGE_DRIVER=supabase' });
    }
  }
  if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local') {
    ctx.addIssue({
      code: 'custom',
      path: ['STORAGE_DRIVER'],
      message: 'local storage is not allowed in production (files would be lost on restart)',
    });
  }
  if (env.JWT_ACCESS_SECRET === env.CODE_HASH_SECRET) {
    ctx.addIssue({ code: 'custom', path: ['CODE_HASH_SECRET'], message: 'must be different from JWT_ACCESS_SECRET' });
  }
  if (env.NODE_ENV === 'production') {
    for (const key of ['JWT_ACCESS_SECRET', 'CODE_HASH_SECRET'] as const) {
      if (env[key].includes(PLACEHOLDER_MARKER)) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'is still the .env.example placeholder' });
      }
    }
  }
  if (env.NODE_ENV === 'production' && env.MAIL_DRIVER === 'console') {
    ctx.addIssue({
      code: 'custom',
      path: ['MAIL_DRIVER'],
      message: 'console mail is not allowed in production (users would never receive their codes)',
    });
  }
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
