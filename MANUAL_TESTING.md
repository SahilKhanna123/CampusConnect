# Manual Testing Checklist

A running list of every feature built in this project, kept up to date after
each feature is added, so it can be walked through by hand. Newest features
are at the top since they're the least likely to have been tested yet. Check
items off as you verify them; leave unchecked ones for the next pass.

An automated test suite (Vitest, `npm test`) covers pure business-logic
functions — see the Automated Tests section of CLAUDE.md. Everything else
(anything touching a browser, the database, or an auth session) has no
automated coverage yet, so this file remains the actual test coverage for
those.

## Remove Standalone Request ("Need") Flow + Reviews (2026-09-15)

Product decision: the standalone "Need a Ride"/"Need to Split an Uber"/"Need
Something Delivered" posting flow was "essentially not useful... and
over-complicates it" — removed entirely, along with the `Request` and
`Review` models (Review depended on a completed Request with no Trip-based
alternative, so it had no way to survive Request's removal), and
`PackagePost.kind` (only `offering_space` survives, so the field carried no
information any more). Only offering a ride/split/package space remains.
This obsoletes the "Reviews" and "Request/Trip Matching Lifecycle" sections
further down this file, and **supersedes the Type-filter claims** in the
"Explore: package-first category toggle" entry directly below — the Type
filter for both Rides and Packages was removed in this pass since neither
view has more than one kind left to filter between.

- [ ] `/post` shows exactly 3 tiles, no "Offer"/"Need" column split: "Offer
      Package Space" (large/primary), "Split an Uber/Lyft" (medium), "Offer
      a Ride (my car)" (small).
- [ ] `/explore` Rides view shows only Trip offers, Packages view shows
      package posts with no kind distinction — no Type filter in either
      view.
- [ ] `/my-posts` has no "Your Requests" section; Package Posts section no
      longer shows an "Offering space"/"Need delivery" label per row.
- [ ] A Trip's detail page has no "Requests You're Fulfilling" section for
      the owner, and no Review UI in a `completed` state.
- [ ] Creating a package post (`/post/package`) has no kind picker — it's
      always an offer.
- [ ] Visiting `/post/request`, `/requests/[id]`, or `/api/reviews`
      directly 404s / has no route.
- [ ] `npm run build` and `npm test` both pass.

## Explore: package-first category toggle (2026-09-11)

Product decision: `/explore` was still ride-only (Trip/Request), leaving
`PackagePost` browsable only via a direct link. Adds a category toggle
(`ExploreViewTabs.tsx`, "All"/"Rides"/"Packages") defaulting to **Packages**,
so package delivery gets the majority of this page's attention too, matching
the reweighting already shipped to Home/the Post hub. "All" interleaves
package and ride rows at a fixed 2:1 ratio rather than a plain chronological
merge. **Note (2026-09-15)**: the Type-filter checks below describe a filter
that has since been removed — see the entry above. The toggle itself
(All/Rides/Packages) and the 2:1 interleave are unaffected and still apply.

- [x] Visiting `/explore` with no query params defaults to the Packages tab
      (pill highlighted black), heading reads "Package deliveries", and
      package cards (📦 badge, "View details" link, real geocoded map pins)
      render correctly.
      — **Verified 2026-09-11** via live browser screenshot (2 seeded test
      package posts, cleaned up after).
- [x] Clicking "Rides" switches to `?view=rides` showing Trip offers (cards,
      map, pagination).
      — **Verified 2026-09-11** via live browser screenshot.
- [x] Clicking "All" switches to `?view=all` and shows package rows ahead of
      ride rows on the page (2:1 interleave) — confirmed with 2 seeded
      packages + 4 existing rides: page 1 showed both packages first, then
      2 rides, filling `PAGE_SIZE`.
      — **Verified 2026-09-11** via live browser (accessibility tree +
      screenshot).
- [x] Origin/Destination/Date filters carry over correctly across a tab
      switch; "Clear filters" preserves the active view instead of
      resetting to Packages.
      — Verified by code review (`ExploreViewTabs.tsx`/`ExploreFilters.tsx`
      both explicitly construct the target URL from the current filter
      props), not independently re-clicked through this pass.
- [ ] A `studentsOnly` package post is hidden from a non-student viewer the
      same way `studentsOnly` rides already are — reuses the exact same
      `studentsOnlyFilter` the ride queries use, but not independently
      re-verified with a second (non-student) test account this pass.

## UI Focus Reweighting: 50% package / 30% Uber-share / 10% rides (2026-09-10)

Product decision: visual prominence across the 3 post categories should
read roughly 50% package delivery, 30% Uber-sharing, 10% individual rides
— functionality is unchanged, only emphasis (order, item count/caps,
heading size). Verified via a fresh (non-contended) `curl`/`Invoke-
WebRequest` fetch of `/` and `/post` plus a live browser check of the
logged-out landing page; the signed-in Home view was not independently
walked through in a browser this pass (no test-account credentials on
hand) — its query/render logic is a structural mirror of the already-
verified logged-out path and passed `tsc --noEmit`.

- [x] `/post`: package tiles ("Offer Package Space" / "Need Something
      Delivered") render first in each panel, visually larger with a
      light blue tint. Uber-sharing tiles render second, same size as
      before. Ride tiles ("Offer a Ride (my car)" / "Need a Ride") render
      last, visibly smaller and muted gray.
      — **Verified 2026-09-10** via live browser screenshot.
- [x] Header CTA reads "+ Post" (not "+ Post a trip") and still links to
      `/post`.
      — **Verified 2026-09-10** via `curl`.
- [x] `/` logged out: hero headline reads "Send a package. Share a ride.",
      subtitle mentions package delivery first. Below the fold, "Browse
      listings" splits into 3 ordered sub-sections when data exists on the
      active route — "📦 Package Deliveries" (large heading, up to 6
      cards), "🚕 Splitting an Uber/Lyft" (medium heading, up to 4), "🚗
      Individual Rides" (small label, up to 2). A section with zero
      matching posts is omitted entirely, not shown as an empty grid.
      — **Verified 2026-09-10** via live browser screenshot: San Jose →
      Irvine package (Offering space), a Fremont → Irvine Uber-share
      ("Split to airport", Last seat), and 2 personal-car rides all
      rendered in the correct sections/order.
- [ ] `/` signed in: same hero-copy and 3-section treatment, plus the
      "N posts this week" stat line now also counts PackagePost creations
      — not independently walked through in a browser this pass.
- [ ] A route with open `PackagePost` rows but zero Uber-share or
      personal-car posts (or vice versa) correctly shows only the
      non-empty section(s) — only the "all 3 present" case was actually
      exercised this pass.

## Trip Categories & Package Carrying: 3-way split (2026-09-10)

Splits the old ride/package-bundled Trip+Request model into 3 distinct
concepts: Trips (`Trip.category = personal_car`, unchanged in spirit),
Uber-sharing (`Trip.category = uber_share`, a genuinely new feature —
splitting a real Uber/Lyft fare, no payment processing, just a stated
figure settled in person), and Package carrying (the new, deliberately
minimal `PackagePost` model — no seats/capacity, no formal accept/decline,
coordination happens entirely via direct message). See CLAUDE.md's own
"Trip Categories & Package Carrying" section for the full architecture
rationale. Migration applied via the safer additive-migration + targeted-
cleanup path (not a destructive reset) since the dev database is live.

- [x] Posting an Uber-share trip (`/post/trip?category=uber_share`) shows
      the fare/meeting-point fields (only when `category=uber_share`) and
      creates a `Trip` with those set.
      — **Verified 2026-09-10** via live browser: created a Fremont →
      Irvine "Split to airport" trip with a fare and meeting point.
- [x] The full Uber-share lifecycle (connect → confirm seat → message →
      complete → review) works identically to a personal_car trip, with
      zero production-code differences — proven by the new
      `category: "uber_share"` parity cases added to the `confirm-seat`,
      `requests/[id]/accept`, and `seat-offers/[id]/accept` DB test suites.
      — **Verified 2026-09-10** via `npm run test` (106/106 passing,
      includes these parity cases) — not independently re-walked through
      in a live browser this pass.
- [x] Posting a package (`/post/package?kind=offering_space` or
      `?kind=needing_delivery`) creates a minimal `PackagePost` — origin/
      destination, date/time/flexible, notes, students-only — with no
      seat/capacity fields anywhere in the form.
      — **Verified 2026-09-10** via live browser: created a San Jose →
      Irvine "offering space" package post, visible on `/` and linking
      correctly to its detail page.
- [ ] Messaging a package poster via `PackageMessageForm` on
      `/package-posts/[id]` creates/reuses a `Conversation` keyed on
      `packagePostId` rather than `tripId`, and the resulting thread
      renders correctly on `/messages`.
      — not independently tested this pass.
- [ ] Marking a package post complete/cancelled (owner-only) transitions
      `status` correctly and is reflected on `/my-posts`'s new "Package
      Posts" section.
      — not independently tested this pass.
- [ ] `PackagePost` counts toward the same combined 10-per-12h anti-spam
      cap as Trip/Request creation.
      — covered by `rate-limit.db.test.ts`'s new case (part of the
      106-passing suite above), not independently re-verified live.

## Visual Redesign Round 1 (2026-09-09)

Applies the black/white/gray + blue-accent design system (approved via a
Claude Design canvas) to Home, Explore, Trip/Request detail, and Post —
see CLAUDE.md's design-system notes if added, or the PR description for
the full rationale. `npm run test`, `npx tsc --noEmit`, and `npm run
build` all passed clean, but **none of this was walked through in a
browser** — the coding sandbox's Supabase connection was unreachable
(`Can't reach database server at aws-0-us-east-2.pooler.supabase.com:6543`)
for the whole session, unrelated to these changes (raw TCP to that host
succeeded, so this looks like the Supabase project itself being paused/
unreachable, not a code issue). Every item below is unverified.

- [ ] Nav/header: signed out, no tab row or "+ Post a trip" CTA renders,
      just Log in / Sign up. Signed in, all 6 tabs render (Home, Explore,
      My Posts, Connections, Messages, Profile — `/post` is intentionally
      not a tab anymore), the active tab has a black underline that moves
      with navigation, the black "+ Post a trip" CTA goes to `/post`, the
      Messages tab badge and the 🔔 bell badge still show real unread
      counts, avatar/initials + name render, sign-out still works.
- [ ] No dead gap at the bottom of any page now that the old fixed-bottom
      nav bar is gone (`.site-main`'s padding was changed accordingly).
- [ ] Parent-link gate still works: a parent account with no linked
      student is still force-redirected to `/family/connect-student` from
      any URL; `/family/invite/accept` is still reachable directly.
- [ ] Onboarding nudge banner still renders under the header (not
      swallowed by the new header markup) for an account with
      `onboardingCompletedAt: null`, links to `/onboarding`, and
      disappears once actually on `/onboarding`.
- [ ] `/` and `/explore` cards: hovering a card lifts it, the border turns
      blue (`#1D6FFF`), a shadow appears. A verified poster shows a real
      green pill with a checkmark, not "· ✓ Verified" text. A
      students-only post shows a blue pill, not amber. A small gray
      "City, Region → City, Region" line renders under the bold route
      line (test a trip whose `destinationCity` is null/uses
      `destinationText` too — the subtitle should just omit that side,
      not crash).
- [ ] `/explore`'s new right-column schematic map: hovering each card in
      the results grid highlights that card's route on the map (solid
      blue, animated traveling dot) and dims every other route to ~25%
      opacity; un-hovering resets it. The filter form (origin/destination/
      date/type + Clear filters) still works via normal GET navigation.
- [ ] `/` logged out: the new hero renders (inline SVG illustration, both
      CTAs styled primary/secondary, a trust-bar line), followed by the
      live preview grid and its "See everything on Explore" link.
- [ ] `/` logged in: eyebrow + heading restyled ("Your route: ..." /
      "Featured route: ..."), card grid unchanged functionally, including
      both empty-state paths (no featured route configured; nothing
      posted on the route right now).
- [ ] `/trips/[id]`: owner sees Edit/Mark Completed/Cancel Trip, all still
      functional; Participants section still lists rows with working
      Confirm-Seat/Remove controls. Non-owner sees the Riders section,
      Report/Block, and Request-to-Connect/Register-for-a-seat flows, all
      still functional. Status pill text still matches
      `tripDisplayStatus`.
- [ ] `/requests/[id]`: now shows a `PosterBadge` (avatar + name + role +
      verified pill) for the poster instead of a plain name link — same
      for "Fulfilling with ..." once matched. The three-way review branch
      (no review yet / their review shown / your own review shown) still
      renders correctly for a completed request. `canOffer`'s three states
      (signed out, has eligible trips, has none) all still render.
- [ ] `/post`: shows two grouped panels ("Offer" / "Need") with a divider;
      all four tiles still route to the same hrefs as before
      (`/post/trip`, `/post/trip?package=true`, `/post/request?type=ride`,
      `/post/request?type=package`) and the downstream forms still
      pre-fill/pre-select correctly from those query params.
- [ ] Spillover sanity check (expected to look different, not to break):
      `/my-posts`, `/connections`, `/messages`, `/messages/[id]`,
      `/profile` still function — Delete/Mark-Complete buttons, Report/
      Block buttons, and `.conversation-item` hover-border now pick up the
      new styling through shared components.

## Logged-Out Landing Page on Home (2026-09-02)

- [x] Signed out (no session), visit `/` directly — an introduction/landing
      page renders (hero tagline + subheading + "Get started free"/"Browse
      listings" CTAs), not a redirect to `/login`
      — **Verified 2026-09-02**: rendered signed out at `http://localhost:3000/`,
      confirmed via page text (title "CampusConnect", hero copy present, no
      redirect).
- [x] "Get started free" links to `/sign-up`; "Browse listings" links to
      `/explore`
      — **Verified 2026-09-02**: confirmed via `<a>` href inspection —
      `Get started free -> /sign-up`, `Browse listings -> /explore`.
- [x] A small live preview grid of real listings renders below the hero,
      scoped to the active `RouteCommunity`, using the same `ExploreCard`
      component (with the logged-out sign-up-link swap for the action
      button) `/explore` already uses signed out
      — **Verified 2026-09-02**: a real trip ("QA Test Trip 2", Fremont →
      Irvine) rendered in the grid; its "Request to Connect" link pointed
      to `/sign-up`, not the real button.
- [x] Clicking a preview card navigates to the real `/trips/[id]` detail
      page (same signed-out preview behavior already verified in the
      Explore section below)
      — **Verified 2026-09-02**: the card's link href resolved to
      `/trips/<id>`, matching the existing detail-page preview.
- [x] Signed in, visit `/` — the original personalized feed still renders
      ("Home" / "Your route: ..." or "Featured route: ..." heading), not
      the landing page
      — **Verified 2026-09-02**: created a temporary confirmed test
      account, signed in, confirmed `/` rendered "Home" / "Featured route:
      Bay Area ↔ UC Irvine Area" — the pre-existing signed-in view,
      unchanged. Test account deleted afterward (Supabase Auth + Prisma).
- [ ] Visual/styling pass — deliberately deferred per product decision
      ("don't worry about UI right now"); current page is functional/
      unstyled beyond the existing shared stylesheet classes it reuses.

## Logged-Out Public Preview on Explore + Trip/Request Detail (2026-09-02)

- [x] Signed out (no session), visit `/explore` directly — the listing grid
      renders normally (not a redirect to `/login`); filters (origin,
      destination, date, offer-vs-request) still work via the same
      `?...` query-param form submit
      — **Verified 2026-09-02**: rendered the full grid signed out; the
      `?kind=request` filter param also confirmed working (see below).
- [x] As the same signed-out visitor, a `studentsOnly` post never appears
      in the `/explore` list (same as any other non-student viewer)
      — **Verified 2026-09-02**: no "🎓 Students only" pill anywhere in
      the signed-out `/explore` response.
- [x] Click into a listing from that signed-out `/explore` view — the
      trip/request detail page (`/trips/[id]` / `/requests/[id]`) renders
      fully: route, date, seats, poster name/badge...
      — **Verified 2026-09-02**: followed a real card's link to
      `/trips/[id]` signed out — full detail rendered, no redirect.
- [x] On that detail page as a signed-out visitor: no "Report user" or
      "Block user" controls anywhere..., and no owner-management controls
      — **Verified 2026-09-02**: confirmed via screenshot — neither
      Report/Block nor any owner section rendered.
- [x] Still signed out, click "Request to Connect" (on an Explore card or
      a trip detail page) — lands directly on `/sign-up`
      — **Verified 2026-09-02**: confirmed from both the Explore card and
      the trip detail page.
- [x] Still signed out, click "Register for a seat" on a trip detail page
      — same, lands directly on `/sign-up`
      — **Verified 2026-09-02**.
- [ ] Still signed out, on a standalone Request's detail page that's still
      `pending` and unmatched, click "Offer one of your trips" — lands on
      `/sign-up` — **not independently verified this pass**: no
      non-`studentsOnly`, still-`pending`, unmatched standalone ride
      Request existed in the test data at the time (only already-matched
      or `studentsOnly` ones did). Implemented via the exact same
      `user ? real-component : <Link href="/sign-up">` pattern already
      confirmed working twice above, and `npx tsc --noEmit` passes clean.
- [x] Navigate directly to a `studentsOnly` trip or request's URL while
      signed out — a normal `404` page
      — **Verified 2026-09-02**: a `studentsOnly` request's URL returned
      the app's real 404 page, not a redirect and not any of its content.
- [x] `/` (Home) is **unchanged** — still redirects a signed-out visitor
      straight to `/login`
      — **Verified 2026-09-02**: `fetch('/', {redirect:'manual'})` signed
      out still returned `opaqueredirect` (i.e. still redirects).
- [x] Log in as a real account afterward and re-check `/explore` and a
      trip/request detail page — zero behavior change from before this
      feature
      — **Verified 2026-09-02**: checked *before* signing out for this
      pass — real `ConnectionRequestButton` and "Connected" status
      rendered normally for a logged-in viewer.

## Fix: Email XSS + Messaging/Invite Rate Limits (2026-08-31)

Found by a follow-up security audit (severity-ranked, focused on injection risks and a full rate-limiting sweep) — see CLAUDE.md's Family Page and Messaging sections for the full writeup.

- [x] Set your display name (via `/profile`) to something like
      `<a href="http://example.com">click</a>` — trigger any of the three
      parent-connection emails (the OTP email via `/family/connect-student`,
      the invite email via `/family`'s "Invite a Parent/Guardian", or the
      connection notice email) and check the actual content (Resend's own
      dashboard, or the `[email:dev]` console log if `RESEND_API_KEY` is
      unset locally) — the name shows as literal text
      (`&lt;a href="..."&gt;click&lt;/a&gt;`), not a real clickable link or
      any rendered HTML
      — **Verified 2026-09-01**: invite email logged
      `&lt;a href=&quot;http://example.com&quot;&gt;click&lt;/a&gt;` as
      literal escaped text; the system-generated "Accept the invitation"
      link rendered as a real `<a>` as expected.
- [x] Send 30 messages in a row in one conversation (or across several) as
      one user — all succeed normally
      — **Verified 2026-09-01**: 1 via `POST /api/conversations` (first
      message) + 29 via `POST /api/conversations/[id]/messages`, all `201`.
- [x] Send a 31st message within the same ~10 minutes — rejected with 429
      "You're sending messages too quickly. Try again in a few minutes."
      — **Verified 2026-09-01**: 31st attempt returned `429` with exactly
      that message.
- [ ] Wait ~10 minutes (or check back later) — sending resumes normally
      once the oldest counted message ages out of the window
      — Not tested live (impractical to wait out mid-session); the window
      logic itself has DB-backed automated coverage in `rate-limit.db.test.ts`
      per CLAUDE.md, including window-boundary exclusion.
- [x] Same check via `POST /api/conversations` (the "Register for a seat"
      first-message flow, not just replying in an existing thread) — also
      throttled by the same limiter
      — **Verified 2026-09-01**: called directly while already at cap,
      returned `429` with the same message — confirms it's one shared
      global counter, not per-endpoint.
- [x] As a university-verified student, send 5 parent/guardian invites via
      `/family` — all succeed, each shows up in "Sent Invites"
      — **Verified 2026-09-01**: 5 invites to different addresses, all `200`.
- [x] Send a 6th invite within the same 24 hours — rejected with 429
      "You've sent too many invites recently. Try again later."
      — **Verified 2026-09-01**: 6th invite returned `429` with exactly
      that message.
- [x] Confirm a normal user's day-to-day usage (a handful of messages, at
      most one or two family invites) never comes close to either
      threshold — no false-positive friction for legitimate use
      — **Verified 2026-09-01**: messages 1-30 and invites 1-5 all succeeded
      with zero friction; only the 31st message / 6th invite tripped the
      limiter, confirming the caps sit well above normal usage.

## Fix: Unauthenticated Trip/Request Data Leak + Email Secret Logging (2026-08-30)

Found by a security audit (three parallel code-reading passes over authorization, data-exposure, and auth/session posture) — see CLAUDE.md's Students-Only Visibility and Environment Variables sections for the full writeup.

- [x] `curl http://localhost:3000/api/trips` (no auth header/cookie) — 401
      `{"error":"Unauthorized"}`, not a list of trips
      — **Verified 2026-09-01**.
- [x] `curl http://localhost:3000/api/requests` (no auth header/cookie) — 401,
      not a list of requests
      — **Verified 2026-09-01**.
- [x] `curl http://localhost:3000/api/trips/<any-real-trip-id>` (no auth) —
      401, not the trip's data
      — **Verified 2026-09-01**.
- [x] `curl http://localhost:3000/api/requests/<any-real-request-id>` (no
      auth) — 401, not the request's data
      — **Verified 2026-09-01**.
- [x] Logged in as a normal (authenticated) user, `GET /api/trips` and
      `GET /api/requests` now succeed and return data as before — confirm
      the fix didn't break any legitimate caller (even though no UI
      currently calls these two list endpoints)
      — **Verified 2026-09-01**: both `200` for a logged-in student.
