# Backend API (`@cc/backend`)

NestJS 12 (ESM) + Prisma 7 + PostgreSQL. Design: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Run locally
Prerequisites: Node 24 (≥ 24.15 recommended), Docker Desktop running.

```bash
# from the repo root
npm install                        # installs everything + generates the Prisma client
npm run db:up                      # local Postgres in Docker (host port 5433)
cp backend/.env.example backend/.env
npm run db:migrate -w @cc/backend  # apply migrations
npm run db:seed -w @cc/backend     # categories (safe to re-run)
npm run dev:api                    # API on http://localhost:3000/api/v1 (auto-reload)
```
Check: open http://localhost:3000/api/v1/health → `{"status":"ok","database":"up",...}`.

`.env.example` contains **placeholder** auth secrets that work locally (production refuses them).
For your own machine you can generate real ones:
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` (run twice — the two secrets must differ).

Verification/reset codes are **printed in this terminal** (`MAIL_DRIVER=console`) until a real email provider is chosen (PRD Q3).
Uploaded images are stored in `backend/.uploads/` (`STORAGE_DRIVER=local`, git-ignored) until Supabase Storage is set up.
"Add money" uses a built-in fake checkout page (`PAYMENT_GATEWAY=fake`) until Razorpay test keys are configured.

## Scripts (`npm run <script> -w @cc/backend`)
| Script | Does |
|---|---|
| `start:dev` | Run with auto-reload |
| `build` / `start:prod` | Compile to `dist/` / run compiled server |
| `typecheck` / `lint` | TypeScript check / oxlint |
| `test` | Unit tests (`src/**/*.spec.ts`, no database) |
| `test:e2e` | Integration tests (`test/**/*.e2e-spec.ts`) against the **test** database `campusconnect_test` |
| `db:migrate` | Create/apply a migration after editing `prisma/schema.prisma` (dev only) |
| `db:deploy` | Apply existing migrations (CI / production) |
| `db:seed` | Upsert reference data |
| `db:studio` | Browse the database in a web UI |
| `admin:grant -- <email> [--revoke]` | Give/remove the ADMIN role (no API for this on purpose) |
| `load:test -- --base <url> [--listings 20000] [--seconds 15] [--workers 20]` | Seeds fake listings and measures p50/p95/p99 per endpoint (NFR-03). **Only runs against a database named `*_load`** — see "Load test" below |

**Migrations in a non-interactive shell** (e.g. an AI assistant or CI): `prisma migrate dev` refuses to run.
Generate the SQL with `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/<timestamp>_<name>/migration.sql`,
**review it** (no drops without approval), then `npm run db:deploy`.

## Load test (NFR-03)
Uses its own database so your dev data is never touched (PowerShell shown; same idea in bash):
```powershell
docker exec campusconnect-postgres psql -U cc -d campusconnect -c "CREATE DATABASE campusconnect_load"   # once
$env:DATABASE_URL = "postgresql://cc:<password>@localhost:5433/campusconnect_load"; $env:DIRECT_URL = $env:DATABASE_URL
npx prisma migrate deploy; npm run db:seed
npm run build
# API under test on port 3001, same database, rate limits raised (otherwise most requests get 429):
$env:PORT = "3001"; $env:RATE_LIMIT_PER_MINUTE = "10000000"; $env:AUTH_RATE_LIMIT_PER_MINUTE = "1000"; $env:JOBS_ENABLED = "false"; $env:LOG_LEVEL = "warn"
Start-Process node dist/main.js
npm run load:test -- --base http://localhost:3001 --seconds 10
```
Exit code 1 if any endpoint's p95 ≥ 300 ms or returns errors. Results of the last run: docs/DEV_LOG.md (Phase 9).

## Folder structure
| Path | Purpose |
|---|---|
| `src/main.ts` | Entry point: loads `.env`, validates config (exits with a clear list of problems if invalid), starts the server |
| `src/app.factory.ts` | `createApp(env)` — builds the app with all middleware (helmet, body limit, CORS, `/api/v1` prefix). Used by `main.ts` **and** integration tests so tests match production |
| `src/app.module.ts` | Root module: config, database, rate limiting, validation pipe, error filter, request-context middleware, feature modules |
| `src/config/env.ts` | zod schema for every environment variable + `loadEnv()` |
| `src/config/config.module.ts` | Provides the validated env everywhere: `@Inject(APP_ENV) env: AppEnv` |
| `src/common/errors/app-error.ts` | `AppError` — throw this for expected problems (`AppError.notFound()`, `.forbidden()`, `.conflict()` …) |
| `src/common/errors/all-exceptions.filter.ts` | Converts every error to the standard `{ error: { code, message, details, requestId } }` body; hides internals of 5xx errors |
| `src/common/http/request-context.middleware.ts` | Request IDs (`x-request-id`) + one access-log line per request (never logs bodies or tokens) |
| `src/common/validation/validation.pipe.ts` | Global zod validation via Nest's `StandardSchemaValidationPipe`, with our error format. **Every `@Body`/`@Query`/`@Param` must pass `{ schema }`** |
| `src/common/route-safety.spec.ts` | Scans all controllers: fails on any unvalidated parameter, or if the set of `@Public()` routes changes without updating its reviewed list |
| `src/prisma/` | `PrismaService` (database client, `isHealthy()`) and its global module |
| `src/modules/<feature>/` | One folder per feature, each with its own README |
| `src/generated/prisma/` | Generated Prisma client (git-ignored; created by `npm install` / `prisma generate`) |
| `prisma/schema.prisma` | Database schema (full MVP data model) |
| `prisma/migrations/` | SQL migrations — never edit an applied migration; create a new one |
| `prisma/seed.ts`, `prisma/seed-data/` | Idempotent reference data (categories) |
| `prisma/scripts/grant-admin.ts` | `npm run admin:grant` |
| `prisma/scripts/load-test.ts` | `npm run load:test` (Phase 9, ADR-027) |
| `prisma/docker-init/` | SQL run once when the local Docker DB is created (creates the test DB) |
| `prisma.config.ts` | Prisma 7 CLI config (schema path, migrations, seed, `DIRECT_URL`) |
| `test/setup/` | Integration-test helpers: test env, global setup (runs migrations), `createTestApp()`, `resetUserData()`, `seedCategories()`, `createUser()`, `uploadImage()` |
| `test/*.e2e-spec.ts` | Integration tests |

## Modules
| Module | Status | README |
|---|---|---|
| health | ✅ Phase 0 | [src/modules/health/README.md](src/modules/health/README.md) |
| auth | ✅ Phase 1 | [src/modules/auth/README.md](src/modules/auth/README.md) |
| mail | ✅ Phase 1 (console driver) | [src/modules/mail/README.md](src/modules/mail/README.md) |
| users | ✅ Phase 2 (profile, student badge, portfolio, public profiles, deletion) | [src/modules/users/README.md](src/modules/users/README.md) |
| storage | ✅ Phase 2 (local ✅; Supabase built, not yet verified live) | [src/modules/storage/README.md](src/modules/storage/README.md) |
| uploads | ✅ Phase 2 | [src/modules/uploads/README.md](src/modules/uploads/README.md) |
| categories | ✅ Phase 2 | [src/modules/categories/README.md](src/modules/categories/README.md) |
| admin | ✅ Phases 2/6/8 (domains, ledger, reports, suspensions, disputes, jobs) — API only | [src/modules/admin/README.md](src/modules/admin/README.md) |
| listings | ✅ Phase 3 | [src/modules/listings/README.md](src/modules/listings/README.md) |
| quotes | ✅ Phase 4 (accept → Phase 5) | [src/modules/quotes/README.md](src/modules/quotes/README.md) |
| conversations | ✅ Phase 4 | [src/modules/conversations/README.md](src/modules/conversations/README.md) |
| realtime | ✅ Phase 4 (socket.io) | [src/modules/realtime/README.md](src/modules/realtime/README.md) |
| safety | ✅ Phases 4 + 8 (blocks, reports, suspension, spam guard) | [src/modules/safety/README.md](src/modules/safety/README.md) |
| jobs | ✅ Phase 8 (auto-approve) | [src/modules/jobs/README.md](src/modules/jobs/README.md) |
| orders | ✅ Phase 5 (direct payment; escrow in Phase 6) | [src/modules/orders/README.md](src/modules/orders/README.md) |
| wallet | ✅ Phase 6 (ledger, escrow, simulated withdrawals) | [src/modules/wallet/README.md](src/modules/wallet/README.md) |
| payments | ✅ Phase 6 (fake ✅; Razorpay test mode built, awaiting keys) | [src/modules/payments/README.md](src/modules/payments/README.md) |
| reviews | ✅ Phase 7 (+ public work record) | [src/modules/reviews/README.md](src/modules/reviews/README.md) |
| notifications | ✅ Phase 7 (in-app + live; phone push after the EAS build) | [src/modules/notifications/README.md](src/modules/notifications/README.md) |

## Conventions
- ESM: relative imports end in `.js` (even for `.ts` files).
- Every route requires sign-in unless marked `@Public()` (global `AuthGuard`). Get the caller with `@CurrentUser()`.
- Services enforce authorization (filter by the acting user) — never rely on the app to hide things.
- Money only through `WalletService`; order status only through `OrdersService.transition()` (from Phase 5/6).
- Expected errors: throw `AppError` with a stable `code`. Never rename an existing code (the app may depend on it).
