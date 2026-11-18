# `users` module — own account, student badge, portfolio, public profiles

PRD: FR-004, FR-009, FR-050…054 · Rules: [ADR-020](../../../../docs/DECISIONS.md)

## Endpoints (`/api/v1`, all signed in)
| Endpoint | Body (shared schema) | Success | Main errors |
|---|---|---|---|
| `GET /me` | — | 200 `MeResponse` | |
| `PATCH /me` | `updateProfileSchema` (only changed fields; `avatarUploadKey: null` removes photo) | 200 `MeResponse` | 400 `VALIDATION_FAILED`, `UPLOAD_INVALID`, `UPLOAD_NOT_FOUND` |
| `DELETE /me` | `deleteAccountSchema` `{ password }` | 204 | 403 `AUTH_PASSWORD_INCORRECT`, 409 `ACCOUNT_HAS_OPEN_ORDERS` |
| `POST /me/student-verification` | `{ collegeEmail }` | 200 `MeResponse` (`student.pendingEmail`) | 422 `STUDENT_DOMAIN_NOT_ALLOWED`, 409 `STUDENT_EMAIL_IN_USE` / `STUDENT_ALREADY_VERIFIED`, 429 `AUTH_CODE_COOLDOWN` |
| `POST /me/student-verification/confirm` | `{ code }` | 200 `MeResponse` (`student.verified`) | 400 `AUTH_CODE_INVALID` / `AUTH_CODE_EXPIRED` |
| `GET /me/portfolio` | — | 200 `PortfolioItemDto[]` | |
| `POST /me/portfolio` | `{ title, description?, uploadKey }` | 201 | 422 `PORTFOLIO_LIMIT` (10) |
| `PATCH /me/portfolio/:id` | `{ title?, description?, position? }` | 200 | 404 `PORTFOLIO_ITEM_NOT_FOUND` (also for other users' items) |
| `DELETE /me/portfolio/:id` | — | 204 (positions renumbered, image deleted) | 404 |
| `GET /users/:id` | — | 200 `PublicProfile` | 404 `USER_NOT_FOUND` (also suspended/deleted), 400 bad id |

## Files
| File | What it does |
|---|---|
| `users.module.ts` | Registers controllers/services (imports Auth + Uploads) |
| `me.controller.ts` | `/me` and `/me/student-verification*` |
| `portfolio.controller.ts` | `/me/portfolio*` |
| `users.controller.ts` | `GET /users/:id` |
| `profile.service.ts` | `getMe`, `updateMe` (avatar claim + old photo cleanup), `getPublicProfile` (rating avg/count, completed jobs), `deleteAccount` (password, open-order check, anonymise) |
| `student-verification.service.ts` | `checkDomain` (admin list + suffixes), `start` (code to college email), `confirm` (grant badge); `domainCandidates()` |
| `portfolio.service.ts` | list/create (row lock for the 10-item limit)/update (reorder)/remove (renumber, delete image) |
| `user.mapper.ts` | `toMeResponse`, `toPublicProfile`, `toPortfolioItemDto`, `ME_INCLUDE`, `PUBLIC_PROFILE_INCLUDE` — the ONLY way user data leaves the API |
| `student-verification.spec.ts` | Unit tests (domain candidates, image signature) |

Integration tests: `backend/test/profiles.e2e-spec.ts`.

## Privacy rules (FR-054)
`PublicProfile` never contains email, phone, date of birth, college email, coordinates or storage keys — asserted in tests. Add new public fields only through `toPublicProfile`.
