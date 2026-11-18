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
| `src/common/validation/validation.pipe.ts` | Global zod validation via Nest's `StandardSchemaValidationPipe`, with our error format. **Every `@Body`/`@Query` must pass `{ schema }`** |
| `src/prisma/` | `PrismaService` (database client, `isHealthy()`) and its global module |
| `src/modules/<feature>/` | One folder per feature, each with its own README |
| `src/generated/prisma/` | Generated Prisma client (git-ignored; created by `npm install` / `prisma generate`) |
| `prisma/schema.prisma` | Database schema (full MVP data model) |
| `prisma/migrations/` | SQL migrations — never edit an applied migration; create a new one |
| `prisma/seed.ts`, `prisma/seed-data/` | Idempotent reference data (categories) |
| `prisma/docker-init/` | SQL run once when the local Docker DB is created (creates the test DB) |
| `prisma.config.ts` | Prisma 7 CLI config (schema path, migrations, seed, `DIRECT_URL`) |
| `test/setup/` | Integration-test helpers: test env, global setup (runs migrations), `createTestApp()` |
| `test/*.e2e-spec.ts` | Integration tests |

## Modules
| Module | Status | README |
|---|---|---|
| health | ✅ Phase 0 | [src/modules/health/README.md](src/modules/health/README.md) |
| auth, users, … | Planned — see [ROADMAP](../docs/ROADMAP.md) | — |

## Conventions
- ESM: relative imports end in `.js` (even for `.ts` files).
- Services enforce authorization (filter by the acting user) — never rely on the app to hide things.
- Money only through `WalletService`; order status only through `OrdersService.transition()` (from Phase 5/6).
- Expected errors: throw `AppError` with a stable `code`. Never rename an existing code (the app may depend on it).
