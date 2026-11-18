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
| T2.1 | `GET/PATCH /me`, profile fields, public profile endpoint with safe mapper | FR-050, 052, 054 | ⬜ |
| T2.2 | Student verification (college email domain check + code) + admin student-domain allow-list | FR-004 | ⬜ |
| T2.3 | Categories endpoint + sensitive-category gating | FR-100, 104 | ⬜ |
| T2.4 | Uploads: Supabase Storage signed URLs (with local fallback driver for dev/tests) | FR-051 | ⬜ |
| T2.5 | Portfolio CRUD (max 10) | FR-051 | ⬜ |
| T2.6 | Account deletion (anonymise) | FR-009 | ⬜ |
| T2.7 | Mobile: profile view/edit, avatar + portfolio upload, student verification flow, public profile screen | — | ⬜ |
| T2.8 | Tests | NFR-10 | ⬜ |

**Exit:** a user has a complete public profile with portfolio and (optionally) a Student badge.

## Phase 3 — Listings & search (Modes 1 and 2 posting)
**Depends on:** Phase 2.

| ID | Task | Refs | Status |
|---|---|---|---|
| T3.1 | Create/edit/pause/close service offers and job requests (soft delete) | FR-150…153 | ⬜ |
| T3.2 | Search: keyword, filters, cursor pagination, indexes | FR-101, 103 | ⬜ |
| T3.3 | Near-me: bounding-box + distance in SQL, sort by distance | FR-102 | ⬜ |
| T3.4 | Mobile: home feed, search + filters, listing detail, create/edit listing (with device location + images), my listings | — | ⬜ |
| T3.5 | Tests (incl. ownership checks, pagination, distance) | NFR-10 | ⬜ |

**Exit:** users can post both listing types and find them by keyword, category and distance.

## Phase 4 — Quotes, conversations, realtime
**Depends on:** Phase 3.

| ID | Task | Refs | Status |
|---|---|---|---|
| T4.1 | Quotes: create/edit/withdraw, list for owner, reject | FR-200, 201, 203 | ⬜ |
| T4.2 | Conversations + messages REST, unread tracking, block check | FR-250, 252, 253 | ⬜ |
| T4.3 | socket.io gateway: verified JWT handshake, membership-checked rooms, events | FR-251 | ⬜ |
| T4.4 | Mobile: send quote, compare quotes screen, inbox, chat (realtime + fallback refetch), block user | — | ⬜ |
| T4.5 | Tests (incl. non-participant cannot read/join, forged token rejected) | NFR-10 | ⬜ |

**Exit:** buyer and seller can negotiate in real time; quotes visible and comparable.

## Phase 5 — Orders (job lifecycle)
**Depends on:** Phase 4.

| ID | Task | Refs | Status |
|---|---|---|---|
| T5.1 | Book a service (REQUESTED) and accept a quote (→ order, other quotes NOT_SELECTED, listing closed) | FR-202, 400 | ⬜ |
| T5.2 | `OrdersService.transition()` with shared state machine, optimistic locking, timeline events | FR-401, 408 | ⬜ |
| T5.3 | Actions: accept, decline, submit, approve, request changes (≤3), cancel, dispute — **DIRECT payment mode** first | FR-402…405 | ⬜ |
| T5.4 | Start/finish codes for on-site orders | FR-406 | ⬜ |
| T5.5 | Mobile: my orders / my jobs, order detail with timeline and state-aware action buttons | FR-409 | ⬜ |
| T5.6 | Tests: every transition allowed/denied, concurrency (double tap) | NFR-10 | ⬜ |

**Exit:** a complete job can be run end-to-end with direct payment.

## Phase 6 — Wallet, escrow, payments (test mode)
**Depends on:** Phase 5. **Needs from founder:** Razorpay test API keys (can start with `FakeGateway` before that).

