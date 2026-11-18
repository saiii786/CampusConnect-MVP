# Development Log

A dated, append-only record of what was done in each working session: what changed, what was tested (with results), and what is still open. Newest entry at the top.

**Entry template**
```
## YYYY-MM-DD — <short title>
**Roadmap tasks:** T?.?
**Done:** …
**Files:** (added / changed — details in FILE_MAP.md)
**Tests run:** command → result (only list tests that were actually executed)
**Not verified / known gaps:** …
**Next:** …
```

---

## 2026-11-19 — Phase 9 (part 1): security review + load test
**Roadmap tasks:** T9.3, T9.4

**Done**
- **Security review (T9.3):** an independent read-only review of the backend against ARCHITECTURE §10. No critical/high. Fixed the 3 medium findings (ADR-027): on-site code brute force (`Order.codeAttempts`, max 10, `ORDER_CODE_LOCKED`), email/student code guess race + unlimited re-issue (reserve-before-compare, 10 codes/day), sockets outliving their token/suspension (close at token expiry and on suspend/password reset; app reconnects itself). Lows and unconfirmed items are tracked in ADR-027 and ROADMAP T10.x. Found while reviewing: **production cannot boot yet** (no real mail driver) → ROADMAP T10.0.
- **Load test (T9.4):** `npm run load:test` (fetch-based; no k6 install needed) on a separate `campusconnect_load` database with 20,000 listings, 20 concurrent clients, 10 s per endpoint.
  | Endpoint | p95 before | p95 after |
  |---|---|---|
  | text search, no match | 323 ms | 101 ms (pg_trgm GIN indexes) |
  | near me 10 km | 597 ms | 214 ms (two-pass geo search) |
  | browse / search / category+price / detail / me / conversations / unread | 51–157 ms | unchanged |
- Additive migrations: `phase9_listing_trgm`, `phase9_order_code_attempts` (applied to the dev and test databases).

**Problems found and fixed during the session**
- First load runs returned 400s: my script sent `sort=PRICE_ASC`, the API expects `price_asc` (script bug, not an API bug).
- My first email-code fix still reported "4 tries left" to every parallel guess (it computed from the value read before reserving) → switched to an `update` that returns the reserved slot. Caught by the new parallel-guess test.
- Keeping expired codes (instead of deleting them) made "latest code" ambiguous when two had the same timestamp → tie-break on the time-ordered id.
- The commit gate grepped test output for "failed" and matched an expected log line ("Supabase sign upload failed") → gate now uses exit codes.

