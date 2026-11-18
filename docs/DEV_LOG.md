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
