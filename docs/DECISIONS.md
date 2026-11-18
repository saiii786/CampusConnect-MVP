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

## ADR-018 — Function first, then a dedicated UI/UX phase
- **Date:** 2026-11-18 · **Status:** Accepted (founder)
- **Context:** Early screens are functional, not polished. Screens change as features connect (orders ↔ chat ↔ wallet ↔ reviews), so polishing each one as it is built would mean redesigning it later. The founder confirmed this approach.
- **Decision:** Phases 1–9 deliver working, tested features with **functional** screens built only from the shared UI kit and theme tokens (no one-off styling). A dedicated **Phase 9A — UI/UX design & polish** (brand, design system v2, bottom tabs, screen redesign, motion, onboarding, usability test) runs after all features work and before deployment (Phase 10). Free design resources only.
- **Consequences:** The app looks basic until Phase 9A — expected, not a defect. Because every screen uses the kit and tokens, the redesign is mostly changing those shared pieces rather than rewriting screens. Accessibility basics (labels, contrast, touch size) are still required from day one.

## ADR-019 — Image storage: driver interface, server-chosen keys, claim before use
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** Profiles and portfolios need images (FR-051) at ₹0. Images should not pass through the free API server in production, and a client must never be able to point its profile at an arbitrary URL or at someone else's file. The founder's Supabase project is not set up yet.
- **Decision:**
  - `StorageService` interface with two drivers chosen by `STORAGE_DRIVER`: **`local`** (dev/tests — files on disk, uploaded via a signed `PUT /uploads/local/:token`, served by `GET /uploads/files/<key>`; refused in production) and **`supabase`** (production — signed upload URL, app uploads directly, public bucket).
  - The **server chooses every key**: `users/<userId>/<avatar|portfolio>/<uuid>.<jpg|png|webp>`. Features accept only a `key` and **claim** it: the key must be in the caller's own folder for that purpose, and the stored object must exist, be ≤ 5 MB and be an image. Only then is the public URL saved. Replaced/deleted images are removed (best effort).
  - The app **resizes photos on the phone** (max 1280 px, JPEG 0.8) before uploading.
  - Local driver checks the file's magic bytes; Supabase relies on bucket MIME/size limits + the claim check.
  - DB keeps both the URL (for responses) and the key (for deletion): additive columns `Profile.avatarKey`, `PortfolioItem.imageKey`.
