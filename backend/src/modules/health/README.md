# Module: health

**PRD:** NFR-09 · **Roadmap:** T0.4

| File | Purpose |
|---|---|
| `health.module.ts` | Registers the controller |
| `health.controller.ts` | `GET /api/v1/health` |

## Endpoint
`GET /api/v1/health` — public, not rate-limited.

| Case | Status | Body |
|---|---|---|
| Server and database fine | 200 | `{ "status": "ok", "database": "up", "uptimeSeconds": 12, "timestamp": "…" }` |
| Database unreachable | 503 | `{ "status": "degraded", "database": "down", … }` |

Used by: Render health checks, uptime monitors, the mobile app's "Server status" card.

## Tests
`test/platform.e2e-spec.ts` (integration).
