# `categories` module — category tree

PRD: FR-100 (fixed tree, Appendix A), FR-104 (sensitive categories gated) · ADR-010

| Endpoint | Who | Success |
|---|---|---|
| `GET /api/v1/categories` | public | 200 `CategoriesResponse { groups: [{ name, categories: [{ id, slug, name }] }] }`, `Cache-Control: max-age=3600` |

| File | What it does |
|---|---|
| `categories.service.ts` | `list()` — non-sensitive categories grouped in seed order; `getSelectable(id)` — for listings (Phase 3): 422 `CATEGORY_NOT_AVAILABLE` for unknown **or gated** categories |
| `categories.controller.ts` | The endpoint |
| `categories.module.ts` | Exports `CategoriesService` |

Categories come from `backend/prisma/seed-data/categories.ts` (`npm run db:seed`). Babysitting, elder care and pet care are `sensitive` and stay hidden until ID verification (FR-008) exists.
