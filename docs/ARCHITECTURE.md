# Architecture

| | |
|---|---|
| **Status** | v1.0 — 2026-11-18 |
| **Read first** | [PRD.md](PRD.md) (what & why). This doc is *how*. Decisions and their reasons are in [DECISIONS.md](DECISIONS.md). |

> Keep this document true. If code and this doc disagree, one of them is a bug: fix it in the same change.

---

## 1. System overview

```
┌──────────────────────┐   HTTPS (REST, JSON)    ┌───────────────────────────┐   SQL (Prisma)   ┌────────────────────┐
│  Mobile app (Expo)   │ ──────────────────────▶ │  Backend API (NestJS)     │ ───────────────▶ │ PostgreSQL         │
│  Android / iOS       │ ◀────────────────────── │  - REST /api/v1           │                  │ (Supabase, free)   │
│                      │   WebSocket (socket.io) │  - socket.io realtime     │                  └────────────────────┘
│                      │ ◀═════════════════════▶ │  - background jobs (cron) │   HTTPS          ┌────────────────────┐
└──────────┬───────────┘                         └──────┬─────────┬──────────┘ ───────────────▶ │ Supabase Storage   │
           │ opens checkout page                        │         │  signed upload URLs          │ (images)           │
           ▼                                            │         │                              └────────────────────┘
┌──────────────────────┐   webhook (signed)             │         │   HTTPS                      ┌────────────────────┐
│ Razorpay (TEST mode) │ ──────────────────────────────▶│         └────────────────────────────▶ │ Expo Push service  │
│ hosted payment page  │ ◀─── create link / fetch ──────┘                                        └────────────────────┘
└──────────────────────┘
```

- **One backend process** (modular monolith). No microservices — one developer, one deploy, one database.
- **One database.** All money movements happen inside database transactions.
- **Stateless API** (JWT access tokens), so it can scale horizontally later; the only in-memory state is socket.io connections (a Redis adapter can be added when running >1 instance).

## 2. Repository layout

```
campusconnect-mvp/
├── README.md                 Start here: what it is, how to run, where docs are
├── package.json              npm workspaces root (backend, mobile, packages/*)
├── docs/                     PRD, ROADMAP, ARCHITECTURE, DECISIONS, DEV_LOG, FILE_MAP
├── packages/
│   └── shared/               @cc/shared — code used by BOTH backend and mobile:
│                             enums, zod request schemas, order state machine, API types
├── backend/                  NestJS API + Prisma
│   ├── prisma/               schema.prisma, migrations/, seed.ts
│   ├── src/
│   │   ├── main.ts           bootstrap (security middleware, pipes, filters)
│   │   ├── app.module.ts     wires all modules
│   │   ├── config/           env validation (server refuses to start on bad config)
│   │   ├── common/           cross-cutting: errors, guards, decorators, pagination, logging
│   │   ├── prisma/           PrismaService (DB connection)
│   │   └── modules/<name>/   one folder per feature module (see §4), each with README.md
│   └── test/                 integration (API) tests against a real Postgres
├── mobile/                   Expo app (SDK 58, expo-router file-based navigation)
│   └── src/
│       ├── app/              screens = routes (nothing else lives here)
│       │   ├── (auth)/       signed-out screens (welcome, sign in/up, password reset)
│       │   └── (app)/        signed-in screens (home, verify email, …)
│       ├── components/       base UI kit (ui/) + shared composite components
│       ├── config/ lib/      API URL, API client, session (auth), forms, query client
│       ├── tests/            screen tests (kept outside app/, which only holds routes)
│       └── theme/ hooks/     design tokens, hooks
├── docker-compose.yml        local Postgres (host port 5433) for dev + tests
└── .github/workflows/        CI
```

## 3. Technology stack

