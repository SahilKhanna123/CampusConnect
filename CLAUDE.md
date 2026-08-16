# CLAUDE.md

Guidance for Claude Code (and other contributors) working in this repository.

## Project Overview

CampusConnect is a trusted community marketplace connecting students, parents, alumni, and travelers moving between a student's home area and college — launching with **Bay Area ↔ UC Irvine**. Users are not permanently a "driver" or "requester": the same account can offer a ride one week and request one the next. Role lives on the action (`Trip`/`Request`), not on the `User`.

The full architecture rationale, options considered, and tradeoffs live in the approved planning doc — read it before making structural changes:
`C:\Users\sahil\.claude\plans\i-am-building-a-wise-sutton.md`

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router, React 19, TypeScript) |
| Backend | Next.js API routes (`src/app/api/**`) — modular monolith, not microservices |
| Database | PostgreSQL |
| ORM | Prisma (`prisma/schema.prisma`) |
| Auth | Supabase Auth (`@supabase/ssr` for server, `@supabase/supabase-js` for client) |
| File storage | Supabase Storage (profile photos only in MVP) |
| Transactional email | Resend (verification + invite emails) |
| Validation | Zod |
| Hosting (target) | Vercel (app) + Supabase (DB/auth/storage) |

Messaging is polling-based (no websockets) in MVP by design — see the plan doc §14.

## Auth Architecture

Supabase Auth owns account credentials (`auth.users`); Prisma's `User` table is a separate, app-owned table keyed on the **same id** (`User.id = auth.users.id`). Nothing in Prisma generates that id — it's always the Supabase-issued UUID, written by app code.

