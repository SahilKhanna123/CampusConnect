# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project Overview

CampusConnect is a trusted community marketplace connecting students, parents, alumni, and travelers moving between a student's home area and college — launching with **Bay Area ↔ UC Irvine**. Users are not permanently a "driver": role lives on the action (`Trip`), not on the `User`. There is no standalone "need a ride" posting flow — only offering a ride/split/package space is supported (see Trip Categories & Package Carrying below for why the "Need" flow was removed).

Full architecture rationale: `C:\Users\sahil\.claude\plans\i-am-building-a-wise-sutton.md` — read before structural changes.

## Tech Stack

Next.js 15 (App Router, React 19, TS) · Next.js API routes (`src/app/api/**`, modular monolith) · PostgreSQL + Prisma (`prisma/schema.prisma`) · Supabase Auth (`@supabase/ssr` server, `@supabase/supabase-js` client) · Supabase Storage (profile photos only) · Resend email · Zod validation · Vercel + Supabase hosting. Messaging is polling-based (no websockets), by design.

## Auth Architecture

Supabase Auth owns credentials (`auth.users`); Prisma's `User` is a separate app-owned table keyed on the **same id** (`User.id = auth.users.id`), always the Supabase-issued UUID.

- **Signup**: persona picker (Student/Parent/Alumni/Traveler) is **not stored**, only decides post-confirmation redirect. Student/Alumni/Traveler → `supabase.auth.signUp()` → `/onboarding`. Parent → same mechanics → `/family/connect-student`. Signup email doubles as university-verification input for students. Two independent confirmation paths:
  - **Link**: `emailRedirectTo: {origin}/auth/callback`; `src/app/auth/callback/route.ts` exchanges the PKCE code, calls `syncUserFromAuth`.
  - **OTP code**: Supabase default is **8 digits** — don't hardcode shorter. Client calls `supabase.auth.verifyOtp({email, token, type:'signup'})` then `POST /api/auth/sync`.
  - Both exist because some university mail gateways pre-fetch links, silently consuming the single-use token before the user clicks. **The Supabase "Confirm signup" email template must include `{{ .Token }}`** (dashboard: Authentication → Emails → Templates) or the code never appears.
- **`src/lib/onboarding.ts`**'s `syncUserFromAuth(authUser)` is the single bridge from confirmed Supabase user → Prisma — both paths call it. Upserts `User` + `VerificationRecord(email, verified)`; checks domain against `SupportedUniversityDomain`, upserts `VerificationRecord(university)` if matched; **claims-or-creates `StudentRecord`** via `claimOrCreateStudentRecord`.
- **`/verify`**: self-serve fallback for adding a university badge later. `POST /api/verification/university/{request,confirm}`.
- **`src/middleware.ts`** + **`src/lib/supabase/middleware.ts`** refresh the session cookie every request (`@supabase/ssr` requirement).
- **`src/lib/auth.ts`**'s `getCurrentUser()` joins the Supabase session to Prisma `User` (incl. `verifications`, `parentLinksAsParent.studentRecord`, `homeCity`, `studentRecord`) — use everywhere instead of calling Supabase directly.

**Two entry gates, each enforced twice:**
- **Parent accounts (`signedUpAsParent=true`)**: blocked from every page except `/family/connect-student`/`/family/invite/accept` until `hasLinkedStudent(user)`. `layout.tsx` does the DB-backed check (first load only — App Router layouts don't re-execute on same-layout client nav). `supabase/middleware.ts` (`updateSession`) re-checks on every navigation via a denormalized `hasLinkedStudent` boolean on Supabase `app_metadata` (middleware can't query Prisma directly — this Next.js version silently drops `runtime:"nodejs"` middleware). Set `true` in `parent-link/confirm`, cleared in `link-objection/[token]/reject` when a revocation leaves zero links. Prisma's `ParentStudentLink` rows remain the real source of truth; `app_metadata` is just a fast edge-readable copy.
- **University-verification is deliberately deferred**: `/api/trips`/`/api/package-posts` don't check `isUniversityVerified` yet (keeps testing unblocked). Every Trip post is self-authored (`travelerId` is always the poster) — there is no beneficiary/on-behalf-of-student concept anywhere in this schema.

## Parent/Student Linking (StudentRecord Architecture)

A parent may use the app before their student signs up. `StudentRecord` = a student identified by university email, can exist with **no** `User` (`userId` nullable). `ParentStudentLink` points at `StudentRecord`, not `User` — stays valid once the student eventually signs up.

