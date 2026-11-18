# Development Roadmap (Route Map)

| | |
|---|---|
| **Status** | v1.0 — 2026-11-18 |
| **Scope source** | [PRD.md](PRD.md) — task IDs reference PRD requirement IDs (`FR-xxx`, `NFR-xx`) |
| **How we build** | Vertical slices: each phase delivers backend **and** mobile screens **and** tests for its features, so the app is usable after every phase |

> **Rules for using this roadmap**
> 1. Work phases in order. A phase starts only when the previous phase's **exit criteria** are met (or the founder explicitly approves an exception, logged in DECISIONS.md).
> 2. Update the **Status** column as you go: `⬜ todo` · `🟨 in progress` · `✅ done` · `⏸ blocked (reason)`.
> 3. Anything not in the PRD is **out of scope**. New ideas go to the *Parking lot* at the bottom, not into code.
> 4. Every finished task: tests run green, docs updated (module README, FILE_MAP, DEV_LOG).

---

## Definition of Done

**For a task**
- [ ] Code implements the referenced FR/NFR exactly; no placeholder or fake behaviour presented as real.
- [ ] Input validated with shared zod schemas; authorization enforced in the service.
- [ ] Unit/integration tests written **and executed** green (including "other user cannot access" tests where relevant).
- [ ] Lint + typecheck pass.
- [ ] Module `README.md`, [FILE_MAP.md](FILE_MAP.md) and [DEV_LOG.md](DEV_LOG.md) updated.

**For the MVP release** (production-ready for the pilot)
- [ ] Zero open P0/P1 bugs.
- [ ] Full journey works on a real Android phone: sign up → verify → profile → post job → receive quote → accept → fund escrow → submit → approve → both review → work record link opens.
- [ ] Same journey for service-offer booking.
- [ ] CI green: lint, typecheck, unit + integration tests; service-layer coverage ≥ 80%; 100% of order state transitions and ledger operations covered.
- [ ] Authorization test matrix passes for every endpoint and socket event.
- [ ] Ledger reconciliation reports 0 mismatches after the full test suite.
- [ ] No secrets or IPs in code; server refuses to start with missing config.
- [ ] Every list paginated; p95 < 300 ms at 50 concurrent users (warm instance, load test with k6).
- [ ] Structured logs + `/health`; backup/restore procedure written and tried once.
- [ ] README + docs let a new developer run everything from scratch in < 30 minutes.

---

## Phase 0 — Foundation
**Goal:** an empty but production-shaped project that builds, tests and runs.
**Depends on:** nothing.

| ID | Task | Refs | Status |
|---|---|---|---|
| T0.1 | Planning docs: PRD, ROADMAP, ARCHITECTURE, DECISIONS, DEV_LOG, FILE_MAP, README | NFR-11 | ✅ |
| T0.2 | Monorepo: npm workspaces, root scripts, oxlint/ESLint + Prettier, `.gitignore`, `.editorconfig`, git init | — | ✅ |
| T0.3 | `packages/shared`: package setup, enums, order state machine + money helpers + unit tests | FR-401 | ✅ |
| T0.4 | Backend scaffold: NestJS 12, env validation (`config/env.ts`), JSON logging with request IDs, helmet, throttler, global error filter (standard error shape), zod validation pipe, `/health` | NFR-01, 09 | ✅ |
| T0.5 | Prisma 7 setup + full MVP schema + first migration + seed (categories). Student-domain allow-list starts empty (PRD Q5) | §5 ARCH | ✅ |
| T0.6 | Local dev DB: `docker-compose.yml` (Postgres, host port 5433, separate test DB) + integration-test setup | NFR-10 | ✅ |
| T0.7 | Mobile scaffold: Expo SDK 58 + expo-router, theme tokens, API client (auto-detects dev API address; `EXPO_PUBLIC_API_URL` override), TanStack Query, base UI components, server-status screen, Jest | NFR-06, 07 | ✅ |
| T0.8 | CI: GitHub Actions (lint, typecheck, unit + integration tests with Postgres service) | NFR-10 | 🟨 written; identical commands pass locally — first GitHub run pending (no remote repo yet) |

**Exit criteria:** `npm run lint`, `npm run typecheck`, `npm test` all green locally; `/health` returns OK against local Postgres; mobile app opens in Expo Go and shows API health.