- **Signup** (`src/app/(auth)/sign-up/page.tsx`, client component) calls `supabase.auth.signUp()`, which emails a confirmation link pointing at `emailRedirectTo: {origin}/auth/callback`. There's no separate persona picker or "student" flag — the signup email itself doubles as the university-verification input.
- **`src/app/auth/callback/route.ts`** is where that link lands. It exchanges the PKCE `code` for a session, then — on first arrival for that Supabase user — upserts the matching Prisma `User` row and a `VerificationRecord(type=email, status=verified)`. Reaching this route already proves Supabase confirmed the email, so this is real basic email verification, not a stand-in. **Same trip**, it also checks the confirmed email's domain against `SupportedUniversityDomain`, and if it matches, upserts `VerificationRecord(type=university, status=verified)` right there — someone who signs up with `you@uci.edu` lands on Home already fully verified, no second step. This was a deliberate simplification made mid-build (see git history around the "merge signup and university verification" commit) after the original plan doc's two-step design (separate `.edu` entry post-signup) proved more failure-prone in practice than it was worth.
- **`/verify`** (`src/app/verify/page.tsx`) still exists as a **self-serve fallback**, not the primary path: for anyone who signed up with a personal email and wants to add a university badge later (e.g. an alum, or a student who typo'd their domain at signup). It posts to `/api/verification/university/request` (checks the domain against `SupportedUniversityDomain`, emails a single-use expiring token) and, when landed on with `?token=`, to `/api/verification/university/confirm`. This is the one path where `src/lib/email.ts` actually sends an email — the merged signup flow above never calls it, since Supabase's own confirmation email already covers that trip.
- **`src/middleware.ts`** + **`src/lib/supabase/middleware.ts`** refresh the session cookie on every request — required by the `@supabase/ssr` pattern since Server Components can't write cookies themselves.
- **`src/lib/supabase/client.ts`** / **`server.ts`** are the two Supabase client constructors (browser vs. cookie-reading server); **`src/lib/auth.ts`**'s `getCurrentUser()` is the one place that joins a Supabase session to a Prisma `User` (with `verifications` included) — use it from Server Components/route handlers rather than calling Supabase directly, so verification-badge logic stays in one place (see `isUniversityVerified` / `universityBadgeLabel`).
- Parents still never sign up through `/sign-up` — `src/app/api/family/invite/accept/route.ts` remains their only account-creation path (still a stub; wire it the same way once needed: create the Supabase Auth user, then the Prisma `User` row with matching id).
- Login (`/login`) and sign-out (`POST /api/auth/signout`) are minimal, included because an auth setup isn't testable without them — kept intentionally small.

**Not yet wired:** enforcing the "no posting/requesting/messaging until university-verified" gate inside the `trips`/`requests`/`conversations` API routes — those are still `501` stubs. When implementing them, check `isUniversityVerified(user)` (or the equivalent parent-link-approved check) server-side before any write.

## Architecture Summary

**Core entities** (`prisma/schema.prisma`): `User`, `VerificationRecord`, `SupportedUniversityDomain`, `ParentStudentInvite`, `ParentStudentLink`, `Region`, `City`, `RouteCommunity`, `Trip`, `Request`, `Conversation`/`ConversationParticipant`/`Message`, `Review`, `Report`, `Block`.

**Design principles baked into the schema — do not casually "simplify" these away:**
- **Verification is composable, not singular.** `VerificationRecord.type` (`email` | `university` | `parent_relationship` | `identity`) lets badges exist independently. University verification is a hard product-level gate on student accounts, enforced in application logic — not a schema constraint — so a future `identity` (government ID) verification type slots in without migration.
- **Role lives on the action.** `Trip.travelerId` and `Request.postedById`/`beneficiaryId` don't care whether the user is a student, parent, or alumni.
- **Parents have no independent signup path.** A `ParentStudentInvite` is the only route to creating a parent account, and a parent has zero read/write capability until `ParentStudentLink.status = approved`. Enforce this in every parent-facing API route, not just the UI.
- **Routes are open, not gated.** `RouteCommunity.active` controls what Home *features* by default (Bay Area ↔ UCI), not what can be posted — `Trip`/`Request` can use any `City`, including ones outside the seeded regions (e.g. an airport for a UCI→LAX post).
- **`Request.trip_id` is nullable.** Supports "requester posts first" (a standalone need, not yet matched to a trip) alongside "traveler posts first."
- **Reviews are fraud-resistant by construction.** A `Review` requires `Request.status = completed`, both parties must be participants of that request, and `(requestId, reviewerId)` is unique — enforce these as DB constraints, not just app checks.
- **No payment fields.** `Trip.tripNotes` is free text describing the trip itself (e.g. "driving my own car"), never a contribution/gas-money mechanism — MVP explicitly excludes payment infrastructure.
- **Anti-spam:** cap of 10 new `Trip`/`Request` creations per user per rolling 12-hour window (`src/lib/rate-limit.ts`).

## Directory Structure

```
prisma/schema.prisma          Database schema — source of truth for all entities/relationships
prisma/seed.ts                Launch data: Bay Area / UCI regions & cities, featured RouteCommunity, uci.edu domain
src/app/                      Next.js App Router
  layout.tsx                  Root layout + primary nav + auth status (signed-in name/badge or Log in/Sign up)
  page.tsx                    Home — personalized around the user's featured route
  explore/page.tsx            Explore — browse route communities and trips
  post/page.tsx                Post — Offer a Ride / Need a Ride / Offer Package Space / Need Delivery
  messages/page.tsx           Messages — conversation list
  profile/page.tsx            Profile — badges, rating, history
  family/page.tsx             Parent/student invite + link management
  auth/callback/route.ts       Supabase email-confirm landing — creates the Prisma User + email VerificationRecord
  (auth)/sign-up/page.tsx      Signup — supabase.auth.signUp(), then on to /verify
  (auth)/login/page.tsx        Login — supabase.auth.signInWithPassword()
  verify/page.tsx              University email step: submit .edu address, or confirm ?token=
  api/                         One subfolder per backend module (see below)
  api/auth/signout/route.ts     Sign-out endpoint
src/lib/
  prisma.ts                    Prisma client singleton
  auth.ts                       getCurrentUser() — joins Supabase session -> Prisma User; verification-badge helpers
  email.ts                      Resend wrapper (falls back to console.log without RESEND_API_KEY)
  supabase/client.ts            Browser Supabase client
  supabase/server.ts            Server Supabase client (reads cookies)
  supabase/middleware.ts         Session-refresh helper used by src/middleware.ts
  rate-limit.ts                 Posting rate-limit helper (10 / 12h)
```

**API modules** (`src/app/api/**`), one per backend concern per the modular-monolith design:
`verification/university`, `family/invite`, `family/link`, `trips`, `requests`, `conversations`, `reviews`, `reports`, `blocks`. Route handlers are currently stubs (`501 Not Implemented`) — fill in business logic per the plan doc's lifecycle rules (capacity checks on `Request` accept must be a DB transaction; review creation must validate participant + completed-status server-side, not trust the client).

## Development Commands

```bash
npm install                 # install dependencies
npm run dev                 # start dev server (http://localhost:3000)
npm run build                # production build
npm run start                # run production build
npm run lint                  # lint

npm run prisma:generate      # regenerate Prisma client after schema changes
npm run prisma:migrate       # create + apply a local migration
npm run prisma:studio         # open Prisma Studio (DB browser)
npm run prisma:seed           # seed launch data: Bay Area / UCI regions, cities, the
                               #   featured RouteCommunity, and the uci.edu domain
```

## Environment Variables

Copy `.env.example` to `.env` (never fill real values into `.env.example` itself — it's committed to the repo) and fill in:
- `DATABASE_URL` / `DIRECT_URL` — Postgres connection strings (Supabase provides both). See the comments in `.env.example` for two non-obvious gotchas already hit once: `DATABASE_URL` needs `?pgbouncer=true` (transaction-pooler prepared-statement conflicts), and `DIRECT_URL` should point at the session pooler (port 5432, same host as `DATABASE_URL`) rather than Supabase's plain `db.<ref>.supabase.co` host, which is IPv6-only and unreachable from IPv4-only networks.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client config
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, never expose to the client. Not yet used by any code path — reserved for future admin-style operations that need to bypass row-level security.
- `RESEND_API_KEY` / `EMAIL_FROM` — transactional email for verification + invite links. Optional: without it, `src/lib/email.ts` logs the verification link to the console instead of sending it, which is fine for local dev.

## Explicitly Not MVP

Do not add: general marketplace/housing/roommates/storage/events features, government ID verification, payment/escrow infrastructure, insurance, university partnerships, or group-Uber-fare-splitting. See the plan doc for the full list and rationale.