- **Duplicate prevention relies on `StudentRecord.universityEmail @unique` plus the pattern in `claimOrCreateStudentRecord`** (`src/lib/onboarding.ts`, heavily commented — read before touching). Two races handled: concurrent *creates* (real unique-backed create + caught-P2002-refetch, never find-then-create) and concurrent *claims* of one unclaimed record (conditional `updateMany(WHERE userId IS NULL)`). Verified via real concurrent `Promise.all` during development; no automated DB test yet — re-verify by hand if changed. Only two callers: `syncUserFromAuth` and `parent-link/confirm`.
- **Parent signup skips email confirmation**: `/api/auth/parent-signup` uses the admin API (`supabase/admin.ts`, service-role) with `email_confirm: true` — scoped to just that route; the student flow stays fully rigorous since a student's email confirmation *is* their university verification.
- **Parent flow**: `/family/connect-student` → `POST /api/family/parent-link/request` (validates domain, creates ephemeral `ParentStudentOtpRequest`, emails an 8-digit code to the **student's** inbox) → `POST /api/family/parent-link/confirm` (hashed code, attempt-limited, calls `claimOrCreateStudentRecord`, creates `ParentStudentLink(otp_verified)`). Custom OTP (`src/lib/otp.ts`) rather than Supabase's, since Supabase's OTP can't target a third party's inbox.
- **No on-behalf-of-student posting exists at all**: there is no beneficiary concept anywhere in this schema — `Trip.travelerId` is always the poster's own id, parent or otherwise. This used to be a live security tradeoff back when a standalone `Request` model existed with a separate `beneficiaryId`, letting a parent post "for" the student the moment `otp_verified` was reached; that `Request` model (and the whole "Need" posting flow it powered) has since been removed entirely (see Trip Categories & Package Carrying below), which removed the tradeoff along with it. `ParentStudentLink` today is a pure verification/relationship *fact*, not an access grant of any kind — it doesn't make the student a `ConversationParticipant` or merge the two accounts in any way. The student notice email with the no-account-required objection link (`/family/link-objection` → `POST .../reject`) still exists as a courtesy notification of the link itself, not as a revoke-a-live-capability safety valve.
- **Both directions implemented**: `POST /api/family/link/[id]/approve` (student's otp_verified→approved) and the reverse invite flow (`/api/family/invite`, see Family Page).

## Parent Link Approval

`POST /api/family/link/[id]/approve`: student's `otp_verified`→`approved` upgrade for parent-initiated links (invite-direction links are already `approved`). Caller must be `link.studentRecord.userId` (403); only `otp_verified` can be approved (400 otherwise), via a guarded `updateMany`. No `VerificationRecord` written (no student-side badge UI exists). Notifies the parent (`parent_link_approved` → `/profile`).

## Family Page

`/family` is the **student's** hub — distinct from the read-only parent-facing "Linked Students" list on `/profile`. A parent visiting `/family` is pointed to `/profile`.

- **"Parents Connected to You"**: every link on the caller's `StudentRecord`, `ApproveLinkButton` (confirm()-gated) on `otp_verified` rows only. Reuses `ConnectionRequest`'s status-badge palette.
- **Student-initiated invite** (`ParentStudentInvite`, `POST /api/family/invite`): caller must be `isUniversityVerified` (not just "has a StudentRecord" — here the *student* is vouching). Sends to the parent's inbox, 32-byte hex token, 7-day expiry, no code needed (asymmetric from the OTP flow by design). Re-inviting clears only the old **pending** invite, never accepted/revoked history. **Rate limited**: `canSendFamilyInvite` caps 5/24h (429) — each invite is a real email send to an arbitrary address, real spam/abuse cost.
- **`/family/invite/accept?token=...`**: requires sign-in as the **exact** invited email. Accept POST requires an explicit click, never fires on load (same email-scanner reasoning, more critical here since it grants `approved` directly).
- **Exempt from the parent-link gate**: `/family/invite/accept`, alongside `/family/connect-student` (kept in sync in `layout.tsx` and `supabase/middleware.ts`).
- **`POST /api/family/invite/accept`** creates the link at `status=approved` directly (the invite itself is unambiguous consent). Same revoked-link guard as `parent-link/confirm`. Notifies the student on acceptance (`family_invite_accepted` → `/family`).

## Profile & Onboarding

- **Student** (`/onboarding`): name (prefilled), optional photo, home city, optional `major`/`year`/`travelPreferences`/`lookingFor` (`String[]`, `src/lib/lookingFor.ts`). University name/badge always derived read-only, never entered here. **Soft nudge, not a hard gate** — `layout.tsx` shows a banner (`hasCompletedOnboarding`) but never blocks navigation.
- **Parent** (step 0 of `/family/connect-student`, skipped if already onboarded): name, photo, home city, phone (private), `linkedStudentName` (free text, self-declared, public — cleared server-side the moment the parent's last link is removed, since it names a third party who isn't the one publishing it).
- **Shared form**: `ProfileEditForm.tsx`, gated by `isParent` prop, all submit to `PATCH /api/profile` (multipart/form-data, handles photo). `onboardingCompletedAt` set once.
- **Public vs. private**: `src/lib/profile.ts`'s `getPublicProfile(userId)` is the single hand-picked allowlist (never `include`) shared by `GET /api/profile/[userId]` and `/profile/[userId]`. Public: name, photo, university, general home area, `major`/`year`/`travelPreferences`/`lookingFor`, `linkedStudentName`, badges. Never returned: email, phone, `StudentRecord`, `ParentStudentLink` rows, `signedUpAsParent`. Requires login to view.
- **Photos**: Supabase Storage bucket `avatars` (public-read, 5MB, JPEG/PNG/WebP) — doesn't exist by default, create via `npm run supabase:setup-storage`.

## Trip Categories & Package Carrying (Offer-Only)

CampusConnect only supports **offering** something — a ride (your own car), a split Uber/Lyft seat, or package space on your route. There is no standalone "need a ride"/"need something delivered" posting flow: a `Request` model used to power a parallel "Need" side of `/post` (post a standalone ask, get matched to a Trip later), and `PackagePost` used to carry a `needing_delivery` counterpart to its `offering_space` kind — **both were removed entirely** per direct product decision ("Need" is "essentially not useful... and over-complicates it"). Only 3 offer actions remain on `/post`.

- **Trips and Uber-sharing share one `Trip` model with `category` (`TripCategory`: `personal_car`|`uber_share`)**, not two models — `ConnectionRequest`/`SeatOffer`/`Conversation` all hold a scalar `tripId` FK (no polymorphic relation in Prisma); splitting would need a second FK everywhere plus an "exactly one of" check on every write. A `category` column costs one enum field with zero downstream logic changes. Reverses an earlier "not a group-Uber-splitting" MVP exclusion — explicit instruction, not scope creep.
  - `uber_share`-only fields: `estimatedFarePerSeat Decimal?` (informational, never real payment), `meetingPoint String?`. `seatsTotal`/`seatsRemaining` shared by both.
- **`PackagePost` (standalone, deliberately minimal)** — no structured fields, no accept/decline handshake, no capacity counter, never creates `ConnectionRequest`/`SeatOffer`, **no review mechanism**. Fields: origin/destination (City or `destinationText`), `date`/`time`/`flexibleTime`, one optional `notes @db.VarChar(300)`, `studentsOnly`, `status` (`open`→`completed`/`cancelled`, poster marks done manually). **No `kind` field** — every `PackagePost` is implicitly an offer of space, since `needing_delivery` was removed.
  - **Only interaction: messaging.** `PackageMessageForm.tsx` mirrors `RegisterInterestForm`, posts `{packagePostId, body}` to `POST /api/conversations`.
  - **`Conversation.tripId` is nullable**, paired with nullable `packagePostId` — exactly one required, enforced app-level in `findOrCreateConversationForPost` (`src/lib/messaging.ts`).
  - **API**: `src/app/api/package-posts/` (list/create/get/edit/cancel/complete). **Pages**: `/post/package`, `/package-posts/[id]`+`/edit`, a third `/my-posts` section.
  - `canCreatePost` counts `PackagePost` toward the same shared 10-per-12h cap as `Trip`.
- **`/post`** has 3 entry actions, a single list (no Offer/Need split): Offer Package Space (primary weight) / Split an Uber/Lyft (secondary) / Offer a Ride (my car) (tertiary). First two → `/post/trip?category=`; package → `/post/package`. Update this doc before adding a 4th.
- **`Review` was removed along with `Request`**: `Review.requestId` was a required FK with no Trip-based alternative, so it had no way to survive Request's removal. There is no review/rating feature anywhere in the app.
- **Browsing**: `PackagePost` is browsable on `/explore` (a category toggle defaulting to Packages — see the Explore Page section) and previewed on Home's package-weighted feed, but `personal_car`/`uber_share` still mix together with no visual split between the two Trip categories on either page.

## Trip Posting System

- **Entry point**: `/post` → `TripPostForm.tsx`/`PackagePostForm.tsx` (create+edit, full-state submission). Shared Zod schemas in `src/lib/postSchemas.ts` (can't live in a `route.ts` — Next rejects non-HTTP-method exports there).
- **Ownership** enforced in application code, not RLS (RLS enabled schema-wide with zero policies — locks down Supabase's REST API only; Prisma bypasses it). `getCurrentUser()` then explicit `travelerId` comparison on every PATCH/DELETE.
- **Delete is a soft cancel** (`status → cancelled`).
- **Pages**: `/post/trip`; `/my-posts` (Upcoming/History via `?tab=history`); `/trips/[id]` (detail, Edit/Cancel owner-only) + `/edit`.
- **Past-due status is derived, never persisted**: `src/lib/postStatus.ts`'s `tripDisplayStatus` computes "expired" at read time.
- **Write-in destination**: `destinationCityId` nullable + paired `destinationText String?` — pick a listed `City` or type one in, never both, via `.refine()` in `postSchemas.ts` (app-level, not a DB constraint). Origin stays City-only.
- **Students-only visibility** (`Trip.studentsOnly`): "student" = `hasStudentRecord(user)` (claimed `StudentRecord`), not "didn't sign up as parent." Enforced at every layer: creation/edit reject `true` from a non-student (403); `/explore`/Home add `{studentsOnly:false}` for non-students; detail pages `notFound()` for a non-student non-owner (404, don't-leak-existence); `POST /api/connection-requests`/`/api/conversations` each re-check (403).
  - **Lesson from a real audit**: `GET /api/trips/[id]` etc. were left unauthenticated on the reasoning "no UI consumes it" — **wrong**: unreferenced by UI still means live and directly callable, and it let anyone bulk-enumerate every trip including `studentsOnly` ones. Fixed with `getCurrentUser()` → 401 + the same filtering. **"No UI consumes this yet" only justifies deferring a feature, never skipping authorization on a route that's already live.**

## Home Page

`/` forks on `getCurrentUser()` — signed-in gets a narrow featured-corridor feed; logged-out gets `LandingPage()` (hero + CTAs + preview grid), not a redirect (deliberate reversal of an earlier "Home stays fully gated" decision).

- **Signed-in**: `getFeaturedRoutePairs(user)` (`src/lib/geo.ts`) tries the user's personal route, falls back to every `active` `RouteCommunity` row if none derivable. Heading: "Your route: X ↔ Y" vs. "Featured route: X ↔ Y". Trip offers only, same as Explore.
- **Logged-out**: same public-preview rules as Explore's logged-out mode (Trip offers only, `studentsOnly:false`, no self/blocked exclusion, interactive buttons swapped for `<Link href="/sign-up">`). Scoped to the active `RouteCommunity`. Hero CTAs: "Get started free" → `/sign-up`, "Browse listings" → `/explore`.

## Explore Page

`/explore` — server component querying Prisma directly, merges upcoming `Trip` offers + open `PackagePost` listings from **other** users. There is no standalone ride `Request` to browse — that flow was removed entirely (see Trip Categories & Package Carrying above).

- **Category toggle** (`ExploreViewTabs.tsx`, client component, `?view=all|rides|packages`): **defaults to `packages`** (the one value never written into the URL, "only show what's non-default" convention) — per product decision, package delivery carries the majority of this page's visual weight, not an equal split. `view=rides` shows Trip offers only (both Trip categories mixed, no visual split between them). `view=all` interleaves package and ride rows at a **fixed 2:1 ratio** (`interleavePackagesAndRides()` in `explore/page.tsx`) rather than a plain chronological merge — ~67%, within the requested 60-70% range — so ride volume doesn't drown out packages the way an unweighted merge would. Implemented with `router.replace()`, not a plain `<Link>`, for the same reason "Clear filters" already had to be (see below) — reuses the existing `.subtabs`/`.subtab` pill CSS (Upcoming/History, Received/Sent) rather than inventing new tab styling.
- **No Type filter**: with only one kind left per view (Trip offers on Rides, offer-only `PackagePost`s on Packages), there's nothing left to filter between within a view — removed along with `Request`/`PackagePost.kind`.
- A `PackagePost` card reuses `ExploreCard.tsx`'s existing offer kind-branching (a second `"package"` kind on the `ExploreCardPost` union), not a separate component — same shell, map, and coordinate-resolution pipeline as rides, just with a "View details" footer link (no owner-gated action) and a static 📦 badge instead of a seats badge. `PackagePostCard.tsx` (Home's own lighter package card, no coordinates since Home has no map) is unrelated and unchanged.
- Excludes caller's own posts and anything not `status:"upcoming"`/`"open"`, further filtered via `tripDisplayStatus` (`PackagePost` has no derived display status — `status:"open"` alone is the DB-level filter).
- **Filters** (`originCityId`, `destinationCityId`, `date`) live in URL query params. `ExploreFilters.tsx` auto-submits via `router.replace()` — never a native GET (full reload). "Clear filters" also uses `router.replace()`, never a plain `<Link>` (a `<Link href="/explore">` was tried and confirmed broken — Next's prefetch cache served a stale filtered RSC payload) — and preserves the active `view` rather than resetting to the default. The `<form>` is keyed on a string of the current filter values to force remount (and reset uncontrolled fields) when the URL changes from outside this component.
- **Route map** (`ExploreMapView.tsx`/`RouteMap.tsx`): real Leaflet + OSM tiles (chosen over Google Maps to avoid its billing-account requirement), `next/dynamic({ssr:false})` since Leaflet touches `window` at load. `CircleMarker`s, not the default pin (avoids a known webpack asset-path break). Hovering a card re-fits the viewport to just that route. Tiles muted via CSS grayscale filter. Ambient markers are gray dots with always-visible labels; the hovered route's endpoints get distinct green/blue styling. Real coordinates from `City.latitude`/`longitude` (seeded) or geocoded via Nominatim and cached in `GeocodeCache` — resolved **sequentially**, never `Promise.all` (Nominatim's usage policy caps ~1 req/sec). An unresolvable place is simply not plotted, never guessed.
- **Card layout ported pixel-for-pixel** from a reference Figma Make export at `C:\Users\sahil\Desktop\UI_Instructions\src\App.tsx` — see memory `campusconnect-ui-reference-folder`.
- **Poster stats line** ("UC Irvine '26 · 11 trips") is real computed data — `resolvePosterStats()` batches 1 `groupBy` query per page load (never per-card), completed `Trip` count only. No rating/star figure — that depended on the now-removed `Review` model.
- **`note` field** (`tripNotes`/`notes`) renders as an italicized quote at the card bottom when present, omitted otherwise — never fabricate missing data.
- **`.site-main` max-width is 1600px site-wide** (`globals.css`, up from 1280px) — the nav bar spans full viewport with no cap, so a narrower content cap created a visible mismatch. **This is a standing UI preference for the whole project** (confirmed twice via direct feedback) — default to using available viewport width. See memory `campusconnect-use-full-page-width`.
- **Paginated**, `PAGE_SIZE = 4`: feed sliced *before* per-post enrichment so unrendered posts never get enriched. Plain `?page=` param.
- **`loading.tsx`/`error.tsx`** App Router file conventions — first use of this pattern in the project; prefer it over a bespoke spinner/boundary elsewhere.
- **Logged-out public preview**: `/explore`, `/trips/[id]`, `/package-posts/[id]` are the one deliberate exception to "every page requires login" — `getCurrentUser()`'s `null` is branched on, never redirected. A `studentsOnly` detail page still 404s (never a special "log in" message). `ReportButton`/`BlockButton` absent (not sign-up links); real interaction controls swapped for `<Link href="/sign-up">` with the **same button label**. Interaction API routes needed zero changes (already 401'd with no session).

## Messaging

`Conversation`/`Message`, scoped to `(tripId, counterpart)` — lets a prospective requester message before committing to a formal request. Deliberately does **not** create a `ConnectionRequest` or touch `seatsRemaining` — "Register for a seat" is a button label, not a real reservation.

- **Entry point**: `RegisterInterestForm.tsx` on `/trips/[id]`, non-owner viewers, `tripDisplayStatus==="upcoming"` and `seatsRemaining>0`. Reveals a prefilled composer on click.
- **`POST /api/conversations`**: `{tripId, body}` or `{packagePostId, body}`. Finds-or-creates a `Conversation` + first `Message`. Rejects messaging your own post or a non-actionable post. Plain find-then-create — a duplicate thread is a UX nuisance, not a race worth hardening.
- **`GET/POST .../[id]`, `.../[id]/messages`**: 404 (not 403) for a non-participant — don't leak thread existence.
- **Polling**: `MessageThread.tsx` re-fetches `?since=<lastTimestamp>` every 4s.
- **Rate limited**: `canSendMessage` caps 30/10min rolling window (429) — prevents scripted flooding of one victim's thread. Global per-sender.
- **Unread**: `ConversationParticipant.lastReadAt`. `isConversationUnread` (`messaging.ts`) is the single rule, shared by `/messages` and the nav badge. `POST .../[id]/read` fires on mount and after any poll with new messages.
- **`findOrCreateConversationForPost`** is the one conversation-creation path — also reused by `connection-requests/[id]/accept`.
- **Archive/Delete live on `ConversationParticipant`**, never `Conversation` — per-user view preference, never shared/destructive. `archivedAt` is sticky (new message never auto-clears). `deletedAt` **is** auto-cleared the moment either party sends a new message (via `findOrCreateConversationForPost` on reuse, or independently in the messages route).

## Connection Requests

A formal gated lifecycle (`ConnectionRequest`: `pending`→`accepted`/`declined`/`cancelled`) layered **on top of**, not instead of, ungated Messaging — genuinely different products ("ask a quick question" vs. "ask permission before a thread exists"). Both converge on the same `Conversation`.

- **`ConnectionRequestButton.tsx`** on `/trips/[id]` and every offer `ExploreCard` (batched query). Reflects only a **live** (pending/accepted) request — declined/cancelled reverts to a plain clickable button.
- **`POST /api/connection-requests`** (`{tripId}`): `requesterId`/`recipientId` always derived server-side, never from the body — that's the actual spoofing prevention. Rejects own trip, non-upcoming trip, duplicate pending (409).
- **`.../{accept,decline,cancel}`**: accept/decline require `recipientId===caller`; cancel requires `requesterId===caller` (inverse check). All require `status==="pending"` first. 403 (not 404) — closer to `Trip` ownership than to a private-thread model. Only `accept` touches `Conversation`.
- **`/connections`** (Received default, `?tab=sent`). Accept `router.push()`es straight to `/messages/[conversationId]` rather than staying on the page.
- **No DB uniqueness on `(tripId, requesterId)`** — would block the intentional "try again after a decline" flow.
- **Required note** (`ConnectionRequest.message`): composer has a required textarea, enforced client + Zod. If accepted, seeded as the first `Message`.

## Notifications

`Notification`, one row per event, in-app only. `createNotification()` (`src/lib/notifications.ts`) is the single creation path.

- **Fields**: `type`, `title`, `message` (written at creation, not re-derived), `relatedId` (untyped, points at whatever `type` implies), `isRead`, `createdAt`.
- **`notificationLink()`**: one synchronous `type`→URL mapper, no DB access.
- **`/notifications`**: server component, capped at 100 rows. `NotificationItem.tsx` fires fire-and-forget `POST .../[id]/read` before navigating.
- **Security**: `.../[id]/read` uses `updateMany(WHERE id, userId)`-as-authorization (0 rows → 404). `.../read-all` scopes to the caller.
- **Nav bell**: separate count from Messages badge — folding them would double-count or drop one kind.

## Trip Management (Trip Lifecycle)

`Trip`: `upcoming` → `completed`|`cancelled`, with owner-facing Edit/Cancel/Mark Completed.

- **`TripStatus.active` renamed `upcoming`** via `ALTER TYPE ... RENAME VALUE` (metadata-only).
- **Edit**: only from `upcoming` (400 in route, redirect in edit page).
- **Cancel** (`DELETE /api/trips/[id]`): only from `upcoming`. One `$transaction`: sets `status=cancelled`, bulk-flips every **pending** `ConnectionRequest` to `cancelled`, leaves every **accepted** one and its `Conversation` fully intact, notifies affected requesters (`trip_cancelled`).
- **Mark Completed** (`POST .../complete`): owner-only, `upcoming`-only, `confirm()`-gated. Does **not** touch `ConnectionRequest`. Consequence: `connection-requests/[id]/accept` re-checks `tripDisplayStatus==="upcoming"`, which is what actually blocks accepting against a completed trip.
- **Trip detail**: owner actions show only while `isUpcoming`. An already-**accepted** connection keeps "Connected — View messages" even past `isUpcoming` (only a *fresh* request is blocked).
- **`/my-posts`**: Trips' "Upcoming" bucket uses `tripDisplayStatus==="upcoming"`, not date. History sub-groups Completed/Cancelled/Past due.

## Trip Participants (Seat Confirmation)

Turns an accepted `ConnectionRequest` into a confirmed seat, decrementing `seatsRemaining`.

- `ConnectionRequest.seatConfirmedAt` (nullable), set/cleared only inside the same transaction as an opposite `seatsRemaining` decrement/increment.
- **`POST .../[id]/confirm-seat`**: owner-only, requires `accepted` + `seatConfirmedAt` null + `upcoming`. One `$transaction`: `updateMany` guarded on `seatsRemaining:{gt:0}` (0 rows → throw, nothing written — the overbooking guard). Notifies the requester (`trip_seat_confirmed`).
- **`.../release-seat`**: owner-only, undoes a confirm — clears + increments back. No notification (bookkeeping correction, not an event).
- **Trip detail**: owners see a "Participants" section merging accepted `ConnectionRequest`s **and** `SeatOffer`s (`ConfirmSeatButton.tsx`, generalized via `{id, kind}`).
- **Trip edit**: now computes consumed seats via `getConfirmedRiderCounts` (every mechanism that can hold a seat) and rejects the edit (400) if the new total would go below consumed.
- **One rider, one confirmed seat per trip across both mechanisms**: `hasConfirmedSeatOnTrip(tripId, userId)` gates `confirm-seat`, `seat-offers/[id]/accept`, and `POST /api/seat-offers` creation.
- **Confirmed riders are public**: non-owner viewers see a read-only "Riders" list (no management buttons). Same count on `/explore`/Home cards, batched via `getConfirmedRiderCounts(tripIds)`.

## Seat Offers

Owner-initiated counterpart: lets an owner offer a seat to someone they're already messaging, not just people who went through Request-to-Connect.

- **`SeatOffer`**: `tripId`, `recipientId`, `conversationId` (always from within an existing `Conversation`), `status` (`pending`→`accepted`/`declined`/`cancelled`), `seatConfirmedAt`. Deliberately **not** built by reversing `ConnectionRequest` — its `recipientId=trip owner` invariant is load-bearing across many ownership checks.
- **`POST /api/seat-offers`** (`{conversationId}`): caller must be that conversation's trip owner; `recipientId` derived from the conversation, never the body.
- **`.../accept`**: accepting **is** confirmation (atomic decrement, unlike `ConnectionRequest`'s separate confirm-seat step). **`.../decline`**: no capacity change. **`.../cancel`**: owner-only, rescinds a pending offer. **`.../release-seat`**: mirrors `ConnectionRequest`'s exactly.
- **UI: an inline bubble inside the message thread**, not a separate control — `SeatOfferBubble.tsx` renders as a chat-bubble `<li>` inside `MessageThread`'s own list, chronologically sorted with real messages. `GET .../messages` returns the full current `seatOffers` on every poll (not `since`-filtered, since accept/decline/cancel doesn't change `createdAt`).
- **`PATCH`/`DELETE /api/trips/[id]`** account for `SeatOffer`-consumed seats too, alongside `ConnectionRequest` — both draw from the same `seatsRemaining` pool.

## Removed: Request/Trip Matching Lifecycle and Reviews

This project used to have a standalone `Request` model (`tripId = null`, "requester posts first") that could get matched to a `Trip` via `requests/[id]/{accept,decline,complete}`, and a `Review` feature keyed off a completed `Request`. **Both were removed entirely**, per direct product decision that the standalone "Need a Ride"/"Need to Split an Uber" posting flow (`Request`) "is essentially not useful... and over-complicates it" — see Trip Categories & Package Carrying above. `Review.requestId` was a required FK with no Trip-based alternative, so Review had no way to survive Request's removal and was deleted along with it. There is no review/rating feature, no `/requests/*` route, and no `/api/reviews` route anywhere in the app today. `ConnectionRequest` (Trip Participants, above) is a **completely different, unrelated** model and was not touched by this removal.

## Report a User

`POST /api/reports` — write-only, manual admin review, zero automated consequence (no admin/moderator UI exists at all).

- **`ReportButton.tsx`** on `/profile/[userId]`, `/trips/[id]`, `/package-posts/[id]`, `/messages/[id]` (conversation id, not one message). Not gated by upcoming/active status — reporting should stay possible after a post resolves.
- No `confirm()` — friction is a required reason `<select>` with no default instead.
- **`POST /api/reports`**: `reporterId` from `getCurrentUser()`. Fixed reason vocabulary even though the column is a plain string (keeps a future moderation queue scannable). Self-report → 400. Unknown `reportedUserId` → 404. `contextId` never validated against the underlying entity (can be legitimately deleted later; report should still stand). No DB uniqueness on `(reporterId, reportedUserId)`.

## Block a User

One-directional `Block` (`blockerId`→`blockedId`), **enforced bidirectionally** — a blocked user disappears from both parties' Explore, neither can start a new conversation/connection request. Fully reversible.

- **`src/lib/blocks.ts`**: `isBlockedBetween(a,b)`, `getBlockedCounterpartIds(userId)`.
- **`BlockButton.tsx`** on the same 4 surfaces as `ReportButton`. **Is** `confirm()`-gated (visible effect on both parties).
- **`POST /api/blocks`** (`{blockedId}`): self-block → 400, unknown id → 404, duplicate is a plain `upsert` no-op.
- **Enforcement**: `POST /api/conversations`/`/api/connection-requests` reject (403) if blocked; `.../accept` re-checks as defense-in-depth (a block can land between pending and accept); `/explore` filters the Trip query.
- **Deliberately not touched**: existing history predating a block stays fully visible — only *new* conversations/requests are blocked. Trip/package detail pages aren't hidden from a blocked counterpart (only Explore is).

**Payment safety notice**: `/messages/[id]` renders a static `.chat-safety-notice` banner above every thread — no payment/escrow infrastructure exists, money is handled in person.

## Architecture Summary

**Core entities** (`prisma/schema.prisma`): `User`, `VerificationRecord`, `SupportedUniversityDomain`, `StudentRecord`, `ParentStudentOtpRequest`, `ParentStudentInvite`, `ParentStudentLink`, `Region`, `City`, `RouteCommunity`, `Trip` (categories `personal_car`/`uber_share`), `PackagePost`, `Conversation`/`ConversationParticipant`/`Message`, `ConnectionRequest`, `SeatOffer`, `Notification`, `Report`, `Block`, `GeocodeCache`. There is **no** `Request` or `Review` model — both were removed (see Trip Categories & Package Carrying above); don't reintroduce either without re-reading why they were removed.

**Design principles baked into the schema — don't casually simplify these away:**
- **Verification is composable.** `VerificationRecord.type` (`email`|`university`|`parent_relationship`|`identity`) lets badges exist independently; university verification is an app-logic gate, not a schema constraint.
- **Role lives on the action**, not the `User`.
- **A `User` and a `StudentRecord` are separate concepts.** A `StudentRecord` can exist with no `User`. `ParentStudentLink` is a fact, never an access grant — there is no capability anywhere in the app gated on link status, since the one that used to be (posting a Trip "for" a student via the old `Request.beneficiaryId`) no longer exists.
- **Routes are open, not gated.** `RouteCommunity.active` controls what Home *features*, not what can be posted.
- **No payment fields.**
- **Anti-spam**: 10 new `Trip`/`PackagePost` creations per user per rolling 12h window (`src/lib/rate-limit.ts`).
- **RLS is enabled on every table with zero policies** — this is **not** the authorization mechanism (entirely application code). Prisma connects as `postgres` (`rolbypassrls=true`), unaffected by RLS. Zero-policy RLS only closes off Supabase's auto-exposed PostgREST REST API to the public anon key — nothing in this codebase uses that API for table data.

## Directory Structure

```
prisma/schema.prisma          Database schema — source of truth
prisma/seed.ts                Launch data: Bay Area/UCI regions & cities, RouteCommunity, uci.edu domain
scripts/setup-storage.ts      Idempotent: creates the "avatars" Storage bucket
src/app/
  layout.tsx                  Root layout/nav; parent-link gate (first load) + onboarding nudge
  page.tsx                    Home — signed-in personal/featured feed; logged-out landing page
  explore/                    Browse Trip offers + PackagePosts, category toggle, filters, map, pagination; also viewable without login
  post/                       Post hub → /post/trip, /post/package (3 offer actions)
  my-posts/                   Caller's own Trips/PackagePosts
  connections/                Connection Requests, Received/Sent tabs
  trips/[id]/, package-posts/[id]/   Detail + /edit
  messages/                   Conversation list + /[id] thread (polling)
  notifications/              Caller's notifications
  onboarding/, profile/, family/, auth/callback/, (auth)/sign-up, (auth)/login, verify/
  api/                        One subfolder per module — auth, profile, trips, package-posts,
                               conversations, connection-requests, seat-offers, notifications, family/*, reports, blocks
src/lib/
  prisma.ts                   Prisma client singleton
  auth.ts                     getCurrentUser() + badge/gate helpers (isUniversityVerified, hasCompletedOnboarding, hasLinkedStudent, hasStudentRecord)
  onboarding.ts                syncUserFromAuth() + claimOrCreateStudentRecord()
  profile.ts                   getPublicProfile() allowlist
  geo.ts                        getCitiesByRegion() + getPrimaryRouteLabel() + getFeaturedRoutePairs()
  geocode.ts                    Nominatim geocoding + GeocodeCache
  lookingFor.ts                 LOOKING_FOR_OPTIONS
  postSchemas.ts                 Shared Zod schemas for Trip/PackagePost
  otp.ts                         Numeric-code gen/hash for parent→student OTP
  email.ts                      Resend wrapper (console.log fallback in dev only, throws in prod); escapeHtml() sanitizes user-controlled values before HTML interpolation
  supabase/                     client.ts, server.ts, middleware.ts, storage.ts, admin.ts
  rate-limit.ts                 canCreatePost (Trip/PackagePost, 10/12h), canSendMessage (30/10min), canSendFamilyInvite (5/24h)
  messaging.ts                   findOrCreateConversationForPost() + isConversationUnread() + getUnreadConversationCount()
  notifications.ts               createNotification() + notificationLink() + getUnreadNotificationCount()
  blocks.ts                       isBlockedBetween() + getBlockedCounterpartIds()
  tripParticipants.ts             hasConfirmedSeatOnTrip() + getConfirmedRiderCounts()
src/components/                 ProfileEditForm, TripPostForm/PackagePostForm, DeletePostButton,
                                 MarkTripCompleteButton, ExploreCard/ExploreFilters/ExploreViewTabs/ExploreMapView/RouteMap,
                                 RegisterInterestForm, ConnectionRequestButton, ConfirmSeatButton, SeatOfferBubble,
                                 MessageThread, ConversationActions, NotificationItem, ReportButton,
                                 ApproveLinkButton, BlockButton,
                                 InviteParentForm, AcceptFamilyInviteButton
```

**API modules**: `verification/university`, `family/invite`, `family/link`, `profile`, `trips`, `package-posts`, `conversations`, `connection-requests`, `seat-offers`, `notifications`, `reports`, `blocks`. **All implemented — no route returns 501.** There is no `requests` or `reviews` module — both were removed (see Trip Categories & Package Carrying above).

## Development Commands

```bash
npm install / npm run dev / npm run build / npm run start
npm run test                   # pure/unit suite (no DB)
npm run test:watch
npm run db:test:up             # start disposable local Postgres (Docker) for DB tests
npm run test:db                # migrate + run *.db.test.ts suite
npm run test:watch:db
npm run db:test:down
npm run prisma:generate / prisma:migrate / prisma:studio / prisma:seed
npm run supabase:setup-storage
```

**Windows gotcha #1**: force-killing `npm run dev` can tear the webpack cache under `.next/cache`. Symptom: one route 500s with `Jest worker encountered N child process exceptions` while the same Prisma query run standalone succeeds instantly. Fix: stop dev server, `rm -rf .next`, restart. Avoid force-killing when a graceful stop is possible.

**Windows gotcha #2**: running `npm run build` while `npm run dev` is live on the same tree corrupts dev's `.next` state — pages return 200 but CSS silently stops applying. Same fix. Check for a live dev server before building.

**`npm run lint` is not configured**: no `eslint.config.js`/`.eslintrc.*` exists despite `eslint` in `devDependencies`. Running it hangs on `next lint`'s interactive setup prompt in a non-interactive shell. Don't assume it passes or runs as part of verifying a change.

## Automated Tests

Vitest for pure business-logic functions needing no database. `MANUAL_TESTING.md` remains the coverage for anything needing a browser/DB/auth session. Config: `vitest.config.mts` (Node env, `resolve.tsconfigPaths: true`).

- **Convention**: colocated `*.test.ts` next to the source file.
- **Pure-function coverage**: `postStatus.ts`, `otp.ts` (format/determinism only), `postSchemas.ts` (`tripFieldsSchema`/`packagePostFieldsSchema`), `notifications.ts` (`notificationLink`/`truncateForNotification` only, exhaustive per-`NotificationType`), `messaging.ts` (`isConversationUnread` only), `lookingFor.ts`, `auth.ts`'s six pure derived-value helpers, `email.ts`'s `escapeHtml()`, `supabase/middleware.ts`'s `shouldRedirectToParentLinkGate(...)` (the gate's branching pulled into a standalone pure predicate for testability without faking a `NextRequest`).
- **Importing a file with DB-backed exports alongside pure ones is safe** — Prisma Client connects lazily, so a test that never calls the DB-backed export needs no `DATABASE_URL`.
- **`src/lib/testFixtures.ts`**: shared fixture factory (Prisma-free) for `auth.ts` tests.
- **DB-backed suite** (`*.db.test.ts`, via `npm run test:db`, excluded from plain `npm test`): disposable local Postgres via Docker, never the shared Supabase dev DB, never a mocked Prisma client — the point is exercising real transaction/race behavior. `src/lib/testDb.ts` throws at import time if `DATABASE_URL` doesn't look like the disposable test DB. `src/lib/testDbFixtures.ts` holds real-insert factories. `vitest.config.db.mts` sets `fileParallelism:false`. For auth-gated routes, `getCurrentUser` is mocked to resolve a real DB-inserted user id; everything else runs for real. Next 15 dynamic params are a `Promise`.
- **Current coverage**: `onboarding.db.test.ts` (races + idempotency), the two overbooking-prevention routes (`confirm-seat`, `seat-offers/[id]/accept` — a third, `requests/[id]/accept`, was removed along with the standalone `Request` model it tested), `rate-limit.db.test.ts`, `blocks.db.test.ts`, `profile.db.test.ts`, one representative of the `updateMany`-as-authorization family. CI runs both suites + `npm run build` on every push/PR to `main`.

## Environment Variables

- `DATABASE_URL`/`DIRECT_URL` — Postgres (Supabase). `DATABASE_URL` needs `?pgbouncer=true`; `DIRECT_URL` should point at the session pooler (port 5432, same host), not the plain `db.<ref>.supabase.co` host (IPv6-only).
- `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only. Backs parent-signup account creation, avatar uploads, and the `hasLinkedStudent` `app_metadata` flag.
- `RESEND_API_KEY`/`EMAIL_FROM` — optional in dev (console.log fallback); `email.ts` throws instead when missing in production, so effectively required in any real deploy.

## Explicitly Not MVP

Do not add: general marketplace/housing/roommates/storage/events features, government ID verification, payment/escrow infrastructure, insurance, or university partnerships. **Group-Uber-fare-splitting was previously on this list and has since been explicitly reversed** by direct user decision (`Trip.category="uber_share"`) — not scope-creep.
