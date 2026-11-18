# `orders` module — the job lifecycle

PRD: FR-400…409 · Rules: ARCHITECTURE §6 + ADR-012 · Implementation: [ADR-023](../../../../docs/DECISIONS.md)

## Endpoints (`/api/v1`)
| Endpoint | Who | Body / query | Success | Main errors |
|---|---|---|---|---|
| `POST /orders` | buyer, verified email | `{ listingId, paymentMode, requirements?, deadline?, hours? (HOURLY), amountPaise? (QUOTE-priced) }` | 201 `OrderDetailDto` (REQUESTED) | 422 `BOOKING_NOT_ALLOWED` / `CANNOT_ORDER_OWN_LISTING` / `PAYMENT_MODE_UNAVAILABLE`, 403 `USER_BLOCKED`, 400 price rules |
| `POST /quotes/:id/accept` | job owner, verified email | `{ paymentMode, requirements?, deadline? }` | 201 `OrderDetailDto` (IN_PROGRESS for DIRECT) | 404, 409 `QUOTE_INVALID_STATUS` / `LISTING_NOT_ACTIVE` |
| `GET /orders` | participant | `role=buyer|seller, status?, cursor?, limit?` | 200 `Page<OrderSummaryDto>` | |
| `GET /orders/:id` | buyer or seller | — | 200 `OrderDetailDto` | 404 for anyone else |
| `POST /orders/:id/actions/:action` | per state machine | `{ note?, reason? (dispute), code? (on-site submit) }` | 200 `OrderDetailDto` | 409 `ORDER_INVALID_TRANSITION` / `ORDER_CHANGED`, 403 `ORDER_ACTION_NOT_ALLOWED`, 422 `ORDER_RULE_VIOLATION` / `ORDER_NOT_STARTED`, 400 `ORDER_CODE_INVALID` |
| `POST /orders/:id/start` | seller, on-site, IN_PROGRESS | `{ code }` | 200 | 400 wrong code, 409 already started, rate-limited |

Actions: `accept`, `decline`, `cancel`, `fund` (escrow, Phase 6), `submit`, `approve`, `request-changes` (max 3), `dispute` (reason required).
`OrderDetailDto.availableActions` lists exactly the buttons the viewer may press now.

## Files
| File | What it does |
|---|---|
| `orders.module.ts` | Registers the module; binds `ORDER_MONEY` to "escrow disabled" until the wallet (Phase 6) |
| `orders.controller.ts` | Endpoints above |
| `orders.service.ts` | `book`, `acceptQuote`, `act`, **`transition`** (the only status writer), `start`, `list`, `getDetail`; on-site code derivation; chat notes; `order:updated` events |

Tests: `backend/test/orders.e2e-spec.ts`; the full rule table is tested in `packages/shared/src/orders/state-machine.spec.ts`.
