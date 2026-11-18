# `auth` module — accounts and sessions

PRD: FR-001…006, FR-601 (suspension), FR-603 (rate limits) · Design: [ADR-017](../../../../docs/DECISIONS.md) · Roadmap: Phase 1

## Endpoints (`/api/v1`)
| Endpoint | Who | Body (shared schema) | Success | Main errors |
|---|---|---|---|---|
| `POST /auth/signup` | public, auth limit | `signupSchema` | 201 `AuthSessionResponse` | 400 `VALIDATION_FAILED`, 409 `AUTH_EMAIL_TAKEN` |
| `POST /auth/login` | public, auth limit | `loginSchema` | 200 `AuthSessionResponse` | 401 `AUTH_INVALID_CREDENTIALS`, 403 `AUTH_ACCOUNT_SUSPENDED` |
| `POST /auth/refresh` | public, auth limit | `refreshTokenSchema` | 200 `AuthSessionResponse` | 401 `AUTH_REFRESH_INVALID` / `AUTH_REFRESH_REUSED`, 403 suspended |
| `POST /auth/logout` | public | `refreshTokenSchema` | 204 (idempotent) | — |
| `POST /auth/verify-email` | signed in, auth limit | `verifyEmailSchema` | 200 `MeResponse` | 400 `AUTH_CODE_INVALID` (`details.attemptsLeft`) / `AUTH_CODE_EXPIRED`, 409 `AUTH_EMAIL_ALREADY_VERIFIED` |
| `POST /auth/resend-verification` | signed in, auth limit | — | 202 | 429 `AUTH_CODE_COOLDOWN`, 409 already verified |
| `POST /auth/forgot-password` | public, auth limit | `forgotPasswordSchema` | 202 always (no enumeration) | — |
| `POST /auth/reset-password` | public, auth limit | `resetPasswordSchema` | 204; signs out all devices | 400 `AUTH_CODE_INVALID` / `AUTH_CODE_EXPIRED` |

`GET /me` lives in the `users` module but uses `AuthService.me()`.

## Files
| File | What it does |
|---|---|
| `auth.module.ts` | Registers everything below; exports `AuthService`, `TokenService`, `AuthGuard` |
| `auth.controller.ts` | Thin HTTP layer (table above) |
| `auth.service.ts` | All rules: signup (user + profile + wallet in one write), login, refresh **rotation + reuse detection**, logout, verify/resend, forgot/reset |
| `auth.guard.ts` | **Global** guard (registered in `app.module.ts`): bearer token → user loaded from DB → suspended/deleted blocked → `@Roles` → `@RequireVerifiedEmail` → `request.user`. Also `readBearerToken()` |
| `auth.decorators.ts` | `@Public()`, `@Roles()`, `@RequireVerifiedEmail()`, `@AuthRateLimit()`, `@CurrentUser()`, `AuthUser` type |
| `token.service.ts` | Sign/verify access JWTs (`jose`, HS256 pinned, iss/aud/typ checked); create refresh tokens; `hashRefreshToken()` |
| `password-hasher.ts` | argon2id hash/verify (`@node-rs/argon2`), dummy verify for timing equalisation |
| `email-code.service.ts` | 6-digit codes: issue (cooldown, replaces older), consume (HMAC compare, attempts, single use) |
| `*.spec.ts` | Unit tests: tokens (forgery, `alg: none`, expiry…), hasher (argon2id params), guard (public/roles/suspended/verified) |

Integration tests: `backend/test/auth.e2e-spec.ts` (21 tests against the real test DB).

## Rules for using auth in other modules
- Every route is **private by default**. Add `@Public()` only for genuinely anonymous endpoints, and add the route to `PUBLIC_ROUTES` in `src/common/route-safety.spec.ts` (the test fails otherwise — on purpose).
- Get the caller with `@CurrentUser() user: AuthUser` and pass `user.id` to services. **Never** take a user id from the request body for "who am I".
- Posting and ordering need `@RequireVerifiedEmail()` (FR-003). Admin endpoints need `@Roles('ADMIN')`.
- Sensitive public endpoints (anything a bot could hammer) get `@AuthRateLimit()`.

## Key numbers (change only with an ADR)
| Setting | Value | Where |
|---|---|---|
| Access token lifetime | 15 min | `ACCESS_TOKEN_TTL_MINUTES` |
| Refresh token lifetime | 30 days, renewed on each refresh | `REFRESH_TOKEN_TTL_DAYS` |
| Email code | 6 digits, 5 attempts; verify 30 min, reset 15 min; resend cooldown 60 s | `email-code.service.ts` |
| Auth rate limit | 10 requests/min/IP on `@AuthRateLimit()` routes | `AUTH_RATE_LIMIT_PER_MINUTE` |
| Password | 8–128 characters | `@cc/shared` `auth/schemas.ts` |

## Known limits
- Emails are printed to the server log (`MAIL_DRIVER=console`) until PRD Q3 picks a provider; production refuses to start with the console driver.
- Signup tells the caller when an email is already registered (usability trade-off).
- No absolute maximum session length yet (parking lot).
