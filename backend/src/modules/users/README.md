# `users` module — the signed-in user's account

PRD: FR-001 (now), FR-004, FR-009, FR-050…054 (Phase 2)

| Endpoint | Who | Success |
|---|---|---|
| `GET /api/v1/me` | signed in | 200 `MeResponse` (`id, email, emailVerified, role, displayName, createdAt`) |

| File | What it does |
|---|---|
| `users.module.ts` | Registers the `/me` controller (imports `AuthModule`) |
| `me.controller.ts` | `GET /me` |
| `user.mapper.ts` | `toMeResponse()` — the ONLY way user rows leave the API. Never return Prisma rows directly (they contain `passwordHash`, `dateOfBirth`, `status`) |

Phase 2 adds `PATCH /me`, `DELETE /me`, student verification, portfolio and public profiles (`PublicUser` — never includes email/phone).
