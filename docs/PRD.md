# Product Requirements Document (PRD)

| | |
|---|---|
| **Product (working name)** | CampusConnect — final name is an open question (see §12) |
| **Document owner** | Sai Ganesh (founder) |
| **Status** | v1.0 — approved direction, 2026-11-18 |
| **Related docs** | [ROADMAP.md](ROADMAP.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DECISIONS.md](DECISIONS.md) |

> **How to use this document.** This is the single source of truth for *what* we are building and *why*.
> Every feature has an ID (`FR-xxx`). The roadmap, code comments and commits refer to these IDs.
> If a requirement changes, edit it here **and** add an entry to [DECISIONS.md](DECISIONS.md) explaining why.
> Do not silently change scope in code.

---

## 1. Problem

- India has a very large young population. The number of graduates has grown sharply since 2021, while entry-level jobs have not kept pace; AI is also reducing some entry-level roles.
- Many people have useful skills — painting, cooking, repairing bikes, babysitting, writing code, decorating for events — that are **not being used to earn money**, because there is no simple, trusted way to connect them with nearby people who need that skill.
- Students in BTech / degree programmes graduate with **no real work experience**, which hurts them in their first interviews.

## 2. Vision

> **Every person has a skill. Give every person a fair, safe way to earn from it — starting with students, who also earn a verified record of real work before their first job.**

## 3. Target users

| Persona | Description | What they need |
|---|---|---|
| **Student worker** (primary) | BTech / degree student, 18–24, smartphone, limited time | Flexible gigs near campus or online; a portfolio and verified ratings they can show recruiters |
| **Local worker** | Non-student with a trade or skill (mechanic, cook, painter, driver) | Steady local customers, fair pricing, getting paid reliably |
| **Household buyer** | Family / individual who needs a task done at home | Find someone trustworthy nearby, compare prices, see reviews |
| **Small business / event buyer** | Shop, startup, function organiser | Hire for a one-off task (catering, website, decor) |

Everyone has **one account** and can act as both **buyer** (hires) and **seller** (works). There are no separate account types.

## 4. Goals and non-goals

### Goals (MVP)
1. A buyer can find and hire a seller for any skill, either by **browsing services** or by **posting a job and comparing quotes**.
2. Both sides can chat, agree on a price and deadline, and track the job to completion.
3. Payments feel real (real gateway screens, real webhook confirmation) while using **test money only**.
4. Every completed job produces two-way reviews and adds to the seller's **verified work record**.
5. Students can verify their student status and get a visible badge.
6. Runs at **₹0 infrastructure cost** (free tiers only).

### Non-goals (MVP) — explicitly out of scope
- Real-money payments and payouts (needs a registered business + gateway KYC).
- Government-ID (Aadhaar/DigiLocker) verification (paid / requires registration).
- Instant "available now / need now" mode (**planned for v1.1**, see FR-300).
- Web app, admin dashboard UI (admin uses API endpoints in MVP), multi-language UI, voice input.
- Recommendation algorithms / AI matching.

## 5. Success metrics (for the pilot city)

| Metric | Target after 8 weeks of pilot |
|---|---|
| Verified student sellers | 200 |
| Jobs completed through the app | 100 |
| % of orders reaching COMPLETED (of those accepted) | ≥ 60% |
| Median time from job post to first quote | ≤ 6 hours |
| Average rating | ≥ 4.2 |
| Safety incidents reported and unresolved > 48h | 0 |

## 6. The three ways to match (core concept)

All three modes share **one pipeline**: `Listing → (Quote) → Order → Chat · Payment · Review → Work record`.

| Mode | Listing type | Who starts | Flow | Release |
|---|---|---|---|---|
| **1. Job request + quotes** | `JOB_REQUEST` | Buyer | Buyer posts "I need X" → sellers send quotes → buyer compares quotes + seller profiles → accepts one → Order | **MVP** |
| **2. Service offer** | `SERVICE_OFFER` | Seller | Seller posts "I offer X at ₹Y" → buyer searches/browses → views profile, portfolio, ratings, reviews → books → seller accepts → Order | **MVP** |
| **3. Instant / nearby** | `AVAILABLE_NOW`, `NEED_NOW` | Either | Short-lived, location-based post ("available to drive in Kukatpally till 8pm" / "need a bike mechanic here now") → nearby users notified → quick accept → Order | **v1.1** |

## 7. Functional requirements

