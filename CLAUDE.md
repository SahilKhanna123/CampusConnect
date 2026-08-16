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
  layout.tsx                  Root layout + primary nav (Home/Explore/Post/Messages/Profile)
  page.tsx                    Home — personalized around the user's featured route
  explore/page.tsx            Explore — browse route communities and trips
  post/page.tsx                Post — Offer a Ride / Need a Ride / Offer Package Space / Need Delivery
  messages/page.tsx           Messages — conversation list
  profile/page.tsx            Profile — badges, rating, history
  family/page.tsx             Parent/student invite + link management
  (auth)/sign-up/page.tsx      Signup (student university-email verification required inline)
  verify/page.tsx              University email verification landing (token confirm)
  api/                         One subfolder per backend module (see below)
src/lib/
  prisma.ts                    Prisma client singleton
  supabase/client.ts            Browser Supabase client
  supabase/server.ts            Server Supabase client (reads cookies)
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

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` / `DIRECT_URL` — Postgres connection strings (Supabase provides both)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client config
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, never expose to the client
- `RESEND_API_KEY` / `EMAIL_FROM` — transactional email for verification + invite links

## Explicitly Not MVP

Do not add: general marketplace/housing/roommates/storage/events features, government ID verification, payment/escrow infrastructure, insurance, university partnerships, or group-Uber-fare-splitting. See the plan doc for the full list and rationale.