# Decision Log (ADRs)

Every significant product or technical decision is recorded here **with its reason**, so nobody has to guess later why something is the way it is — and so we don't change our minds by accident.

**Rules**
- Never edit an accepted decision's meaning. To change it, add a **new** entry that *supersedes* the old one and mark the old one `Superseded by ADR-xxx`.
- Any paid service, scope change, or deviation from ARCHITECTURE.md needs an entry here (and founder approval where noted).

Format: **Context** (situation) → **Decision** → **Consequences** (trade-offs).

---

## ADR-001 — Build a new codebase instead of continuing either old one
- **Date:** 2026-11-18 · **Status:** Accepted (founder)
- **Context:** Two divergent prototypes existed: `CampusConnect` (better security/structure, realtime chat, reviews) and `demo-connect` (simulated wallet/escrow, proposal form, but critical security holes and a frontend/backend status mismatch). Neither supported the full product (quotes, two listing modes, work record). Audit details are in DEV_LOG 2026-11-18.
- **Decision:** New monorepo `campusconnect-mvp`, reusing the good ideas of both: CampusConnect's module structure, ownership checks, socket gateway and reviews; demo-connect's proposal fields, unread badges, SecureStore and wallet concept.
- **Consequences:** Short restart cost; old repos stay untouched as reference.

## ADR-002 — Repo location outside OneDrive
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** OneDrive syncs every file; `node_modules` has tens of thousands of files, which causes slow installs, file-lock errors and wasted cloud quota.
- **Decision:** Repo lives at `C:\Users\isaig\Projects\campusconnect-mvp`; backup is via GitHub, not OneDrive.
- **Consequences:** Must push to GitHub regularly for backup. Note the on-disk casing is `Projects` — tools must be run from the exactly-cased path (see README troubleshooting).

## ADR-003 — MVP scope: Modes 1 + 2 first, Instant mode in v1.1
- **Date:** 2026-11-18 · **Status:** Accepted (founder)
- **Context:** Instant/nearby matching only works with many active users in a small area (liquidity). Launching three modes at once spreads a small user base thin.
- **Decision:** MVP = job requests with quotes + service offers. Data model includes `AVAILABLE_NOW` / `NEED_NOW` listing types now so v1.1 needs no rewrite.
- **Consequences:** Faster MVP; instant mode waits for pilot traction.

## ADR-004 — Test-mode money with a real gateway; zero budget
- **Date:** 2026-11-18 · **Status:** Accepted (founder)
- **Context:** Founder wants a real-feeling MVP (real gateway screens and APIs) but has no budget, and real escrow in India needs a registered business, KYC and legal review.
- **Decision:** Razorpay in **test mode** (free) behind a `PaymentGateway` interface, plus a `FakeGateway` for tests and for development before keys exist. Internal double-entry ledger for wallets and escrow. Withdrawals simulated. Permanent TEST MODE badge in the app.
- **Consequences:** Realistic flows at ₹0. Going live later = live keys + compliance work, not a rewrite.

## ADR-005 — Hosted checkout page instead of the native Razorpay SDK
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** The native `react-native-razorpay` module needs a custom dev build; it does not run in Expo Go.
- **Decision:** Server creates a hosted checkout/payment link; the app opens it in an in-app browser (`expo-web-browser`). Payment is confirmed only by server-side verification (webhook signature or server-to-server status fetch).
- **Consequences:** Works in Expo Go; slightly less native look.

## ADR-006 — Money as integer paise + double-entry ledger
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** Old code stored money as `Float` (rounding errors) and changed balances without an audit trail, with race conditions.
- **Decision:** All amounts are `Int` paise. Every money movement is a ledger transaction whose entries sum to zero, with a unique idempotency key. `Wallet.balancePaise` is a cache updated in the same DB transaction via a conditional update; reconciliation verifies it.
- **Consequences:** Slightly more code; correctness and auditability.

