# `mail` module — outgoing email

PRD: FR-003 (verification), FR-006 (password reset), FR-004 (college email) · Provider: PRD Q3 → **Brevo** (ADR-029)

| File | What it does |
|---|---|
| `mail.service.ts` | `MailService` (abstract: `send({ to, subject, text })`) and `ConsoleMailService` (prints to the log, keeps the last 50 in `outbox` for tests; `lastTo(email)`) |
| `brevo-mail.service.ts` | `BrevoMailService` — Brevo transactional API (`POST /v3/smtp/email`), 10 s timeout, never logs the key or message bodies |
| `brevo-mail.service.spec.ts` | Unit tests (request shape, error handling, nothing secret logged) |
| `mail.module.ts` | Global module; picks the driver from `MAIL_DRIVER` |

## Drivers
| `MAIL_DRIVER` | Use | Status |
|---|---|---|
| `console` | development, tests | ✅ — **refused in production** by `config/env.ts` |
| `brevo` | production (free: 300 emails/day) | ✅ code + unit tests — ⚠ not yet tried with a real key |

## Setting up Brevo (free)
1. Create an account at brevo.com (free plan).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: the address emails come from (e.g. a Gmail you own). Click the confirmation link Brevo emails you. No domain needed.
3. **SMTP & API → API keys → Generate a new API key**.
4. Set on the server (never in the app, never committed):
   ```
   MAIL_DRIVER=brevo
   BREVO_API_KEY=xkeysib-…
   MAIL_FROM_EMAIL=<the verified sender>
   MAIL_FROM_NAME=Connect
   ```
5. Sign up in the app with a real inbox and check the code arrives (and is not in spam).

**Development tip:** with `console`, find the code in the API terminal:
`To: you@example.com | Subject: 123456 is your Connect verification code`.
