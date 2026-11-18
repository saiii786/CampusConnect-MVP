# `safety` module — blocking (reports in Phase 8)

PRD: FR-253 (Phase 4), FR-600/603 (Phase 8)

| Endpoint | Body | Success |
|---|---|---|
| `GET /blocks` | — | 200 `BlockedUserDto[]` (people I blocked) |
| `POST /blocks` | `{ userId }` | 204 (idempotent; 400 `CANNOT_BLOCK_SELF`, 404 unknown user) |
| `DELETE /blocks/:userId` | — | 204 (idempotent) |

A block in **either direction** stops: messages, starting conversations, quotes (Phase 4) and orders (Phase 5). Use `BlocksService.assertNotBlocked(a, b)` in any new feature where two people interact.

| File | What it does |
|---|---|
| `safety.module.ts` | Exports `BlocksService` |
| `blocks.controller.ts` | Endpoints above |
| `blocks.service.ts` | `isBlockedBetween`, `assertNotBlocked`, `blockedAmong`, `block`, `unblock`, `list` |