| ID | Task | Refs | Status |
|---|---|---|---|
| T6.1 | Ledger + wallet service (double-entry, idempotency, conditional balance update, reconciliation) | FR-450, NFR-04 | ⬜ |
| T6.2 | `PaymentGateway` interface, `FakeGateway`, `RazorpayGateway` (test keys) | FR-451 | ⬜ |
| T6.3 | Top-up: create checkout, webhook with signature check, verify-on-return fallback | FR-451 | ⬜ |
| T6.4 | Escrow hooks in order transitions: fund, release, refund | FR-452 | ⬜ |
| T6.5 | Wallet history; simulated withdrawal | FR-453, 454 | ⬜ |
| T6.6 | Mobile: wallet screen, add money (in-app browser), history, TEST MODE badge, fund-order step | FR-455 | ⬜ |
| T6.7 | Tests: ledger invariants, duplicate webhooks, insufficient funds, races, reconciliation = 0 | NFR-10 | ⬜ |

**Exit:** escrow orders work end-to-end with Razorpay test checkout; ledger always reconciles.

## Phase 7 — Reviews, work record, notifications
**Depends on:** Phase 6 (reviews only need Phase 5; can overlap).

| ID | Task | Refs | Status |
|---|---|---|---|
| T7.1 | Two-way reviews (completed orders only, once, 14-day window), reply, rating aggregates | FR-500…502 | ⬜ |
| T7.2 | Public work record endpoint + shareable link (simple public HTML page served by the API) | FR-053 | ⬜ |
| T7.3 | Notifications service: in-app list + Expo push tokens + push sending | FR-550, 551 | ⬜ |
| T7.4 | Mobile: leave review, reviews on profile, share work record, notifications screen, push registration | — | ⬜ |
| T7.5 | Tests | NFR-10 | ⬜ |

## Phase 8 — Safety, admin, scheduled jobs
**Depends on:** Phase 7.

| ID | Task | Refs | Status |
|---|---|---|---|
| T8.1 | Reports + blocks | FR-600, 253 | ⬜ |
| T8.2 | Admin endpoints: reports, suspend, dispute resolution (with escrow refund/release), student domains, ledger reconcile | FR-601 | ⬜ |
| T8.3 | Scheduled jobs: auto-approve after 5 days | FR-407 | ⬜ |
| T8.4 | Spam/profanity guard + message/listing rate limits | FR-603 | ⬜ |
| T8.5 | Terms, privacy, community guidelines screens | FR-604 | ⬜ |
| T8.6 | Tests | NFR-10 | ⬜ |

## Phase 9 — Quality pass
**Depends on:** Phase 8.

| ID | Task | Refs | Status |
|---|---|---|---|
| T9.1 | UX pass: loading/empty/error states everywhere, offline banner, consistent design | NFR-06 | ⬜ |
| T9.2 | Accessibility pass (labels, font scaling, contrast, touch targets) | NFR-07 | ⬜ |
| T9.3 | Security review against ARCHITECTURE §10 + authorization matrix complete | NFR-01 | ⬜ |
| T9.4 | Load test (k6) and query/index tuning | NFR-03 | ⬜ |
| T9.5 | Maestro E2E for both main journeys | NFR-10 | ⬜ |

## Phase 10 — Deploy & pilot readiness
**Depends on:** Phase 9. **Needs founder approval** before any deploy.

| ID | Task | Status |
|---|---|---|
| T10.1 | Supabase production project + migrations | ⬜ |
| T10.2 | Render deploy (`render.yaml`), env secrets, health check | ⬜ |
| T10.3 | EAS build profiles, Android APK for testers | ⬜ |
| T10.4 | Backup/restore procedure documented and tested | ⬜ |
| T10.5 | Runbook: how to operate, rotate secrets, handle disputes | ⬜ |
| T10.6 | MVP Definition of Done checklist signed off | ⬜ |

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
- Native date picker for date of birth (MVP uses a typed YYYY-MM-DD field); absolute max session lifetime (refresh tokens currently slide 30 days)
