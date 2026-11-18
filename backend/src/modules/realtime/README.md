# `realtime` module — socket.io

PRD: FR-251 · ARCHITECTURE §9 · Design: [ADR-022](../../../../docs/DECISIONS.md)

- Endpoint: `/socket.io` on the API server (not under `/api/v1`). Connect with `auth: { token: <access token> }`.
- **Handshake:** JWT signature/expiry verified + user must be ACTIVE, else `connect_error` `AUTH_FAILED`.
- Every socket joins `user:<id>`. Client → server: `conversation:join` / `conversation:leave` `{ conversationId }` → ack `{ ok: true }` or `{ ok: false, code: 'NOT_FOUND' | 'VALIDATION_FAILED' }` (membership checked in the DB).
- Server → client: `message:new` (MessageDto), `conversation:read` ({ conversationId, userId, lastReadAt }); `notification:new`, `order:updated` arrive in later phases.
- Clients never write over the socket; all writes are REST.

| File | What it does |
|---|---|
| `realtime.module.ts` | Global module (imports Auth for TokenService) |
| `realtime.gateway.ts` | Handshake auth middleware, auto-join user room, join/leave handlers |
| `realtime.service.ts` | `emit(rooms, event, payload)` for feature services; `userRoom()`, `conversationRoom()` |

Related: `src/common/http/app-throttler.guard.ts` — HTTP rate limits skip socket contexts.
