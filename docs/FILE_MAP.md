# File Map

Every file we maintain, and what it is for. Not listed: generated/vendor files
(`node_modules/`, `dist/`, `package-lock.json`, `backend/src/generated/`, `.expo/`) and image assets.

**Rule:** when you add, rename or delete a file, update this map in the same change. Function-level
detail lives in each package/module `README.md` and in the file's header comment; this is the index.

_Last updated: 2026-11-19 (end of Phase 8)._

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
| `docs/DECISIONS.md` | Decision log ADR-001…031, with reasons; how to change a decision |
| `docs/RUNBOOK.md` | Operating the pilot: deploy (Render, EAS), migrations, backups/restore, secret rotation, incidents |
| `docs/TESTING.md` | Founder's manual test checklist with a Notes column |
| `render.yaml` | Render Blueprint for the API (free, Singapore; secrets typed into Render, never in git) |
| `backups/` | **Not in git.** Database dumps from `npm run db:backup` (contain user data) |
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
| `src/users/schemas.ts` | Profile, student badge, portfolio, account-deletion schemas; `MeResponse`, `PublicProfile`, `PortfolioItemDto`, `UserBadge` |
| `src/users/schemas.spec.ts` | Tests for users/uploads/admin schemas (tag cleaning, limits, upload keys, domains, ids) |
| `src/uploads/schemas.ts` | Upload signing schema, upload-key pattern, image types, 5 MB limit, `UploadTarget` |
| `src/categories/types.ts` | Category response types |
| `src/listings/schemas.ts` | Listing create/update/search schemas, listing rules, DTOs, `Page<T>`, distance helpers |
| `src/quotes/schemas.ts` | Quote request schemas and DTOs |
| `src/conversations/schemas.ts` | Chat/block schemas, DTOs, socket event names |
| `src/listings/schemas.spec.ts` | Tests: offer/job rules, on-site location, search query coercion, haversine, rounding |
| `src/admin/schemas.ts` | Student-domain admin schema + DTO |
| `src/enums.ts` | Domain enums (statuses, types) — must match the Prisma schema |
| `src/money.ts` | Paise helpers: `rupeesToPaise`, `formatPaise`, `isValidAmountPaise` |
| `src/money.spec.ts` | Tests for money helpers |
| `src/orders/schemas.ts` | Order request schemas and DTOs |
| `src/wallet/schemas.ts` | Wallet/top-up/withdrawal schemas and DTOs, reconcile DTO |
| `src/reviews/schemas.ts` | Review/reply schemas, review + work-record DTOs |
| `src/notifications/schemas.ts` | Notification types/DTOs, read + push-token schemas |
| `src/safety/schemas.ts` | Report + admin moderation/dispute schemas and DTOs |
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
| `prisma/migrations/20261118210000_phase2_profile_storage_keys/migration.sql` | Phase 2 (additive): `Profile.avatarKey`, `Profile.studentEmail` (unique), `PortfolioItem.imageKey` |
| `prisma/migrations/20261118230000_phase3_listing_image_keys/migration.sql` | Phase 3 (additive): `Listing.imageKeys` |
| `prisma/migrations/20261119000000_phase8_moderation_hidden/migration.sql` | Phase 8 (additive): `Message.hiddenAt`, `Review.hiddenAt` |
| `prisma/migrations/20261119100000_phase9_listing_trgm/migration.sql` | Phase 9 (additive): pg_trgm + trigram indexes on listing title/description |
| `prisma/migrations/20261119110000_phase9_order_code_attempts/migration.sql` | Phase 9 (additive): `Order.codeAttempts` |
| `prisma/migrations/20261119120000_phase10_lock_public_schema/migration.sql` | RLS on every table + no privileges for Supabase `anon`/`authenticated` (ADR-029) |
| `prisma/migrations/migration_lock.toml` | Prisma's provider lock (do not edit) |
| `.env.supabase` | **Not in git.** Supabase connection strings (production database) — local file only |
| `src/modules/mail/brevo-mail.service.ts` | Brevo email driver (ADR-029) |
| `src/modules/mail/brevo-mail.service.spec.ts` | Brevo driver unit tests |
| `test/schema-safety.e2e-spec.ts` | Fails if any table lacks Row Level Security |
| `prisma/scripts/grant-admin.ts` | `npm run admin:grant -- <email> [--revoke]` |
| `prisma/scripts/load-test.ts` | `npm run load:test` — seeds a `*_load` database and measures p50/p95/p99 per endpoint |
| `prisma/scripts/db-check.ts` | `npm run db:check` — read-only queries through the app's Prisma client (test a connection string, e.g. Supabase pooler) |
| `prisma/scripts/db-backup.ts` | `npm run db:backup` — pg_dump + automatic restore check into a throwaway DB |
| `src/prisma/pg-options.ts` | Database connection options: verified TLS with `DATABASE_CA_CERT_PATH` (ADR-031) |
| `src/prisma/pg-options.spec.ts` | Tests for the TLS options |
| `certs/supabase-prod-ca-2021.crt` | Supabase's public CA certificate (not a secret) |
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
| `src/modules/auth/code-hasher.ts` | Shared 6-digit code generation, scoped HMAC hashing, constant-time compare |
| `src/modules/storage/README.md` | Storage drivers + Supabase bucket setup steps |
| `src/modules/storage/storage.service.ts` | Abstract `StorageService` |
| `src/modules/storage/local-storage.service.ts` | Local disk driver with signed upload tokens |
| `src/modules/storage/supabase-storage.service.ts` | Supabase Storage driver (REST) |
| `src/modules/storage/storage.module.ts` | Global provider; picks driver from `STORAGE_DRIVER` |
| `src/modules/storage/storage.spec.ts` | Driver unit tests |
| `src/modules/uploads/README.md` | Upload flow, endpoints, files |
| `src/modules/uploads/uploads.service.ts` | `sign`, `claim`, `discard` |
| `src/modules/uploads/uploads.controller.ts` | `POST /uploads/sign` |
| `src/modules/uploads/local-uploads.controller.ts` | Local driver: `PUT /uploads/local/:token`, `GET /uploads/files/*key` |
| `src/modules/uploads/image-signature.ts` | JPEG/PNG/WebP magic-byte check |
| `src/modules/uploads/uploads.module.ts` | Module + raw-body parser on the local upload route only |
| `src/modules/users/profile.service.ts` | Own profile, public profile, account deletion |
| `src/modules/users/student-verification.service.ts` | Student badge: domain rules, code, grant |
| `src/modules/users/student-verification.spec.ts` | Unit tests: domain candidates, image signature |
| `src/modules/users/portfolio.service.ts` | Portfolio CRUD, 10-item limit, ordering |
| `src/modules/users/portfolio.controller.ts` | `/me/portfolio*` |
| `src/modules/users/users.controller.ts` | `GET /users/:id` |
| `src/modules/categories/README.md` | Categories module docs |
| `src/modules/categories/categories.service.ts` | Grouped list without gated categories; `getSelectable()` |
| `src/modules/categories/categories.controller.ts` | `GET /categories` (public, cached) |
| `src/modules/categories/categories.module.ts` | Exports `CategoriesService` |
| `src/common/pagination/cursor.ts` | Opaque keyset/offset pagination cursors |
| `src/common/http/app-throttler.guard.ts` | Rate-limit guard for HTTP only (skips socket contexts) |
| `src/modules/users/user-stats.service.ts` | Batched rating/review count/completed jobs per user |
| `src/modules/safety/README.md` | Safety module docs (blocks) |
| `src/modules/safety/safety.module.ts` | Safety module |
| `src/modules/safety/blocks.controller.ts` | `/blocks` |
| `src/modules/safety/blocks.service.ts` | Block checks and management |
| `src/modules/safety/reports.controller.ts` | `POST /reports` |
| `src/modules/safety/reports.service.ts` | Reports, moderation (hide/suspend), target lookup |
| `src/modules/safety/content-guard.ts` | Scam/link/flood checks + per-user limits |
| `src/modules/safety/blocked-terms.ts` | Editable scam-phrase list |
| `src/modules/safety/content-guard.spec.ts` | Content guard unit tests |
| `src/modules/admin/admin-safety.controller.ts` | Admin reports + suspend/unsuspend |
| `src/modules/admin/admin-disputes.controller.ts` | Admin dispute list + resolution |
| `src/modules/admin/admin-jobs.controller.ts` | Run auto-approve now |
| `src/modules/jobs/README.md` | Scheduled jobs docs |
| `src/modules/jobs/jobs.module.ts` | Jobs module |
| `src/modules/jobs/jobs.service.ts` | Auto-approve interval + `autoApprove()` |
| `src/modules/realtime/README.md` | Realtime (socket.io) docs |
| `src/modules/realtime/realtime.module.ts` | Global realtime module |
| `src/modules/realtime/realtime.gateway.ts` | socket.io gateway: verified handshake, rooms |
| `src/modules/realtime/realtime.service.ts` | `emit()` helper + room names |
| `src/modules/conversations/README.md` | Chat module docs |
| `src/modules/conversations/conversations.module.ts` | Conversations module |
| `src/modules/conversations/conversations.controller.ts` | `/conversations…` |
| `src/modules/conversations/conversations.service.ts` | Conversations, messages, unread, read receipts |
| `src/modules/wallet/README.md` | Wallet/ledger docs: endpoints, money movements |
| `src/modules/wallet/ledger.module.ts` | Single LedgerService provider |
| `src/modules/wallet/ledger.service.ts` | Double-entry posting, escrow balance, reconciliation |
| `src/modules/wallet/wallet.service.ts` | Wallet, history, withdrawals, escrow (`OrderMoney`) |
| `src/modules/wallet/wallet.controller.ts` | `/wallet…` |
| `src/modules/wallet/wallet.module.ts` | Wallet module |
| `src/modules/payments/README.md` | Payments docs + how to switch on Razorpay test mode |
| `src/modules/payments/payment-gateway.ts` | Gateway interface |
| `src/modules/payments/fake-gateway.ts` | Fake gateway (dev/tests) |
| `src/modules/payments/razorpay-gateway.ts` | Razorpay test-mode Payment Links |
| `src/modules/payments/payments.service.ts` | Top-ups, verify, webhook handling, crediting |
| `src/modules/payments/webhooks.controller.ts` | `POST /webhooks/razorpay` (raw body) |
| `src/modules/payments/fake-checkout.controller.ts` | Fake checkout HTML pages + return page |
| `src/modules/payments/payments.module.ts` | Gateway selection |
| `src/modules/payments/payments.spec.ts` | Ledger/gateway unit tests |
| `src/modules/admin/ledger.controller.ts` | `GET /admin/ledger/reconcile` |
| `src/modules/reviews/README.md` | Reviews + work record docs |
| `src/modules/reviews/reviews.module.ts` | Reviews module |
| `src/modules/reviews/reviews.controller.ts` | Review endpoints + public work record (JSON/HTML) |
| `src/modules/reviews/reviews.service.ts` | Review rules, replies, per-order state, work record |
| `src/modules/reviews/work-record.page.ts` | Public work-record HTML (escaped) |
| `src/modules/notifications/README.md` | Notifications docs (how to notify, push drivers) |
| `src/modules/notifications/notifications.module.ts` | Global notifications module |
| `src/modules/notifications/notifications.service.ts` | notify (collapse chat), list, read, push tokens |
| `src/modules/notifications/notifications.controller.ts` | Notification + push-token endpoints |
| `src/modules/notifications/push.service.ts` | Expo push sending |
| `src/modules/orders/README.md` | Orders module docs |
| `src/modules/orders/orders.module.ts` | Orders module + escrow hook binding |
| `src/modules/orders/orders.controller.ts` | Order endpoints (incl. `POST /quotes/:id/accept`) |
| `src/modules/orders/orders.service.ts` | Booking, quote acceptance, `transition()`, on-site codes, lists/detail |
| `src/modules/quotes/README.md` | Quotes module docs |
| `src/modules/quotes/quotes.module.ts` | Quotes module |
| `src/modules/quotes/quotes.controller.ts` | Quote endpoints |
| `src/modules/quotes/quotes.service.ts` | Quote rules and DTOs |
| `src/modules/listings/README.md` | Listings module docs: endpoints, rules, files |
| `src/modules/listings/listings.module.ts` | Listings module |
| `src/modules/listings/listings.controller.ts` | `/listings…` and `/me/listings` |
| `src/modules/listings/listings.service.ts` | Create/update/status/detail/search (database + geo paths) |
| `src/modules/listings/listing.mapper.ts` | Listing response mappers (no coordinates) |
| `src/modules/admin/README.md` | Admin module docs + how to grant admin |
| `src/modules/admin/admin.module.ts` | Registers admin controllers |
| `src/modules/admin/student-domains.controller.ts` | `GET/POST /admin/student-domains` |
| `src/modules/mail/README.md` | Mail module docs, drivers, how to add a provider |
| `src/modules/mail/mail.service.ts` | `MailService` interface + `ConsoleMailService` (log + test outbox) |
| `src/modules/mail/mail.module.ts` | Global provider; picks driver from `MAIL_DRIVER` |
| `src/modules/users/README.md` | Users module docs |
| `src/modules/users/users.module.ts` | Registers users controllers and services |
| `src/modules/users/me.controller.ts` | `GET/PATCH/DELETE /me`, `/me/student-verification*` |
| `src/modules/users/user.mapper.ts` | `toMeResponse`, `toPublicProfile`, `toPortfolioItemDto` — safe response mapping |
| `test/setup/db.ts` | `resetUserData()` (truncates user data in the **test** DB), `seedCategories()` |
| `test/setup/users.ts` | `createUser()`, `uploadImage()`, `JPEG_BYTES` |
| `test/auth.e2e-spec.ts` | Integration tests for signup, login, tokens, refresh reuse, verification, reset, suspension, rate limits |
| `test/chat.e2e-spec.ts` | Integration tests: quotes, conversations, blocks, socket.io (handshake, rooms, live delivery) |
| `test/safety.e2e-spec.ts` | Integration tests: reports, admin moderation, suspension, hidden reviews, disputes, auto-approve, spam guard, per-user limits |
| `test/reviews.e2e-spec.ts` | Integration tests: reviews, replies, window, work record privacy/escaping, notifications, push tokens |
| `test/wallet.e2e-spec.ts` | Integration tests: top-ups, escrow flows, refunds, double tap, withdrawals, reconciliation, Razorpay webhooks (mocked API) |
| `test/orders.e2e-spec.ts` | Integration tests: booking, quote acceptance, lifecycle, permissions, limits, disputes, double tap, on-site codes |
| `test/listings.e2e-spec.ts` | Integration tests for listings and search (rules, ownership, visibility, photos, filters, near-me, pagination) |
| `test/profiles.e2e-spec.ts` | Integration tests for profile, uploads, portfolio, public profiles, student badge, categories, admin domains, account deletion |
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
| `src/app/(app)/index.tsx` | Browse (home): post/my listings/profile links, verify prompt, search, type tabs, near me, filters, endless list |
| `src/app/(app)/search-filters.tsx` | Filters: category, remote/on-site, price, sort, distance |
| `src/app/(app)/listings/new.tsx` | Post a service offer or job request |
| `src/app/(app)/listings/[id].tsx` | Listing detail; owner actions (edit/pause/resume/close) |
| `src/app/(app)/listings/edit/[id].tsx` | Edit my listing |
| `src/app/(app)/my-listings.tsx` | My listings with status filter |
| `src/app/(app)/listing-quotes/[id].tsx` | Quotes received for my job (compare, chat, decline) |
| `src/app/(app)/quote-form.tsx` | Send / edit my quote |
| `src/app/(app)/my-quotes.tsx` | My quotes as a seller (edit, withdraw) |
| `src/app/(app)/inbox.tsx` | Conversations with unread counts |
| `src/app/(app)/chat/[id].tsx` | Chat screen (live, read receipts, safety banner, block) |
| `src/components/quotes/quote-card.tsx` | Quote card with seller trust signals |
| `src/app/(app)/book.tsx` | Book a service (hours / agreed price, requirements, payment mode) |
| `src/app/(app)/accept-quote.tsx` | Accept a quote → order |
| `src/app/(app)/orders.tsx` | Orders list: I'm buying / I'm selling, active / all |
| `src/app/(app)/orders/[id].tsx` | Order detail: actions, on-site codes, timeline |
| `src/components/orders/payment-mode-picker.tsx` | Direct / wallet payment choice |
| `src/app/(app)/wallet.tsx` | Wallet: balance, escrow, history, add/withdraw |
| `src/app/(app)/add-money.tsx` | Top-up in the in-app browser with auto-verify |
| `src/app/(app)/withdraw.tsx` | Simulated withdrawal |
| `src/components/ui/test-mode-badge.tsx` | TEST MODE badge |
| `src/lib/wallet/wallet-api.ts` | Wallet calls + hooks, labels |
| `src/lib/wallet/wallet.test.ts` | Every transaction kind has a label |
| `src/app/(app)/notifications.tsx` | Notifications list (tap to open, mark all read) |
| `src/app/(app)/report.tsx` | Report screen (reason + details) |
| `src/app/legal/[doc].tsx` | Terms / Privacy / Guidelines (always reachable) |
| `src/content/legal.ts` | Legal texts (drafts — lawyer review before launch) |
| `src/content/brand.ts` | Brand name + tagline (ADR-029) |
| `src/app/(app)/(tabs)/_layout.tsx` | Bottom tabs: Home · Messages (unread badge) · Post · Orders · Profile |
| `src/app/(app)/(tabs)/index.tsx`, `inbox.tsx`, `orders.tsx`, `profile.tsx` | The four tab screens (moved here from `(app)/`; URLs unchanged) |
| `src/app/(app)/(tabs)/post.tsx` | "Post" tab placeholder → opens `/listings/new` |
| `eas.json` | EAS build profiles (preview = APK for testers, API URL baked in) |
| `assets/brand/*.svg` | Logo sources: app icon, rounded mark, Android foreground/background/monochrome, splash mark (ADR-030) |
| `assets/brand/make-brand.cjs` | Regenerates the SVGs and every PNG icon from geometry |
| `assets/brand/logo-mark-256.png` | Logo preview for docs |
| `assets/images/*.png` | Generated app icons (icon, adaptive foreground/background/monochrome, splash, favicon) |
| `e2e/.env.test-accounts` | **Not in git.** Real test inboxes, local only |
| `src/components/ui/offline-banner.tsx` | "You're offline" banner + `useIsOnline()` (ADR-028) |
| `src/components/ui/page-footer.tsx` | Endless-list footer: loading more / error with Try again |
| `src/theme/tokens.test.ts` | Contrast tests: every text pair ≥ 4.5:1, control outlines ≥ 3:1, light + dark |
| `src/tests/components/offline-and-paging.test.tsx` | Offline banner + page footer tests |
| `e2e/README.md` | Maestro setup and how to run (flows NOT yet executed) |
| `e2e/flows/01-post-and-find-service.yaml` | E2E: seller posts a service, buyer finds it |
| `e2e/flows/02-book-complete-review.yaml` | E2E: book → accept → done → approve → review |
| `e2e/flows/subflows/*.yaml` | Open app (Expo Go), sign in, sign out |
| `src/content/legal.test.ts` | Legal docs exist and state key promises |
| `src/components/reviews/review-card.tsx` | Review with stars and reply |
| `src/components/reviews/review-form.tsx` | Star picker + comment |
| `src/components/reviews/my-reviews.tsx` | Reviews about me (reply) + share work record |
| `src/lib/reviews/reviews-api.ts` | Review calls/hooks, work-record URL |
| `src/lib/notifications/notifications-api.ts` | Notification calls/hooks, link → screen |
| `src/lib/notifications/push.ts` | Push registration (real builds only), sign-out removal |
| `src/lib/notifications/notifications.test.ts` | Tests: link routing, work-record URL, stars |
| `src/lib/orders/orders-api.ts` | Order calls + hooks, `ESCROW_AVAILABLE` |
| `src/lib/orders/format.ts` | Status/action/timeline labels |
| `src/lib/orders/orders.test.ts` | Tests: labels cover every action/status, timeline sentences |
| `src/lib/chat/chat-api.ts` | Chat calls, hooks, `addMessageToCache` |
| `src/lib/chat/format.ts` | Chat time labels |
| `src/lib/chat/chat.test.ts` | Tests: cache dedupe, socket origin, time labels |
| `src/lib/quotes/quotes-api.ts` | Quote calls and hooks |
| `src/lib/realtime/realtime.ts` | socket.io client hook + room join/leave |
| `src/components/listings/listing-card.tsx` | Listing row for lists |
| `src/components/listings/category-picker.tsx` | Grouped category chooser |
| `src/components/listings/listing-form.tsx` | Create/edit listing form + `buildListingBody`, `listingToFormValues` |
| `src/components/ui/segmented.tsx` | Segmented (radio) control |
| `src/lib/listings/listings-api.ts` | Listings calls + query hooks |
| `src/lib/listings/search-filters.ts` | Search filter store + `toSearchQuery` |
| `src/lib/listings/format.ts` | Price/budget/distance labels |
| `src/lib/listings/listings.test.ts` | Tests: labels, filter → query, form body conversion |
| `src/lib/location/current-location.ts` | Phone location (permission, last known/current, city) |
| `src/app/(app)/verify-email.tsx` | Enter the 6-digit email code / resend |
| `src/app/(app)/profile.tsx` | My profile: summary, student badge status, portfolio list/add/remove, links, sign out, server status (dev) |
| `src/app/(app)/profile/edit.tsx` | Edit profile + change/remove photo |
| `src/app/(app)/profile/student.tsx` | Student badge: college email → code |
| `src/app/(app)/profile/add-work.tsx` | Add a portfolio item (photo + title + description) |
| `src/app/(app)/profile/delete-account.tsx` | Delete account with password confirmation |
| `src/app/(app)/users/[id].tsx` | Another user's public profile |
| `src/components/server-status-card.tsx` | Live `/health` status card |
| `src/components/profile/profile-summary.tsx` | Shared profile header (photo, name, badges, stats, bio, skills, languages) |
| `src/components/ui/index.ts` | UI kit exports |
| `src/components/ui/avatar.tsx` | Round photo with initials fallback; `initialsOf()` |
| `src/components/ui/chip.tsx` | `Chip`, `ChipList` |
| `src/components/ui/image-tile.tsx` | Image with caption (portfolio) |
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
| `src/lib/api/media-url.ts` | Resolve API-relative image URLs against the API origin |
| `src/lib/uploads/upload-image.ts` | Pick + resize photo; sign + upload; returns key |
| `src/lib/uploads/upload-image.test.ts` | Tests: upload flow, failures, 5 MB guard, media URLs, initials |
| `src/lib/users/users-api.ts` | Users/portfolio/categories API calls and query hooks |
| `src/tests/screens/sign-in.test.tsx` | Sign-in screen: validation messages, normalised submit, server error |
| `src/lib/api/api-error.ts` | `ApiError` + `describeError()` friendly messages |
| `src/lib/api/health.ts` | `useServerHealth()` hook (long timeout for sleeping free-tier server) |
| `src/lib/query-client.ts` | Query client; `shouldRetry` (network/5xx only) |
| `src/lib/query-client.test.ts` | Retry-policy tests |
| `src/theme/tokens.ts` | Colours (light/dark, WCAG AA), spacing, radius, typography |
| `src/theme/use-theme.ts` | `useTheme()` |
| `src/hooks/use-color-scheme.ts` | Colour-scheme hook (Expo template) |
