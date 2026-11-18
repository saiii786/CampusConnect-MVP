# `conversations` module — chat

PRD: FR-250…254 · Design: [ADR-022](../../../../docs/DECISIONS.md)

| Endpoint | Body / query | Success | Notes |
|---|---|---|---|
| `POST /conversations` | `{ listingId }` | 200 `ConversationDto` | Find-or-create. 422 `CANNOT_CONTACT_SELF`, 403 `USER_BLOCKED`, 404 listing not visible |
| `GET /conversations` | `cursor?, limit?` | 200 `Page<ConversationDto>` | Recent activity first; each with other person, listing, last message, `unreadCount`, `blocked` |
| `GET /conversations/unread` | — | 200 `{ unreadConversations, unreadMessages }` | Badge on the Messages button |
| `GET /conversations/:id` | — | 200 `ConversationDto` | |
| `GET /conversations/:id/messages` | `cursor?, limit?` | 200 `Page<MessageDto>` | Newest first (keyset on id) |
| `POST /conversations/:id/messages` | `{ body }` (1–2000 chars) | 201 `MessageDto` | Emits `message:new` to the conversation room and both users' rooms. 403 `USER_BLOCKED`, 409 `RECIPIENT_UNAVAILABLE` |
| `POST /conversations/:id/read` | — | 200 `ConversationReadEvent` | Emits `conversation:read` |

Everyone but the two participants gets **404 `CONVERSATION_NOT_FOUND`**.

Roles: service offer → contacting person is BUYER, owner is SELLER; job request → owner is BUYER, contacting/quoting person is SELLER.

| File | What it does |
|---|---|
| `conversations.module.ts` | Imports Safety (blocks); exports `ConversationsService` |
| `conversations.controller.ts` | Endpoints above |
| `conversations.service.ts` | `ensure` (idempotent upsert, used by quotes), `start`, `list`, `messages`, `send`, `postMessage` (store + emit), `markRead`, `unreadSummary`, `findForParticipant` |