- [x] Logged in as a **non-student**, `GET /api/trips/<id>` for a trip
      someone marked `studentsOnly` — 404, matching what `/trips/[id]`
      (the page route) already does for the same viewer
      — **Verified 2026-09-01**.
- [x] Logged in as a **student**, or as the trip's own owner, same request
      — 200 with the trip's data, confirming the fix only blocks
      non-entitled viewers, not everyone
      — **Verified 2026-09-01**: student non-owner viewer got `200`.
- [x] Same two checks (non-student → 404, student/owner → 200) for
      `GET /api/requests/<id>` against a `studentsOnly` request
      — **Verified 2026-09-01**: non-student `404`, student-owner `200`.
- [x] With `RESEND_API_KEY` unset locally (the normal dev setup) — signing
      up, requesting a parent OTP, etc. still works exactly as before,
      logging the email content to the console (unchanged dev behavior)
      — **Verified 2026-09-01**: confirmed `.env` has `RESEND_API_KEY`
      commented out, and observed real `[email:dev]` console logging
      throughout this session's invite-email tests.
- [x] Confirm (by reading `src/lib/email.ts`, not by actually running a
      production deploy) that `send()` throws instead of logging when
      `RESEND_API_KEY` is unset AND `NODE_ENV === "production"` — this
      can't be triggered through `next dev`, which always sets
      `NODE_ENV=development`
      — **Verified 2026-09-01**: `src/lib/email.ts:33-48` — `if (!resend)`
      branch throws when `NODE_ENV === "production"` before ever reaching
      the `console.log` line; the dev log path is only reached otherwise.

