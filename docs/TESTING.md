# Manual test checklist (founder)

Go through each row on a real phone. Write anything odd — wrong, confusing, ugly, slow — in **Notes**;
it does not need to be a bug. Later we turn the notes into fixes (Phase 9A screen redesign uses them).

**Which accounts:** your six test inboxes are listed in `mobile/e2e/.env.test-accounts` (on your computer only):
one admin (you), two sellers, two buyers, and the college email for the Student badge.

## How to run the app
**Option A — today, on your Wi-Fi (no deploy needed)**
1. `npm run db:up` and `npm run dev:api` (API on your computer, local database).
2. `npm run dev:mobile`, scan the QR code with **Expo Go** (phone on the same Wi-Fi).
3. Email codes appear in the **API terminal** (real emails need the Brevo key).

**Option B — after the deploy (docs/RUNBOOK.md §2–3)**
Install the APK link from EAS. Real emails, real (test-mode) Razorpay page, works on mobile data. The first
request after the server slept can take ~1 minute.

Two phones (or one phone + signing out/in) make chat and orders easier to test.

## Checklist

### 1. First run and account
| # | Do this | Expect | OK? | Notes |
|---|---|---|---|---|
| 1.1 | Open the app | Indigo splash with the rings, then Welcome: "Connect", tagline | | |
| 1.2 | Create an account (seller 1) | Lands on Home with "Verify your email" | | |
| 1.3 | Enter the 6-digit code | Banner disappears | | |
| 1.4 | Wrong code 5 times | "Code expired, request a new one" | | |
| 1.5 | Close and reopen the app | Still signed in | | |
| 1.6 | Profile → Sign out → Forgot password → reset | Can sign in with the new password | | |
| 1.7 | Turn on large text in phone settings | Text grows, nothing cut off | | |
| 1.8 | Switch phone to dark mode | Navy background, everything readable | | |

### 2. Profile and Student badge
| # | Do this | Expect | OK? | Notes |
|---|---|---|---|---|
| 2.1 | Profile → Edit: photo, bio, skills, city | Saved, shown on public profile | | |
| 2.2 | Add portfolio work with a photo | Appears on profile | | |
| 2.3 | Student badge with the college email | Code arrives, "Student ✓" appears | | |
| 2.4 | "See my public profile" | No email/phone visible | | |

### 3. Listings and search (bottom tab **Post**, **Home**)
| # | Do this | Expect | OK? | Notes |
|---|---|---|---|---|
| 3.1 | Post → service, fixed price, remote, 2 photos | Listing opens; photos swipe one per page | | |
| 3.2 | Post an on-site job request with "Use my current location" | Shows city; others see distance, never your exact place | | |
| 3.3 | Try a scam text ("pay registration fee") | Refused with a clear message | | |
| 3.4 | As buyer: search words, Services/Job requests, Near me, Filters | Results match; empty search shows a helpful message | | |
| 3.5 | Scroll to the bottom of a long list | "Loading more…" then more items | | |
| 3.6 | My listings → pause, resume, edit, close | Paused/closed ones disappear from search | | |

### 4. Quotes and chat (tab **Messages**)
| # | Do this | Expect | OK? | Notes |
|---|---|---|---|---|
| 4.1 | Seller: Send a quote on the buyer's job | Chat opens with the quote | | |
| 4.2 | Buyer: View quotes received, compare, chat | Seller's rating/jobs/student badge shown | | |
| 4.3 | Send messages both ways | Appear live; Messages tab shows an unread badge | | |
| 4.4 | Long-press a message → Report | Report screen opens | | |
| 4.5 | Block, then try to message | Messaging is off; unblock restores it | | |

### 5. Orders (tab **Orders**)
| # | Do this | Expect | OK? | Notes |
|---|---|---|---|---|
| 5.1 | Buyer: Book a service, **Pay directly** | Seller sees "Waiting for seller" | | |
| 5.2 | Seller: Accept → Mark work as done | Buyer is notified | | |
| 5.3 | Buyer: Ask for changes, then Approve | Completed; timeline shows every step | | |
| 5.4 | On-site job: seller enters start code, then finish code | Works; 10 wrong codes lock it | | |
| 5.5 | Buyer: Accept a quote instead of booking | Order starts, other quotes closed | | |
| 5.6 | Orders: Active / All, I'm buying / I'm selling | Finished orders only under All | | |
| 5.7 | Report a problem on an order | Dispute opened; admin can resolve (§8) | | |

### 6. Wallet (TEST MODE money)
| # | Do this | Expect | OK? | Notes |
|---|---|---|---|---|
| 6.1 | Wallet → Add money ₹500 | Test checkout page; balance updates after paying | | |
| 6.2 | Book with **Wallet (safer)** → Pay into escrow | Balance drops, "held safely" shown | | |
| 6.3 | Approve the work | Seller's wallet receives the money | | |
| 6.4 | Seller: Withdraw | Simulated; balance updates | | |

### 7. Reviews, work record, notifications
| # | Do this | Expect | OK? | Notes |
|---|---|---|---|---|
| 7.1 | After completion both leave stars + comment | Shown on profiles | | |
| 7.2 | Seller replies to a review | Reply visible | | |
| 7.3 | Profile → Share my work record → open the link | Public page; each job says "Paid through the app" or "Paid directly" | | |
| 7.4 | 🔔 on Home | Lists quotes, bookings, order updates; tapping opens the right screen | | |

### 8. Safety and admin (your admin account)
| # | Do this | Expect | OK? | Notes |
|---|---|---|---|---|
| 8.1 | Report a listing/user from another account | Report created | | |
| 8.2 | Admin API: list reports, hide the listing, suspend the user (examples in `backend/src/modules/admin/README.md`) | Listing gone; suspended user is signed out at once | | |
| 8.3 | Resolve a dispute REFUND / RELEASE | Money moves; both notified | | |
| 8.4 | Terms / Privacy / Guidelines from sign-up and Profile | Open and readable | | |

### 9. Bad network
| # | Do this | Expect | OK? | Notes |
|---|---|---|---|---|
| 9.1 | Turn on airplane mode while browsing | "You're offline" banner; saved data stays visible | | |
| 9.2 | Turn it off again | Banner goes, lists refresh by themselves | | |
| 9.3 | Send a message while offline | Clear "not sent" message, no crash | | |

## General impressions
| Area | Notes |
|---|---|
| Looks (colours, logo, fonts, spacing) | |
| Words that were confusing | |
| Screens that felt slow | |
| Things you expected but did not find | |