**Exit status (2026-11-18):** ✅ lint, typecheck, 75 tests green; `/health` 200 on the compiled server; Android bundle builds. ⚠ Not yet seen on a physical phone in Expo Go (needs the founder's phone) and CI not yet run on GitHub.

## Phase 1 — Accounts & authentication
**Depends on:** Phase 0.

| ID | Task | Refs | Status |
|---|---|---|---|
| T1.1 | Signup (email, password, DOB 18+, terms), login, argon2id | FR-001, 005 | ✅ |
| T1.2 | Access + refresh tokens with rotation and reuse detection; logout | FR-002 | ✅ |
| T1.3 | `MailService` (console driver) + email verification code | FR-003 | ✅ |
| T1.4 | Forgot / reset password | FR-006 | ✅ |
| T1.5 | Auth guard, `@CurrentUser()`, `@Roles('ADMIN')`, suspended-user blocking | FR-601 | ✅ (global guard; also `@Public()`, `@RequireVerifiedEmail()`; `GET /me`) |
| T1.6 | Rate limits on auth endpoints | FR-603 | ✅ (`@AuthRateLimit()`, 10/min/IP default) |
| T1.7 | Mobile: welcome, sign up, login, verify email, forgot password; secure token storage; auto refresh on 401; logout | FR-001…006 | 🟨 built, unit/screen tests green, Android bundle builds — not yet tried on a phone |
| T1.8 | Tests: unit + integration (incl. token reuse, expired token, suspended user) | NFR-10 | ✅ |
| T1.9 | Route-schema guard test: fails if any `@Body`/`@Query` parameter has no zod schema (an unvalidated parameter is silently accepted — the old demo-connect bug) | NFR-01 | ✅ (`route-safety.spec.ts`; also pins the list of public routes) |
| T1.10 | Decide ADR-014 (first-party `@nestjs/authentication` vs hand-rolled) before starting T1.1 | ADR-014 | ✅ → ADR-017 (own module on argon2 + jose) |

**Exit:** new user can sign up, verify, log in, stay logged in across restarts, log out; all auth tests green.

**Exit status (2026-11-18):** ✅ backend flow verified by 21 integration tests + a live run of the built server (signup → code in log → verify → `/me` → refresh → 401 without token). ✅ Mobile session logic, API client and sign-in screen covered by tests; bundle builds. ⚠ Not yet exercised on a physical phone (founder test pending, same as Phase 0). Real email delivery waits on PRD Q3 (codes print in the API log until then).

## Phase 2 — Profiles, student badge, categories, uploads
**Depends on:** Phase 1.

| ID | Task | Refs | Status |
|---|---|---|---|
| T2.1 | `GET/PATCH /me`, profile fields, public profile endpoint with safe mapper | FR-050, 052, 054 | ✅ |
| T2.2 | Student verification (college email domain check + code) + admin student-domain allow-list | FR-004 | ✅ (ADR-020; `npm run admin:grant`) |
| T2.3 | Categories endpoint + sensitive-category gating | FR-100, 104 | ✅ |
| T2.4 | Uploads: Supabase Storage signed URLs (with local fallback driver for dev/tests) | FR-051 | 🟨 local driver ✅ verified live; Supabase driver built + unit-tested, **not yet tried against a real project** (ADR-019) |
| T2.5 | Portfolio CRUD (max 10) | FR-051 | ✅ |
| T2.6 | Account deletion (anonymise) | FR-009 | ✅ (ADR-020) |
| T2.7 | Mobile: profile view/edit, avatar + portfolio upload, student verification flow, public profile screen | — | 🟨 built, tests green, bundle builds — not yet tried on a phone (photo picking needs a real device) |
| T2.8 | Tests | NFR-10 | ✅ |

**Exit:** a user has a complete public profile with portfolio and (optionally) a Student badge.

**Exit status (2026-11-18):** ✅ API side verified by 14 new integration tests and a live run (upload → avatar served → portfolio → public profile without email → delete account → files removed). ⚠ Phone test pending (founder); Supabase Storage pending the founder's Supabase project.

## Phase 3 — Listings & search (Modes 1 and 2 posting)
**Depends on:** Phase 2.

| ID | Task | Refs | Status |
|---|---|---|---|
| T3.1 | Create/edit/pause/close service offers and job requests (soft delete) | FR-150…153 | ✅ (FR-153 "not your own listing" is enforced where quotes/orders are created, Phases 4–5) |
| T3.2 | Search: keyword, filters, cursor pagination, indexes | FR-101, 103 | ✅ (ADR-021) |
| T3.3 | Near-me: bounding-box + distance in SQL, sort by distance | FR-102 | ✅ (bounding box in SQL, exact distance in code) |
| T3.4 | Mobile: home feed, search + filters, listing detail, create/edit listing (with device location + images), my listings | — | 🟨 built, tests green, bundle builds — not yet tried on a phone (location + photos need a device) |
| T3.5 | Tests (incl. ownership checks, pagination, distance) | NFR-10 | ✅ |

**Exit status (2026-11-18):** ✅ 14 new integration tests + live run (verified user posts on-site offer → near-me search 4.3 km away finds it → far city does not → close). ⚠ Phone test pending.

**Exit:** users can post both listing types and find them by keyword, category and distance.

## Phase 4 — Quotes, conversations, realtime
**Depends on:** Phase 3.

| ID | Task | Refs | Status |
|---|---|---|---|
| T4.1 | Quotes: create/edit/withdraw, list for owner, reject | FR-200, 201, 203 | ✅ (ADR-022) |
| T4.2 | Conversations + messages REST, unread tracking, block check | FR-250, 252, 253 | ✅ (+ `/blocks` endpoints) |
| T4.3 | socket.io gateway: verified JWT handshake, membership-checked rooms, events | FR-251 | ✅ |
| T4.4 | Mobile: send quote, compare quotes screen, inbox, chat (realtime + fallback refetch), block user | — | 🟨 built, tests green, bundle builds — not yet tried on phones (needs two devices/accounts) |
| T4.5 | Tests (incl. non-participant cannot read/join, forged token rejected) | NFR-10 | ✅ |

**Exit:** buyer and seller can negotiate in real time; quotes visible and comparable.

**Exit status (2026-11-18):** ✅ 9 new integration tests (real sockets) + live run (quote → chat opened → owner sees seller badges → room join → live message delivered → unread 2 → forged token refused). ⚠ Two-phone test pending.

## Phase 5 — Orders (job lifecycle)
**Depends on:** Phase 4.

| ID | Task | Refs | Status |
|---|---|---|---|
| T5.1 | Book a service (REQUESTED) and accept a quote (→ order, other quotes NOT_SELECTED, listing closed) | FR-202, 400 | ✅ (ADR-023) |
| T5.2 | `OrdersService.transition()` with shared state machine, optimistic locking, timeline events | FR-401, 408 | ✅ |
| T5.3 | Actions: accept, decline, submit, approve, request changes (≤3), cancel, dispute — **DIRECT payment mode** first | FR-402…405 | ✅ (escrow refused until Phase 6) |
| T5.4 | Start/finish codes for on-site orders | FR-406 | ✅ (HMAC-derived, buyer-only) |
| T5.5 | Mobile: my orders / my jobs, order detail with timeline and state-aware action buttons | FR-409 | 🟨 built, tests green, bundle builds — not yet tried on phones |
| T5.6 | Tests: every transition allowed/denied, concurrency (double tap) | NFR-10 | ✅ (all transitions in the shared exhaustive spec; API paths + double tap in `orders.e2e-spec.ts`) |

**Exit:** a complete job can be run end-to-end with direct payment.

**Exit status (2026-11-18):** ✅ 10 new integration tests + live run (book on-site hourly service → accept → start code → finish code → approve; accept a quote → job closed; approve before submit refused). ⚠ Phone test pending.

## Phase 6 — Wallet, escrow, payments (test mode)
**Depends on:** Phase 5. **Needs from founder:** Razorpay test API keys (can start with `FakeGateway` before that).

| ID | Task | Refs | Status |
|---|---|---|---|
| T6.1 | Ledger + wallet service (double-entry, idempotency, conditional balance update, reconciliation) | FR-450, NFR-04 | ✅ (ADR-024; `GET /admin/ledger/reconcile`) |
| T6.2 | `PaymentGateway` interface, `FakeGateway`, `RazorpayGateway` (test keys) | FR-451 | 🟨 fake ✅ verified live; Razorpay built and tested against a mocked API — **needs founder's test keys** for a real run |
| T6.3 | Top-up: create checkout, webhook with signature check, verify-on-return fallback | FR-451 | ✅ |
| T6.4 | Escrow hooks in order transitions: fund, release, refund | FR-452 | ✅ |
| T6.5 | Wallet history; simulated withdrawal | FR-453, 454 | ✅ |
| T6.6 | Mobile: wallet screen, add money (in-app browser), history, TEST MODE badge, fund-order step | FR-455 | 🟨 built, tests green, bundle builds — not yet tried on a phone |
| T6.7 | Tests: ledger invariants, duplicate webhooks, insufficient funds, races, reconciliation = 0 | NFR-10 | ✅ |

**Exit:** escrow orders work end-to-end with Razorpay test checkout; ledger always reconciles.

**Exit status (2026-11-18):** ✅ escrow works end-to-end with the fake checkout (8 new integration tests incl. mocked Razorpay webhooks; live run: top-up ₹1,000 → fund ₹600 → approve → seller paid → withdraw). ⚠ Razorpay test checkout itself not yet exercised — waiting for test keys (and a public URL for webhooks; `verify` works without one).

## Phase 7 — Reviews, work record, notifications
**Depends on:** Phase 6 (reviews only need Phase 5; can overlap).

| ID | Task | Refs | Status |
|---|---|---|---|
| T7.1 | Two-way reviews (completed orders only, once, 14-day window), reply, rating aggregates | FR-500…502 | ✅ (ADR-025) |
| T7.2 | Public work record endpoint + shareable link (simple public HTML page served by the API) | FR-053 | ✅ |
| T7.3 | Notifications service: in-app list + Expo push tokens + push sending | FR-550, 551 | ✅ in-app + live; 🟨 phone push needs an EAS build (Phase 10) |
| T7.4 | Mobile: leave review, reviews on profile, share work record, notifications screen, push registration | — | 🟨 built, tests green, bundle builds — not yet tried on a phone |
| T7.5 | Tests | NFR-10 | ✅ |

**Exit status (2026-11-18):** ✅ 6 new integration tests + live run (booking notifies seller → completed → 5★ review + reply → seller notified → public work record JSON/HTML without buyer name or email → mark all read). ⚠ Phone push untestable until the EAS build.

## Phase 8 — Safety, admin, scheduled jobs
**Depends on:** Phase 7.

| ID | Task | Refs | Status |
|---|---|---|---|
| T8.1 | Reports + blocks | FR-600, 253 | ✅ (ADR-026) |
| T8.2 | Admin endpoints: reports, suspend, dispute resolution (with escrow refund/release), student domains, ledger reconcile | FR-601 | ✅ (API only; admin UI in parking lot) |
| T8.3 | Scheduled jobs: auto-approve after 5 days | FR-407 | ✅ (in-process interval + admin run-now) |
| T8.4 | Spam/profanity guard + message/listing rate limits | FR-603 | ✅ (scam phrases, link spam, floods; 30 msg/min, 10 listings/h) |
| T8.5 | Terms, privacy, community guidelines screens | FR-604 | ✅ drafts in the app — ⚠ lawyer review before public launch (T10.7) |
| T8.6 | Tests | NFR-10 | ✅ |

**Exit status (2026-11-19):** ✅ 7 new integration tests + 4 unit tests + live run (scam listing refused → report → admin hides listing → escrow dispute refunded → ledger reconciles → auto-approve run). ⚠ Not tried on a phone.

## Phase 9 — Quality pass
**Depends on:** Phase 8.

| ID | Task | Refs | Status |
|---|---|---|---|
| T9.1 | UX pass: loading/empty/error states everywhere, offline banner, consistent design | NFR-06 | ✅ (ADR-028; visual design → 9A) |
| T9.2 | Accessibility pass (labels, font scaling, contrast, touch targets) | NFR-07 | ✅ in code + contrast tests — ⚠ TalkBack / large-font check on a phone still to do (T9A.8) |
| T9.3 | Security review against ARCHITECTURE §10 + authorization matrix complete | NFR-01 | ✅ 3 medium fixed; lows tracked in ADR-027 |
| T9.4 | Load test and query/index tuning | NFR-03 | ✅ 20k listings, worst p95 214 ms (`npm run load:test`, ADR-027) |
| T9.5 | Maestro E2E for both main journeys | NFR-10 | 🟨 flows written (`mobile/e2e/`), **not executed** — no Java/Android SDK/Maestro on the dev computer; run on a device or emulator |

**Exit status (2026-11-19):** ✅ security review (3 medium fixed), load test PASS (worst p95 214 ms with 20k listings), UX/a11y audit fixed in code, contrast enforced by tests. 🟨 Not yet done on a real device: Maestro run, TalkBack/large-font check, chat keyboard on Android.

## Phase 9A — UI/UX design & polish (ADR-018)
**Depends on:** Phase 9 (all features working and tested). **Needs from founder:** app name (PRD Q1), brand preferences, 3–5 students for a usability test.
**Why here:** Phases 1–9 build functional screens on the shared UI kit and theme tokens; designing earlier would mean redesigning screens as features connect. Free resources only (Google Fonts, free icon sets, free illustrations).

| ID | Task | Refs | Status |
|---|---|---|---|
| T9A.1 | Brand identity: name, logo + app icon + splash, colour palette, typography (free fonts via `expo-font`) | PRD Q1 | ⬜ |
| T9A.2 | Design system v2: update `theme/tokens.ts`; new components — cards, chips, avatars, skeleton loaders, bottom sheets, toasts | NFR-06 | ⬜ |
| T9A.3 | Navigation: bottom tabs (Home · Search · Post · Messages · Profile), consistent headers, deep links | NFR-06 | ⬜ |
| T9A.4 | Screen redesign: home feed, listing cards/detail, profile & work record, chat, order timeline, wallet | NFR-06 | ⬜ |
| T9A.5 | Motion & feedback: transitions, press feedback, haptics, pull-to-refresh, optimistic updates | NFR-06 | ⬜ |
| T9A.6 | Form UX: native date picker, 6-box code input, inline validation, keyboard handling | NFR-06 | ⬜ |
| T9A.7 | First-run onboarding walkthrough; illustrated empty states | NFR-06 | ⬜ |
| T9A.8 | Usability test with 3–5 students; fix the top issues; re-run accessibility checks (T9.2) | NFR-07 | ⬜ |
| T9A.9 | Update screen tests for the new components | NFR-10 | ⬜ |

**Exit:** founder signs off the look and feel on a real phone; usability-test issues rated "blocker" are fixed; all tests green.

## Phase 10 — Deploy & pilot readiness
**Depends on:** Phase 9A. **Needs founder approval** before any deploy.

| ID | Task | Status |
|---|---|---|
| T10.0 | **Blocker:** real email provider driver (PRD Q3) — production refuses the console mail driver, so the API cannot start in production without it (ADR-027 U2) | ⬜ |
| T10.1 | Supabase production project + migrations; verify storage bucket MIME/size limits (ADR-027 L5) | ⬜ |
| T10.2 | Render deploy (`render.yaml`), env secrets, health check; check `req.ip` behind Render's proxy (ADR-027 U1); re-run `npm run load:test` against it | ⬜ |
| T10.3 | EAS build profiles, Android APK for testers | ⬜ |
| T10.4 | Backup/restore procedure documented and tested | ⬜ |
| T10.5 | Runbook: how to operate, rotate secrets, handle disputes | ⬜ |
| T10.6 | MVP Definition of Done checklist signed off — incl. ADR-027 L2 (label off-app-paid work) and L3 (per-account login backoff) | ⬜ |
| T10.7 | Lawyer review of Terms / Privacy / Guidelines (`mobile/src/content/legal.ts`) before any public launch | ⬜ |

## v1.1 — Instant mode (after pilot feedback)
FR-300…303: AVAILABLE_NOW / NEED_NOW listings with expiry, nearby push matching, map view. Data model already supports the listing types.

---

## Parking lot (ideas — NOT in scope until moved into the PRD)
- Real-money payments & payouts (needs registered business, gateway KYC, legal review)
- Government-ID verification; phone OTP
- Hindi / Telugu UI, voice input
- Web app, admin dashboard UI
- Skill tests / certificates, college partnerships, recruiter access to work records
- AI-assisted matching and pricing suggestions
- Re-evaluate `@nestjs/authentication` once it reaches 1.0 (ADR-017)
- Cleanup job for signed-but-never-used uploads (ADR-019)
- Search scaling: `pg_trgm` indexes for keywords, PostGIS for near-me (ADR-021) — only when data volume needs it
- Map view / location pin picker for listings (MVP uses "use my current location")
- socket.io Redis adapter (only when running more than one API instance, ADR-022)
- Work record opt-out / secret share link (ADR-025)
- Admin web dashboard (moderation is API-only in the MVP, ADR-026)
- Native date picker for date of birth (MVP uses a typed YYYY-MM-DD field); absolute max session lifetime (refresh tokens currently slide 30 days)
