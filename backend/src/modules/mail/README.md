# `mail` module — outgoing email

PRD: FR-003 (verification), FR-006 (password reset), later FR-004 (college email) · Open question: PRD Q3 (provider)

| File | What it does |
|---|---|
| `mail.service.ts` | `MailService` (abstract: `send({ to, subject, text })`) and `ConsoleMailService` (prints to the log, keeps the last 50 in `outbox` for tests; `lastTo(email)`) |
| `mail.module.ts` | Global module; picks the driver from `MAIL_DRIVER` |

## Drivers
| `MAIL_DRIVER` | Use | Status |
|---|---|---|
| `console` | development, tests | ✅ — **refused in production** by `config/env.ts` |
| provider (e.g. Brevo/Resend free tier) | production | ⬜ added when PRD Q3 is decided |

**Development tip:** after signing up in the app, find the code in the API terminal:
`To: you@example.com | Subject: 123456 is your CampusConnect verification code`.

## Adding a provider
1. Create `<provider>-mail.service.ts` extending `MailService`.
2. Add the name to `MAIL_DRIVER` in `config/env.ts` (+ its API key variable), `.env.example` and ARCHITECTURE §11.
3. Add a `case` in `mail.module.ts`; record the choice as an ADR.