| Layer | Choice | Why (short — details in DECISIONS.md) |
|---|---|---|
| Language | TypeScript everywhere | One language, shared types between app and API |
| Monorepo | npm workspaces | Built into npm, no extra tool |
| Backend framework | NestJS 12 (ESM-only), official starter toolchain (ADR-013) | Modules, DI and guards fit a growing API; both old codebases used it |
| Validation | **zod** schemas in `@cc/shared`, used by backend (Nest 12 `StandardSchemaValidationPipe`, `@Body({ schema })`) **and** mobile (forms) | One definition of every request shape → frontend and backend cannot drift apart (the main bug of the old demo-connect) |
| ORM / DB | Prisma 7.x stable (`prisma-client` generator, `@prisma/adapter-pg`, `prisma.config.ts`) + PostgreSQL on Supabase free tier | Type-safe queries, migrations; Postgres is reliable and free |
| Auth | Own module on audited primitives (ADR-017): argon2id (`@node-rs/argon2`); JWT access token (HS256 via `jose`, 15 min); opaque rotating refresh token (30 days, stored as SHA-256, reuse detection); global guard, routes are private unless `@Public()` | Secure and keeps users logged in; `@nestjs/authentication` was pre-1.0 (ADR-014) |
| Realtime | socket.io on the same Nest server, JWT-verified handshake | Simple; free; works on Render |
| Payments | Razorpay **test mode** behind a `PaymentGateway` interface; `FakeGateway` for tests/dev | Real gateway experience at ₹0; can switch to live later |
| File storage | Supabase Storage (signed upload URLs) | Free 1 GB; images never pass through our server |
| Push | Expo Push API | Free, no Firebase setup needed for MVP |
| Email | `MailService` interface — console logger in dev; provider TBD (PRD Q3) | No cost until decided |
| Logging | Nest's built-in `ConsoleLogger` (JSON mode in production) + request-ID middleware | Structured, zero extra dependencies |
| Security middleware | helmet, @nestjs/throttler (rate limit) | Standard protection |
| Mobile | Expo (managed) + expo-router, TanStack Query (server data), Zustand (session), react-hook-form + zod (forms), expo-secure-store (tokens) | Mainstream, well documented, runs in Expo Go |
| Testing | Vitest (unit, backend + shared), Vitest + supertest + Postgres in Docker (integration), Jest + React Native Testing Library (mobile — Expo's supported test runner) | Free, standard |
| Lint / format | oxlint (backend, shared), Expo lint config (mobile), Prettier | Official defaults |
| Hosting | Render free web service (API), Supabase (DB + storage), EAS free tier (app builds) | ₹0 |
| CI | GitHub Actions | Free |

Exact versions are pinned in each `package.json`; upgrades are logged in DEV_LOG.md.

## 4. Backend modules

Each module lives in `backend/src/modules/<name>/` and has its own `README.md` listing its files, endpoints and rules.

| Module | Responsibility | PRD |
|---|---|---|
| `health` | `/health` liveness + DB check | NFR-09 |
| `auth` | signup, login, refresh, logout, email verification, password reset, JWT guard | FR-001…006 |
| `users` | own profile (`/me`), public profiles, student verification, account deletion, portfolio | FR-004, 009, 050…054 |
| `categories` | category tree (seeded) | FR-100, 104 |
| `listings` | service offers + job requests, search, near-me | FR-101…103, 150…153 |
| `quotes` | quotes on job requests, accept → creates order | FR-200…203 |
| `conversations` | conversations + messages (REST), unread counts | FR-250…254 |
| `realtime` | socket.io gateway: auth handshake, rooms, emits events | FR-251 |
| `orders` | order lifecycle, state machine enforcement, timeline | FR-400…409 |
| `wallet` | ledger, balances, escrow hold/release/refund, withdrawals | FR-450…456 |
| `payments` | gateway interface, Razorpay + Fake implementations, top-ups, webhooks | FR-451 |
| `reviews` | two-way reviews + replies, rating aggregates, work record | FR-053, 500…502 |
| `notifications` | in-app notifications + Expo push | FR-550, 551 |
| `safety` | reports, blocks | FR-253, 600 |
| `admin` | admin-only endpoints (reports, suspensions, disputes, student domains) | FR-601 |
| `storage` | `StorageService` drivers: local disk (dev/tests) and Supabase Storage (prod) — ADR-019 | FR-051 |
| `uploads` | signed upload targets, claim/discard of uploaded images, local-driver upload/serve routes | FR-051, 150 |
| `mail` | email sending abstraction | FR-003, 004, 006 |
| `jobs` | scheduled tasks (auto-approve, expire) | FR-407 |

**Dependency rule:** controllers → services → Prisma. Services may call other modules' services, never their controllers. Money changes only through `WalletService`. Order status changes only through `OrdersService.transition()`.

## 5. Data model

Source of truth: `backend/prisma/schema.prisma`. Summary:

| Model | Key fields | Notes |
|---|---|---|
| **User** | id (uuid), email (unique), passwordHash, emailVerifiedAt, role (USER/ADMIN), status (ACTIVE/SUSPENDED/DELETED), dateOfBirth, termsAcceptedAt | Never returned to clients directly; mapped to safe DTOs |
| **Profile** | userId (1-1), displayName, avatarUrl, avatarKey, bio, city, lat/lng (approx.), skills[], languages[], collegeName, studentVerifiedAt, studentEmail (unique, private) | Public data except avatarKey/studentEmail/lat/lng |
| **StudentVerification** | userId, collegeEmail, codeHash, expiresAt, attempts | 6-digit code mailed to college email |
| **StudentDomain** | domain, collegeName, allowed | Admin allow-list (PRD Q5) |
| **RefreshToken** | id, userId, tokenHash, familyId, expiresAt, revokedAt, replacedById | Rotation + reuse detection |
| **EmailToken** | userId, purpose (VERIFY/RESET), codeHash, expiresAt | |
| **PortfolioItem** | userId, title, description, imageUrl, imageKey, position | max 10 |
| **Category** | id, slug, name, groupName, sensitive (bool), position | `sensitive` → hidden until ID verification (FR-104) |
| **Listing** | id, ownerId, type (SERVICE_OFFER / JOB_REQUEST / AVAILABLE_NOW / NEED_NOW), categoryId, title, description, pricingType (FIXED/HOURLY/QUOTE), pricePaise, budgetMinPaise/MaxPaise, workMode (REMOTE/ONSITE), city, lat, lng, radiusKm, preferredDate, expiresAt, status (ACTIVE/PAUSED/CLOSED), imageUrls[], imageKeys[], deletedAt | One table for all modes. Indexed on (status, type, categoryId), (city), (lat, lng). lat/lng rounded to 3 decimals, never returned (ADR-021) |
| **Quote** | id, listingId, sellerId, amountPaise, message, etaDate, status (ACTIVE/WITHDRAWN/ACCEPTED/REJECTED/NOT_SELECTED) | unique(listingId, sellerId) |
| **Conversation** | id, listingId, buyerId, sellerId, lastMessageAt | unique(listingId, buyerId, sellerId) |
| **Message** | id, conversationId, senderId, body, createdAt | |
| **ConversationRead** | conversationId, userId, lastReadAt | unread = messages after lastReadAt by the other person |
| **Order** | id, buyerId, sellerId, listingId, quoteId?, title, requirements, amountPaise, paymentMode (ESCROW/DIRECT), status, deadline, changeRequests, startCodeHash, finishCodeHash, submittedAt, completedAt, version | `version` for optimistic locking |
| **OrderEvent** | orderId, actorId?, action, fromStatus, toStatus, note, createdAt | Timeline / audit trail (FR-408) |
| **Dispute** | orderId (unique), raisedById, reason, status (OPEN/RESOLVED_REFUND/RESOLVED_RELEASE), resolvedById, resolutionNote | |
| **Wallet** | userId (1-1), balancePaise, updatedAt | Cached balance, updated **only** in the same transaction as ledger entries |
| **LedgerTransaction** | id, kind (TOPUP/ESCROW_HOLD/ESCROW_RELEASE/ESCROW_REFUND/WITHDRAWAL), orderId?, paymentId?, idempotencyKey (unique), createdAt | Groups entries |
| **LedgerEntry** | transactionId, account (WALLET/ESCROW/EXTERNAL), userId?, orderId?, amountPaise (signed) | Entries of one transaction **sum to 0** (double-entry) |
| **Payment** | id, userId, gateway, gatewayRef (unique), amountPaise, status (CREATED/PAID/FAILED/EXPIRED), checkoutUrl, rawLastEvent | Top-ups |
| **Withdrawal** | id, userId, amountPaise, status (SIMULATED) | Test mode only |
| **Review** | id, orderId, reviewerId, revieweeId, rating (1–5), comment, reply, repliedAt | unique(orderId, reviewerId) |
| **Notification** | id, userId, type, payload (json), readAt | |
| **PushToken** | userId, token (unique), platform | |
| **Report** | id, reporterId, targetType (USER/LISTING/MESSAGE/REVIEW), targetId, reason, details, status, handledById | |
| **Block** | blockerId, blockedId | unique pair |

Conventions: ids are UUIDs; all tables have `createdAt`/`updatedAt`; money is always `Int` paise with a `Paise` suffix; nothing that other users depend on is hard-deleted (soft delete with `deletedAt` / status).

## 6. Order state machine

Defined once in `packages/shared/src/orders/state-machine.ts` and used by the backend (enforcement) and the mobile app (which buttons to show).

```
                 book service                      accept quote
                      │                                 │
                      ▼                                 │
              ┌──────────────┐  decline  ┌──────────┐   │
              │  REQUESTED   │──────────▶│ DECLINED │   │
              └──────┬───────┘           └──────────┘   │
          accept     │  (seller)                        │
        ┌────────────┴──────────────┐                   │
   ESCROW│                    DIRECT │                  │
        ▼                           │◀──────────────────┤ (DIRECT)
┌──────────────────┐  fund          ▼                   │
│ AWAITING_PAYMENT │──────────▶┌─────────────┐◀─────────┘ (ESCROW → AWAITING_PAYMENT first)
└──────────────────┘ (buyer)   │ IN_PROGRESS │◀───────────────┐
                               └──────┬──────┘ request changes │ (buyer, max 3)
                             submit   │ (seller)               │
                                      ▼                        │
                               ┌─────────────┐─────────────────┘
                               │  SUBMITTED  │── approve (buyer) / auto after 5 days ──▶ COMPLETED
                               └─────────────┘
      IN_PROGRESS / SUBMITTED ── dispute (either) ──▶ DISPUTED ── admin: refund ──▶ CANCELLED
                                                              └─ admin: release ─▶ COMPLETED
```

| From | Action | Who | To | Money side effect (ESCROW orders) |
|---|---|---|---|---|
| — | `book` | buyer | REQUESTED | — |
| — | `acceptQuote` | buyer | AWAITING_PAYMENT (escrow) / IN_PROGRESS (direct) | — |
| REQUESTED | `accept` | seller | AWAITING_PAYMENT (escrow) / IN_PROGRESS (direct) | — |
| REQUESTED | `decline` | seller | DECLINED | — |
| REQUESTED | `cancel` | buyer | CANCELLED | — |
| AWAITING_PAYMENT | `fund` | buyer | IN_PROGRESS | wallet(buyer) −amount, escrow(order) +amount |
| AWAITING_PAYMENT | `cancel` | buyer or seller | CANCELLED | — |
| IN_PROGRESS | `submit` | seller | SUBMITTED | — |
| IN_PROGRESS | `cancel` | **seller only** (backing out) | CANCELLED | escrow → refund to buyer |
| SUBMITTED | `approve` | buyer | COMPLETED | escrow → release to seller |
| SUBMITTED | `requestChanges` | buyer (≤3 times) | IN_PROGRESS | — |
| SUBMITTED | `autoApprove` | system (5 days) | COMPLETED | escrow → release to seller |
| IN_PROGRESS, SUBMITTED | `dispute` | buyer or seller | DISPUTED | — (funds stay in escrow) |
| DISPUTED | `resolveRefund` | admin | CANCELLED | escrow → refund to buyer |
| DISPUTED | `resolveRelease` | admin | COMPLETED | escrow → release to seller |

Terminal states: **COMPLETED, CANCELLED, DECLINED.** A buyer who wants to stop mid-work asks the seller to cancel, or raises a dispute — this protects sellers from losing paid-for work.

**Enforcement:** `OrdersService.transition(orderId, action, actor)` loads the order, checks the table and actor, then updates with `WHERE id = ? AND version = ?` (optimistic lock) inside the same DB transaction as any ledger entries. Two simultaneous taps cannot both succeed.

## 7. Money design (wallet, escrow, payments)

- **Double-entry ledger.** Each money event is a `LedgerTransaction` with ≥2 `LedgerEntry` rows that sum to zero. Example — buyer funds a ₹500 order: `WALLET(buyer) −50000`, `ESCROW(order) +50000`.
- **Balances.** `Wallet.balancePaise` is a cached value updated in the *same* transaction as the entries, using a conditional update (`balance >= amount`) so it can never go negative. A reconciliation check (test + admin endpoint) verifies `cache == sum(entries)`.
- **Idempotency.** Every ledger transaction has a unique `idempotencyKey` (e.g. `topup:<paymentId>`, `escrow-hold:<orderId>`). Replays (duplicate webhooks, double taps) are no-ops.
- **Top-up flow (test mode):**
  1. App → `POST /wallet/topups {amountPaise}` → server creates a `Payment` and asks the gateway for a hosted checkout link.
  2. App opens the link in an in-app browser; user pays with Razorpay **test** card/UPI.
  3. Razorpay → `POST /webhooks/razorpay` (signature verified with the webhook secret) → `Payment` = PAID → ledger `EXTERNAL −x, WALLET(user) +x`.
  4. Fallback when the webhook cannot reach us (local dev): when the browser closes the app calls `POST /wallet/topups/:id/verify`; the server asks Razorpay for the status directly (server-to-server). The client is **never** trusted to say "paid".
- **Gateway abstraction.** `PaymentGateway` interface with `createCheckout()`, `fetchStatus()`, `verifyWebhook()`. Implementations: `RazorpayGateway` (test keys) and `FakeGateway` (tests and when no keys are configured — gives a local fake checkout page). Selected by env `PAYMENT_GATEWAY=razorpay|fake`.
- **Withdrawals** are simulated: ledger `WALLET −x, EXTERNAL +x`, status `SIMULATED`.

## 8. API conventions

- Base path `/api/v1`. JSON only. Auth header `Authorization: Bearer <accessToken>`.
- **Errors** always have this shape (never stack traces):
  ```json
  { "error": { "code": "ORDER_INVALID_TRANSITION", "message": "Order cannot be approved in status IN_PROGRESS", "details": null, "requestId": "…" } }
  ```
  HTTP status: 400 validation, 401 not logged in, 403 not allowed, 404 not found (also used when a resource exists but the caller may not know about it), 409 conflict/state, 422 business rule, 429 rate limit.
- **Pagination**: cursor based — request `?limit=20&cursor=<opaque>`, response `{ "items": [...], "nextCursor": "…" | null }`.
- **Money** in API: integer `amountPaise`. Mobile formats it as ₹.
- **Dates**: ISO-8601 UTC strings.
- **Public user data** is always returned through a `PublicUser` shape (id, displayName, avatarUrl, badges, rating, completedJobs) — never emails or phone numbers.

### 8.1 Endpoint catalogue (MVP)

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/signup` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/verify-email` · `POST /auth/resend-verification` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
| Me | `GET /me` · `PATCH /me` · `DELETE /me` · `POST /me/student-verification` · `POST /me/student-verification/confirm` · `GET/POST/PATCH/DELETE /me/portfolio[/:id]` · `GET /me/listings` · `GET /me/quotes` · `POST /me/push-tokens` |
| Users | `GET /users/:id` · `GET /users/:id/reviews` · `GET /users/:id/work-record` (public, no auth) |
| Categories | `GET /categories` |
| Uploads | `POST /uploads/sign` · local driver only: `PUT /uploads/local/:token`, `GET /uploads/files/<key>` (public) |
| Listings | `GET /listings` (search: `q, type, categoryId, city, workMode, minPricePaise, maxPricePaise, lat, lng, radiusKm, sort, cursor, limit`) · `GET /listings/:id[?lat&lng]` · `POST /listings` (verified email) · `PATCH /listings/:id` · `POST /listings/:id/pause` · `POST /listings/:id/resume` · `POST /listings/:id/close` · `GET /me/listings?status=` (ADR-021) |
| Quotes | `GET /listings/:id/quotes` (owner only) · `POST /listings/:id/quotes` · `GET /me/quotes` · `PATCH /quotes/:id` · `POST /quotes/:id/withdraw` · `POST /quotes/:id/reject` · `POST /quotes/:id/accept` (Phase 5) — ADR-022 |
| Conversations | `POST /conversations` · `GET /conversations` · `GET /conversations/unread` · `GET /conversations/:id` · `GET /conversations/:id/messages` · `POST /conversations/:id/messages` · `POST /conversations/:id/read` |
| Orders | `POST /orders` (book a service) · `POST /quotes/:id/accept` · `GET /orders?role=buyer|seller&status=` · `GET /orders/:id` · `POST /orders/:id/actions/:action` (accept, decline, fund, submit, approve, request-changes, cancel, dispute) · `POST /orders/:id/start` (on-site start code) · `POST /orders/:id/review` (Phase 7) — ADR-023 |
| Reviews | `POST /orders/:id/review` · `POST /reviews/:id/reply` · `GET /users/:id/reviews` · public: `GET /users/:id/work-record`, `GET /work-record/:id` (HTML) — ADR-025 |
| Wallet | `GET /wallet` · `GET /wallet/transactions` · `POST /wallet/topups` · `GET /wallet/topups/:id` · `POST /wallet/topups/:id/verify` · `POST /wallet/withdrawals` (ADR-024) |
| Webhooks | `POST /webhooks/razorpay` (no JWT; HMAC signature over the raw body) |
| Payment pages | `GET /payments/fake/:id` + `POST …/pay` / `…/cancel` (fake gateway only, token-protected) · `GET /payments/return` |
| Notifications | `GET /notifications` · `GET /notifications/unread-count` · `POST /notifications/read` · `POST /me/push-tokens` · `DELETE /me/push-tokens` |
| Safety | `POST /reports` (Phase 8) · `GET /blocks` · `POST /blocks` · `DELETE /blocks/:userId` |
| Admin | `GET /admin/reports` · `POST /admin/reports/:id/resolve` · `POST /admin/users/:id/suspend` · `POST /admin/users/:id/unsuspend` · `GET /admin/disputes` · `POST /admin/disputes/:orderId/resolve` · `POST /admin/jobs/auto-approve` · `GET/POST /admin/student-domains` · `GET /admin/ledger/reconcile` (all `@Roles('ADMIN')`, ADR-026) |

## 9. Realtime (socket.io)

- Client connects with `auth: { token: <accessToken> }`. The server **verifies the JWT signature and expiry** and checks the user is ACTIVE; otherwise disconnects.
- Each socket joins `user:<id>` automatically. Joining `conversation:<id>` is allowed only after a DB membership check.
- **Messages are sent via REST** (`POST /conversations/:id/messages`, validated and authorized like every other endpoint); the server then emits over sockets. One code path for writes.

| Event (server → client) | Room | Payload |
|---|---|---|
| `message:new` | `conversation:<id>` and recipient's `user:<id>` | message |
| `conversation:read` | `conversation:<id>` | { conversationId, userId, lastReadAt } |
| `notification:new` | `user:<id>` | notification |
| `order:updated` | buyer's and seller's `user:<id>` | { orderId, status } |

| Event (client → server) | Payload | Check |
|---|---|---|
| `conversation:join` / `conversation:leave` | { conversationId } | participant only |

## 10. Security design (checklist)

| Threat | Control |
|---|---|
| Broken object-level authorization (IDOR) | Every service method takes the `actor` and filters by it; integration tests per endpoint for "other user gets 404/403" |
| Forged tokens | JWT verified everywhere (HTTP + sockets); secrets ≥ 32 chars validated at startup; no fallback secrets |
| Token theft | Short access token; refresh rotation with reuse detection (revoke family); tokens in SecureStore on device |
| Brute force | Throttler on auth endpoints (10/min/IP) + argon2id; every one-time code reserves an attempt **before** it is compared (5 per email code, max 10 codes/day per purpose; 10 per order for on-site codes) — ADR-027 |
| Live-socket hijack | Sockets close when their access token expires and at once on suspension / password reset (ADR-027) |
| Mass assignment | zod schemas with `.strict()`; services map fields explicitly |
| Injection | Prisma parameterised queries; raw SQL only via tagged templates |
| Money manipulation | Server computes all amounts; positive-integer validation; conditional balance updates; idempotency keys; webhook signature check |
| Data leaks | Safe response mappers; emails/phones never in public responses; error filter hides internals |
| Abuse/spam | Rate limits on messages/listings; reports; blocks; admin suspension |
| Supabase public APIs (anon key) | Every table has Row Level Security and no privileges for `anon`/`authenticated`; only the backend (table owner) touches data — enforced by `test/schema-safety.e2e-spec.ts` (ADR-029) |
| Misconfiguration | Env validated at startup; helmet headers; CORS restricted to configured origins (mobile apps don't need CORS) |

## 11. Configuration (environment variables)

Validated in `backend/src/config/env.ts`; the server exits with a clear message if anything required is missing or invalid. `.env.example` lists every variable.

| Variable | Required | Example / note |
|---|---|---|
| `NODE_ENV` | yes | development / test / production |
| `PORT` | no | 3000 |
| `DATABASE_URL` | yes | pooled Supabase URL (runtime) |
| `DIRECT_URL` | yes | direct Supabase URL (migrations) |
| `JWT_ACCESS_SECRET` | yes | ≥ 32 random chars; production refuses the `.env.example` placeholder |
| `CODE_HASH_SECRET` | yes | ≥ 32 random chars, different from `JWT_ACCESS_SECRET`; keys the HMAC of email codes (ADR-017). Replaces the planned `JWT_REFRESH_SECRET` — refresh tokens are opaque, not JWTs |
| `ACCESS_TOKEN_TTL_MINUTES` / `REFRESH_TOKEN_TTL_DAYS` | no | 15 / 30 |
| `RATE_LIMIT_PER_MINUTE` / `AUTH_RATE_LIMIT_PER_MINUTE` | no | 120 / 10 per IP (auth limit only on `@AuthRateLimit()` routes) |
| `LOG_LEVEL` / `LOG_JSON` | no | `log` / `true` in production |
| `CORS_ORIGINS` | no | comma separated |
| `PAYMENT_GATEWAY` | no | `fake` (default; refused in production) or `razorpay` (ADR-024) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | if razorpay | **test** keys only — a key not starting with `rzp_test_` is refused |
| `PUBLIC_API_URL` | no | public https URL of the API; used for the "back to the app" page after checkout |
| `PUSH_DRIVER` | no | `log` (default) · `expo` (production) · `none` (tests) — ADR-025 |
| `JOBS_ENABLED` / `JOBS_INTERVAL_MINUTES` | no | `true` / `15` — auto-approve job (ADR-026); `false` in tests |
| `STORAGE_DRIVER` | no | `local` (default; refused in production) or `supabase` (ADR-019) |
| `STORAGE_LOCAL_DIR` | no | `.uploads` (local driver folder, git-ignored) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `STORAGE_BUCKET` | if `supabase` | server-side only, never in the app; bucket public, 5 MB limit, image types only |
| `MAIL_DRIVER` | no | `console` (default; dev/test only — refused when `NODE_ENV=production`) or `brevo` (ADR-029) |
| `BREVO_API_KEY` / `MAIL_FROM_EMAIL` / `MAIL_FROM_NAME` | if `brevo` | server-side secret · Brevo-verified sender · default `Connect` |
| ~~`PUBLIC_WEB_BASE_URL`~~ | — | Not used: the public work-record page is served by the API itself (`GET /work-record/:id`, ADR-025) |

Mobile: `EXPO_PUBLIC_API_URL` (required for builds). In development it may be left empty: the app derives `http://<dev-computer>:3000/api/v1` from the Expo dev server address (ADR-015). No hard-coded IPs anywhere.

## 12. Testing strategy

| Level | Tool | What | Where |
|---|---|---|---|
| Unit | Vitest | services, state machine, ledger math, mappers | `backend/src/**/*.spec.ts`, `packages/shared/**/*.spec.ts` |
| Integration / API | Vitest + supertest + Postgres (Docker) | every endpoint: happy path, validation, **authorization matrix**, money invariants | `backend/test/*.e2e-spec.ts` |
| Mobile components | Jest + React Native Testing Library | forms, state-dependent buttons | `mobile/**/*.test.tsx` |
| End-to-end | Maestro (free CLI) — later phase | sign up → post → quote → order → complete → review | `mobile/e2e/` |

Rules: a feature is not done until its tests run green **and were actually executed**; bugs get a regression test first.

## 13. Deployment

| Piece | Where | How |
|---|---|---|
| API | Render free web service | `render.yaml`; build `npm ci && npm run build -w backend`; start runs `prisma migrate deploy` then the server |
| DB + storage | Supabase free project | migrations via `DIRECT_URL` |
| Mobile (dev) | Expo Go | `npx expo start` |
| Mobile (testers) | EAS Build free tier | Android APK via internal distribution |
| CI | GitHub Actions | lint, typecheck, unit + integration tests (Postgres service container) on every push |

Production deployment happens **only with founder approval**.
