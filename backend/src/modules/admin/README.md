# `admin` module — admin-only endpoints

PRD: FR-601. Every controller is `@Roles('ADMIN')` (others get 403). There is no API to become admin:

```bash
npm run admin:grant -w @cc/backend -- someone@example.com           # make admin
npm run admin:grant -w @cc/backend -- someone@example.com --revoke  # back to normal user
```
(script: `backend/prisma/scripts/grant-admin.ts`; uses the database in `backend/.env`)

| Endpoint | Body | Success |
|---|---|---|
| `GET /api/v1/admin/student-domains` | — | 200 `StudentDomainDto[]` |
| `POST /api/v1/admin/student-domains` | `upsertStudentDomainSchema { domain, collegeName, allowed = true }` | 200 `StudentDomainDto` (created or updated) |

`allowed: true` accepts a college domain without an `.ac.in/.edu/.edu.in` suffix and sets the college name on verified profiles; `allowed: false` blocks a domain even if its suffix would be accepted (ADR-020).

| File | What it does |
|---|---|
| `admin.module.ts` | Registers admin controllers |
| `student-domains.controller.ts` | Student-domain allow/deny list |

Phase 8 adds reports, suspensions, dispute resolution and ledger reconciliation here.
