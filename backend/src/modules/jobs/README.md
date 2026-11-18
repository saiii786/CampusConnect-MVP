# `jobs` module — scheduled background work

PRD: FR-407 · Design: [ADR-026](../../../../docs/DECISIONS.md)

| Job | What | When |
|---|---|---|
| Auto-approve | Orders SUBMITTED more than 5 days ago (buyer silent) → `auto-approve` by SYSTEM: COMPLETED, escrow released to the seller, both notified | Every `JOBS_INTERVAL_MINUTES` (15) and 30 s after start; or `POST /admin/jobs/auto-approve` |

- Runs inside the API process (`JOBS_ENABLED=true`; `false` in tests). Free hosting sleeps when idle — the run 30 s after waking catches up.
- Uses `OrdersService.transition()`, so the state machine, optimistic lock and escrow rules apply; running twice or on two servers is safe (losers get 409 and are skipped).

| File | What it does |
|---|---|
| `jobs.module.ts` | Imports Orders; exports `JobsService` |
| `jobs.service.ts` | Interval lifecycle (`onApplicationBootstrap` / `onApplicationShutdown`), `autoApprove(now)` |