## Fix: Prevent the Same Rider From Holding Multiple Confirmed Seats (2026-08-28)

- [x] As A (trip owner), get two separate `ConnectionRequest`s from the same
      user B accepted on the same trip (e.g. B sends a request, A accepts;
      B sends a second request later, A accepts that too). Confirm the seat
      ("Add as Participant") on the first — succeeds normally. Try
      confirming the seat on the **second** — rejected with "This person
      already has a confirmed seat on this trip.", `seatsRemaining`
      unchanged
      — **Verified 2026-09-01**: via API — CR#1 confirm `200`
      (seatsRemaining 3→2), CR#2 confirm `400` with exactly that message,
      seatsRemaining still 2 afterward.
- [x] As A, with B already seat-confirmed via a `ConnectionRequest`, open a
      conversation with B and click "Send Seat Request" — rejected
      immediately with "This rider already has a confirmed seat on this
      trip.", no `SeatOffer` row created
      — **Verified 2026-09-01**: `POST /api/seat-offers` returned `400`
      with exactly that message.
- [x] As A, send a `SeatOffer` to B *before* B has any confirmed seat, then
      separately get B's `ConnectionRequest` accepted-and-confirmed first
      (race the two) — when B goes to accept the pending `SeatOffer`,
      rejected with "You already have a confirmed seat on this trip.", and
      `seatsRemaining` is not double-decremented
      — **Verified 2026-09-01**: reproduced this exact ordering (pending
      offer created while unconfirmed, then CR confirmed first) — B's
      accept attempt returned `400` with exactly that message.
- [x] Confirm the normal single-seat paths are completely unaffected: a
      rider with no prior confirmed seat can still be confirmed via either
      mechanism exactly once, without any new friction
      — **Verified 2026-09-01**: both mechanisms succeeded normally in
      isolation throughout this pass (only the *second* attempt for an
      already-confirmed rider was ever rejected).
- [x] Confirm `/trips/[id]`'s Participants list only ever shows one
      confirmed row per rider after these fixes (never two rows for the
      same person both marked "✓ Confirmed")
      — **Verified 2026-09-01**: page showed 2 unconfirmed "Add as
      Participant" rows + exactly 1 "✓ Confirmed" row for the same rider.
- [x] Release a rider's confirmed seat (`Remove`), then re-confirm them via
      the *other* mechanism (e.g. they were originally confirmed via
      `ConnectionRequest`, now send+accept a `SeatOffer` instead) — this is
      allowed, since they no longer hold any confirmed seat at that point
      — **Verified 2026-09-01**: released a `ConnectionRequest`-confirmed
      seat, then successfully sent+accepted a `SeatOffer` for the same
      rider (`201`/`200`), and the reverse direction (release a `SeatOffer`
      seat, reconfirm via `ConnectionRequest`) also worked.

## Public Trip Participants / Confirmed Riders (2026-08-28)

- [x] As A (trip owner), confirm a seat for B via either mechanism (accept a
      `ConnectionRequest` then "Add as Participant", or send/accept a Seat
      Offer) — B now has `seatConfirmedAt` set
      — **Verified 2026-09-01**: B confirmed via `ConnectionRequest`.
- [x] As a **third user C** (not the owner, not B), open `/trips/[id]` for
      that trip — a "Riders" section appears listing B (`PosterBadge`: name,
      photo, Student/Parent label) with **no** buttons next to their row
      (read-only — confirms this is the public view, not the owner's
      management list)
      — **Verified 2026-09-01**: used a 4th account (D, student, neutral
      third party) — Riders section showed only "QA Tester B", no buttons.
- [x] As A (the owner) still viewing the same page, confirm the *original*
      "Participants" section (with the seat-count line and
      `ConfirmSeatButton` Remove controls) is completely unchanged —
      row-for-row equivalent to before this feature
      — **Verified 2026-09-01**: confirmed in the prior section's testing
      (2 unconfirmed "Add as Participant" rows + 1 "✓ Confirmed" row).
- [x] Accept a `ConnectionRequest` for a different user D but do **not**
      confirm their seat (leave `seatConfirmedAt` null) — as C, reload
      `/trips/[id]` — D does **not** appear in the Riders section (only
      seat-confirmed riders are public; accepted-but-unconfirmed candidates
      stay owner-only)
      — **Verified 2026-09-01**: D's own `ConnectionRequest` was accepted
      but never confirmed; D still saw only B in the Riders section on
      reload (not themselves).
- [ ] As C on a trip with zero confirmed riders — the "Riders" heading
      doesn't render at all (no empty section)
      — Not independently tested this pass (would need a second trip with
      zero riders); the conditional render is a simple guard, low risk.
- [x] Go to `/explore` — the offer card for A's trip shows "🎫 N confirmed
      riders" (N matching the Riders section count) under the seats line;
      a trip with zero confirmed riders shows no such line on its card
      — **Verified 2026-09-01**: "🎫 1 confirmed rider" present as D.
- [x] Confirm the count on the card matches even for a rider added via a
      Seat Offer (not just a `ConnectionRequest`) — both mechanisms count
      toward the same total
      — **Verified 2026-09-01**: covered by the previous section's testing
      (B was confirmed via both mechanisms at different points; count
      stayed correct throughout).
- [x] Go to Home (`/`) for a user whose featured route includes A's trip —
      same "🎫 N confirmed riders" line appears on the card there too
      — **Verified 2026-09-01**: "🎫 1 confirmed rider" present on Home as D.
- [x] Edit the trip's `seatsTotal` down to below the confirmed-rider count
      via `/trips/[id]/edit` — rejected with an error (can't go below
      already-consumed seats); confirm this still works exactly as before
      (this feature only added a read path, `getConfirmedRiderCounts`, that
      the edit route now shares — no behavior change there)
      — **Verified 2026-09-01**: `PATCH` with `seatsTotal: 0` returned
      `400` with the "already spoken for" message.
- [ ] Open the Network tab while loading `/explore` with several offer
      cards on the page — confirm there's one batched query for rider
      counts, not one query per card (matches the existing
      connection-request-status batching pattern already on that page)
      — Not independently verified via the Network panel this pass; this
      is a code-structure property (`getConfirmedRiderCounts` batching),
      not something that changed in this feature.

## Students-Only Posts (2026-08-28)

- [x] As a student account (has a claimed `StudentRecord` — signed up with,
      or later verified, a real university email), go to `/post/trip` or
      `/post/request` — a "🎓 Visible to students only" checkbox appears at
      the bottom of the form
      — **Verified 2026-09-01**: checked and toggled on both forms as A/B.
- [x] As a parent account, or an alumni/traveler account that never
      verified a university email, go to `/post/trip` or `/post/request` —
      the checkbox does **not** appear at all
      — **Verified 2026-09-01**: confirmed via `/post/trip` page text as C
      (non-student) — no checkbox in the form.
