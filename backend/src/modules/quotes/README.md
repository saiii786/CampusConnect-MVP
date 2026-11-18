# `quotes` module — quotes on job requests (Mode 1)

PRD: FR-200…203 · Design: [ADR-022](../../../../docs/DECISIONS.md) · Accepting a quote → order: Phase 5

| Endpoint | Who | Body | Success | Main errors |
|---|---|---|---|---|
| `POST /listings/:id/quotes` | seller, **verified email** | `{ amountPaise, message, etaDate? }` | 201 `QuoteDto` (+ chat opened, quote posted in it) | 404 listing, 422 `QUOTE_NOT_ALLOWED` (not a job request) / `CANNOT_QUOTE_OWN_LISTING`, 403 `USER_BLOCKED`, 409 `QUOTE_EXISTS` / `QUOTE_CLOSED` |
| `GET /listings/:id/quotes` | job owner | — | 200 `QuoteDto[]` (ACTIVE first, cheapest first; seller rating, jobs, badges) | 404 for anyone else |
| `GET /me/quotes` | seller | — | 200 `MyQuoteDto[]` (with job title/status/owner) | |
| `PATCH /quotes/:id` | seller | `{ amountPaise?, message?, etaDate? }` | 200 | 404, 409 `QUOTE_INVALID_STATUS` / `LISTING_NOT_ACTIVE` |
| `POST /quotes/:id/withdraw` | seller | — | 200 (→ WITHDRAWN; can be re-sent) | 404, 409 |
| `POST /quotes/:id/reject` | job owner | — | 200 (→ REJECTED, final) | 404, 409 |

Statuses: ACTIVE → WITHDRAWN (seller; re-sendable) · REJECTED (owner) · NOT_SELECTED (job closed / another quote accepted) · ACCEPTED (Phase 5).

| File | What it does |
|---|---|
| `quotes.module.ts` | Imports Conversations, Safety, Users; exports `QuotesService` |
| `quotes.controller.ts` | Endpoints above |
| `quotes.service.ts` | Rules, conditional status changes, DTO building with batched seller stats and conversation ids |

Tests: `backend/test/chat.e2e-spec.ts`.
