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

- **Signup** (`src/app/(auth)/sign-up/page.tsx`, client component) starts with a persona picker (Student / Parent / Alumni / Traveler) that is **NOT a stored/permanent role** (USER != ROLE) — it only decides the post-confirmation redirect. Student/Alumni/Traveler all go through the identical `supabase.auth.signUp()` flow described below and land on Home; Parent goes through the same signup mechanics but lands on `/family/connect-student` next (see the Parent/Student Linking section below). The signup email itself doubles as the university-verification input for a Student. Confirmation offers **two independent paths**, both leading to the same place:
  - **Link**: the email's `emailRedirectTo: {origin}/auth/callback` link. `src/app/auth/callback/route.ts` exchanges the PKCE `code` for a session, then calls `syncUserFromAuth`.
  - **OTP code**: the sign-up page also shows a numeric code input right after submitting (Supabase's default email OTP is 8 digits — the input's `maxLength` learned this the hard way, don't hardcode a shorter length). The client calls `supabase.auth.verifyOtp({ email, token, type: 'signup' })` directly (no server route involved in the verification itself), then `POST /api/auth/sync` to run the same `syncUserFromAuth` bridge against the now-cookie-authenticated session.
  - **Why both exist:** some university (and corporate) mail gateways pre-fetch every link in incoming email to scan it, which silently consumes the link's single-use token before the real user clicks it — confirmed in this project via a real test where Supabase's own `confirmation_sent_at`/`email_confirmed_at` were 7 seconds apart, not humanly possible. The link still works fine for domains without that behavior; the code is the reliable fallback, since a scanner can't type a code into a form. **For the code to actually appear in the email, the "Confirm signup" template must be edited in the Supabase dashboard (Authentication → Emails → Templates) to include `{{ .Token }}`** — by default Supabase's template only shows the link.
- **`src/lib/onboarding.ts`**'s `syncUserFromAuth(authUser)` is the single place that bridges a confirmed Supabase Auth user into Prisma — both the link and OTP paths call it, so the Prisma-write logic exists exactly once. It upserts the `User` row and `VerificationRecord(type=email, status=verified)` (reaching either path already proves Supabase confirmed the email), then checks the confirmed email's domain against `SupportedUniversityDomain` and upserts `VerificationRecord(type=university, status=verified)` in the same call if it matches — someone who signs up with `you@uci.edu` lands on Home already fully verified, no second step. **Same call also claims-or-creates their `StudentRecord`** via `claimOrCreateStudentRecord` (see the Parent/Student Linking section) — this is what lets a student who signs up later automatically attach to a record a parent already created. This merged design was a deliberate simplification made mid-build (see git history) after the original plan doc's two-step design (separate `.edu` entry post-signup) proved more failure-prone in practice than it was worth.
- **`/verify`** (`src/app/verify/page.tsx`) still exists as a **self-serve fallback**, not the primary path: for anyone who signed up with a personal email and wants to add a university badge later (e.g. an alum, or a student who typo'd their domain at signup). It posts to `/api/verification/university/request` (checks the domain against `SupportedUniversityDomain`, emails a single-use expiring token) and, when landed on with `?token=`, to `/api/verification/university/confirm`. This is one of two paths where `src/lib/email.ts` actually sends an email (the other is the parent-connection OTP/notice emails below) — the merged signup flow never calls it, since Supabase's own confirmation email already covers that trip.
- **`src/middleware.ts`** + **`src/lib/supabase/middleware.ts`** refresh the session cookie on every request — required by the `@supabase/ssr` pattern since Server Components can't write cookies themselves.
- **`src/lib/supabase/client.ts`** / **`server.ts`** are the two Supabase client constructors (browser vs. cookie-reading server); **`src/lib/auth.ts`**'s `getCurrentUser()` is the one place that joins a Supabase session to a Prisma `User` (with `verifications` included) — use it from Server Components/route handlers rather than calling Supabase directly, so verification-badge logic stays in one place (see `isUniversityVerified` / `universityBadgeLabel`).
- Login (`/login`) and sign-out (`POST /api/auth/signout`) are minimal, included because an auth setup isn't testable without them — kept intentionally small.

**Not yet wired:** enforcing the "no posting/requesting/messaging until university-verified" gate inside the `trips`/`requests`/`conversations` API routes — those are still `501` stubs. When implementing them, check `isUniversityVerified(user)` server-side before any write, and `canActOnBehalfOf(parentUserId, studentRecordId)` (`src/lib/auth.ts`) before letting a parent set a Request's beneficiary — that field doesn't exist on `Request` yet, see the Parent/Student Linking section for the open fork on how it should be added.

## Parent/Student Linking (StudentRecord Architecture)

**Core problem this solves:** a parent may want to use CampusConnect before their student ever creates an account — the old model (`ParentStudentLink` pointing straight at a `User`) made that impossible. `StudentRecord` (`prisma/schema.prisma`) is a student identified by university email that can exist with **no** `User` account at all (`userId` nullable). `ParentStudentLink` now points at `StudentRecord`, not `User` — this is what lets an existing link stay valid automatically once the student eventually signs up, no relinking needed.

- **Duplicate prevention is entirely load-bearing on `StudentRecord.universityEmail` being `@unique`, plus the *pattern* used around it** — see the extensive comments on `claimOrCreateStudentRecord` (`src/lib/onboarding.ts`). Two distinct races matter and are both handled: (1) two concurrent *creates* for the same email (real `@unique`-backed create, with a caught-`P2002`-then-refetch fallback — **not** a naive find-then-create, which would race); (2) two concurrent *claims* of the same unclaimed record (a conditional `updateMany(WHERE userId IS NULL)`, since the `userId @unique` constraint alone only stops one `User` claiming two records, not two claims racing on one record). Both races were verified against the real database during development (concurrent `Promise.all` calls into `claimOrCreateStudentRecord`, confirming a single row results either way) — don't remove that rigor when touching this function; there's no permanent automated test for it yet (no test suite exists in this project), so re-verify by hand if you change it.
- **Every path that can create or claim a `StudentRecord` MUST go through `claimOrCreateStudentRecord`** — never a bespoke find-then-create. Currently two callers: `syncUserFromAuth` (a student's own signup) and `src/app/api/family/parent-link/confirm/route.ts` (a parent's OTP confirm).
- **Parent flow**: `/family/connect-student` (parent-facing, two steps on one page) → `POST /api/family/parent-link/request` (validates the parent's own email is already verified, validates the student email's domain against `SupportedUniversityDomain`, creates a `ParentStudentOtpRequest` — an *ephemeral* pending row, deliberately not touching `StudentRecord` yet so a typo'd email never leaves an orphan record — and emails an 8-digit code to the **student's** inbox, not the parent's) → `POST /api/family/parent-link/confirm` (validates the code against a hash with attempt-limiting, then calls `claimOrCreateStudentRecord` and creates `ParentStudentLink(status=otp_verified)`).
- **Why a custom OTP instead of Supabase's**: Supabase's OTP is inherently tied to the auth account being signed into/created for that email — it can't send a code to a third party's inbox on someone else's behalf. `src/lib/otp.ts` + the `request`/`confirm` routes reuse the exact pattern already built for `/api/verification/university/{request,confirm}`, just with a short numeric code (hashed at rest — unlike the long hex tokens elsewhere, an 8-digit code is meaningfully brute-forceable, hence `OTP_MAX_ATTEMPTS` + a ~20 min expiry) instead of a link.
- **Security tradeoff, resolved**: OTP possession alone (`otp_verified`) already lets the parent post a Request "for" the student — it does **not** wait for a further explicit student approval first. This was deliberate, not an oversight — see the long comment on `ParentStudentLink` in `prisma/schema.prisma` for the full reasoning (short version: nothing else a parent can do is gated by this link at all, so the actual risk at `otp_verified` is reputational/representation harm from a public post, not private data exposure — and blocking all on-behalf-of posting until an eventual, maybe-never-happens student signup would defeat the parent-first product goal). Required mitigations, not optional: (1) a distinct notice email to the student at link-creation time with a **no-account-required objection link** (`/family/link-objection` + `POST /api/family/link-objection/[token]/reject`) that immediately revokes; (2) that objection page requires an explicit button click before revoking, **never** auto-acts on page load/GET — email security scanners pre-fetch links (this bit us for real earlier in this project's own signup flow, see the OTP-vs-link section above) and an auto-revoking GET would let a scanner falsely kill a legitimate connection; (3) a revoked link cannot be silently re-established by the same parent re-running the OTP flow (`confirm/route.ts` checks for and rejects this).
- **Full account separation, always**: `ParentStudentLink` is a verification/relationship *fact*, never an access grant. A parent's `Request` always has `postedById = the parent's own User.id`; nothing about the link makes the student a `ConversationParticipant`, gives the parent message access, or merges the two accounts in any way, even after the student claims their record. Don't "helpfully" add implicit cross-visibility later — if a claimed student needs visibility into what's been posted for them, that's a filtered read of `Request` rows only, never a join into `Conversation`/`Message`.
- **`approved` status is not yet reachable** — `src/app/api/family/link/[id]/approve/route.ts` (the student's explicit upgrade from `otp_verified` to full trust) is still a stub. Also still stubs: `src/app/api/family/invite/route.ts`/`invite/accept/route.ts`, the *other* direction (a student who already has an account invites a parent by email) — that direction should skip straight to `approved` on accept, not `otp_verified`, since the student's own initiating action is already unambiguous consent (asymmetric from the parent-initiated OTP flow on purpose).
- **Open, not yet decided**: how `Request` should reference a `StudentRecord` beneficiary — narrow replacement of the existing `beneficiaryId (User)` field, or an additive second nullable FK alongside it. Do not silently pick one when implementing the Post flow; it was deliberately left as a fork for a product decision.

## Architecture Summary

**Core entities** (`prisma/schema.prisma`): `User`, `VerificationRecord`, `SupportedUniversityDomain`, `StudentRecord`, `ParentStudentOtpRequest`, `ParentStudentInvite`, `ParentStudentLink`, `Region`, `City`, `RouteCommunity`, `Trip`, `Request`, `Conversation`/`ConversationParticipant`/`Message`, `Review`, `Report`, `Block`.

**Design principles baked into the schema — do not casually "simplify" these away:**
- **Verification is composable, not singular.** `VerificationRecord.type` (`email` | `university` | `parent_relationship` | `identity`) lets badges exist independently. University verification is a hard product-level gate on student accounts, enforced in application logic — not a schema constraint — so a future `identity` (government ID) verification type slots in without migration.
- **Role lives on the action.** `Trip.travelerId` and `Request.postedById`/`beneficiaryId` don't care whether the user is a student, parent, or alumni.
- **A `User` account and a `StudentRecord` are separate concepts.** A `StudentRecord` can exist with no `User` at all (a parent created it first) — see the Parent/Student Linking section below. Parents now fully self-signup (no invite required), but `ParentStudentLink` is a verification fact, never an access grant: a parent's own capabilities are never blocked by link status, only the narrow "post a Request for this student" capability is, and even that isn't blocked pending some distant future approval — see the security tradeoff writeup below before changing this.
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
  family/connect-student/page.tsx  Parent-facing: enter student email -> enter OTP code -> linked
  family/link-objection/page.tsx    Public, no-auth: student's "this wasn't me" revoke landing page
  auth/callback/route.ts       Supabase email-confirm landing — creates the Prisma User + email VerificationRecord
  (auth)/sign-up/page.tsx      Signup — persona picker, then supabase.auth.signUp()
  (auth)/login/page.tsx        Login — supabase.auth.signInWithPassword()
  verify/page.tsx              University email step: submit .edu address, or confirm ?token=
  api/                         One subfolder per backend module (see below)
  api/auth/signout/route.ts     Sign-out endpoint
  api/family/parent-link/request/route.ts   Parent submits student email -> OTP sent to student
  api/family/parent-link/confirm/route.ts   Parent submits code -> StudentRecord + ParentStudentLink created
  api/family/link-objection/[token]/reject/route.ts   Public: revoke via the student notice email's link
src/lib/
  prisma.ts                    Prisma client singleton
  auth.ts                       getCurrentUser() — joins Supabase session -> Prisma User; verification-badge + canActOnBehalfOf helpers
  onboarding.ts                  syncUserFromAuth() + claimOrCreateStudentRecord() — the one place Prisma User/StudentRecord rows get created from a confirmed email
  otp.ts                         Numeric-code generation/hashing for the parent->student OTP flow
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