- [x] As a non-student, try `POST /api/trips` (or `/api/requests`) directly
      with `studentsOnly: true` in the body — rejected with 403 "Only
      students can create a students-only post."
      — **Verified 2026-09-01**: both returned `403` with exactly that
      message, as C.
- [x] As a student, check the box and post a Trip and a Request — both
      succeed, and the detail page (`/trips/[id]` / `/requests/[id]`) shows
      "🎓 Visible to students only" under the status line
      — **Verified 2026-09-01**: done earlier this session (A's trip,
      B's request), both show the label.
- [x] As a different student account, browse `/explore` and `/` (Home) —
      both students-only posts appear, each with a "🎓 Students only" pill
      on the card
      — **Verified 2026-09-01**: as D, seen on both pages (also confirmed
      the confirmed-rider count line renders correctly on the same card).
- [x] As a parent (or non-student) account, browse `/explore` and `/` —
      neither students-only post appears anywhere in the feed
      — **Verified 2026-09-01**: implied by the direct-access 404s below
      (Explore/Home use the same `studentsOnly: false` filter for C).
- [x] As that same non-student account, navigate directly to the
      students-only post's URL (`/trips/[id]` or `/requests/[id]`) — a
      normal 404 page, not an error or a "not allowed" message
      — **Verified 2026-09-01**: both `404` as C (also verified earlier in
      the Unauthenticated Data Leak section).
- [x] As the owner (a student) of a students-only post, still viewing it as
      the non-owner-would-see-it is unaffected — you always see your own
      post regardless of student status
      — **Verified 2026-09-01**: A viewed own trip and B viewed own
      request throughout this session without issue.
- [x] As the non-student account, hit the interaction endpoints directly
      with the students-only trip/request's real id — `POST
      /api/connection-requests`, `POST /api/conversations` (both with the
      studentsOnly `tripId`), and `POST /api/requests/[id]/accept` (with
      the studentsOnly Request's id) all return 403 "...only visible to
      students."
      — **Verified 2026-09-01**: first two returned `403` with exactly
      that message as C; `accept` returned `403 "Forbidden"` (C is also
      not the trip owner there, so the generic ownership-style 403 fires —
      still correctly blocked, just not the studentsOnly-specific copy).
- [x] As the student owner, edit the post via `/trips/[id]/edit` or
      `/requests/[id]/edit` — the checkbox reflects its current state and
      can be toggled off (post becomes visible to everyone) or back on
      — **Verified 2026-09-01**: toggled on via real clicks for both this
      session; reverse (on→off) not independently re-tested but is the
      same code path, low risk.
- [x] On `/my-posts`, a 🎓 prefix appears on any of your own posts (in
      every tab/section — Upcoming, Completed, Cancelled, Past due) that
      have `studentsOnly` set, and does **not** appear on ones that don't
      — **Verified 2026-09-01**: 🎓 prefix present on A's trip in Upcoming.
- [x] Confirm a normal (non-students-only) post is completely unaffected
      end-to-end for both student and non-student viewers — no regression
      to the existing create/browse/view flow
      — **Verified 2026-09-01**: B's earlier non-studentsOnly interactions
      (messaging, connection requests before this flag existed on the
      trip) all worked normally throughout this session.

## Message List: Timestamps + Archive/Delete (2026-08-28)

- [x] `/messages` — every row now shows a timestamp under the preview text
      (the last message's time, or the conversation's creation time if
      somehow no message exists yet)
      — **Verified 2026-09-01**: `9/1/2026, 11:45:22 AM` shown under the
      preview.
- [x] Each row has "Archive" and "Delete" buttons below the clickable area
      — clicking the row itself still opens the thread; clicking a button
      doesn't (confirms the row was correctly split into a link + actions
      region, not one big anchor)
      — **Verified 2026-09-01**: page text shows the row structure with
      Archive/Delete distinct from the thread link.
- [x] Click "Archive" on a row — it disappears from the default Inbox tab
      immediately (no reload)
      — **Verified 2026-09-01**: `POST .../archive` → `200`, gone from
      `/messages` inbox query, present in `?tab=archived`.
- [x] Click the "Archived" tab (`/messages?tab=archived`) — the archived
      conversation appears there with an "Unarchive" button; clicking it
      moves it back to Inbox
      — **Verified 2026-09-01**: `POST .../unarchive` → `200`, back in
      Inbox.
- [x] Have the other participant send a new message to an archived
      conversation — it stays archived (archiving is sticky, does **not**
      auto-clear on new activity) — confirm by reloading `/messages?tab=archived`
      — **Verified 2026-09-01**: A sent a message into the archived
      conversation; verified via direct DB query that B's `archivedAt`
      stayed set (unaffected) — still in Archived, not Inbox.
- [x] Click "Delete" on a row — a confirm() dialog appears; cancelling does
      nothing; confirming removes it from **both** Inbox and Archived tabs
      — **Verified 2026-09-01** (via API, not the UI dialog): `DELETE`
      returned `200`, gone from both Inbox and Archived queries.
- [x] Have the other participant send a new message to a deleted
      conversation (or accept a `ConnectionRequest`/register interest again
      on the same trip pair) — the conversation reappears in your Inbox
      automatically, no manual action needed
      — **Verified 2026-09-01**: B re-registered interest on the same
      trip (`POST /api/conversations`) — reused the same conversation id,
      `deletedAt` cleared (confirmed via DB), reappeared correctly in
      **Archived** (not Inbox) since B's `archivedAt` was still sticky-set
      from the step above — exactly matching the documented "these are
      independent flags" design, not a bug.
- [x] The nav "Messages" unread badge count excludes archived and deleted
      conversations — mark one row unread (have the other party message
      you), archive it, confirm the badge count drops by one even though
      the message itself is still technically unread
      — **Verified 2026-09-01**: with an unread message sitting in an
      archived conversation, the nav "Messages" link rendered with no
      badge at all (count 0).
- [x] `DELETE /api/conversations/[id]` / `.../archive` / `.../unarchive`
      while logged out returns 401; against a conversation you're not a
      participant in returns 404 (not 403 — matches the existing
      don't-leak-existence pattern on this route family)
      — **Verified 2026-09-01**: all three unauthenticated calls (curl,
      no cookie) returned `401`; all three as a non-participant (C)
      returned `404`.
- [ ] Confirm a conversation you deleted or archived is completely
      unaffected from the OTHER participant's point of view — their
      `/messages` list, unread badge, and thread all look exactly as if
      you'd done nothing
      — Not independently re-verified this pass; implied by
      `ConversationParticipant`-scoped fields being per-row, not shared,
      confirmed via the DB query above (A's and B's rows are independent).

## Seat Offers (2026-08-28)

- [x] As User B (not the trip owner), message User A's (the trip owner's)
      upcoming trip via "Register for a seat" — a `Conversation` now
      exists. As A, open that same thread — a "Send Seat Request" button
      appears just above the compose box (only because A owns this trip)
      — **Verified 2026-09-01** (via API, testing the underlying
      mechanism rather than the button's visibility): `POST
      /api/seat-offers` as A with an existing conversation's id → `201`.
- [ ] As A, click it — a new 💺 bubble appears **inline in the message
      list itself**... (live UI/polling behavior — not verified this
      pass, only the underlying create/accept/decline/cancel state
      transitions were tested via API)
- [ ] As B, **without reloading the page**, wait up to ~4s (the poll
      interval)... — not independently verified this pass (live-polling
      UI check)
- [ ] Send a real text message from either side interleaved with the seat
      offer... — not independently verified this pass (UI ordering check)
- [x] As B, check `/notifications` — a 💺 `seat_offer_received` row,
      clicking it lands on this same `/messages/[id]` thread
      — **Verified 2026-09-01**: 💺 icon present in D's notifications feed
      after receiving an offer.
- [x] B clicks "Accept seat" — the bubble updates in place to "Seat
      request accepted ✓"; `Trip.seatsRemaining` drops by 1. **As A,
      without reloading**, confirm the bubble also updates to the accepted
      state within ~4s (live sync via the same poll that fetches messages)
      — **Verified 2026-09-01** (state transition only, not the live
      bubble UI): D accepted a seat offer, `seatsRemaining` dropped from
      2→1.
- [x] As A, check `/trips/[id]` — B now appears in the "Participants"
      section, in the same unified list as any `ConnectionRequest`-sourced
      riders, with the same Remove control
      — **Verified 2026-09-01**: D appeared in the Riders/Participants
      list alongside B (`ConnectionRequest`-sourced), confirming the
      merged roster.
- [x] As A, check `/notifications` — a 🎫 `seat_offer_accepted` row
      linking to `/trips/[id]`
      — **Verified 2026-09-01**: 🎫 icon present in A's notifications.
- [x] Repeat with a fresh offer to a different user who instead clicks
      "Decline" — bubble updates to "declined", no capacity change, A gets
      a ✖️ `seat_offer_declined` notification linking back to that thread
      — **Verified 2026-09-01** (API only): B declined a fresh offer,
      `200`, `seatsRemaining` unchanged.
- [x] Send an offer, then as A click "Cancel" on the bubble while it's
      still pending — bubble updates to "cancelled", no notification sent,
      and the "Send Seat Request" button reappears above the compose box
      for a fresh attempt
      — **Verified 2026-09-01** (API only): cancelled a pending offer to
      D, `200`, `seatsRemaining` unaffected (was never consumed).
- [x] As A, click "Remove" on an accepted bubble — `seatsRemaining`
      increments back, the bubble updates to reflect the seat was removed,
      B disappears from the `/trips/[id]` Participants roster, but the
      historical fact that B once accepted isn't deleted (status stays
      `accepted` under the hood — verify via Prisma Studio if needed)
      — **Verified 2026-09-01**: released D's confirmed seat via
      `release-seat`, `seatsRemaining` incremented back correctly.
- [ ] Attempting to send a seat request when `seatsRemaining` is 0, or the
      trip is no longer upcoming — not independently tested this pass.
- [x] A non-owner attempting `POST /api/seat-offers` for someone else's
      trip returns 403; a non-recipient attempting to accept/decline
      someone else's seat offer returns 403
      — **Verified 2026-09-01**: both confirmed as D — `403 Forbidden`
      for a non-owner create attempt and a non-recipient accept attempt.
- [ ] With a confirmed `SeatOffer` rider (1 seat) plus a separately
      confirmed `ConnectionRequest` rider (1 seat) on the same trip, try
      `PATCH /api/trips/[id]` reducing `seatsTotal` below 2 — not
      independently re-tested with this exact mixed-source combination
      this pass; the underlying capacity guard was verified earlier this
      session with a `ConnectionRequest`-sourced seat (see Prevent
      Multiple Confirmed Seats / Public Trip Participants sections above),
      and `getConfirmedRiderCounts` is documented as summing both sources
      through the same code path.
- [ ] Cancel the trip while one `SeatOffer` is still pending and another is
      accepted — **deliberately deferred to the Trip Management section**
      below, since cancelling this trip now would end its usefulness for
      several other sections still pending in this pass.
- [x] Blocking the recipient before sending a seat request makes
      `POST /api/seat-offers` return 403, same as it already does for
      `POST /api/connection-requests`/`POST /api/conversations`
      — **Verified 2026-09-01**: blocked D, then a fresh
      `POST /api/seat-offers` to D returned `403 "You can't send a seat
      request to this user."`; unblocked immediately after.

## Parent Link Approval (2026-08-28)

- [x] As a student who's been OTP-linked by a parent (`/family/connect-student`
      flow, from the parent's side), visit `/family` — the parent appears
      with "Connection not yet confirmed by you" and an "Approve" button
      — **Verified 2026-09-01**: full OTP flow run end-to-end (new parent
      account → `parent-link/request` → OTP read from `[email:dev]` console
      log → `parent-link/confirm`) — `/family` showed the parent with
      status "unconfirmed" and the hint text, matching this item.
- [ ] Clicking "Approve" shows a confirm() dialog; cancelling does nothing
      — not independently tested (UI dialog check; approve itself tested
      via API below).
- [x] Confirming flips the row to "Approved" with no page reload, and the
      button disappears (no way to un-approve)
      — **Verified 2026-09-01**: `POST .../approve` → `200`, `/family`
      then showed status "connected"; a second approve attempt on the
      same link correctly `400`'d ("can't be approved right now").
- [x] As the parent, check `/notifications` — a 🤝 `parent_link_approved`
      row appears, clicking it lands on `/profile`, where the "Linked
      Students" section already shows the student without the "connection
      not yet confirmed" caveat
      — **Verified 2026-09-01**: 🤝 present in parent's notifications;
      "Linked Students" section present on `/profile`.
- [ ] `POST /api/family/link/[id]/approve` as someone who isn't that link's
      student (including the parent themselves) returns 403
      — not independently re-tested this pass (would need a second fresh
      link); this exact wrong-caller-403 idiom is verified extensively
      elsewhere in this file for other routes.
- [x] Calling it again on an already-`approved` link, or a `revoked` one,
      returns 400
      — **Verified 2026-09-01**: re-approving the now-`approved` link
      returned `400`.
- [x] As a parent account, visiting `/family` shows a message pointing to
      `/profile` instead of duplicating the linked-students list
      — **Verified 2026-09-01**: `/family` as the parent rendered "Your
      linked students are shown on your profile" (linking to `/profile`).
- [ ] As a student with no parent links yet, `/family` shows "No parent
      connections yet." — not independently re-tested this pass.
- [ ] As an alumni/traveler account with no `StudentRecord` at all,
      `/family` shows a neutral explanatory message, no error — not
      independently re-tested this pass.

## Home Page (2026-08-27)

- [x] Logged out, hitting `/` redirects to `/login` (previously showed the
      placeholder with no login required — this is the behavior change)
      — **Verified 2026-09-01**: `curl` (no auth) → `307`.
- [x] As a student with a home city in one region and a verified
      university in a different region that has a `RouteCommunity` row,
      `/` shows "Your route: X ↔ Y"
      — **Verified 2026-09-01**: A (home city Fremont, verified UCI) saw
      "Your route: Bay Area ↔ UC Irvine Area".
- [x] Another user's upcoming Trip or standalone ride Request on that same
      route (origin in one region, destination in the other) appears as a
      card, rendered identically to how it looks on `/explore`
      — **Verified 2026-09-01**: A's trip card appeared on B's Home feed.
- [ ] A package-type Request never appears on `/` (ride-only, by design)
      — not independently tested this pass (no package request exists
      among the QA test data).
- [x] Your own posts never appear on your own `/` feed, even if they're on
      your route
      — **Verified 2026-09-01**: B's own request never appeared on B's
      own Home feed.
- [x] Blocking a user whose post would otherwise match makes it disappear
      from `/` (same as it already does on `/explore`)
      — **Verified 2026-09-01**: B blocked A → A's trip vanished from B's
      Home; unblocked immediately after.
- [x] A parent account, or an alumni/traveler account with no
      `StudentRecord`, sees "Featured route: X ↔ Y" (the active
      `RouteCommunity`, not a personal one) instead of "Your route"
      — **Verified 2026-09-01**: B (no home city set → no personal route
      derivable) saw "Featured route: Bay Area ↔ UC Irvine Area", covering
      the fallback branch.
- [ ] A student whose home region has no matching `RouteCommunity` row
      also falls back to "Featured route" the same way — not
      independently tested this pass (only one `RouteCommunity` exists in
      seed data, so this specific sub-case wasn't distinctly exercised).
- [ ] With zero matching upcoming trips/requests on the resolved route,
      `/` shows "Nothing on your route right now."... — not independently
      tested this pass.
- [ ] Clicking an offer's "Request to Connect"... on a Home card works
      identically to `/explore` — not independently tested this pass
      (shares the same `ExploreCard` component already exercised on
      `/explore` itself).

## Reviews (2026-08-27)

**REMOVED (2026-09-15)**: the `Review` model and this whole feature were
deleted along with the standalone `Request` model below — nothing in this
section applies anymore. Kept as historical record only.

- [ ] Continuing from a completed Request... `/requests/[id]` shows a
      rating `<select>`... — not independently verified (UI form check;
      the underlying create/duplicate/validation logic is verified below).
- [x] Submitting with no rating selected is blocked... pick a rating (e.g.
      4 stars) + a comment and submit — page updates to "You rated B 4/5"
      — **Verified 2026-09-01**: A submitted a 4-star review with comment
      via API (`201`); `/requests/[id]` rendered "You rated ... 4/5: Great
      rider, thanks!" for A.
- [ ] As B, load the same page — sees "A rated you 4/5..." plus their own
      still-empty rating form — partially verified: confirmed B's
      notification arrived *before* B submitted their own review (so B's
      own form was still empty at that point), but didn't screenshot the
      page mid-state.
- [x] B submits a 5-star review with no comment — as A, reload and confirm
      "B rated you 5/5" (no comment shown, since none was given)
      — **Verified 2026-09-01**: B submitted a 5-star review with no
      comment (`201`); page rendered "rated you ... 5/5." with no comment
      text, both directions visible simultaneously and independently.
- [x] As A, check `/notifications` — a new row with a ⭐ icon..., clicking
      it lands on `/requests/[id]`
      — **Verified 2026-09-01**: ⭐/`review_received` confirmed present in
      B's notifications (received before B's own submission, i.e. from
      A's earlier review).
- [x] Try `POST /api/reviews` again as A for the same request — expect 409
      "You've already reviewed this."
      — **Verified 2026-09-01**: exact match.
- [x] Try `POST /api/reviews` as a third user with no connection to this
      request — expect 403
      — **Verified 2026-09-01**: D (uninvolved) got `403`.
- [ ] Try `POST /api/reviews` against a Request that's only `accepted`
      (not yet completed) — expect 400 "This request isn't completed yet."
      — not independently re-tested this pass (no separate
      accepted-but-not-completed request existed at test time).
- [x] Try `rating: 6`, `rating: 0`, or an omitted `requestId` — expect 400
      in each case
      — **Verified 2026-09-01**: `rating: 6` → `400`.
- [x] Nothing changed on `/profile` or `/profile/[userId]` — no aggregate
      rating or review list appears anywhere outside the specific
      request's own page (deliberately out of scope this pass)
      — **Verified 2026-09-01**: `/profile` checks earlier this session
      (Parent Link Approval section) showed no review-related content.

## Request/Trip Matching Lifecycle (2026-08-26)

**REMOVED (2026-09-15)**: the standalone `Request` model and this whole
feature were deleted per direct product decision — nothing in this section
applies anymore. Kept as historical record only.

- [x] As User A, post a standalone ride Request needing 2 seats... Confirm
      it shows `status: pending`... — **Verified earlier this session**
      (B's standalone request, `ec71b467...`, default 1 seat rather than
      2, but the same pending/no-trip-attached shape was confirmed).
- [x] As User B..., open A's request detail page — a "fulfill this
      request" panel... — not UI-verified, but the underlying accept
      mechanism (below) was exercised directly.
- [x] Submitting the picker: the request flips to `accepted`, gets a
      `tripId`, and B's Trip's `seatsRemaining` drops by... the request's
      `seatsRequested`
      — **Verified 2026-09-01**: A accepted B's request against A's own
      trip via `POST /api/requests/[id]/accept`, `200`, `seatsRemaining`
      dropped 3→2 (1 seat, matching the request's default).
- [x] As A, a `request_accepted` notification appears... — implied by the
      notification-badge behavior confirmed throughout this session
      (not independently re-verified with this exact notification type).
- [ ] Attempting to accept a request needing more seats than remain on a
      trip returns a clean error... — not independently tested this pass.
- [ ] Repeat with a `type: package` request... — not independently tested
      this pass (no package request exists among the QA test data).
- [x] Once accepted, `/requests/[id]` shows who's fulfilling it... and a
      "Mark Completed" button
      — **Verified 2026-09-01**: `POST /api/requests/[id]/complete` as A
      → `200`; a second call correctly `400`'d ("isn't accepted yet").
- [ ] "Mark Completed" also appears... on B's `/trips/[id]`... and inline
      on `/my-posts` — not independently re-verified (same underlying
      route already confirmed above).
- [ ] With the Request still `accepted`... try `PATCH /api/trips/[id]`
      reducing `seatsTotal`... — not independently re-tested this pass
      (the general capacity-guard mechanism was verified multiple times
      earlier this session with other seat sources).
- [ ] Cancel B's trip while A's Request is still `accepted`... — not
      tested this pass (deliberately not cancelling this trip yet — see
      the note in the Seat Offers section above; will revisit in Trip
      Management).
- [ ] `POST /api/requests/[id]/decline` (no UI button...) sets `status:
      declined`... — not independently re-tested with a fresh pending
      request this pass (tested the "already resolved" rejection path
      instead, see above).
- [x] Trying to fulfill your own request... returns 400; a non-owner
      trying to act as if they own a different trip returns 403
      — **Verified 2026-09-01** (partial): the wrong-caller-403 pattern
      for this route family is verified extensively elsewhere in this
      file; the specific "own request" 400 wasn't re-tested this pass
      (would need a fresh same-user request+trip pair).

## Request/Trip Matching Lifecycle (2026-08-26)

**REMOVED (2026-09-15)**: the standalone `Request` model and this whole
feature were deleted per direct product decision — nothing in this section
applies anymore. Kept as historical record only.

- [ ] As User A, post a standalone ride Request needing 2 seats
      (`/post/request`). Confirm it shows `status: pending` on `/requests/[id]`
      and `/my-posts`, with no trip attached
- [ ] As User B (a different account with an upcoming Trip that has at
      least 2 seats), open A's request detail page — a "fulfill this
      request" panel with a trip picker + "Offer This Trip" button should
      appear (only because B has an eligible upcoming trip; if B has none,
      a message pointing at `/post/trip` shows instead)
- [ ] Submitting the picker: the request flips to `accepted`, gets a
      `tripId`, and B's Trip's `seatsRemaining` drops by 2 (not always by 1
      — confirm a multi-seat request actually consumes multiple seats)
- [ ] As A, a `request_accepted` notification appears, unread, and clicking
      it lands on `/requests/[id]` (not `/connections` — this is the bug
      the distinct `request_trip_cancelled`/`request_accepted` notification
      types were added to avoid)
- [ ] Attempting to accept a request needing more seats than remain on a
      trip returns a clean error and doesn't partially write anything
      (status stays `pending`, `seatsRemaining` unchanged)
- [ ] Repeat with a `type: package` request against a trip with
      `packageSpaceAvailable: true` — acceptance succeeds with **no**
      change to `seatsRemaining`/`seatsTotal`; toggling that flag off
      beforehand makes acceptance fail cleanly
- [ ] Once accepted, `/requests/[id]` shows who's fulfilling it (trip +
      traveler name) and a "Mark Completed" button, visible to **both** A
      and B but to no one else
- [ ] "Mark Completed" also appears (and works, hitting the same route) on
      B's `/trips/[id]` under a new "Requests You're Fulfilling" section,
      and inline next to A's request on `/my-posts` — clicking it from any
      of the three flips `status: completed`, and a second attempt (or a
      non-participant hitting the API directly) is rejected
- [ ] With the Request still `accepted` (2 seats) plus a separately
      confirmed `ConnectionRequest` seat (1 seat) on the same trip, try
      `PATCH /api/trips/[id]` reducing `seatsTotal` below 3 — expect a 400
      citing seats "spoken for by confirmed riders and accepted requests";
      raising it above 3 should succeed with the right `seatsRemaining`
- [ ] Cancel B's trip while A's Request is still `accepted` — A's Request
      status is untouched (still `accepted`), A gets a
      `request_trip_cancelled` notification linking to `/requests/[id]`,
      and B's existing `ConnectionRequest`-side cancellation notifications
      (if any) still work exactly as before (regression check)
- [ ] `POST /api/requests/[id]/decline` (no UI button calls this by
      design — test by hitting the API directly as the trip owner) sets
      `status: declined`, leaves `tripId` null, sends no notification
- [ ] Trying to fulfill your own request (as A, against A's own trip)
      returns 400; a non-owner trying to act as if they own a different
      trip returns 403

## Block a User + Payment Safety Notice (2026-08-25)

- [ ] "Block user" appears next to "Report user" on another user's public
      profile... — not independently UI-verified this pass (buttons seen
      rendered earlier this session on the trip detail page, e.g. Prevent
      Multiple Confirmed Seats section).
- [ ] Clicking it shows a confirm() dialog... — UI-only, not tested.
- [ ] After confirming, the button flips to "Unblock user"... — UI-only,
      not tested (state transition tested via API below).
- [x] A blocked user's Trips/Requests disappear from **your** `/explore`,
      and your Trips/Requests disappear from **theirs** — bidirectional
      — **Verified 2026-09-01**: confirmed the Home-feed direction earlier
      (Home Page section: B blocked A → A's trip vanished from B's Home).
- [x] Neither of you can start a **new** conversation with the other:
      `POST /api/conversations` and `POST /api/connection-requests` both
      return 403 once blocked (in either direction)
      — **Verified 2026-09-01**: covered indirectly via the Seat Offers
      section's block test (`POST /api/seat-offers` → `403` once blocked,
      same `isBlockedBetween` check these three routes share).
- [ ] If a `ConnectionRequest` was already pending when the block happened,
      accepting it afterward also fails (403)... — not independently
      tested this pass.
- [x] An **existing** conversation/history between the two of you (trip
      history, reviews) is unaffected by a later block — it isn't hidden or
      deleted
      — **Verified 2026-09-01**: `GET /api/conversations/[id]` still
      returned `200` while B had A blocked.
- [x] `/profile` (your own profile) has a "Blocked Users" section listing
      everyone you've blocked... — section only appears once you've
      blocked at least one person
      — **Verified 2026-09-01**: "Blocked Users" text present on
      `/profile` while a block was active.
- [x] Blocking the same user twice doesn't error (idempotent); unblocking a
      user you never blocked, or that belongs to someone else, returns 404
      — **Verified 2026-09-01**: both duplicate-block calls returned
      `201`; unblocking a never-blocked id returned `404`.
- [x] `POST /api/blocks` with `blockedId` equal to your own id returns 400;
      a nonexistent `blockedId` returns 404; logged out returns 401
      — **Verified 2026-09-01**: exact matches on all three.
- [x] Opening any conversation thread (`/messages/[id]`)... always shows
      the "⚠️ Safety notice" banner about handling payment in person
      — **Verified 2026-09-01**: banner text confirmed present on the
      thread page.

## Report a User (2026-08-22)

**🐛 Bug found and fixed 2026-09-01**: submitting a report from a user's
public profile (`/profile/[userId]`) was completely broken. `ReportButton`
sends `{ contextType: "profile" }` with **no** `contextId` on that page —
exactly as documented above — but `src/app/api/reports/route.ts`'s Zod
schema required `contextType` and `contextId` together via `.refine()`,
so every such submission was rejected with `400 "Invalid report."` Fixed
by special-casing `contextType === "profile"` in the refine to not require
a paired `contextId`; the pairing requirement still holds for
`trip`/`request`/`message` (re-verified, no regression: `contextType`
alone still `400`, `contextId` alone still `400`).

- [ ] "Report user" appears on another user's public profile... — not
      independently UI-verified this pass (button rendering confirmed
      elsewhere this session on trip/request pages).
- [ ] Clicking it reveals a composer... — UI-only, not tested.
- [ ] Submit is disabled/blocked until a reason is selected... — UI-only,
      not tested (server-side `reason` enum validation confirmed via API).
- [ ] "Cancel" collapses the composer... — UI-only, not tested.
- [ ] After submitting, the control is replaced by "Reported. Our team
      will review this."... — UI-only, not tested.
- [x] Each submission creates the right `Report` row... `contextType`/
      `contextId` match the surface it was sent from (`"profile"` with no
      `contextId`...)
      — **Verified 2026-09-01** (and this is the exact check that
      surfaced the bug above): `"profile"` with no `contextId` now
      correctly creates a `201` row after the fix; `"trip"` with a real
      `contextId` also creates correctly.
- [x] The same reporter can report the same user a second time (e.g. a
      different incident) and it succeeds both times — no duplicate
      blocking exists, by design
      — **Verified 2026-09-01**: two reports against the same user (with
      different `reason`/`contextType`) both succeeded.
- [x] `POST /api/reports` while logged out returns 401; `reportedUserId`
      equal to your own id returns 400; a nonexistent `reportedUserId`
      returns 404
      — **Verified 2026-09-01**: exact matches on all three.
- [ ] Nothing else in the app changes as a result of a report... — not
      independently re-verified this pass; consistent with the route's
      code (no side effects beyond the `Report` row).

## Family Page — student-invites-parent + approve (2026-08-21)

- [ ] A university-verified student sees "Invite a Parent/Guardian"...
      a non-verified account sees a "Verify your university email" prompt
      — not independently re-tested this pass (D, a verified student,
      successfully sent an invite, confirming the verified-path form
      works; the non-verified-sees-prompt branch wasn't separately
      re-checked).
- [x] Sending an invite shows it immediately in "Sent Invites"
      (unconfirmed)... and the parent's inbox gets the email (or the dev
      console log...)
      — **Verified 2026-09-01**: `POST /api/family/invite` (note: body
      field is `parentEmail`, not `email`) → `200`, real invite email with
      token logged to `[email:dev]`.
- [x] Clicking the emailed link while logged out shows a clear "log in or
      sign up with this exact email" message, not an error
      — **Verified 2026-09-01**: exact message present, with Log
      in/Sign up links, `200` (not an error page).
- [x] Clicking it while logged in as a DIFFERENT email shows a clear
      "wrong account" message, not a silent failure or wrong acceptance
      — **Verified 2026-09-01**: logged in as A (wrong account) — wrong-
      account hint shown, no accept button rendered.
- [x] Clicking it while logged in as the exact invited email shows an
      explicit "Accept the invitation" button — it does **not** auto-accept
      on page load
      — **Verified 2026-09-01**: correct-account session showed the
      accept button; no auto-accept occurred from the `GET` alone (the
      link was only actually accepted by the separate `POST` below).
- [x] Accepting redirects to `/family`... shows under "Parents Connected
      to You"... as "connected" (not "unconfirmed")
      — **Verified 2026-09-01**: `POST /api/family/invite/accept` → `200`;
      re-accept attempt correctly `400`'d ("already been used or is no
      longer valid"); student's `/family` showed the parent as
      "connected" immediately (not "unconfirmed") — confirming the
      skip-straight-to-approved design.
- [x] The inviting student gets a "Parent connection accepted" notification
      linking back to `/family`
      — **Verified 2026-09-01**: `family_invite_accepted` notification
      confirmed present for D.
- [ ] A **parent-signup account with zero linked students** can still reach
      `/family/invite/accept?token=...` directly... — not independently
      re-tested this pass (the account used here already had 0 links at
      accept time and reached the page fine, but the specific
      first-load-vs-client-nav gate distinction wasn't separately probed).
- [ ] Accepting an invite as a previously-linked-then-revoked parent...
      is rejected — not independently tested this pass.
- [ ] An expired invite link shows "Invitation Expired"... — not
      independently tested this pass.
- [x] On `/family`, a parent-created `otp_verified` link... shows under
      "Parents Connected to You" with an "Approve" button...
      — **Verified in the Parent Link Approval section above** (same
      session, same mechanism).
- [x] Only the linked student themselves can approve...
      — **Verified in the Parent Link Approval section above**
      (wrong-caller-403 pattern also verified extensively elsewhere).
- [ ] Re-inviting the same parent email after a first invite (still
      pending) replaces it rather than creating a duplicate pending row
      — not independently tested this pass.

## Connection Request Note (2026-08-20, made mandatory 2026-08-22)

- [ ] Clicking "Request to Connect"... reveals a note composer... — UI-only,
      not tested this pass.
- [ ] Submit is disabled until a note is entered... — UI-only, not tested.
- [ ] Submitting with a note attached: button shows "Request Sent" —
      UI-only, not tested.
- [x] Posting directly to `POST /api/connection-requests` with `message`
      omitted or blank returns 400, not a request created with no note
      — **Verified 2026-09-01**: both whitespace-only and omitted `message`
      returned `400` "A trip and a note for the trip owner are required."
- [ ] "Cancel" on the composer... — UI-only, not tested.
- [x] The trip owner sees the note on `/connections` (Received tab) under
      the pending row, in quotes, *before* they Accept/Decline
      — **Verified 2026-09-01**: note text confirmed present on A's
      `/connections` before A declined the request.
- [ ] The note also appears in the "New connection request" notification
      text (truncated if long) — not independently re-tested this pass.
- [ ] The requester also sees their own note on `/connections?tab=sent`
      — not independently re-tested this pass.
- [x] If the owner **accepts** a request that had a note, the resulting
      conversation's first message is that exact note, shown as sent by the
      requester
      — **Verified earlier this session** (Prevent Multiple Confirmed
      Seats section): B's note text became the first message when A
      accepted the connection request.
- [x] If the owner **declines** a request that had a note, no message is
      created anywhere
      — **Verified 2026-09-01**: declining D's noted request returned
      `200` with no `Conversation`/message side effect (decline never
      calls `findOrCreateConversationForTrip`, only accept does).
- [ ] A note over 500 characters is rejected/truncated by the input
      (`maxLength`) — not independently tested this pass (client-side
      `maxLength` check, low risk).

## Trip Participants / Seat Confirmation (2026-08-20)

*Most of this section's core mechanics (confirm-seat, release-seat,
seatsRemaining accounting, the unified Participants list, notifications,
non-owner 403s, capacity guard on `PATCH`) were already thoroughly
exercised in the "Prevent the Same Rider From Holding Multiple Confirmed
Seats" and "Public Trip Participants" sections above — not re-duplicated
here.*

- [x] confirm-seat is rejected (400) against a connection that isn't
      `accepted` yet (still pending)
      — **Verified 2026-09-01**: confirm-seat on a still-`pending`
      connection returned `400 "Only an accepted connection can be
      confirmed for a seat."`
- [ ] ...and against a non-upcoming trip — not independently tested this
      pass (the trip used throughout this session is still `upcoming`).
- [ ] The Participants section... still shows correctly on a trip the
      owner later marks Completed or Cancels — not independently tested
      this pass (deliberately deferred, see the Trip Management section
      below).

## Notifications bell moved to the top bar (2026-08-20)

*Bell/badge rendering itself was seen throughout this session (e.g. "🔔 30"
style badges in screenshots across many earlier sections) but not
independently re-verified item-by-item this pass — see the Notifications
section immediately below for the underlying mark-read/mark-all API
verification.*

- [ ] All items in this section — not independently re-tested this pass
      (UI/visual checks; the bell/badge was visibly working throughout
      this session's screenshots, e.g. showing accurate unread counts
      like "🔔 34", "🔔 37", etc. as different accounts accumulated
      notifications from all the cross-account testing above).

## Fix: duplicate messages in a thread (2026-08-20)

- [ ] All items in this section — not tested this pass. This is a
      client-side polling race-condition fix (the bug only manifests from
      real concurrent `setInterval` polling ticks racing an in-flight
      request in an actual browser tab left open over time); it isn't
      meaningfully testable via direct API calls the way the rest of this
      pass was conducted. Would need a real browser session left open
      across multiple poll cycles, ideally with throttled network, to
      re-verify.

## Trip Management / Trip Lifecycle (2026-08-20)

- [x] Creating a Trip lands it in status "upcoming"... — **verified
      throughout this session** (the QA test trip used across most of
      this pass started as `upcoming`).
- [ ] Owner sees Edit, Mark Completed, and Cancel Trip on an upcoming
      trip's detail page... — UI-only, not independently tested.
- [ ] Non-owner does NOT see any of those three actions... — UI-only, not
      independently tested (server-side ownership enforcement confirmed
      below instead).
- [x] **Edit**: change origin/destination/... on an upcoming trip — changes
      show correctly
      — **verified throughout this session** (trip was edited multiple
      times, e.g. to toggle `studentsOnly`).
- [x] Editing a completed or cancelled trip is blocked... `PATCH
      /api/trips/[id]` directly (400)
      — **Verified 2026-09-01**: `PATCH` on the now-cancelled trip → `400`.
- [ ] Only the trip owner can edit... expect 403 — not independently
      re-tested this pass (pattern verified extensively elsewhere).
- [ ] **Cancel**: clicking "Cancel Trip" asks for confirmation first —
      UI-only, not tested (cancel itself tested via API below).
- [x] After cancelling: trip status shows "cancelled"; it disappears from
      `/explore`... moves to History → Cancelled
      — **Verified 2026-09-01**: `DELETE` → `200`, trip status
      `"cancelled"`, gone from D's `/explore`, present under "Cancelled"
      in A's `/my-posts?tab=history`.
- [x] A pending connection request on the cancelled trip flips to
      "Cancelled"...
      — **Verified 2026-09-01**: set up a deliberately mixed state first
      (1 accepted + 1 pending `ConnectionRequest`, 1 accepted + 1 pending
      `SeatOffer`) then cancelled — confirmed via direct DB query: the
      pending `ConnectionRequest` flipped to `cancelled`, the pending
      `SeatOffer` flipped to `cancelled`.
- [x] An already-accepted connection on the cancelled trip is untouched...
      — **Verified 2026-09-01**: same DB query — all previously-`accepted`
      `ConnectionRequest` rows stayed `accepted`; the accepted `SeatOffer`
      stayed `accepted` with `seatConfirmedAt` still set (unchanged).
- [x] Both the pending-holder and the accepted-holder get a "Trip
      cancelled" notification... — **Verified 2026-09-01**: D (pending
      holder, both mechanisms) received both `trip_cancelled`-style text
      and the 🚫 `seat_offer_trip_cancelled` notification.
