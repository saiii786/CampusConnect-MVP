# Mobile app (`@cc/mobile`)

Expo SDK 58 (React Native 0.88, React 19) with expo-router. Runs in **Expo Go** — no Android
Studio / Xcode needed. Design: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

> Expo changes quickly between SDK versions. Before using any Expo/React Native API, read the
> SDK 58 docs (see `AGENTS.md` in this folder) — do not rely on older tutorials.

## Run on your phone
1. Install **Expo Go** from the Play Store / App Store.
2. Start the backend first (see [backend/README.md](../backend/README.md)).
3. From the repo root: `npm run dev:mobile`, then scan the QR code with Expo Go.
   - Phone and computer must be on the **same Wi-Fi**. The app finds the API automatically
     (your computer's address, port 3000) — no IP to edit.
   - Windows: allow Node.js through the firewall (private networks) the first time, or the
     phone can't reach port 3000.
4. The welcome screen shows **Server status: ● Connected** (development builds only).
5. Try the account flow: **Create an account** → you land on Home with "Verify your email" →
   the 6-digit code is printed in the **API terminal** (no real emails yet, PRD Q3) → enter it.
   Close and reopen the app: you stay signed in. **Sign out** returns to the welcome screen.
6. Profile (Phase 2): **My profile** → add a photo, edit details, add portfolio work, get the Student
   badge (code goes to the college email — printed in the API terminal in development), see your public profile.
7. Listings (Phase 3): **+ Post** a service or a job request (needs a verified email; "Use my current location"
   for on-site work), browse Services / Job requests, search, **Near me**, **Filters**, open a listing,
   and manage yours in **My listings** (edit, pause, resume, close).
8. Quotes & chat (Phase 4, best with two phones/accounts): on a job request tap **Send a quote**
   (opens the chat), as the job owner tap **View quotes received**, on any listing tap **Message**;
   **Messages** shows unread counts and updates live; block/unblock from a chat.
9. Orders (Phase 5): **Book** a service (or **Accept** a quote) → **Orders** shows "I'm buying" / "I'm selling";
   the order screen shows only the allowed buttons (accept, mark done, approve, ask for changes, cancel,
   report a problem) and the timeline. On-site jobs: the buyer sees start/finish codes, the seller enters them.
   Payment is "Pay directly" for now; the wallet arrives in Phase 6.

To use a deployed API instead, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.

## Scripts (`npm run <script> -w @cc/mobile`)
| Script | Does |
|---|---|
| `start` | Expo dev server (QR code for Expo Go) |
| `typecheck` | TypeScript check |
| `lint` | ESLint (Expo config) |
| `test` | Jest + React Native Testing Library (`src/**/*.test.ts(x)`) |

## How sign-in works (T1.7, ADR-017)
- `src/lib/auth/session.ts` owns the session: status (`restoring` / `signedIn` / `signedOut` / `restoreFailed`) and the user, in a Zustand store (`useSession`).
- **Refresh token** → device secure storage (`session-storage.ts`, Keychain/Keystore). **Access token** → memory only.
- The API client asks the session for a token on every call; tokens are refreshed 30 s before expiry, and a `401 AUTH_TOKEN_INVALID` triggers **one** refresh + retry.
- Refreshes are **single-flight**: parallel requests share one refresh (the server treats a reused refresh token as theft and ends the session).
- If the server rejects the refresh token → signed out. If the network is down → still signed in; at start-up this shows the "Can't reach CampusConnect / Try again" screen.
- The root layout picks the screen group from the status (`Stack.Protected`), keeps the splash screen up while restoring, and clears cached server data on sign-out.

## Folder structure
| Path | Purpose |
|---|---|
| `src/app/` | **Screens = routes** (expo-router). `_layout.tsx` = providers + navigator. Nothing but screens here (tests go in `src/tests/`) |
| `src/app/_layout.tsx` | Root providers (TanStack Query, theme) + session restore + protected route groups |
| `src/app/reconnect.tsx` | Shown when a saved session could not be restored because the server was unreachable |
| `src/app/(auth)/` | Signed-out screens: `welcome`, `sign-in`, `sign-up`, `forgot-password`, `reset-password` (+ `_layout` stack) |
| `src/app/(app)/` | Signed-in screens: `index` (Browse: search, type tabs, near me, endless list), `search-filters`, `listings/new`, `listings/[id]`, `listings/edit/[id]`, `my-listings`, `listing-quotes/[id]`, `quote-form`, `my-quotes`, `inbox`, `chat/[id]`, `book`, `accept-quote`, `orders`, `orders/[id]`, `verify-email`, `profile` (my profile + portfolio + sign out), `profile/edit`, `profile/student`, `profile/add-work`, `profile/delete-account`, `users/[id]` (public profile) (+ `_layout` stack) |
| `src/components/listings/` | `listing-card`, `category-picker`, `listing-form` (shared by new/edit; `buildListingBody`, `listingToFormValues`) |
| `src/components/ui/` | Base UI kit — `AppText`, `Avatar`, `Button`, `TextField`, `Checkbox`, `Chip`/`ChipList`, `ImageTile`, `Notice`, `Screen`, `Segmented`, `LoadingState` / `ErrorState` / `EmptyState`. Import from `@/components/ui` |
| `src/components/profile/profile-summary.tsx` | Profile header shared by "My profile" and public profiles |
| `src/components/server-status-card.tsx` | Live `/health` card (development builds) |
| `src/config/api-url.ts` | Works out the API base URL (env var, or the dev computer automatically) |
| `src/lib/api/client.ts` | `api.get/post/patch/delete` — JSON, timeouts, bearer token + one refresh-and-retry on 401, failures → `ApiError`. `auth: false` for public endpoints |
| `src/lib/api/api-error.ts` | `ApiError` (status, code, details, requestId) + `describeError()` for friendly messages |
| `src/lib/api/health.ts` | `useServerHealth()` query hook |
| `src/lib/auth/session.ts` | Session manager (`session.signIn / signOut / restore`, token refresh) + `useSession` store |
| `src/lib/auth/session-storage.ts` | Secure persistence of the refresh token (expo-secure-store) |
| `src/lib/auth/auth-api.ts` | Typed calls: signup, login, verifyEmail, resendVerification, forgotPassword, resetPassword, me |
| `src/lib/forms/server-errors.ts` | `applyServerErrors()` — puts server validation errors on the matching form fields |
| `src/lib/api/media-url.ts` | `resolveMediaUrl()` — image URLs from the API (absolute, or "/…" for local dev storage) |
| `src/lib/uploads/upload-image.ts` | `pickImage()` (photo library + resize to ≤ 1280 px JPEG) and `uploadImage()` (sign → PUT → key) |
| `src/lib/listings/` | `listings-api.ts` (calls + infinite-query hooks), `search-filters.ts` (filter store → API query), `format.ts` (price/budget/distance labels) |
| `src/lib/chat/` | `chat-api.ts` (conversations, messages, unread, blocks + hooks, `addMessageToCache`), `format.ts` (time labels) |
| `src/lib/quotes/quotes-api.ts` | Quote calls + hooks (`useListingQuotes`, `useMyQuotes`, `useMyQuoteFor`) |
| `src/lib/realtime/realtime.ts` | `useRealtime()` (socket.io connection while signed in; updates caches on `message:new` / `conversation:read`), `joinConversation`, `leaveConversation` |
| `src/components/quotes/quote-card.tsx` | Quote with seller trust signals and actions |
| `src/components/orders/payment-mode-picker.tsx` | Pay directly / Wallet (escrow disabled until Phase 6) |
| `src/lib/orders/` | `orders-api.ts` (calls + hooks, `ESCROW_AVAILABLE`), `format.ts` (status/action/timeline labels) |
| `src/lib/location/current-location.ts` | Phone location with permission ("while using the app") + best-effort city |
| `src/lib/users/users-api.ts` | Profile/student/portfolio/public-profile/categories calls + query hooks; keeps the session's user in sync |
| `src/lib/query-client.ts` | TanStack Query setup (retries only network/5xx errors) |
| `src/tests/screens/` | Screen tests (e.g. sign-in form validation and submit) |
| `src/theme/tokens.ts` | Colours (light/dark, WCAG AA), spacing, radius, typography, min touch size |
| `src/theme/use-theme.ts` | `useTheme()` — current tokens for the phone's light/dark setting |
| `src/hooks/use-color-scheme.ts` | Colour-scheme hook (from the Expo template) |
| `assets/` | App icon, splash and images (Expo template defaults — to be replaced with real branding) |
| `app.json` | Expo config: name, scheme `campusconnect`, icons, plugins |
| `eslint.config.js` | ESLint config (generated by `expo lint`) |
| `AGENTS.md`, `.claude/settings.json` | Guidance from the Expo template for AI coding assistants |

## Rules
- Forms validate with the **shared zod schemas** from `@cc/shared` (`zodResolver(signupSchema)` …) — never write a second copy of a validation rule in the app.
- Never store tokens anywhere except through `session` (no AsyncStorage for secrets).
- Never hard-code colours, spacing or font sizes in screens — use `useTheme()`.
- Every screen handles loading, error and empty states with the shared state views.
- Every interactive element has an accessible label and is ≥ 48 px tall.
- Never put secrets in `EXPO_PUBLIC_*` variables — they ship inside the app.
- Add Expo modules with `npx expo install <pkg>`. In this monorepo that command's npm step can fail
  (npm 11 workspace bug); if it does, run `npm install -w @cc/mobile <pkg>@<version expo chose>` from the repo root.
