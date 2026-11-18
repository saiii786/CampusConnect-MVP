# CampusConnect (working name)

A gig and freelance marketplace for India where **anyone can earn from any skill** — home services, repairs, cooking, events, tech, tutoring — with a focus on **students**, who also build a **verified record of real work** before their first job.

> **Status:** Phase 0 (foundation) complete — next: Phase 1 (accounts & authentication). Payments will run in **TEST MODE** only — no real money moves.

## Read these first (in order)
1. [docs/PRD.md](docs/PRD.md) — what we are building and why (requirement IDs `FR-xxx`)
2. [docs/ROADMAP.md](docs/ROADMAP.md) — the phased plan and current status of every task
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it is built
4. [docs/DECISIONS.md](docs/DECISIONS.md) — why it is built that way
5. [docs/DEV_LOG.md](docs/DEV_LOG.md) — what happened, session by session
6. [docs/FILE_MAP.md](docs/FILE_MAP.md) — what every file is for

## Repository layout
```
backend/          NestJS API + Prisma (PostgreSQL)
mobile/           Expo (React Native) app
packages/shared/  Types, validation schemas and the order state machine used by both
docs/             All project documentation
```

## Getting started (≈ 10 minutes)
**Prerequisites:** Node.js 24 (≥ 24.15 recommended), Docker Desktop, Git, and the Expo Go app on your phone.

```bash
git clone <repo-url> && cd campusconnect-mvp
npm install                              # all workspaces + Prisma client
npm run db:up                            # local PostgreSQL in Docker (host port 5433)
cp backend/.env.example backend/.env     # Windows PowerShell: Copy-Item backend\.env.example backend\.env
npm run db:migrate -w @cc/backend        # create tables
npm run db:seed -w @cc/backend           # categories
npm run dev:api                          # terminal 1: API → http://localhost:3000/api/v1/health
npm run dev:mobile                       # terminal 2: scan the QR code with Expo Go
```
The app's welcome screen should show **Server status: ● Connected**.

### Everyday commands (from the repo root)
| Command | What it does |
|---|---|
| `npm run lint` | Lint all packages |
| `npm run typecheck` | TypeScript check all packages |
| `npm test` | Unit tests (shared, backend, mobile) |
| `npm run test:e2e` | API integration tests (needs `npm run db:up`) |
| `npm run db:up` / `db:down` | Start / stop the local database |

More detail: [backend/README.md](backend/README.md) · [mobile/README.md](mobile/README.md) · [packages/shared/README.md](packages/shared/README.md)

### Troubleshooting
| Problem | Fix |
|---|---|
| `P1000: Authentication failed` on port 5432 | Another PostgreSQL is installed on your machine. Our Docker DB uses **5433** — check `backend/.env` |
| Phone shows "Can't reach the server" | Same Wi-Fi for phone and PC; allow Node.js through Windows Firewall (private network); API running? |
| Mobile bundler: `Unable to resolve "@cc/shared"` (Windows) | Folder-name casing mismatch. Always `cd` using the exact on-disk casing (e.g. `C:\Users\isaig\Projects\…`), delete `node_modules\@cc\*` links and run `npm install` again |
| API exits with "Invalid environment configuration" | It lists the missing/invalid variables — compare with `backend/.env.example` |

## Working agreement (for every developer, human or AI)
- Build only what is in the PRD; new ideas go to the ROADMAP *Parking lot*.
- Follow the roadmap phase order and its Definition of Done.
- Every change updates: the module `README.md`, `docs/FILE_MAP.md`, and a `docs/DEV_LOG.md` entry.
- Every decision that changes scope, architecture or cost gets an ADR in `docs/DECISIONS.md` (paid services need founder approval).
- Never commit secrets. Configuration comes from environment variables (`.env`, see `.env.example`).
- Never claim a test passed unless it was run.
