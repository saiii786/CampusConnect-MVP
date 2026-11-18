# End-to-end tests (Maestro) — ROADMAP T9.5

> ⚠ **Status: written, NOT yet executed.** The development computer has no Java, Android SDK,
> emulator or Maestro CLI (checked 2026-11-19). Labels were taken from the code, but until these
> flows have run on a real device or emulator, treat them as a draft. Record the first real run in
> `docs/DEV_LOG.md`.

Maestro (free, open source) drives the real app on an Android emulator or a phone over USB,
tapping on the same text a user sees.

## One-time setup
1. Install Java 17+ and the Maestro CLI: https://docs.maestro.dev/getting-started/installing-maestro
   (Windows: use WSL, or Maestro Studio).
2. An Android emulator (Android Studio → Device Manager) **or** a phone with USB debugging and
   **Expo Go** installed.
3. Start the API (`npm run dev:api`) and the app (`npm run dev:mobile`); note the `exp://…` URL that
   Expo prints.
4. Create **two accounts** in the app and verify both emails (the code is printed in the API
   terminal). Sign-up needs the emailed code, which Maestro cannot read — so the flows sign in with
   existing accounts.

## Run
```bash
cd mobile/e2e
maestro test flows/ \
  -e EXPO_URL=exp://192.168.1.10:8081 \
  -e SELLER_EMAIL=seller@example.com -e SELLER_PASSWORD='…' \
  -e BUYER_EMAIL=buyer@example.com  -e BUYER_PASSWORD='…'
```

| Flow | Journey (PRD main journeys) |
|---|---|
| `flows/01-post-and-find-service.yaml` | Seller posts a remote fixed-price service → buyer finds it by search and opens it |
| `flows/02-book-complete-review.yaml` | Buyer books it (pay directly) → seller accepts and marks done → buyer approves and leaves 5 ★ |
| `flows/subflows/*.yaml` | Open the app, sign in, sign out |

Run 01 before 02 (02 searches for the service 01 posted). Each run posts a new listing with a unique title.
