# @cc/shared

Code used by **both** the backend and the mobile app, so the two can never disagree about
names, statuses or rules (ADR-007 — the old demo-connect broke because they did).

| File | What it contains |
|---|---|
| `src/index.ts` | Public entry point — re-exports everything below |
| `src/enums.ts` | Domain enums as `const` objects + types (`OrderStatus`, `ListingType`, …). Must match `backend/prisma/schema.prisma` — checked by `backend/src/common/shared-contract.spec.ts` |
| `src/orders/state-machine.ts` | The order state machine (ARCHITECTURE §6): `resolveOrderTransition()` (may this actor do this action now? what is the new status and money effect?), `availableOrderActions()` (which buttons to show), `initialOrderStatus()`, constants `MAX_CHANGE_REQUESTS`, `AUTO_APPROVE_AFTER_DAYS` |
| `src/money.ts` | Integer-paise helpers: `rupeesToPaise()`, `formatPaise()` (Indian grouping, e.g. ₹1,00,000), `isValidAmountPaise()`, `MAX_AMOUNT_PAISE` |
| `src/auth/schemas.ts` | Auth request schemas used by the API **and** the app's forms: `signupSchema`, `loginSchema`, `refreshTokenSchema`, `verifyEmailSchema`, `forgotPasswordSchema`, `resetPasswordSchema` (+ building blocks `emailSchema` — trims and lower-cases —, `passwordSchema` 8–128, `dateOfBirthSchema` 18+, `emailCodeSchema` 6 digits); helpers `parseIsoDate()`, `ageInYears()`; response types `MeResponse`, `AuthTokens`, `AuthSessionResponse`; error codes `AuthErrorCode`. All object schemas are `.strict()` (unknown fields rejected) |
| `src/users/schemas.ts` | Profile/student/portfolio/deletion request schemas (`updateProfileSchema` cleans tags and turns "" into null), `idParamSchema`, `emailDomain()`, `STUDENT_EMAIL_SUFFIXES`, limits (`PORTFOLIO_MAX_ITEMS`…), response types `MeResponse`, `OwnProfile`, `StudentStatus`, `PublicProfile`, `PortfolioItemDto`, `UserBadge` |
| `src/uploads/schemas.ts` | `signUploadSchema`, `uploadKeySchema` / `UPLOAD_KEY_PATTERN`, `UploadPurpose`, `IMAGE_CONTENT_TYPES`, `MAX_UPLOAD_BYTES`, `UploadTarget` |
| `src/categories/types.ts` | `CategoriesResponse`, `CategoryGroupDto`, `CategoryDto` |
| `src/admin/schemas.ts` | `domainSchema`, `upsertStudentDomainSchema`, `StudentDomainDto` |
| `src/**/*.spec.ts` | Vitest tests. `state-machine.spec.ts` checks every status × action × actor × payment-mode combination against an independent copy of the documented table |

Each roadmap phase adds the request schemas for its endpoints (one per API request body).

## Scripts
```bash
npm run build -w @cc/shared      # compile to dist/ (backend and mobile import the compiled output)
npm test -w @cc/shared           # unit tests
npm run typecheck -w @cc/shared
```

**Rule:** after changing anything here, run `npm run build:shared` (root) — the backend and app use `dist/`.
Changing a state-machine rule is a product decision: update ARCHITECTURE §6, the spec's `EXPECTED` table, and add an ADR.
