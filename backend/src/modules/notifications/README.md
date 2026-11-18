# `notifications` module — in-app notifications and push

PRD: FR-550, FR-551 · Design: [ADR-025](../../../../docs/DECISIONS.md)

## Using it from a feature
```ts
await this.notifications.notify(userId, {
  type: NotificationType.ORDER_STATUS,
  title: 'The seller marked the work as done',
  body: order.title,
  link: { kind: 'order', id: order.id },
});
```
Call it **after** your database change committed. It stores the notification, emits `notification:new` on the socket, sends a push (best effort), and never throws.

## Endpoints
| Endpoint | Body | Success |
|---|---|---|
| `GET /notifications` | `cursor?, limit?` | 200 `Page<NotificationDto> & { unreadCount }` |
| `GET /notifications/unread-count` | — | 200 `{ unreadCount }` |
| `POST /notifications/read` | `{ ids? }` (omit = all) | 200 `{ unreadCount }` |
| `POST /me/push-tokens` | `{ token: 'ExponentPushToken[…]', platform? }` | 204 (token moves to the latest user on that device) |
| `DELETE /me/push-tokens` | `{ token }` | 204 (app calls it on sign-out) |

## Push drivers (`PUSH_DRIVER`)
`expo` (Expo push API, free) · `log` (development: prints instead) · `none` (tests). Phone push only works in real app builds with an EAS project id — not in Expo Go (Phase 10).

| File | What it does |
|---|---|
| `notifications.module.ts` | Global module |
| `notifications.service.ts` | `notify` (with chat-message collapsing), `list`, `unreadCount`, `markRead`, push-token register/remove |
| `notifications.controller.ts` | Endpoints above |
| `push.service.ts` | Expo push sending; removes `DeviceNotRegistered` tokens |