## ADR-007 — Shared zod schemas for request validation
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** demo-connect's frontend and backend disagreed on field names and statuses (`PENDING` vs `PROPOSED`, `price` vs `totalFare`), breaking the main flow. It also used inline TypeScript types that NestJS cannot validate.
- **Decision:** Request schemas, enums and the order state machine live in `packages/shared` (zod). Backend validates with a zod pipe; mobile uses the same schemas for forms.
- **Consequences:** One definition per contract; both sides fail to compile if they drift.

## ADR-008 — Modular monolith on free hosting
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** Solo developer, zero budget, MVP traffic.
- **Decision:** One NestJS process (REST + socket.io + cron) on Render free tier; Supabase free Postgres + Storage; Expo Push; GitHub Actions.
- **Consequences:** Free; cold starts after idle (~30–60 s) and DB pause after a week idle are accepted for the pilot. Can scale out later (Redis adapter for sockets, paid tier).

## ADR-009 — Messages written via REST, delivered via sockets
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** The old gateway duplicated message validation/authorization logic in socket handlers (and got it wrong).
- **Decision:** All writes go through authorized REST endpoints; sockets only push events to rooms the server has membership-checked.
- **Consequences:** One validated write path; sockets stay thin.

## ADR-010 — Sensitive categories gated until ID verification
- **Date:** 2026-11-18 · **Status:** Accepted (proposed by tech, founder to confirm)
- **Context:** Child care and elder care involve vulnerable people in private homes; MVP has no government-ID verification.
- **Decision:** Categories flagged `sensitive` are hidden from posting/search until ID verification (FR-008) exists.
- **Consequences:** Smaller initial category list; much lower safety risk.

## ADR-011 — Prisma 7.x stable, not the npm `latest` tag
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** On npm, `prisma@latest` currently points to an 8.0 **release candidate**; the newest stable is the 7.x line.
- **Decision:** Pin Prisma to the latest stable 7.x. Never adopt RC/beta versions for the MVP.
- **Consequences:** Upgrade to 8 later, deliberately, with a DEV_LOG entry.

## ADR-012 — Order rules: full escrow, seller-protecting cancellation
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** demo-connect used a 50%/50% split, which complicates refunds and still leaves the second half unprotected.
- **Decision:** Escrow orders hold **100%** of the amount when work starts. Before work starts either side can cancel. After work starts only the seller can cancel (refund to buyer); a buyer who wants to stop raises a dispute decided by an admin. Buyer can request changes up to 3 times; auto-approve after 5 days of no response.
- **Consequences:** Simple, protects both sides; disputes need an admin (founder) in the pilot.

## ADR-013 — Follow the official NestJS 12 toolchain (ESM, Vitest, oxlint, TypeScript 6)
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** NestJS 12 (current stable, 12.5.x) is ESM-only. Its official starter (generated with `@nestjs/cli@12.0.13`) uses Vitest instead of Jest, oxlint instead of ESLint, and TypeScript 6. npm's `typescript@latest` is 7.x (new native compiler), which the Nest starter does not use yet. Prisma 7 is also ESM-only.
- **Decision:** Use the starter's toolchain as-is: ESM (`"type": "module"`, relative imports end in `.js`), Vitest for all tests (backend and shared), oxlint, TypeScript 6.x. Request validation uses Nest 12's built-in `StandardSchemaValidationPipe` with zod schemas (`@Body({ schema })`) — which implements ADR-007 without class-validator.
- **Consequences:** Supersedes the "Jest / ESLint" mentions in the first draft of ARCHITECTURE.md (updated). Fewer custom pieces; matches Nest docs, so future developers can follow the official documentation.

## ADR-014 — Evaluate first-party `@nestjs/authentication` before hand-rolling auth
- **Date:** 2026-11-18 · **Status:** Decided 2026-11-18 → **not adopted for the MVP; see ADR-017**
- **Context:** Nest 12 ships an official authentication package (password login with scrypt, JWT access + rotating refresh tokens, global guard with `@Public()`, `@CurrentUser()`, email verification, password reset). Security code we don't write ourselves is code we can't get wrong.
- **Decision:** At T1.1, read its full documentation and check it supports: Prisma-backed storage, refresh-token reuse detection, socket.io handshake verification, suspended-user blocking. If yes, use it; if not, hand-roll per ARCHITECTURE §10 and record why here.
- **Consequences:** Password hashing may be scrypt instead of argon2id (both acceptable under OWASP guidance).

