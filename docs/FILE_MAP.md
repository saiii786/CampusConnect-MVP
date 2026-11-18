# File Map

Every file we maintain, and what it is for. Not listed: generated/vendor files
(`node_modules/`, `dist/`, `package-lock.json`, `backend/src/generated/`, `.expo/`) and image assets.

**Rule:** when you add, rename or delete a file, update this map in the same change. Function-level
detail lives in each package/module `README.md` and in the file's header comment; this is the index.

_Last updated: 2026-11-18 (end of Phase 1)._

---

## Root
| Path | Purpose |
|---|---|
| `README.md` | Entry point: what the project is, setup in ~10 min, everyday commands, troubleshooting, working agreement |
| `package.json` | npm workspaces root (`packages/*`, `backend`, `mobile`) + root scripts (`lint`, `typecheck`, `test`, `test:e2e`, `db:up`, `dev:api`, `dev:mobile`) |
| `docker-compose.yml` | Local PostgreSQL 17 for development and tests (host port 5433) |
| `.github/workflows/ci.yml` | CI on every push/PR: install, lint, typecheck, unit tests, API integration tests (Postgres service) |
| `.gitignore` | Keeps dependencies, builds, generated code and **all `.env` files** out of git |
| `.gitattributes` | Stores text files with LF line endings (Windows ↔ Linux CI), marks images binary |
| `.editorconfig`, `.prettierrc` | Formatting rules (2 spaces, LF, single quotes, width 100) |
| `.nvmrc` | Node version (24) for nvm / CI |

## `docs/` — project documentation
| Path | Purpose |
|---|---|
| `docs/PRD.md` | Product requirements: problem, users, three matching modes, requirement IDs (FR/NFR), open questions Q1–Q7 |
| `docs/ROADMAP.md` | Phased plan, task IDs and status, exit criteria, Definition of Done, parking lot |
| `docs/ARCHITECTURE.md` | Technical design: stack, modules, data model, order state machine, money design, API & socket contracts, security, config, testing, deployment |
| `docs/DECISIONS.md` | Decision log ADR-001…017, with reasons; how to change a decision |
| `docs/DEV_LOG.md` | Dated record of each work session: done, tests run, gaps, next |
| `docs/FILE_MAP.md` | This file |

## `packages/shared/` — `@cc/shared` (used by backend AND mobile)
| Path | Purpose |
|---|---|
| `README.md` | What is shared and the rules for changing it |
| `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` | ESM package config; builds `src/` → `dist/` |
| `src/index.ts` | Public exports |
| `src/auth/schemas.ts` | Auth request schemas (signup, login, refresh, verify, forgot/reset), DOB/age helpers, auth response types, `AuthErrorCode` |
| `src/auth/schemas.spec.ts` | Tests: email normalisation, 18+ rule, terms, password limits, strict (no extra fields), code format |
| `src/enums.ts` | Domain enums (statuses, types) — must match the Prisma schema |
| `src/money.ts` | Paise helpers: `rupeesToPaise`, `formatPaise`, `isValidAmountPaise` |
| `src/money.spec.ts` | Tests for money helpers |
| `src/orders/state-machine.ts` | Order lifecycle rules: `resolveOrderTransition`, `availableOrderActions`, `initialOrderStatus` |
| `src/orders/state-machine.spec.ts` | Exhaustive test of every status × action × actor × payment mode against the documented table |