Priority: **M** = must have for MVP · **S** = should have for MVP · **L** = later (v1.1+).

### 7.1 Accounts & identity (FR-0xx)
| ID | Requirement | Pri |
|---|---|---|
| FR-001 | Sign up / sign in with email + password (min 8 chars). | M |
| FR-002 | Sessions: short-lived access token + rotating refresh token; user stays logged in across app restarts; sign out revokes the session. | M |
| FR-003 | Email verification by link/code before posting or ordering. | M |
| FR-004 | **Student verification**: user adds a college email (e.g. `*.ac.in`, `*.edu`, or a whitelisted domain); verifying it grants a **Student** badge. | M |
| FR-005 | Minimum age 18 (self-declared date of birth at signup, with terms acceptance). | M |
| FR-006 | Password reset by email. | S |
| FR-007 | Phone number verification by OTP. | L (provider cost — see §12) |
| FR-008 | Government-ID verification badge. | L |
| FR-009 | Delete my account (anonymise personal data, keep order/review records for the other party). | S |

### 7.2 Profile & work record (FR-05x)
| ID | Requirement | Pri |
|---|---|---|
| FR-050 | Profile: display name, photo, bio, city/area, skills (tags), languages spoken, college (if student). | M |
| FR-051 | Portfolio: up to 10 items (image + title + description) per user. | M |
| FR-052 | Public profile page shows: badges, average rating, number of completed jobs, reviews, active listings, portfolio. | M |
| FR-053 | **Verified work record**: list of completed orders (category, date, rating received, buyer's comment) that the seller can share as a **public link** (e.g. for a résumé). Only data from orders completed in-app appears. | M |
| FR-054 | Personal data never shown publicly: email, phone, exact address. | M |

### 7.3 Categories & search (FR-10x)
| ID | Requirement | Pri |
|---|---|---|
| FR-100 | Fixed category tree (see Appendix A), managed by admin seed data. | M |
| FR-101 | Search listings by keyword, category, city, listing type, price range, **"remote" vs "on-site"**. | M |
| FR-102 | "Near me": sort/filter on-site listings by distance from the user's current location (radius 1–50 km). | M |
| FR-103 | Paginated results (cursor based, 20 per page). | M |
| FR-104 | Sensitive categories (child care, elder care) are hidden/blocked until ID verification exists (FR-008). | M |

### 7.4 Listings (FR-15x)
| ID | Requirement | Pri |
|---|---|---|
| FR-150 | Create/edit/pause/close a **Service offer**: title, description, category, pricing (fixed / per hour / "ask for quote"), price, remote or on-site, service area (city + location pin + radius), up to 5 images. | M |
| FR-151 | Create/edit/close a **Job request**: title, description, category, budget (optional range), remote or on-site, location, preferred date/deadline, up to 5 images. | M |
| FR-152 | Listings are never hard-deleted; closing/deleting hides them but keeps history for orders and reviews. | M |
| FR-153 | A user cannot order their own listing or quote on their own job request. | M |

### 7.5 Quotes — Mode 1 (FR-20x)
| ID | Requirement | Pri |
|---|---|---|
| FR-200 | A seller can send **one active quote** per job request: amount, message, estimated completion date. They may edit or withdraw it until accepted. | M |
| FR-201 | The buyer sees all quotes with each seller's rating, completed-job count, badges and a link to the profile. | M |
| FR-202 | Buyer accepts one quote → an Order is created; other quotes are automatically marked *not selected* and the job request is closed. | M |
| FR-203 | Buyer can reject a quote individually. | S |

### 7.6 Chat (FR-25x)
| ID | Requirement | Pri |
|---|---|---|
| FR-250 | 1-to-1 conversation between buyer and seller, scoped to a listing. Started by the buyer from a listing, or automatically when a quote is sent. | M |
| FR-251 | Real-time delivery when both are online; history persists; unread counts. | M |
| FR-252 | Only the two participants can read or send messages. | M |
| FR-253 | Block a user (no further messages / orders between the two). | M |
| FR-254 | Phone numbers / emails in chat are allowed but a safety banner reminds users to keep payment in-app. | S |

### 7.7 Orders (FR-40x) — the job lifecycle
> FR-30x is reserved for Instant mode (§7.12).

| ID | Requirement | Pri |
|---|---|---|
| FR-400 | An Order is created by (a) buyer booking a Service offer, or (b) buyer accepting a Quote. It stores: agreed amount, requirements, deadline, payment mode, both parties, source listing/quote. | M |
| FR-401 | Order follows the state machine in [ARCHITECTURE.md §6](ARCHITECTURE.md#6-order-state-machine). Any transition not in the table is rejected by the server. | M |
| FR-402 | Seller can accept or decline a booking. (Quote-based orders skip this: the seller already agreed by quoting.) | M |
| FR-403 | Payment mode chosen at order time: **Escrow (wallet)** or **Direct** (paid outside the app, e.g. cash/UPI on completion). | M |
| FR-404 | Seller marks work **submitted**; buyer **approves** (→ completed) or **requests changes** (→ back to in progress, max 3 times). | M |
| FR-405 | Cancellation: either party may cancel before work starts; after work starts, cancellation needs both to agree, otherwise a **dispute** is raised. | M |
| FR-406 | **On-site job check**: a 4-digit start code and finish code shown to the buyer; seller enters them to prove start and finish happened. | S |
| FR-407 | Auto-approve a submitted order if the buyer does not respond within 5 days. | S |
| FR-408 | Every state change is recorded in an order timeline (who, what, when). | M |
| FR-409 | "My orders" (as buyer) and "My jobs" (as seller) lists with status filters. | M |

### 7.8 Wallet & payments — test mode (FR-45x)
| ID | Requirement | Pri |
|---|---|---|
| FR-450 | Every user has a wallet. The ledger (append-only list of money movements) is the source of truth; the displayed balance must always equal the sum of the user's ledger entries and can never go negative. Amounts stored in **paise (integer)**. | M |
| FR-451 | **Add money**: opens the payment gateway's real checkout in **test mode**; wallet is credited only after the server verifies the gateway's signed webhook. | M |
| FR-452 | **Escrow**: for escrow orders the buyer pays the full order amount from the wallet into escrow when the order starts; funds are released to the seller on completion, or refunded on cancellation / dispute decision. | M |
| FR-453 | Wallet history screen (every credit/debit with reason and order link). | M |
| FR-454 | **Withdraw**: simulated (creates a withdrawal record, marked "test mode — no real transfer"). | S |
| FR-455 | The app shows a permanent **TEST MODE** badge on every money screen. | M |
| FR-456 | Platform fee: 0% during pilot (configurable later). | M |

### 7.9 Reviews (FR-50x)
| ID | Requirement | Pri |
|---|---|---|
| FR-500 | After an order completes, **both** sides can leave a 1–5 star rating + comment, once, within 14 days. | M |
| FR-501 | Reviews are only possible for completed in-app orders (no fake reviews). | M |
| FR-502 | Reviewee can post one public reply. | S |

### 7.10 Notifications (FR-55x)
| ID | Requirement | Pri |
|---|---|---|
| FR-550 | In-app notification list for: new message, new quote, quote accepted, booking request, order status change, payment received, review received. | M |
| FR-551 | Mobile push notifications for the same events (Expo push). | S |

### 7.11 Trust & safety (FR-60x)
| ID | Requirement | Pri |
|---|---|---|
| FR-600 | Report a user, listing, message or review (reason + text). | M |
| FR-601 | Admin (role on the account) can review reports, hide content, suspend users, and decide disputes (refund or release) via API. | M |
| FR-602 | Share live trip/job status link for on-site jobs. | L |
| FR-603 | Rate limiting on login, signup and messaging; basic profanity / spam guard on listings. | M |
| FR-604 | Community guidelines + terms + privacy policy screens, accepted at signup. | M |

### 7.12 Instant mode — v1.1 (FR-30x)
| ID | Requirement | Pri |
|---|---|---|
| FR-300 | Post **AVAILABLE_NOW** (skill, area, until time) or **NEED_NOW** (task, location, budget) — expires automatically (max 12 h). | L |
| FR-301 | Users within the radius who match the category get a push notification. | L |
| FR-302 | First accepted response creates an Order (quote-style). | L |
| FR-303 | Map view of nearby available people / needs. | L |

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 **Security** | OWASP API Top 10 addressed; every endpoint and socket event checks the caller is allowed to touch the resource; secrets only in environment variables; server refuses to start if required config is missing. |
| NFR-02 **Privacy** | Collect the minimum personal data; never expose email/phone publicly; account deletion supported (DPDP Act 2023 principles). |
| NFR-03 **Performance** | p95 API latency < 300 ms (excluding free-tier cold start); lists paginated; search uses DB indexes. |
| NFR-04 **Reliability** | Money operations are atomic (single DB transaction) and idempotent (webhooks may arrive twice). |
| NFR-05 **Cost** | ₹0 infrastructure. Any paid service needs founder approval and an entry in DECISIONS.md. |
| NFR-06 **Devices** | Android 9+ and iOS 16+ phones; usable on small screens (360 px wide) and slow 3G/4G networks. |
| NFR-07 **Accessibility** | Text scales with system font size; touch targets ≥ 44 px; colour contrast WCAG AA; screen-reader labels on icons. |
| NFR-08 **Language** | English UI in MVP; strings kept in one file so Hindi/Telugu can be added later. |
| NFR-09 **Observability** | Structured JSON logs with request IDs; `/health` endpoint; errors never leak stack traces to clients. |
| NFR-10 **Quality** | Automated tests for every service; every authorization rule has a test proving user A cannot access user B's data. |
| NFR-11 **Documentation** | Every module has a README; every new file is listed in [FILE_MAP.md](FILE_MAP.md); every session is logged in [DEV_LOG.md](DEV_LOG.md). |

## 9. Constraints
- **Zero budget**: free tiers only (Supabase, Render, Expo, Razorpay test mode, GitHub).
- Free-tier side effects are accepted for the MVP: backend sleeps after idle (first request slow), database pauses after a week of no use.
- Solo founder + AI-assisted development: simplicity beats cleverness.

## 10. Launch plan (pilot)
- **One city first**, with a few colleges as the supply base (pilot city: **Hyderabad — assumed, to be confirmed**, see §12).
- Onboard students on campus first (sellers), then promote to nearby households and small businesses (buyers).
- Expand city by city once a city has steady quotes on most job requests.

## 11. Risks (product level)
| Risk | Mitigation |
|---|---|
| Cold start: no sellers → no buyers | Hyperlocal launch; students as seeded supply; job-request mode lets buyers post even when no listing exists |
| Users move off-platform after first contact | Value of verified work record + reviews only counts for in-app orders |
| Safety incident in a home job | Sensitive categories gated; reports + blocking; start/finish codes; clear guidelines |
| Real payments needed sooner | Payment code isolated behind a gateway interface; switching to live keys is a config + compliance step |
| Legal (gig-worker rules, payments regulation) | Test-money only in MVP; legal review before any real money |

## 12. Open questions (need founder answer — do not guess in code)
| # | Question | Default used until answered |
|---|---|---|
| Q1 | Final product name? | "CampusConnect" |
| Q2 | Pilot city? | Hyderabad |
| Q3 | Which email provider for verification mails (free tier)? | Dev: emails printed to server log. Proposed: Brevo or Resend free tier |
| Q4 | Phone OTP provider? (SMS usually costs money) | Not in MVP |
| Q5 | College email domains accepted for the Student badge? | Any `*.ac.in` / `*.edu` / `*.edu.in` + admin-maintained allow-list |
| Q6 | Platform fee after pilot? | 0% |
| Q7 | Code licence (private/proprietary vs open source)? | Private, all rights reserved (`"private": true`, no LICENSE file) |

## Appendix A — Initial category tree
| Group | Categories |
|---|---|
| Home services | Cleaning, Painting, Plumbing, Electrical, Carpentry, Pest control, Shifting help |
| Repairs | Bike mechanic, Car mechanic, Appliance repair, Mobile/laptop repair |
| Food | Home chef, Tiffin service, Catering, Baking |
| Events | Decoration, Photography, Videography, Catering staff, DJ/Music |
| Tech | Web development, App development, IT support, Data/Excel work |
| Creative | Graphic design, Video editing, Content writing, Social media |
| Education | Tutoring, Music lessons, Coding lessons, Language lessons |
| Driving & delivery | Personal driver, Delivery/pickup |
| Personal | Fitness trainer, Beautician, Tailoring, Mehendi |
| Care (**gated**, FR-104) | Babysitting, Elder care, Pet care |
| Other | Anything else |

## Appendix B — Glossary
| Term | Meaning |
|---|---|
| Listing | Any post: service offer, job request, (later) available-now / need-now |
| Quote | A seller's price offer on a job request |
| Order | The agreed job between one buyer and one seller |
| Escrow | Money held by the platform between "work starts" and "work approved" |
| Ledger | Append-only list of money movements; balances are computed from it |
| Work record | Public, verifiable list of a user's completed in-app orders |
