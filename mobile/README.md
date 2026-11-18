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
| `src/app/(app)/` | Signed-in screens: `index` (home: greeting, verify-email prompt, sign out), `verify-email` (+ `_layout` stack) |
| `src/components/ui/` | Base UI kit — `AppText`, `Button`, `TextField`, `Checkbox`, `Notice`, `Screen`, `LoadingState` / `ErrorState` / `EmptyState`. Import from `@/components/ui` |
| `src/components/server-status-card.tsx` | Live `/health` card (development builds) |
| `src/config/api-url.ts` | Works out the API base URL (env var, or the dev computer automatically) |
| `src/lib/api/client.ts` | `api.get/post/patch/delete` — JSON, timeouts, bearer token + one refresh-and-retry on 401, failures → `ApiError`. `auth: false` for public endpoints |
| `src/lib/api/api-error.ts` | `ApiError` (status, code, details, requestId) + `describeError()` for friendly messages |
| `src/lib/api/health.ts` | `useServerHealth()` query hook |
| `src/lib/auth/session.ts` | Session manager (`session.signIn / signOut / restore`, token refresh) + `useSession` store |
| `src/lib/auth/session-storage.ts` | Secure persistence of the refresh token (expo-secure-store) |
| `src/lib/auth/auth-api.ts` | Typed calls: signup, login, verifyEmail, resendVerification, forgotPassword, resetPassword, me |
| `src/lib/forms/server-errors.ts` | `applyServerErrors()` — puts server validation errors on the matching form fields |
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