## ADR-015 — Mobile finds the dev API automatically; no hard-coded IPs
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** Both old apps hard-coded a home-network IP (`192.168.x.x`) and broke whenever the Wi-Fi changed (see the old `changes-in-session2`).
- **Decision:** `EXPO_PUBLIC_API_URL` wins when set (required for preview/production builds). In development only, the app derives `http://<host>:3000/api/v1` from `Constants.expoConfig.hostUri` — the computer running the Expo dev server. Production builds never guess.
- **Consequences:** Zero configuration for local development; phone and computer must share a network.

## ADR-016 — Built-in Nest logger instead of pino; local DB on port 5433
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** The first ARCHITECTURE draft named pino. Nest 12's `ConsoleLogger` has a JSON mode, which covers our needs without an extra dependency. Separately, the founder's machine already runs a native PostgreSQL 18 service on 5432.
- **Decision:** Use `ConsoleLogger({ json })` + our request-ID middleware. Docker Postgres maps to host port **5433** so it never collides with a locally installed Postgres; we never touch the founder's existing database service.
- **Consequences:** One less dependency; developers with nothing on 5432 are unaffected.

## ADR-017 — Own auth module built on audited primitives (resolves ADR-014)
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context (ADR-014 evaluation):** `@nestjs/authentication` is at **v0.1.6** (pre-1.0, no releases page, ~16 GitHub stars). Its README documents no refresh-token reuse detection, no Prisma storage (a custom store must be written anyway), no suspended-user hook and nothing specific about socket.io handshakes. Building login security on a pre-1.0 API that may change, while still writing the storage layer ourselves, adds risk without removing much code.
- **Decision:** Implement `backend/src/modules/auth` ourselves, but only the *glue* — every cryptographic primitive comes from a widely used library:
  - Passwords: **argon2id** via `@node-rs/argon2` (OWASP parameters m=19 MiB, t=2, p=1; prebuilt binaries, no compiler). Login burns a dummy hash for unknown emails (no timing oracle).
  - Access token: **JWT HS256 via `jose`**, 15 min, claims `sub`/`typ`/`iss`/`aud`; algorithm, issuer and audience pinned on verify. Role/status are **read from the database on every request** (not trusted from the token) so suspension is immediate — one primary-key lookup per request.
  - Refresh token: **opaque 32 random bytes**, stored as SHA-256 hash, 30 days, **rotated on every use**; `familyId` groups a device's chain; presenting a revoked token **revokes the whole family** (reuse detection); rotation claims the old row atomically so concurrent refreshes cannot both win. Therefore the planned `JWT_REFRESH_SECRET` is not needed.
  - Email codes (verify, reset): 6 digits from `crypto.randomInt`, stored as **HMAC-SHA256 keyed by `CODE_HASH_SECRET`**, bound to user + purpose, 5 attempts, 30/15 min expiry, 60 s resend cooldown, single use.
  - **Secure by default:** a global `AuthGuard` protects every route; public routes need `@Public()` and are pinned in a reviewed list by `route-safety.spec.ts` (T1.9).
  - Rate limits: a second named throttler `auth` (`AUTH_RATE_LIMIT_PER_MINUTE`, default 10/min/IP — moderate because a whole college can share one IP) applies only to routes marked `@AuthRateLimit()`.
  - Email: `MailService` interface; only a `console` driver for now, **refused in production** by env validation until PRD Q3 picks a free provider.
  - Mobile: refresh token in SecureStore, access token in memory, **single-flight refresh** (two parallel refreshes would trigger reuse detection), 401 → refresh once → retry.
- **Consequences:** We own ~600 lines of auth code, covered by unit + integration tests (token forgery, `alg: none`, reuse, concurrency, suspension, enumeration). Re-evaluate `@nestjs/authentication` when it reaches 1.0 (parking lot). Signup reveals whether an email is taken (usability trade-off, mitigated by rate limits); login and password reset do not.
