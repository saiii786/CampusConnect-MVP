# `admin` module — admin-only endpoints (moderation by API)

PRD: FR-601 · Design: [ADR-026](../../../../docs/DECISIONS.md). Every controller is `@Roles('ADMIN')` (others get 403) — enforced by `route-safety.spec.ts`. There is no admin app yet; use the API (examples below).

## Becoming an admin
```bash
npm run admin:grant -w @cc/backend -- someone@example.com           # make admin
npm run admin:grant -w @cc/backend -- someone@example.com --revoke  # back to normal user
```
(script: `backend/prisma/scripts/grant-admin.ts`; uses the database in `backend/.env`). Then sign in (app or `POST /auth/login`) to get an access token.

## Endpoints
| Endpoint | Body / query | Success |
|---|---|---|
| `GET /admin/reports` | `status=OPEN` (default) / `ACTIONED` / `DISMISSED` | `AdminReportDto[]` with target summary + owner |
| `POST /admin/reports/:id/resolve` | `{ decision: DISMISS|ACTION, hideContent?, suspendUser?, note? }` | `ReportDto` (409 if already handled) |
| `POST /admin/users/:id/suspend` | `{ reason }` | 204 (signs the user out everywhere) |
| `POST /admin/users/:id/unsuspend` | — | 204 |
| `GET /admin/disputes` | `status=OPEN` (default) / `RESOLVED_REFUND` / `RESOLVED_RELEASE` | `AdminDisputeDto[]` |
| `POST /admin/disputes/:orderId/resolve` | `{ resolution: REFUND|RELEASE, note }` | `{ orderId, status }` — REFUND → buyer refunded, CANCELLED; RELEASE → seller paid, COMPLETED |
| `POST /admin/jobs/auto-approve` | — | `{ approved }` — run the 5-day auto-approve now |
| `GET /admin/student-domains` · `POST /admin/student-domains` | `{ domain, collegeName, allowed }` | Student-badge allow/deny list (Phase 2) |
| `GET /admin/ledger/reconcile` | — | `LedgerReconcileDto` (`ok: true` when all money is consistent) |

## Examples (PowerShell or bash with curl)
```bash
API=http://localhost:3000/api/v1; T=<admin access token>
curl -H "Authorization: Bearer $T" "$API/admin/reports"
curl -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
     -d '{"decision":"ACTION","hideContent":true,"suspendUser":true,"note":"scam"}' "$API/admin/reports/<reportId>/resolve"
curl -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
     -d '{"resolution":"REFUND","note":"no work delivered"}' "$API/admin/disputes/<orderId>/resolve"
curl -H "Authorization: Bearer $T" "$API/admin/ledger/reconcile"
```

| File | What it does |
|---|---|
| `admin.module.ts` | Registers admin controllers |
| `student-domains.controller.ts` | Student-domain allow/deny list |
| `ledger.controller.ts` | Ledger reconciliation |
| `admin-safety.controller.ts` | Reports, suspend/unsuspend |
| `admin-disputes.controller.ts` | Dispute list + resolution via `OrdersService.transition()` |
| `admin-jobs.controller.ts` | Run auto-approve now |
