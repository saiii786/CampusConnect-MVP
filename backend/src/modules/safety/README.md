# `safety` module — blocks, reports, suspension, spam guard

PRD: FR-253, FR-600, FR-601, FR-603 · Design: [ADR-022](../../../../docs/DECISIONS.md) (blocks), [ADR-026](../../../../docs/DECISIONS.md)

## Endpoints (signed in)
| Endpoint | Body | Success | Errors |
|---|---|---|---|
| `GET /blocks` | — | 200 `BlockedUserDto[]` | |
| `POST /blocks` | `{ userId }` | 204 (idempotent) | 400 `CANNOT_BLOCK_SELF`, 404 |
| `DELETE /blocks/:userId` | — | 204 | |
| `POST /reports` | `{ targetType: USER|LISTING|MESSAGE|REVIEW, targetId, reason, details? }` | 201 `ReportDto` (existing open report if repeated) | 404 `REPORT_TARGET_NOT_FOUND` (incl. messages you are not part of), 422 `CANNOT_REPORT_SELF` |

Admin side (resolve, suspend): see `admin` module.

## Rules
- A block in **either direction** stops messages, new conversations, quotes and orders — use `BlocksService.assertNotBlocked(a, b)` for any new person-to-person feature.
- **Content guard** (`content-guard.ts`): `assertContentAllowed(...texts)` → 422 `CONTENT_NOT_ALLOWED` for phrases in `blocked-terms.ts`, more than 3 links, or 30+ repeated characters. Used by listings (create/update), quotes (create/update), messages.
- **Per-user limits** (counted in the database): 30 messages/minute (`MESSAGE_LIMIT_PER_MINUTE`), 10 new listings/hour (`LISTING_LIMIT_PER_HOUR`) → 429 `RATE_LIMITED`.
- **Suspension** (`ReportsService.suspend`): status SUSPENDED + every refresh token revoked → blocked immediately everywhere (auth guard, login, refresh, sockets on next connect). Admins cannot be suspended this way.

| File | What it does |
|---|---|
| `safety.module.ts` | Exports `BlocksService`, `ReportsService` |
| `blocks.controller.ts` / `blocks.service.ts` | Blocks |
| `reports.controller.ts` / `reports.service.ts` | Create, list (admin), resolve (hide/suspend), suspend/unsuspend, target lookup |
| `content-guard.ts` | Spam/scam checks + per-user limit constants |
| `blocked-terms.ts` | Editable scam-phrase list (each change → DEV_LOG) |
| `content-guard.spec.ts` | Unit tests |
