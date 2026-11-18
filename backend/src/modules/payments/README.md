# `payments` module — test-mode top-ups

PRD: FR-451 · Design: [ADR-024](../../../../docs/DECISIONS.md) · **TEST MODE ONLY — live keys are refused**

## Flow
1. App → `POST /wallet/topups { amountPaise }` (₹10–₹50,000) → `TopupDto { id, checkoutUrl, status: CREATED }`.
2. App opens `checkoutUrl` in the in-app browser (Razorpay test Payment Link, or the fake page).
3. Confirmation, any of:
   - Razorpay → `POST /webhooks/razorpay` (signature = HMAC-SHA256 of the raw body with `RAZORPAY_WEBHOOK_SECRET`);
   - app → `POST /wallet/topups/:id/verify` (on return to the app + polling);
   - fake page → "Pay" button.
4. All three run `refreshFromGateway()`: ask the gateway, and if PAID for the exact amount, set `Payment.status = PAID` and post the ledger TOPUP — once.

## Endpoints
| Endpoint | Who | Notes |
|---|---|---|
| `POST /wallet/topups` | signed in, auth rate limit | 502 `PAYMENT_GATEWAY_ERROR` if the gateway is down |
| `GET /wallet/topups/:id` · `POST /wallet/topups/:id/verify` | owner | others get 404 |
| `POST /webhooks/razorpay` | public | 401 `WEBHOOK_SIGNATURE_INVALID`; 200 otherwise |
| `GET /payments/fake/:id?token` · `POST …/pay` · `POST …/cancel` | public, token | fake gateway only (404 otherwise) |
| `GET /payments/return` | public | "go back to the app" page (Razorpay `callback_url`) |

## Files
| File | What it does |
|---|---|
| `payment-gateway.ts` | Abstract `PaymentGateway` (`createCheckout`, `fetchStatus`, `parseWebhook`) |
| `fake-gateway.ts` | In-memory fake gateway |
| `razorpay-gateway.ts` | Razorpay Payment Links (test mode) via REST |
| `payments.service.ts` | `createTopup`, `get`, `verify`, `handleWebhook`, `completeFake`, `refreshFromGateway` |
| `webhooks.controller.ts` | Raw-body webhook endpoint |
| `fake-checkout.controller.ts` | HTML fake checkout + return page |
| `payments.module.ts` | Picks the gateway from `PAYMENT_GATEWAY` |
| `payments.spec.ts` | Unit tests: ledger validation, Razorpay create/status/signatures, fake gateway |

## Switching on Razorpay test mode (founder)
1. Razorpay dashboard → switch to **Test Mode** → Settings → API Keys → generate (key id starts `rzp_test_`).
2. Webhooks → add `https://<public API>/api/v1/webhooks/razorpay`, event **payment_link.paid**, set a secret.
3. API env: `PAYMENT_GATEWAY=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PUBLIC_API_URL`.
4. Pay with Razorpay's test card/UPI on the checkout page. Without a public URL (local dev) webhooks cannot arrive, but "verify" still credits the wallet.