**Tests run (all executed this session)**
- backend unit 67/67 · backend integration **100/100** (6 new: code lock + parallel guesses, buyer can't burn finish tries, email-code parallel guesses, daily code cap, socket closed on suspend, socket closed at token expiry) · mobile 53/53 · lint + typecheck clean.
- Load test: PASS (worst p95 214 ms).

**Not verified / known gaps**
- Load numbers are from a laptop; free-tier hosting will differ (re-run in T10.2).
- Mobile reconnect-after-server-disconnect is typechecked and linted, not tried on a phone.

## 2026-11-19 — Phase 8: safety, admin, scheduled jobs, legal screens
**Roadmap tasks:** T8.1–T8.6

**Done**
- Follow-up to Phase 7: the Phase 7 commit contained a test line that failed `tsc` (the test passed); fixed in commit `9f28bae`. Cause: the commit ran in the same command even though typecheck had failed. Commits are now gated on typecheck + lint + tests passing.
- Shared: report/admin/dispute schemas and DTOs.
- Database: additive migration `Message.hiddenAt`, `Review.hiddenAt`.
- Backend: reports (`POST /reports`), admin moderation (list/resolve with hide + suspend, suspend/unsuspend), admin disputes (REFUND/RELEASE via `OrdersService.transition()`), `jobs` module (auto-approve every 15 min + 30 s after start; admin run-now), content guard (scam phrases, link spam, floods) on listings/quotes/messages, per-user limits (30 messages/min, 10 listings/h), hidden messages/reviews handled everywhere (removed text, excluded from ratings, work record). Route-safety test now enforces `@Roles('ADMIN')` on every `/admin` route. New env: `JOBS_ENABLED`, `JOBS_INTERVAL_MINUTES`. Decisions in ADR-026.
- Mobile: Report screen (listings, profiles, chat, long-press message), Terms/Privacy/Guidelines screens (root route; links on sign-up and My profile). Legal texts are drafts → lawyer review added as ROADMAP T10.7.

**Problems found and fixed during the session**
- Test helper declared `async` hid supertest's `.expect()` (all 7 tests failed at once) → plain function.
- Smoke cleanup did not know about reports → rolled back (nothing deleted), extended, re-run.

**Tests run (all executed this session)**
- shared 70/70 · backend unit 67/67 (incl. admin-route check, content guard) · backend integration 94/94 (7 new) · mobile 53/53
- `npm run lint`, `npm run typecheck` → pass · `npx expo export --platform android` → bundle builds
- Live (built server, port 3001): scam listing → 422 → report → non-admin 403 → admin (granted with `npm run admin:grant`) hides listing → 404 for others → escrow order disputed → admin REFUND → buyer refunded → ledger reconcile ok → auto-approve run. Smoke data removed.

**Not verified / known gaps**
- Not tried on a phone. Legal texts need a lawyer before a public launch.
- Admin works through the API only (examples in `backend/src/modules/admin/README.md`).

**Next:** Phase 9 — quality pass (UX states, accessibility, security review, load test, E2E).

## 2026-11-18 — Phase 7: reviews, work record, notifications
**Roadmap tasks:** T7.1–T7.5

**Done**
- Shared: review/reply schemas, review + work-record DTOs, notification types/DTOs, push-token schema; order detail now carries `reviews`.
- Backend: `reviews` (create with completed + 14-day + once rules, one reply, per-order review state, public work record JSON + escaped HTML page), `notifications` (global `notify()` → DB + socket + push; chat messages collapse per conversation; list/unread/read; push tokens), `PushService` (Expo push, `PUSH_DRIVER`), notifications wired into quotes, bookings, quote acceptance, every order transition, escrow release, top-ups, reviews and chat. Decisions in ADR-025.
- Mobile: notifications screen + 🔔 badge (live), review form and both reviews on completed orders, reviews on public profiles, "Reviews about me" with replies + "Share my work record", push registration (real builds only, lazily loaded; removed on sign-out via a new session sign-out hook). `expo-notifications` ~58.1.9 added.

**Problems found and fixed during the session**
- Sign-out hook timeout left a 3 s timer running → cleared after the race.
- Smoke cleanup did not know about reviews → transaction rolled back (nothing deleted), script extended, re-run.
- A test used a non-existent category slug with a silent fallback → fixed to the real slug (`baking`).

**Tests run (all executed this session)**
- shared 70/70 · backend unit 62/62 · backend integration 87/87 (6 new) · mobile 51/51
- `npm run lint`, `npm run typecheck` → pass · `npx expo export --platform android` → bundle builds
- Live (built server, port 3001): booking → seller notified (BOOKING_REQUEST) → completed → 5★ review + reply → seller notifications REVIEW_RECEIVED/ORDER_STATUS/BOOKING_REQUEST → public work record (no auth) 1 job, rating 5; HTML has the comment, no buyer name, no email → mark all read → 0. Smoke data removed.

**Not verified / known gaps**
- Phone push: needs an EAS build + project id (Phase 10); `PUSH_DRIVER=log` prints pushes in development.
- Not tried on a phone.

**Next:** Phase 8 — safety (reports), admin (suspend, disputes), scheduled jobs (auto-approve), spam guard, terms/privacy screens.

## 2026-11-18 — Phase 6: wallet, escrow, payments (test mode)
**Roadmap tasks:** T6.1–T6.7

**Done**
- Shared: wallet schemas/DTOs (top-up ₹10–₹50,000, withdrawals, reconcile).
- Backend: `wallet` (LedgerService — balanced, idempotent, never-negative; escrow as orders' `ORDER_MONEY`; history; simulated withdrawals), `payments` (gateway interface, fake gateway with HTML checkout, Razorpay test-mode Payment Links, raw-body signed webhook, verify, crediting only after the server confirms the exact amount), `GET /admin/ledger/reconcile`. App now created with `rawBody: true`. New env: `PAYMENT_GATEWAY`, `RAZORPAY_*` (live keys refused), `PUBLIC_API_URL`; production refuses the fake gateway. Decisions in ADR-024.
- Mobile: Wallet screen (balance, in escrow, history), Add money (in-app browser + auto-verify on return and polling), Withdraw (simulated), TEST MODE badge, escrow enabled in the payment picker, "Not enough money → Add money" on funding, wallet refresh on order updates.

**Problems found and fixed during the session**
- PowerShell 5.1 broke a `git commit -m` message containing double quotes (Phase 5 commit failed, nothing committed) → commit messages now go through a file (`git commit -F`).
- LedgerService was provided by two modules (two instances) → single `LedgerModule`.

**Tests run (all executed this session)**
- shared 70/70 · backend unit 62/62 · backend integration 81/81 (8 new, incl. Razorpay webhooks against a mocked Razorpay API) · mobile 49/49
- `npm run lint`, `npm run typecheck` → pass · `npx expo export --platform android` → bundle builds
- Live (built server, port 3001, fake gateway): checkout page shows TEST MODE → pay → verify PAID → wallet ₹1,000 → escrow order: accept → fund (buyer ₹400 left, ₹600 in escrow) → submit → approve (seller ₹600, escrow 0) → simulated withdrawal ₹200. Smoke data removed with the extended scoped script.

**Not verified / known gaps**
- Razorpay test checkout not exercised for real — needs the founder's test keys; webhooks additionally need a public URL (after deploy). Local dev works via "verify".
- Not tried on a phone.

**Next:** Phase 7 — reviews, work record, notifications.

## 2026-11-18 — Phase 5: orders (direct payment)
**Roadmap tasks:** T5.1–T5.6

**Done**
- Shared: order schemas and DTOs (`orderActionBodySchema` treats a missing body as `{}` — Express 5 leaves it undefined).
- Backend: `orders` module — booking (fixed / hourly × hours / agreed amount), atomic quote acceptance, `transition()` (state machine + optimistic lock + timeline + dispute row + escrow hook in one transaction), on-site start/finish codes (HMAC-derived, buyer-only), lists and detail with `availableActions`, chat notes, `order:updated` events. Escrow hook bound to "disabled" until Phase 6. Decisions in ADR-023.
- Mobile: book screen, accept-quote screen, payment-mode picker (wallet shown as "soon"), Orders (I'm buying / I'm selling), order detail with state-aware buttons, input for dispute reason / change note / finish code, start-code entry, timeline; live refresh on `order:updated`.

**Problems found and fixed during the session**
- A test could fail by chance 1 in 10,000 runs (start and finish codes equal) → guarded.
- Lint: numeric sort without comparator in a test → fixed.

**Tests run (all executed this session)**
- `npm test -w @cc/backend` → 56/56 · `npm run test:e2e -w @cc/backend` → 73/73 (10 new) · `npm test -w @cc/mobile` → 48/48 · shared 70/70
- `npm run lint`, `npm run typecheck` → pass · `npx expo export --platform android` → bundle builds
- Live (built server, port 3001): on-site hourly booking (2 h = ₹500) → accept → buyer sees start code, seller does not → start → finish code → approve (timeline book → accept → start → submit → approve); quote accepted → order IN_PROGRESS, job CLOSED; approve before submit refused. Smoke accounts removed with the scoped script.

**Not verified / known gaps**
- Not tried on phones. Auto-approve after 5 days (FR-407) runs in Phase 8 (scheduled jobs); the deadline is shown already.
- Escrow orders wait for the wallet (Phase 6).

**Next:** Phase 6 — wallet, escrow, payments (test mode). Uses the fake gateway until the founder provides Razorpay test keys.

## 2026-11-18 — Phase 4: quotes, conversations, realtime
**Roadmap tasks:** T4.1–T4.5

**Done**
- Shared: quote and chat/block schemas, DTOs, socket event names.
- Backend: `quotes` (send/edit/withdraw/re-send, owner list with seller trust stats, reject), `conversations` (find-or-create, list with unread + last message, messages with keyset paging, send, read receipts, unread summary), `safety` (blocks), `realtime` (socket.io gateway with verified handshake and membership-checked rooms; `RealtimeService.emit`), `UserStatsService`, `AppThrottlerGuard` (HTTP-only rate limits). Decisions in ADR-022.
- New dependencies: `@nestjs/websockets` + `@nestjs/platform-socket.io` 12.5.1 (backend), `socket.io-client` 4.8.4 (mobile; backend dev for tests).
- Mobile: live socket connection while signed in; inbox; chat (inverted list, older messages on scroll, read receipts, safety banner, block/unblock); send/edit quote; quotes received (compare, chat, decline); my quotes (edit, withdraw); listing detail actions (Send a quote / Message / View quotes); Messages button with unread count.

**Problems found and fixed during the session**
- A cleanup command I wrote truncated the chat tables of the dev database (would have removed the founder's own messages too). The permission system blocked it before it ran. Replaced with a scoped SQL script that deletes only `smoke…@example.com` accounts and their rows (in a transaction). Lesson recorded: smoke-test cleanup must always be scoped to the test accounts.
- A helper exported from a route file → moved to `lib/chat/format.ts` (route files export only screens).
- Jest warned about an open timer from a test QueryClient → `gcTime: Infinity` in tests.

**Tests run (all executed this session)**
- `npm test -w @cc/shared` → 70/70 · `npm test -w @cc/backend` → 56/56 · `npm run test:e2e -w @cc/backend` → 63/63 (9 new, real sockets) · `npm test -w @cc/mobile` → 45/45
- `npm run lint`, `npm run typecheck` → pass · `npx expo export --platform android` → bundle builds
- Live (built server, port 3001, real socket client): quote → conversation opened → owner sees seller badges → room join ack ok → seller's message delivered live to the buyer → unread 2 → forged token refused. Smoke accounts removed with the scoped script.

**Not verified / known gaps**
- Not tried with two phones yet.
- Single API instance only for sockets (Redis adapter in parking lot).

**Next:** Phase 5 — orders (job lifecycle, direct payment mode first).

## 2026-11-18 — Phase 3: listings & search
**Roadmap tasks:** T3.1–T3.5

**Done**
- GitHub: the founder signed in once and pushed; `main` on github.com/saiii786/CampusConnect-MVP now matches local (Phases 0–2). Founder asked to continue phase after phase automatically; each phase is committed and pushed when finished.
- Shared: listing schemas (offer/job union with cross-field rules), search/my-listings/detail query schemas, DTOs, `Page<T>`, haversine `distanceKm`, `roundCoordinate`; upload purpose `LISTING`.
- Database: additive migration `Listing.imageKeys` (generated with `migrate diff`, reviewed, applied).
- Backend: `listings` module (create/edit with merge + rule re-check and photo diff, pause/resume/close with conditional updates, visibility rules, search with keyword/filters/near-me/sorts, `/me/listings`), opaque cursor helper. Decisions in ADR-021.
- Mobile: Browse home (search, Services/Job requests, Near me, Filters, endless list, pull-to-refresh), filters screen, listing detail (owner actions), post/edit form (rupees → paise, shared-schema validation, current location, up to 5 photos), My listings; `Segmented` control; `expo-location` added (in Expo Go). Sign-out moved to My profile.

**Problems found and fixed during the session**
- Two test-authoring mistakes caught by running the tests: a category slug that does not exist (`logo-design` → `graphic-design`), and a price-range expectation that ignored inclusive bounds (the code was right).
- Search test setup could not delete listings with quotes (FK RESTRICT, by design) → resets user data instead.
- Editing photos needs their storage keys → listing detail returns `imageKeys` to the owner only (others get `[]`, tested).

**Tests run (all executed this session)**
- `npm test -w @cc/shared` → 70/70 · `npm test -w @cc/backend` → 56/56 · `npm run test:e2e -w @cc/backend` → 54/54 (14 new) · `npm test -w @cc/mobile` → 41/41
- `npm run lint`, `npm run typecheck` → pass · `npx expo export --platform android` → bundle builds
- Live (built server, port 3001): sign up → verify → post on-site hourly offer → near-me search from ~4 km finds it (4.3 km) → search from another city finds nothing → close. Smoke data deleted.

**Not verified / known gaps**
- Not tried on a phone (location permission, photo picking, list scrolling).
- Keyword search uses `contains` (sequential scan) — fine for a pilot; `pg_trgm` later (parking lot).
- "Send a quote" / "Book" buttons arrive in Phases 4–5 (detail screen says so).

**Next:** Phase 4 — quotes, conversations, realtime.

## 2026-11-18 — Phase 2: profiles, student badge, categories, uploads (+ UI/UX phase planned)
**Roadmap tasks:** T2.1–T2.8; new Phase 9A

**Done**
- Founder confirmed the "function first, UI/UX later" approach → **Phase 9A — UI/UX design & polish** added to ROADMAP (before deploy), recorded as ADR-018.
- GitHub: the founder's repo is still empty — pushing needs a one-time browser sign-in as `saiii786` that only the founder can do (`! git push -u origin main`). Not worked around (work account untouched, as instructed).
- Database: additive migration `20261118210000_phase2_profile_storage_keys` (2 nullable columns + 1 column on an empty table + unique index; no drops). Generated with `prisma migrate diff` because `migrate dev` refuses non-interactive shells; SQL reviewed before applying.
- Shared: users/uploads/categories/admin schemas and types; `MeResponse` now has `profile` and `student` sections.
- Backend: `storage` (local + Supabase drivers, ADR-019), `uploads` (sign/claim/discard, local upload + serve routes with magic-byte check), `users` (PATCH/DELETE /me, student badge, portfolio, `GET /users/:id`), `categories` (`GET /categories`, gated categories hidden), `admin` (student domains), `npm run admin:grant`, shared `CodeHasher`. Rules in ADR-020.
- Mobile: my profile, edit profile (photo pick → resize → upload), student badge flow, add work, delete account, public profile; Avatar/Chip/ImageTile components; `expo-image-picker` + `expo-image-manipulator` (both in Expo Go).

**Problems found and fixed during the session**
- **Live run caught a bug the tests missed:** images were stored fine but returned 404, because Express refuses to serve files under a dot-folder (`.uploads`). Fixed (`dotfiles: 'allow'` on the validated path) and the test storage folder now also starts with a dot; confirmed the test fails without the fix and passes with it.
- Typed routes: `profile/index.tsx` is typed as `/profile/index`, so My profile moved to `(app)/profile.tsx` (`/profile`); dynamic routes use `{ pathname: '/users/[id]', params }`.
- Student screen would stay on the email step after changing the college email → fixed with an `onSent` callback.

**Tests run (all executed this session)**
- `npm test -w @cc/shared` → 59/59 pass
- `npm test -w @cc/backend` → 56/56 pass (incl. storage drivers, Supabase via mocked HTTP, route safety with new public routes)
- `npm run test:e2e -w @cc/backend` → 40/40 pass (26 earlier + 14 Phase 2)
- `npm test -w @cc/mobile` → 36/36 pass
- `npm run lint`, `npm run typecheck` → pass; mobile typecheck also passes on a fresh checkout without generated route types
- `npx expo export --platform android` → bundle builds
- Live (built server, port 3001): categories (10 groups / 39) → signup → sign + upload JPEG → set avatar → image served 200 `image/jpeg` → portfolio item → public profile without email → delete account → image 404. Smoke accounts + files removed afterwards.

**Not verified / known gaps**
- Supabase Storage driver not tried against a real project (needs the founder's Supabase project; setup steps in `backend/src/modules/storage/README.md`).
- Photo picking/resizing not tried on a phone (needs a device). Push to GitHub pending the founder's sign-in.
- Signed-but-unused uploads are not cleaned up (parking lot).

**Next:** Phase 3 — listings & search (modes 1 and 2).

## 2026-11-18 — Phase 1: accounts & authentication
**Roadmap tasks:** T1.1–T1.10

**Done**
- Founder approved committing; Phase 0 committed (`.gitattributes` added for LF line endings). Repo-local git identity set to the founder's personal GitHub account (`saiii786`, GitHub noreply email) — global git config and the work account untouched. Push needs a one-time browser sign-in by the founder.
- **T1.10 / ADR-014 decided → ADR-017:** `@nestjs/authentication` is v0.1.6 (pre-1.0) without documented reuse detection or Prisma storage → own module on argon2id (`@node-rs/argon2`) + JWT (`jose`).
- Shared: auth zod schemas + response types (`packages/shared/src/auth/schemas.ts`), used by API and app forms.
- Backend: `auth` module (signup/login/refresh/logout/verify/resend/forgot/reset), global `AuthGuard` (private by default), decorators, `TokenService`, `PasswordHasher`, `EmailCodeService`; `mail` module (console driver); `users` module with `GET /me`; `auth` named throttler; new env vars `JWT_ACCESS_SECRET`, `CODE_HASH_SECRET`, TTLs, `AUTH_RATE_LIMIT_PER_MINUTE`, `MAIL_DRIVER` (production refuses placeholders and console mail). Local `backend/.env` got freshly generated random secrets.
- Route-safety test (T1.9): scans all controllers for unvalidated params and pins the public-route list.
- Mobile: session layer (SecureStore refresh token, in-memory access token, single-flight refresh, restore on start), API client auth + retry, `(auth)` and `(app)` route groups with `Stack.Protected`, screens: welcome, sign in, sign up, forgot/reset password, home, verify email, reconnect; `Checkbox` and `Notice` UI components.

**Problems found and fixed during the session**
- First push failed (403): this PC's stored GitHub login is the work account. Did not change it; configured the repo to use `saiii786` instead.
- `import.meta.glob` (Vite-only typing) broke the backend typecheck → route-safety test scans the filesystem instead.
- react-hook-form's `handleSubmit` is typed for web events → wrapped as `() => void submit()` in RN screens.
- A screen test placed in `src/app/` would have become a route → screen tests live in `src/tests/`.
- Sign-up first navigated to verify-email right after signing in, which can race the route guard → home shows the verify prompt instead.
- During the live check, port 3000 was already used by a running `nest start --watch` (left untouched) → smoke test ran on port 3001; the two smoke accounts were deleted from the local dev DB afterwards.

**Tests run (all executed this session)**
- `npm test -w @cc/shared` → 49/49 pass
- `npm test -w @cc/backend` → 47/47 pass (incl. token forgery/`alg: none`, argon2id params, guard, route safety)
- `npm run test:e2e -w @cc/backend` → 26/26 pass (5 platform + 21 auth: signup, duplicate, validation, login, enumeration, token checks, rotation, reuse → family revoked, concurrent refresh, logout, verification attempts/expiry/cooldown, reset + revoke-all, verify-code ≠ reset-code, suspension, rate limit)
- `npm test -w @cc/mobile` → 32/32 pass
- `npm run lint`, `npm run typecheck` (all packages) → pass
- `npx expo export --platform android` → bundle builds with the new routes
- Live: built server on port 3001 → signup 201 → code printed in log → verify 200 → `/me` 200 → refresh rotates → `/me` without token 401; no secrets/hashes in the log

**Not verified / known gaps**
- Not yet run on a physical phone (founder test). Push to GitHub and first CI run pending the founder's one-time sign-in.
- Emails only go to the API log until PRD Q3 (provider) is decided — production deploy is blocked on this by design.
- DOB is a typed `YYYY-MM-DD` field (no native date picker yet); terms/privacy screens (FR-604 content) not written yet — the checkbox text references them.
- `npm audit` unchanged from Phase 0 (tooling-only advisories).

**Next:** Phase 2 — profiles, student badge, categories, uploads.

## 2026-11-18 — Phase 0: foundation built
**Roadmap tasks:** T0.2–T0.8

**Done**
- Monorepo at `C:\Users\isaig\Projects\campusconnect-mvp` (npm workspaces: `packages/shared`, `backend`, `mobile`), git initialised (no commits yet).
- Checked current upstream tooling before writing code (versions changed after the old prototypes):
  NestJS 12 is ESM-only and its official starter uses Vitest + oxlint + TypeScript 6 (ADR-013);
  Nest 12 validates zod schemas natively (`@Body({ schema })`); Prisma 7 needs `prisma.config.ts`
  + driver adapter and npm's `prisma@latest` is an 8.0 RC, so pinned 7.10.1 (ADR-011);
  Expo SDK 58 / RN 0.88 / React 19.3; Testing Library v14 has async `render`.
- `@cc/shared`: enums, order state machine (ARCHITECTURE §6), paise money helpers.
- Backend: env validation (refuses to start, never prints secrets), standard error body with request IDs,
  helmet, 100 kb JSON limit, rate limiting, zod validation pipe, Prisma service, `/api/v1/health`,
  full MVP schema + first migration + idempotent category seed (42 categories, 3 gated).
- Mobile: Expo SDK 58 template stripped of demo code; theme tokens (light/dark, WCAG AA), UI kit,
  API client (timeouts, ApiError), automatic dev API address (ADR-015), welcome + server-status screen.
- CI workflow (GitHub Actions) written.

**Problems found and fixed during the session**
- A native **PostgreSQL 18 Windows service** already uses port 5432 → Docker DB moved to host port 5433; the existing service was not touched (ADR-016).
- PowerShell 5.1 corrupted non-ASCII characters while rewriting `.env` files → rewrote both files clean (ASCII only) and scanned the repo for any other corruption (none).
- Folder is really `Projects` (capital P); commands run via `projects` made npm create workspace links Metro couldn't see (`Unable to resolve "@cc/shared"`) → recreated links from the correctly-cased path; added to README troubleshooting.
- `prisma generate` failed without DB env vars → `prisma.config.ts` sets the URL only when present; backend `postinstall` generates the client.
- `expo install` / `expo lint` package installs fail inside an npm 11 workspace → installed from the root instead (documented in mobile README).
- Lint flagged Expo's web-only colour-scheme hook → removed (web is not an MVP target).
- Removed the Expo template's `LICENSE` (it claimed the app was MIT/Expo); licence is founder decision PRD Q7.

**Tests run (all executed this session)**
- `npm run lint` → pass (oxlint backend + shared, ESLint mobile)
- `npm run typecheck` → pass (all packages)
- `npm test` → shared 33/33, backend unit 24/24, mobile 13/13 pass
- `npm run test:e2e` → 5/5 pass (health, error shape, request IDs, helmet headers, 413 body limit) against Docker Postgres
- Compiled server (`node dist/main.js`) → `GET /api/v1/health` 200 `{status: ok, database: up}`; with no config → exits 1 listing missing variables
- `npx expo export --platform android` (with a temporary `@cc/shared` import, since reverted) → bundle builds, includes shared code
- `prisma migrate dev` → migration `20261118132417_init` applied; seed run twice → still 42 categories
- `expo-doctor` → 17/20 checks pass; the 3 "failures" are the checker's own `npm explain` errors on packages that are (correctly) not installed

**Not verified / known gaps**
- App not yet opened on a physical phone with Expo Go (needs the founder's phone).
- CI has not run on GitHub (no remote repository yet).
- `npm audit`: 43 advisories, all from two root issues (picomatch ReDoS, minimatch DoS) inside build/test tooling (Metro, Vite, Nest CLI); not in the API's runtime. No patched compatible versions upstream yet — re-check before release.
- Node 24.14.1 installed; Nest CLI asks for ≥ 24.15 (warnings only). Recommend upgrading Node.
- Supabase connection settings (pooler + Prisma 7 adapter) not yet verified — planned in T10.1.

**Next:** Phase 1 — start with T1.10 (decide ADR-014: `@nestjs/authentication` vs hand-rolled), then accounts & auth.

## 2026-11-18 — Audit of old prototypes + planning
**Roadmap tasks:** T0.1

**Done**
- Audited both old codebases in `C:\Users\isaig\OneDrive\Documents\personal` (read only, nothing modified):
  - `CampusConnect/` — NestJS + Prisma + socket.io backend, Expo frontend. Reasonable structure and ownership checks.
  - `demo-connect/` — later rewrite with simulated wallet + 50% escrow.
- Key problems found (these shaped the new design; see DECISIONS.md):
  - **CampusConnect:** socket handshake decoded JWTs without verifying the signature (anyone could impersonate any user); any socket could join any conversation room; fallback JWT secret `'default-secret-key'`; gig deletion cascaded away completed agreements and reviews; public endpoints returned user emails; socket event names differed between frontend and backend so alerts never fired.
  - **demo-connect:** open `POST /users/topup` (unlimited money); agreement endpoint used an inline type so validation was skipped (negative price → money creation, arbitrary seller); chat and agreement detail endpoints had no participant checks; frontend used `PENDING`/`price` while backend used `PROPOSED`/`totalFare`, so the escrow flow was unreachable; navigation to a non-existent `MyGigs` screen; random fake coordinates for gigs.
  - Both: money as `Float`, no real tests (test files didn't compile), hard-coded LAN IPs, heavy commented-out dead code. No secrets were found in git history.
- Founder clarified the product vision (any-skill gig platform for India, student focus, three matching modes). Captured in PRD.
- Wrote PRD, ROADMAP, ARCHITECTURE, DECISIONS (ADR-001…012), this log, FILE_MAP, README.

**Files:** see FILE_MAP.md → `docs/`, `README.md`.

**Tests run:** none — documentation only. (Earlier, during the audit: `tsc --noEmit` on both old backends → application code compiled; only test/config files failed.)

**Not verified / known gaps:** open questions Q1–Q6 in PRD §12 (name, pilot city, email provider, OTP, student domains, fee).

**Next:** T0.2–T0.8 (Phase 0 foundation).
