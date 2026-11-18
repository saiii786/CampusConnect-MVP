# `reviews` module — reviews and the verified work record

PRD: FR-500…502, FR-053 · Design: [ADR-025](../../../../docs/DECISIONS.md)

| Endpoint | Who | Body | Success | Errors |
|---|---|---|---|---|
| `POST /orders/:id/review` | buyer or seller of the order | `{ rating 1–5, comment? }` | 201 `ReviewDto` | 404, 422 `ORDER_NOT_COMPLETED` / `REVIEW_WINDOW_CLOSED`, 409 `REVIEW_EXISTS` |
| `POST /reviews/:id/reply` | the reviewed person | `{ reply }` | 200 `ReviewDto` | 404, 409 `REVIEW_ALREADY_REPLIED` |
| `GET /users/:id/reviews` | signed in | `cursor?, limit?` | 200 `Page<ReviewDto>` | 404 inactive user |
| `GET /users/:id/work-record` | **public** | — | 200 `WorkRecordDto` | 404 |
| `GET /work-record/:id` | **public** | — | 200 HTML (escaped, no scripts) | 404 |

Order detail (`GET /orders/:id`) includes `reviews: { mine, theirs, canReview, reviewDeadline }` from `ReviewsService.forOrder()`.

| File | What it does |
|---|---|
| `reviews.module.ts` | Imports Users (stats); exports `ReviewsService` |
| `reviews.controller.ts` | Endpoints above |
| `reviews.service.ts` | `create`, `reply`, `listForUser`, `forOrder`, `workRecord`; notifies the reviewee |
| `work-record.page.ts` | `renderWorkRecordPage()` + `escapeHtml()` |

Privacy: the work record never includes buyer names, amounts, emails or phones (tested).