## `backend/` — `@cc/backend` (NestJS 12 + Prisma 7)
| Path | Purpose |
|---|---|
| `README.md` | Run locally, scripts, folder structure, conventions |
| `package.json` | Dependencies + scripts (`postinstall` generates the Prisma client) |
| `.env.example` | Template for `backend/.env` — every variable documented |
| `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json` | TypeScript / Nest build config (ESM, `nodenext`) |
| `vitest.config.ts` | Unit test config (`src/**/*.spec.ts`) |
| `vitest.config.e2e.ts` | Integration test config (`test/**/*.e2e-spec.ts`, sequential, migrations in global setup) |
| `.oxlintrc.json` | Lint rules (ignores generated code) |
| `prisma.config.ts` | Prisma CLI config: schema, migrations, seed command, `DIRECT_URL` |
| `prisma/schema.prisma` | **Database schema** — full MVP data model |
| `prisma/migrations/20261118132417_init/migration.sql` | First migration: creates all tables, enums, indexes |
| `prisma/migrations/migration_lock.toml` | Prisma's provider lock (do not edit) |
| `prisma/seed.ts` | Idempotent seed runner (`npm run db:seed`) |
| `prisma/seed-data/categories.ts` | Category tree (PRD Appendix A); `sensitive` flags gated categories |
| `prisma/docker-init/01-create-test-db.sql` | Creates `campusconnect_test` when the Docker DB is first created |
| `src/main.ts` | Server entry: load `.env`, validate config (exit on error), start listening |
| `src/app.factory.ts` | `createApp(env)`: helmet, body-size limit, CORS, `/api/v1` prefix, logger — shared by server and tests |
| `src/app.module.ts` | Root module: config, Prisma, rate limiting, validation pipe, error filter, request middleware, feature modules |
| `src/config/env.ts` | Environment schema (zod) + `loadEnv()`; never prints secret values |
| `src/config/env.spec.ts` | Tests: defaults, parsing, refusing bad/missing config, no secret leakage |
| `src/config/config.module.ts` | Injects the validated env (`APP_ENV` token) everywhere |
| `src/common/errors/app-error.ts` | `AppError` with stable error codes + helpers (`notFound`, `forbidden`, …) |
| `src/common/errors/all-exceptions.filter.ts` | Global filter → standard error body `{ error: { code, message, details, requestId } }` |
| `src/common/errors/all-exceptions.filter.spec.ts` | Tests for error mapping (incl. hiding internal errors) |
| `src/common/http/request-context.middleware.ts` | Request IDs + one access-log line per request |
| `src/common/validation/validation.pipe.ts` | Global zod validation (`@Body({ schema })`) with our error format |
| `src/common/shared-contract.spec.ts` | Contract test: Prisma enums == `@cc/shared` enums |
| `src/common/route-safety.spec.ts` | T1.9: every `@Body`/`@Query`/`@Param` has a zod schema; `@Public()` routes match a reviewed list |
| `src/prisma/prisma.service.ts` | Database client (adapter-pg) + `isHealthy()` |
| `src/prisma/prisma.module.ts` | Makes `PrismaService` available globally |
| `src/modules/health/README.md` | Health module docs |
| `src/modules/health/health.controller.ts` | `GET /api/v1/health` (200 ok / 503 degraded) |
| `src/modules/health/health.module.ts` | Registers the health controller |
| `src/modules/auth/README.md` | Auth module docs: endpoints, files, rules for other modules, key numbers |
| `src/modules/auth/auth.module.ts` | Registers auth providers; exports `AuthService`, `TokenService`, `AuthGuard` |
| `src/modules/auth/auth.controller.ts` | `/auth/signup, login, refresh, logout, verify-email, resend-verification, forgot-password, reset-password` |
| `src/modules/auth/auth.service.ts` | Account + session rules: signup, login, refresh rotation & reuse detection, logout, verification, password reset, `me()` |
| `src/modules/auth/auth.guard.ts` | Global guard: bearer token, DB-checked status/role, `@Roles`, `@RequireVerifiedEmail`; `readBearerToken()` |
| `src/modules/auth/auth.guard.spec.ts` | Guard tests (public, missing/invalid token, suspended, deleted, roles, verified email) |
| `src/modules/auth/auth.decorators.ts` | `@Public`, `@Roles`, `@RequireVerifiedEmail`, `@AuthRateLimit`, `@CurrentUser`, `AuthUser` |
| `src/modules/auth/token.service.ts` | Access JWT sign/verify (jose, HS256), refresh-token generation + hashing |
| `src/modules/auth/token.service.spec.ts` | Token tests: round trip, expiry, wrong secret, `alg: none`, wrong type/audience/subject |
| `src/modules/auth/password-hasher.ts` | argon2id hash/verify + timing-equalising dummy verify |
| `src/modules/auth/password-hasher.spec.ts` | Hasher tests (OWASP params, salt, malformed hash) |
| `src/modules/auth/email-code.service.ts` | 6-digit email codes: HMAC storage, expiry, attempts, cooldown, single use |
| `src/modules/mail/README.md` | Mail module docs, drivers, how to add a provider |
| `src/modules/mail/mail.service.ts` | `MailService` interface + `ConsoleMailService` (log + test outbox) |
| `src/modules/mail/mail.module.ts` | Global provider; picks driver from `MAIL_DRIVER` |
| `src/modules/users/README.md` | Users module docs |
| `src/modules/users/users.module.ts` | Registers `/me` |
| `src/modules/users/me.controller.ts` | `GET /me` |
| `src/modules/users/user.mapper.ts` | `toMeResponse()` — safe user response mapping |
| `test/setup/db.ts` | `resetUserData()` — truncates user data in the **test** DB |
| `test/auth.e2e-spec.ts` | Integration tests for signup, login, tokens, refresh reuse, verification, reset, suspension, rate limits |
| `test/setup/test-env.ts` | Test configuration; points at the **test** database only |
| `test/setup/global-setup.ts` | Runs migrations on the test DB before integration tests; refuses non-test DBs |
| `test/setup/test-app.ts` | `createTestApp()` — boots the real app for integration tests |
| `test/platform.e2e-spec.ts` | Integration tests: health, error shape, request IDs, security headers, body limit |

