# `wallet` module — ledger, balances, escrow, withdrawals

PRD: FR-450, FR-452…456 · Design: [ADR-024](../../../../docs/DECISIONS.md), ARCHITECTURE §7 · TEST MODE ONLY

## Endpoints (`/api/v1`, signed in)
| Endpoint | Body / query | Success | Errors |
|---|---|---|---|
| `GET /wallet` | — | 200 `{ balancePaise, inEscrowPaise, testMode: true }` | |
| `GET /wallet/transactions` | `cursor?, limit?` | 200 `Page<WalletTransactionDto>` (signed amounts, kind, order link) | |
| `POST /wallet/withdrawals` | `{ amountPaise }` (≥ ₹10) | 201 `{ status: 'SIMULATED' }` | 422 `WALLET_INSUFFICIENT_FUNDS` |
| Top-ups | see `payments` module | | |
| `GET /admin/ledger/reconcile` | admin | 200 `LedgerReconcileDto` (`ok`, mismatches, unbalanced, stranded escrow) | 403 |

## Money movements
| Event | Idempotency key | Entries |
|---|---|---|
| Top-up paid | `topup:<paymentId>` | EXTERNAL −x · WALLET(user) +x |
| Fund escrow order | `escrow-hold:<orderId>` | WALLET(buyer) −x · ESCROW(order) +x |
| Approve / auto-approve / admin release | `escrow-release:<orderId>` | ESCROW −held · WALLET(seller) +held |
| Seller cancels / admin refund | `escrow-refund:<orderId>` | ESCROW −held · WALLET(buyer) +held |
| Withdrawal (simulated) | `withdrawal:<id>` | WALLET(user) −x · EXTERNAL +x |

## Files
| File | What it does |
|---|---|
| `ledger.module.ts` | Provides the single `LedgerService` |
| `ledger.service.ts` | `post()` (balanced, idempotent, conditional wallet update), `escrowBalance()`, `reconcile()`; `validateEntries()` |
| `wallet.service.ts` | `getWallet`, `transactions`, `withdraw`; implements orders' `OrderMoney` (`apply` HOLD/RELEASE/REFUND) |
| `wallet.controller.ts` | `/wallet…` endpoints (incl. top-up routes delegating to `PaymentsService`) |
| `wallet.module.ts` | Imports Ledger + Payments; exports `WalletService` |

**Rule:** never change `Wallet.balancePaise` or write `LedgerEntry` rows anywhere else.
Tests: `backend/test/wallet.e2e-spec.ts`, `src/modules/payments/payments.spec.ts`.
