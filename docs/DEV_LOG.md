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