## `mobile/` — `@cc/mobile` (Expo SDK 58)
| Path | Purpose |
|---|---|
| `README.md` | Run on a phone with Expo Go, scripts, folder structure, rules |
| `package.json` | Dependencies, scripts, Jest config (`jest-expo` preset) |
| `app.json` | Expo config: app name, `campusconnect` URL scheme, icons, splash, plugins |
| `tsconfig.json` | TypeScript config (`@/*` → `src/*`, Jest types) |
| `eslint.config.js` | ESLint (Expo flat config) |
| `.env.example` | `EXPO_PUBLIC_API_URL` template (no secrets ever) |
| `.gitignore`, `.vscode/*` | From the Expo template (ignores native folders; editor settings) |
| `AGENTS.md`, `.claude/settings.json` | Expo template guidance for AI coding assistants (SDK-specific docs first) |
| `src/app/_layout.tsx` | Root providers, session restore, splash handling, protected route groups by session status |
| `src/app/reconnect.tsx` | "Can't reach CampusConnect — Try again" (saved session, server unreachable at start) |
| `src/app/(auth)/_layout.tsx` | Signed-out stack (titles, back button) |
| `src/app/(auth)/welcome.tsx` | Welcome: pitch, Create account / Sign in, server status (dev) |
| `src/app/(auth)/sign-in.tsx` | Sign-in form |
| `src/app/(auth)/sign-up.tsx` | Sign-up form (name, email, password, DOB 18+, terms) |
| `src/app/(auth)/forgot-password.tsx` | Request a password-reset code |
| `src/app/(auth)/reset-password.tsx` | Enter code + new password |
| `src/app/(app)/_layout.tsx` | Signed-in stack |
| `src/app/(app)/index.tsx` | Home (Phase 1): greeting, verify-email prompt, server status (dev), sign out |
| `src/app/(app)/verify-email.tsx` | Enter the 6-digit email code / resend |
| `src/components/server-status-card.tsx` | Live `/health` status card |
| `src/components/ui/index.ts` | UI kit exports |
| `src/components/ui/checkbox.tsx` | Accessible checkbox with label and error |
| `src/components/ui/notice.tsx` | Inline danger/warning/success/info message box |
| `src/components/ui/app-text.tsx` | Themed, font-scalable text |
| `src/components/ui/button.tsx` | Accessible button (variants, loading, disabled, ≥ 48 px) |
| `src/components/ui/button.test.tsx` | Button tests (press, busy state) |
| `src/components/ui/text-field.tsx` | Labelled input with error/hint |
| `src/components/ui/screen.tsx` | Safe-area screen container, optional scroll, max width |
| `src/components/ui/state-views.tsx` | `LoadingState`, `ErrorState` (with retry), `EmptyState` |
| `src/config/api-url.ts` | API base URL resolution (env var → dev computer; never guesses in builds) |
| `src/config/api-url.test.ts` | Tests for URL resolution |
| `src/lib/api/client.ts` | HTTP client: JSON, timeouts, bearer token + one refresh-and-retry on 401, errors → `ApiError` |
| `src/lib/api/client.test.ts` | Tests: success, standard errors, network error, timeout, non-JSON errors, auth header, refresh-retry, no loop |
| `src/lib/auth/session.ts` | Session manager + `useSession` store: sign in/out, restore, single-flight token refresh |
| `src/lib/auth/session.test.ts` | Session tests: storage, expiry refresh, single-flight, rejection → sign out, offline handling, restore |
| `src/lib/auth/session-storage.ts` | Refresh token in expo-secure-store |
| `src/lib/auth/auth-api.ts` | Typed `/auth/*` and `/me` calls |
| `src/lib/forms/server-errors.ts` | Map server validation/field errors onto react-hook-form fields |
| `src/lib/forms/server-errors.test.ts` | Tests for the mapping |
| `src/tests/screens/sign-in.test.tsx` | Sign-in screen: validation messages, normalised submit, server error |
| `src/lib/api/api-error.ts` | `ApiError` + `describeError()` friendly messages |
| `src/lib/api/health.ts` | `useServerHealth()` hook (long timeout for sleeping free-tier server) |
| `src/lib/query-client.ts` | Query client; `shouldRetry` (network/5xx only) |
| `src/lib/query-client.test.ts` | Retry-policy tests |
| `src/theme/tokens.ts` | Colours (light/dark, WCAG AA), spacing, radius, typography |
| `src/theme/use-theme.ts` | `useTheme()` |
| `src/hooks/use-color-scheme.ts` | Colour-scheme hook (Expo template) |