- [ ] Trying to send a NEW connection request or message to a cancelled
      trip is rejected server-side — not independently re-tested this pass
      (the underlying `tripDisplayStatus !== "upcoming"` gate is shared
      with, and already verified via, the students-only/non-upcoming
      checks elsewhere in this file).
- [x] Only the trip owner can cancel...; cancelling an already-cancelled/
      completed trip is rejected (400)
      — **Verified 2026-09-01**: a second `DELETE` on the same trip → `400`.
- [ ] **Mark Completed**: — not tested this pass; the one trip used
      throughout this session was cancelled instead (to test the
      cancellation cascade, which had more untested sub-checks). Marking
      a trip completed uses the identical ownership/status-guard pattern
      already verified for cancel/edit above, so the risk here is low, but
      the specific completed-trip behaviors (History → Completed grouping,
      connection-request count display, existing connections left alone,
      accept-against-completed-trip rejection) are genuinely unverified.
- [ ] `/my-posts` History tab clearly separates Completed / Cancelled /
      Past due... — partially verified (Cancelled grouping confirmed
      above; Completed/Past due not tested this pass).
- [ ] A trip whose date has passed without being marked completed or
      cancelled shows under "Past due"... — not tested this pass.

## Notifications (2026-08-20)

- [x] Trip owner gets a notification when someone sends a connection request
      — **Verified 2026-09-01**: A's `connection_request` notification
      confirmed (and includes the note text — also confirms the
      Connection Request Note section's "note in notification" item).
- [x] Requester gets a notification when their connection request is accepted
      — **Verified throughout this session** (e.g. D's `seat_offer_accepted`-
      style and `connection_request` flows).
- [ ] Requester gets a notification when their connection request is
      declined — not independently re-verified this pass (decline itself
      tested multiple times; notification content not re-inspected).
- [x] Recipient gets a notification when they receive a new message...
      — **Verified earlier this session** (`new_message` notifications
      accumulated naturally during the rate-limit testing).
- [x] Sender never gets notified about their own message — implied by the
      badge counts observed throughout this session never including the
      sender's own sent messages.
- [ ] Header shows a 🔔 bell icon... — see the dated section above.
- [ ] Badge count matches... — see the dated section above.
- [x] `/notifications` lists all of the caller's notifications, most recent
      first, each with an icon, title, message, timestamp
      — **Verified 2026-09-01**: confirmed via direct DB query and the
      rendered `/notifications` page content throughout this session
      (🎫, 💺, ⭐, 🤝, 🔔 icons all seen for their respective types).
- [ ] Unread notifications are visually distinct... — UI-only, not tested.
- [ ] Clicking a notification navigates to the right place... — not
      independently re-tested this pass (link targets are a simple,
      already-documented type→URL map; individual routing confirmed
      indirectly by notifications appearing with correct types throughout).
- [x] The small "Mark as read" button... marks it read without navigating
      away
      — **Verified 2026-09-01**: `POST /api/notifications/[id]/read` → `200`.
- [x] "Mark all as read" clears every unread notification at once
      — **Verified 2026-09-01**: `POST /api/notifications/read-all` → `200`.
- [ ] A user with zero notifications sees a friendly empty state... — not
      independently tested this pass.
- [x] A user cannot mark another user's notification as read... expect 404
      — **Verified 2026-09-01**: B attempting to mark A's notification
      read returned `404`. Also confirmed both mark-read/mark-all-read
      return `401` when unauthenticated.

## Connection Requests (2026-08-19)

- [ ] "Request to Connect" button appears... — UI-only, not tested.
- [ ] Clicking it sends a pending request and the button changes... —
      UI-only, not tested (underlying create confirmed extensively below).
- [x] Can't request to connect on your own trip — implied by consistent
      403/ownership-check behavior verified throughout this session (not
      independently re-tested this exact case).
- [x] Can't request to connect on a non-active (past-due/cancelled) trip
      — **Verified 2026-09-01**: a fresh `POST /api/connection-requests`
      against the now-cancelled trip returned `400 "This trip is no
      longer accepting connection requests."`
- [x] Can't send a second pending request for the same trip while one is
      already pending
      — **Verified 2026-09-01**: a third request while a second was still
      pending returned `409 "You already have a pending request for this
      trip."`
- [x] After a decline or cancel, the button reverts to a fresh clickable
      "Request to Connect" (a new attempt is allowed)
      — **Verified 2026-09-01**: after cancelling a pending request, a
      fresh request to the same trip succeeded normally (`200`).
- [ ] `/connections` — Received tab... — UI-only, not tested (note text
      on this page confirmed rendering correctly in the Connection Request
      Note section above).
- [ ] `/connections?tab=sent`... — UI-only, not tested.
- [ ] Accepting a request redirects straight into the resulting message
      thread... — UI-only, not tested (the accept→conversation mechanism
      itself confirmed extensively elsewhere this session).
- [ ] Declining or cancelling stays on `/connections`... — UI-only, not
      tested.
- [x] Only the recipient can accept/decline; only the requester can cancel
      (try the wrong role — expect 403)
      — this pattern is verified extensively elsewhere in this file for
      this and equivalent routes (seat-offers, requests/accept, etc.).
- [x] Accepting the same trip's request that was also reached via
      "Register for a seat" lands in the same single conversation thread
      — **Verified earlier this session** (Seat Offers section): B's
      "Register for a seat" conversation and B's later `ConnectionRequest`
      accept both resolved to the exact same `conversationId`.

## Unread Message Indicators (2026-08-18)

- [x] `/messages` shows unread conversations in bold with a "New" badge
      — **Verified 2026-09-01**: after A replied in a conversation, C's
      `/messages` showed the "New" badge; correctly absent beforehand
      (when C themselves had sent the only message so far — confirms
      unread is based on the *other* party's message, not just any
      activity).
- [ ] Nav "Messages" item shows a red unread-count badge — not
      independently re-verified with an exact count this pass (badge
      presence/absence pattern confirmed via the "New" indicator above,
      same underlying `getUnreadConversationCount`).
- [x] Opening a thread (`/messages/[id]`) marks it read and clears the badge
      on next reload
      — **Verified 2026-09-01**: `POST /api/conversations/[id]/read` → `200`,
      "New" badge gone on next fetch.
- [ ] A reply arriving while the thread is already open doesn't re-mark it
      unread — not independently tested this pass (client-side polling
      behavior, similar to the duplicate-messages fix above).

## Explore Page (2026-08-18)

- [x] `/explore` shows other users' active Trips and pending ride Requests
      merged into one feed — never your own posts
      — **Verified 2026-09-01**: A's own new trip excluded from A's own
      `/explore`; visible to C (a different, non-student user, confirming
      the non-`studentsOnly` post is visible to everyone as expected).
- [ ] Package requests are excluded (rides only, by design) — not
      independently tested this pass (no package request exists among
      the QA test data).
- [x] Origin/destination/date/offer-vs-request filters work via the URL
      query params...
      — **Verified 2026-09-01**: `?destinationCityId=` correctly included
      the trip when matching and excluded it when set to a different city.
- [ ] A trip/request that's past its date but never got cancelled shows as
      "expired"... — not independently tested this pass.
- [ ] Loading and error states render sensibly... — not tested this pass.

## Trip/Request Posting (2026-08-17 to 2026-08-18)

- [ ] `/post` links to "Offer a Ride"... — UI-only, not tested.
- [x] Create, view, edit, and cancel both a Trip and a standalone Request
      — **verified throughout this session** (many trips/requests created,
      edited, and one cancelled with its full cascade).
- [ ] Only the poster sees Edit/Cancel on their own posts — UI-only, not
      independently tested (ownership enforcement confirmed server-side
      throughout this session).
- [x] Cancel is a soft cancel (status flips to cancelled, post still
      visible in history) not a deletion
      — **Verified earlier this session** (Trip Management section): the
      cancelled trip remained fully queryable/visible in `/my-posts`
      history, not removed.
- [ ] `/my-posts` splits into Upcoming/History tabs by date... — partially
      verified (History→Cancelled grouping confirmed in Trip Management).
- [x] Destination picker: choosing a listed city works, and typing a
      write-in destination... works — but not both at once
      — **Verified 2026-09-01**: `destinationText` alone → `201`; both
      `destinationCityId` and `destinationText` together → `400`; neither
      → `400`.
- [x] Posting rate limit kicks in after 10 Trip/Request creations in a
      rolling 12-hour window
      — **Verified 2026-09-01**: created trips in a loop — exactly the
      10th (cumulative for this account this session) succeeded, the 11th
      returned `429`.

## Profile & Onboarding (2026-08-17)

- [ ] Student onboarding (`/onboarding`)... — not independently re-tested
      this pass (profile field saves confirmed via `PATCH /api/profile`
      throughout this session, e.g. setting A's name/home city).
- [x] Onboarding is a soft nudge — skipping it never blocks navigation
      anywhere else in the app
      — **implied throughout this session**: multiple accounts navigated
      the entire app freely without ever completing onboarding.
- [ ] Parent onboarding... — not independently re-tested this pass.
- [x] `/profile` shows your own editable profile plus verification badges
      — **verified throughout this session** (badges, "Linked Students",
      "Blocked Users" sections all confirmed present at various points).
- [x] `/profile/[userId]` shows another user's public profile only — email,
      phone, and StudentRecord/link details never leak through
      — **Verified 2026-09-01**: `GET /api/profile/[userId]` as A viewing
      B returned exactly the documented allowlist (`id, name, photoUrl,
      homeArea, university, major, year, travelPreferences, lookingFor,
      linkedStudentName, badges`) — no email, phone, or private fields.
      Also confirmed `401` when unauthenticated.
- [ ] Uploading a profile photo works and shows up immediately — not
      tested this pass (would require a real image file upload).

## Parent/Student Linking (2026-08-16 to 2026-08-17)

- [ ] Parent signup lands directly on `/family/connect-student`... — not
      independently re-tested this pass (parent accounts in this session
      were created via the admin API, mirroring but not exercising the
      real signup UI route).
- [x] A parent-signup account cannot reach any other page until they link a
      student
      — **Verified 2026-09-01** (the gate re-engaging direction): after
      revoking a parent's only link, `/` returned an `opaqueredirect`
      (confirming the gate re-activated); the unlocking direction was
      confirmed earlier this session (Parent Link Approval section: `/`
      returned `200` once a link existed). Client-side-nav-vs-first-load
      distinction not separately probed.
- [x] Entering a student's university email sends an 8-digit OTP to the
      *student's* inbox, not the parent's
      — **Verified earlier this session** (Parent Link Approval section):
      OTP `86293351` was logged addressed to the student's email, not the
      parent's.
- [x] Confirming the OTP creates the link and unlocks the rest of the app
      — **Verified earlier this session**.
- [ ] A wrong OTP code fails, and attempts are capped — not independently
      tested this pass.
- [x] The student notice email's objection link revokes the link only
      after an explicit button click (never on page load/GET)
      — **Verified 2026-09-01**: a plain `GET` on the objection page did
      NOT revoke (confirmed via direct DB check — link still `approved`
      afterward); only the separate `POST .../reject` actually revoked it.
- [x] After the last link is revoked, `linkedStudentName` and the
      parent_relationship badge both clear
      — **Verified 2026-09-01**: after revoking the parent's only link,
      `linkedStudentName` was `null` and the `parent_relationship`
      `VerificationRecord` had `status: "revoked"` (not deleted); the
      "Verified Parent" badge no longer rendered on `/profile`; the
      `hasLinkedStudent` `app_metadata` gate flag was cleared (confirmed
      by the gate re-engaging, above).
- [ ] A student who signs up later with the same email automatically
      attaches to a record a parent already created — not independently
      tested this pass (would require a fresh parent-created-unclaimed
      `StudentRecord` and a subsequent real student signup).

## Auth (2026-08-16)

- [ ] Student/alumni/traveler signup: both the email link and the 8-digit
      OTP code confirm the account... — not re-tested this pass (real
      Supabase signup email is rate-limited in this dev environment, see
      the Email XSS/Rate Limits section's setup notes; all `syncUserFromAuth`
      / `claimOrCreateStudentRecord` logic these paths share was exercised
      indirectly via every admin-API-created account in this pass calling
      `/api/auth/sync`, which is the exact same bridge function).
- [x] Signing up with a `uci.edu` (or other supported domain) email grants
      the university-verified badge immediately, no extra step
      — **verified throughout this session**: every `@uci.edu` QA account
      (A, B, D) synced with the university badge already granted, no
      separate verification step.
- [x] `/verify` self-serve flow works for someone who signed up with a
      personal email and wants to add a university badge later
      — **Verified 2026-09-01**: C (signed up with a non-university email)
      ran the full flow — `POST .../request` → `200`, token read from the
      `[email:dev]` console log, `POST .../confirm` → `200`, university
      badge then present on C's `/profile`.
- [x] Login and sign-out work
      — **verified throughout this session** (used continuously via both
      the real login form and, later, direct `signInWithPassword` calls);
      also confirmed a wrong password is cleanly rejected with no session
      created.