- **Consequences:** Same app code for dev and prod. The Supabase driver is unit-tested with a mocked HTTP layer but **not yet verified live** (needs the founder's project — Phase 10 at the latest). Signed-but-unused uploads are not cleaned up yet (parking lot).

## ADR-020 — Student badge, public profiles and account deletion rules
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** FR-004, FR-009, FR-052, FR-054 leave some rules open; PRD Q5 default is `.ac.in`/`.edu`/`.edu.in` + an admin list.
- **Decision:**
  - **Student badge:** domain accepted if an admin `StudentDomain` row allows it (most specific domain wins, also matches sub-domains like `cse.iith.ac.in`), or it ends in a built-in suffix — unless an admin row **blocks** it. Code sent to the college email (same rules as other codes). **One college email = one account** (unique `Profile.studentEmail`, private, never public). Admins are made with `npm run admin:grant` (no API).
  - **Public profiles** (`GET /users/:id`) require sign-in (the no-login shareable page is the work record, FR-053, Phase 7). Suspended/deleted users → 404. Never email, phone, DOB, college email or coordinates.
  - **Account deletion** needs the password again and is refused while any order is open (REQUESTED, AWAITING_PAYMENT, IN_PROGRESS, SUBMITTED, DISPUTED). It **anonymises** (email → `deleted+<id>@deleted.invalid`, name → "Deleted user", profile cleared, tokens/portfolio/student data deleted, listings closed) and keeps orders/reviews for the other party. The email can be reused for a new account. Wallet balance is ignored while money is test-mode only.
- **Consequences:** Clear, testable rules (all covered by integration tests). Revisit wallet handling on deletion if real money is ever introduced.

## ADR-021 — Listings: visibility, location privacy and search without PostGIS
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** FR-101…103 and FR-150…153 need keyword/filter/near-me search with pagination on a free Postgres, and FR-054 forbids exposing exact locations.
- **Decision:**
  - **Location privacy:** on-site pins are stored rounded to 3 decimals (≈110 m) and **never returned**; responses carry the city and a computed `distanceKm` (0.1 km). Remote listings store no location.
  - **Visibility:** non-owners see only ACTIVE, non-deleted listings of ACTIVE users in non-gated categories (404 otherwise). Owners see theirs in any status. No hard delete — close is final and marks open quotes NOT_SELECTED.
  - **Posting** requires a verified email (FR-003). Every rule is in the shared `createListingSchema`/`checkListingRules`; updates are merged with the stored listing and re-checked.
  - **Search:** plain Prisma queries — keyword = every word in title or description (case-insensitive `contains`); price filter uses the price for offers and the budget range for job requests. Near-me: bounding-box prefilter in SQL + exact haversine in code, capped at 1,000 candidates. **Cursors are opaque**: keyset on UUIDv7 id for "newest", offset for price/distance sorts.
  - Listing detail includes photo storage keys **for the owner only** (needed to edit photos).
- **Consequences:** No extensions or paid services. `contains` does sequential scans — fine for a pilot (thousands of listings); upgrade path is `pg_trgm` indexes / PostGIS when needed (parking lot). Offset cursors can skip/repeat an item if listings change between pages (acceptable for these sorts).

## ADR-022 — Quotes, chat and realtime design
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** FR-200…203 and FR-250…254 need negotiation between buyers and sellers, live delivery on free hosting, and must avoid the old app's socket flaws (unverified tokens, joinable rooms).
- **Decision:**
  - **Quotes:** only on ACTIVE job requests; not your own (FR-153); not between blocked users; verified email required. One per seller per job (DB unique). WITHDRAWN can be re-sent; REJECTED/NOT_SELECTED/ACCEPTED are final. All status changes are conditional updates. Sending a quote opens the buyer↔seller conversation and posts "💼 Quote: ₹…" in it. Job owners see sellers' rating, completed jobs and badges (batched `UserStatsService`).
  - **Conversations:** one per (listing, buyer, seller). Roles: for a service offer the contacting person is the buyer; for a job request the owner is the buyer. Non-participants get 404. Unread = messages from the other person after my `lastReadAt` (raw SQL, batched). FR-254: the app shows a permanent "keep payments in the app" banner instead of scanning messages.
  - **Blocks** (either direction) stop messages, new conversations and quotes (and orders in Phase 5). Silent for the blocked person (they get 403 USER_BLOCKED when sending).
  - **Realtime:** socket.io on the API server (`/socket.io`). Handshake verifies the JWT signature + ACTIVE status (refused → `AUTH_FAILED`). Sockets auto-join `user:<id>`; `conversation:join` is membership-checked with an ack. **Writes are REST only**; the socket only delivers `message:new` / `conversation:read`. The HTTP throttler skips socket contexts (`AppThrottlerGuard`). The app refreshes on reconnect, so missed events are not lost.
- **Consequences:** One code path for writes (validation + authorisation in one place). Single-instance socket.io; a Redis adapter is needed only when running more than one API instance (parking lot). Sockets stay open until disconnect even after the access token expires — acceptable because every write is re-authorised over REST.

## ADR-023 — Orders implementation choices
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** Phase 5 implements FR-400…409 on top of the shared state machine (ADR-012) before the wallet exists (Phase 6).
- **Decision:**
  - **Single entry point:** every status change goes through `OrdersService.transition()` → `resolveOrderTransition()` → `UPDATE … WHERE id AND version` + timeline event (+ dispute row, + escrow movement) in **one** transaction. Lost races return 409 `ORDER_CHANGED`. Errors: 409 invalid transition, 403 wrong actor, 422 rule violation (e.g. 4th change request).
  - **Escrow hook:** `ORDER_MONEY` provider (`escrowEnabled`, `apply(tx, order, effect)`). Phase 5 binds a "disabled" implementation, so ESCROW orders are refused with 422 `PAYMENT_MODE_UNAVAILABLE` and only DIRECT orders exist; Phase 6 binds the wallet. The app shows "Wallet (soon)".
  - **Booking price:** FIXED → listing price (no override); HOURLY → price × hours (1–200); QUOTE-priced offers → `amountPaise` agreed in chat. The seller still accepts or declines (FR-402).
  - **Accepting a quote** is atomic: quote ACTIVE→ACCEPTED, job ACTIVE→CLOSED (both conditional), other ACTIVE quotes → NOT_SELECTED, order created — or nothing happens.
  - **On-site codes (FR-406):** start/finish codes = HMAC(`CODE_HASH_SECRET`, `ORDER_START|FINISH:<orderId>`) mod 10,000 — deterministic, never stored, only returned to the **buyer**. Seller enters the start code (`POST /orders/:id/start`, rate-limited) and the finish code with `submit`. The unused `startCodeHash`/`finishCodeHash` columns stay null.
  - Booking and quote acceptance post a short message in the buyer↔seller chat; every change emits `order:updated` to both users.
  - Blocking prevents new orders but not finishing existing ones (cancel/dispute must stay possible).
- **Consequences:** The money layer can be added without touching order rules. A 4-digit code can be guessed by brute force only via the rate-limited endpoint (10/min/IP) by the seller of that order — acceptable for a confirmation code, not a security credential.

## ADR-024 — Wallet, escrow and test-mode payments
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** FR-450…456 and ADR-004: a real-feeling payment experience with fake money, ₹0 cost, and a ledger that can be trusted.
- **Decision:**
  - **Ledger:** `LedgerService.post()` is the only code that moves money — balanced entries, unique idempotency key per business event (`topup:<paymentId>`, `escrow-hold|release|refund:<orderId>`, `withdrawal:<id>`), wallet cache updated in the same transaction with a conditional update (never negative → 422 `WALLET_INSUFFICIENT_FUNDS`). Escrow balance = sum of the order's ESCROW entries. `GET /admin/ledger/reconcile` proves wallets = ledger, transactions sum to zero, no escrow stuck on finished orders.
  - **Escrow** is the orders' `ORDER_MONEY` (ADR-023): HOLD on fund, RELEASE on approve/auto-approve/admin release, REFUND on seller cancel/admin refund — inside the order transition's transaction. Platform fee 0% (FR-456).
  - **Gateways:** `PaymentGateway` interface. `RazorpayGateway` uses hosted **Payment Links** in **test mode only** — env refuses keys that are not `rzp_test_…`. `FakeGateway` (default) serves a no-script HTML checkout from the API (HMAC token per payment); refused in production.
  - **Crediting:** the wallet is credited only when the server itself asks the gateway (`fetchStatus`) and it reports PAID for exactly our amount. Triggers: signed webhook (HMAC over the raw body — app runs with `rawBody: true`; the webhook only tells us *which* link to check), the app's `verify`, or the fake page. Status change + ledger posting in one transaction; concurrent duplicates are no-ops. Amount mismatches are logged and never credited.
  - **App flow:** checkout opens in the in-app browser; because Android does not report when the tab closes, the app re-verifies on return to foreground and every 3 s for up to 3 minutes. TEST MODE badge on every money screen (FR-455).
  - **Withdrawals** are simulated (WALLET −x, EXTERNAL +x).
- **Consequences:** Real money is impossible by configuration. Razorpay driver is unit- and integration-tested against a mocked Razorpay API but **not yet against a real test account** (needs the founder's test keys + a public webhook URL, i.e. after deploy). Moving to live money later requires KYC, a registered business and a new ADR (parking lot).

## ADR-025 — Reviews, public work record and notifications
- **Date:** 2026-11-18 · **Status:** Accepted
- **Context:** FR-500…502, FR-053, FR-550/551. Reviews must be trustworthy, the work record must help students on a CV without exposing anyone, and notifications must work at ₹0.
- **Decision:**
  - **Reviews:** only participants of a COMPLETED order, once each (DB unique), within 14 days of completion; 1–5 stars + optional comment; the reviewee may reply once (conditional update). Ratings shown everywhere come from these reviews only.
  - **Work record:** public (no login) JSON `GET /users/:id/work-record` and HTML `GET /work-record/:id`, addressed by the user's UUID. Shows completed jobs as seller: category, month, the buyer's rating and comment. Never buyer names, amounts, emails or phones; HTML-escaped; 404 for suspended/deleted users. (An opt-out/secret link is a possible later improvement — parking lot.)
  - **Notifications:** `NotificationsService.notify()` (global module) is called after a feature's change commits; stores the notification, emits `notification:new`, sends a push; never throws. Events: quote received, quote accepted, booking request, every order status change (to the other side), payment received (escrow release), top-up paid, review received, chat messages. Chat messages update one unread notification per conversation instead of creating one per message; quote/booking chat notes do not double-notify.
  - **Push:** Expo's free push API (`PUSH_DRIVER=expo`), `log` in development, `none` in tests. Tokens are registered only from real app builds with an EAS project id — Expo Go (Android) has no remote push since SDK 53 — so push becomes testable in Phase 10. Tokens move to the last user who signed in on a device and are removed on sign-out; `DeviceNotRegistered` tokens are deleted.
- **Consequences:** In-app notifications and live updates work everywhere now; phone push needs the EAS build (Phase 10).

## ADR-026 — Moderation, spam guard, scheduled jobs and legal texts
- **Date:** 2026-11-19 · **Status:** Accepted
- **Context:** Phase 8 (FR-407, FR-600, FR-601, FR-603, FR-604) for a pilot run by one founder, at ₹0, with no admin UI yet.
- **Decision:**
  - **Reports:** users report a USER, LISTING, MESSAGE (participants only) or REVIEW they can see; one OPEN report per reporter+target; not your own content.
  - **Admin moderation via API** (admin UI is in the parking lot): list reports with a short target summary; resolve DISMISS or ACTION with optional *hide content* (listing → CLOSED + deletedAt; message/review → `hiddenAt`, shown as "removed" / excluded from ratings) and/or *suspend* (status SUSPENDED + all refresh tokens revoked; admins cannot be suspended this way). Additive migration: `Message.hiddenAt`, `Review.hiddenAt`.
  - **Disputes:** admin resolves REFUND/RELEASE through `OrdersService.transition()` (same state machine + escrow + notifications), then marks the dispute resolved; once only.
  - **Auto-approve (FR-407):** in-process interval (`JOBS_ENABLED`, every `JOBS_INTERVAL_MINUTES`, first run 30 s after start so a sleeping free server catches up when it wakes) + admin "run now" endpoint. Safe to run twice/concurrently (optimistic lock). No extra scheduler dependency.
  - **Spam guard (FR-603):** small editable list of Indian job-scam phrases (registration/joining fee, OTP/UPI PIN requests…), more than 3 links, character floods → 422 `CONTENT_NOT_ALLOWED`, applied to listings, quotes and messages. Per-user limits counted in the database (multi-instance safe): 30 messages/minute, 10 listings/hour → 429.
  - **Route safety test** now also fails if any `/admin` route is not `@Roles('ADMIN')`.
  - **Legal (FR-604):** plain-language Terms, Privacy Policy and Community Guidelines in the app (`mobile/src/content/legal.ts`), reachable signed in and out. They are **drafts — a lawyer must review them before a public launch** (ROADMAP T10.7).
- **Consequences:** The pilot can be moderated with a few API calls (examples in `backend/src/modules/admin/README.md`). Keyword guards are intentionally narrow; reports + admin review are the main safety net.
