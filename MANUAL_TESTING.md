# Manual Testing Checklist

A running list of every feature built in this project, kept up to date after
each feature is added, so it can be walked through by hand. Newest features
are at the top since they're the least likely to have been tested yet. Check
items off as you verify them; leave unchecked ones for the next pass.

No automated test suite exists in this project (see CLAUDE.md) — this file
is the actual test coverage.

## Students-Only Posts (2026-08-28)

- [ ] As a student account (has a claimed `StudentRecord` — signed up with,
      or later verified, a real university email), go to `/post/trip` or
      `/post/request` — a "🎓 Visible to students only" checkbox appears at
      the bottom of the form
- [ ] As a parent account, or an alumni/traveler account that never
      verified a university email, go to `/post/trip` or `/post/request` —
      the checkbox does **not** appear at all
- [ ] As a non-student, try `POST /api/trips` (or `/api/requests`) directly
      with `studentsOnly: true` in the body — rejected with 403 "Only
      students can create a students-only post."
- [ ] As a student, check the box and post a Trip and a Request — both
      succeed, and the detail page (`/trips/[id]` / `/requests/[id]`) shows
      "🎓 Visible to students only" under the status line
- [ ] As a different student account, browse `/explore` and `/` (Home) —
      both students-only posts appear, each with a "🎓 Students only" pill
      on the card
- [ ] As a parent (or non-student) account, browse `/explore` and `/` —
      neither students-only post appears anywhere in the feed
- [ ] As that same non-student account, navigate directly to the
      students-only post's URL (`/trips/[id]` or `/requests/[id]`) — a
      normal 404 page, not an error or a "not allowed" message
- [ ] As the owner (a student) of a students-only post, still viewing it as
      the non-owner-would-see-it is unaffected — you always see your own
      post regardless of student status
- [ ] As the non-student account, hit the interaction endpoints directly
      with the students-only trip/request's real id — `POST
      /api/connection-requests`, `POST /api/conversations` (both with the
      studentsOnly `tripId`), and `POST /api/requests/[id]/accept` (with
      the studentsOnly Request's id) all return 403 "...only visible to
      students."
- [ ] As the student owner, edit the post via `/trips/[id]/edit` or
      `/requests/[id]/edit` — the checkbox reflects its current state and
      can be toggled off (post becomes visible to everyone) or back on
- [ ] On `/my-posts`, a 🎓 prefix appears on any of your own posts (in
      every tab/section — Upcoming, Completed, Cancelled, Past due) that
      have `studentsOnly` set, and does **not** appear on ones that don't
- [ ] Confirm a normal (non-students-only) post is completely unaffected
      end-to-end for both student and non-student viewers — no regression
      to the existing create/browse/view flow

## Message List: Timestamps + Archive/Delete (2026-08-28)

- [ ] `/messages` — every row now shows a timestamp under the preview text
      (the last message's time, or the conversation's creation time if
      somehow no message exists yet)
- [ ] Each row has "Archive" and "Delete" buttons below the clickable area
      — clicking the row itself still opens the thread; clicking a button
      doesn't (confirms the row was correctly split into a link + actions
      region, not one big anchor)
- [ ] Click "Archive" on a row — it disappears from the default Inbox tab
      immediately (no reload)
- [ ] Click the "Archived" tab (`/messages?tab=archived`) — the archived
      conversation appears there with an "Unarchive" button; clicking it
      moves it back to Inbox
- [ ] Have the other participant send a new message to an archived
      conversation — it stays archived (archiving is sticky, does **not**
      auto-clear on new activity) — confirm by reloading `/messages?tab=archived`
- [ ] Click "Delete" on a row — a confirm() dialog appears; cancelling does
      nothing; confirming removes it from **both** Inbox and Archived tabs
- [ ] Have the other participant send a new message to a deleted
      conversation (or accept a `ConnectionRequest`/register interest again
      on the same trip pair) — the conversation reappears in your Inbox
      automatically, no manual action needed
- [ ] The nav "Messages" unread badge count excludes archived and deleted
      conversations — mark one row unread (have the other party message
      you), archive it, confirm the badge count drops by one even though
      the message itself is still technically unread
- [ ] `DELETE /api/conversations/[id]` / `.../archive` / `.../unarchive`
      while logged out returns 401; against a conversation you're not a
      participant in returns 404 (not 403 — matches the existing
      don't-leak-existence pattern on this route family)
- [ ] Confirm a conversation you deleted or archived is completely
      unaffected from the OTHER participant's point of view — their
      `/messages` list, unread badge, and thread all look exactly as if
      you'd done nothing

## Seat Offers (2026-08-28)

- [ ] As User B (not the trip owner), message User A's (the trip owner's)
      upcoming trip via "Register for a seat" — a `Conversation` now
      exists. As A, open that same thread — a "Send Seat Request" button
      appears just above the compose box (only because A owns this trip)
- [ ] As A, click it — a new 💺 bubble appears **inline in the message
      list itself**, positioned chronologically (not above/outside the
      thread), showing "Seat request sent" + a "Cancel" option, and a
      timestamp underneath it in the same style real message bubbles use
- [ ] As B, **without reloading the page**, wait up to ~4s (the poll
      interval) — the same bubble appears in B's view of the thread with
      "Accept seat" / "Decline" buttons live, no manual refresh needed
- [ ] Send a real text message from either side interleaved with the seat
      offer — confirm the bubble and the messages sort correctly by time
      relative to each other in the thread, not grouped separately
- [ ] As B, check `/notifications` — a 💺 `seat_offer_received` row,
      clicking it lands on this same `/messages/[id]` thread
- [ ] B clicks "Accept seat" — the bubble updates in place to "Seat
      request accepted ✓"; `Trip.seatsRemaining` drops by 1. **As A,
      without reloading**, confirm the bubble also updates to the accepted
      state within ~4s (live sync via the same poll that fetches messages)
- [ ] As A, check `/trips/[id]` — B now appears in the "Participants"
      section, in the same unified list as any `ConnectionRequest`-sourced
      riders, with the same Remove control
- [ ] As A, check `/notifications` — a 🎫 `seat_offer_accepted` row
      linking to `/trips/[id]`
- [ ] Repeat with a fresh offer to a different user who instead clicks
      "Decline" — bubble updates to "declined", no capacity change, A gets
      a ✖️ `seat_offer_declined` notification linking back to that thread
- [ ] Send an offer, then as A click "Cancel" on the bubble while it's
      still pending — bubble updates to "cancelled", no notification sent,
      and the "Send Seat Request" button reappears above the compose box
      for a fresh attempt
- [ ] As A, click "Remove" on an accepted bubble — `seatsRemaining`
      increments back, the bubble updates to reflect the seat was removed,
      B disappears from the `/trips/[id]` Participants roster, but the
      historical fact that B once accepted isn't deleted (status stays
      `accepted` under the hood — verify via Prisma Studio if needed)
- [ ] Attempting to send a seat request when `seatsRemaining` is 0, or the
      trip is no longer upcoming — the "Send Seat Request" button is
      hidden/disabled with a "No seats remaining" note, or a clean 400
      from the API if hit directly
- [ ] A non-owner attempting `POST /api/seat-offers` for someone else's
      trip returns 403; a non-recipient attempting to accept/decline
      someone else's seat offer returns 403
- [ ] With a confirmed `SeatOffer` rider (1 seat) plus a separately
      confirmed `ConnectionRequest` rider (1 seat) on the same trip, try
      `PATCH /api/trips/[id]` reducing `seatsTotal` below 2 — expect a 400
      citing seats "spoken for by confirmed riders, accepted requests, and
      accepted seat offers"
- [ ] Cancel the trip while one `SeatOffer` is still pending and another is
      accepted — the pending one's bubble flips to cancelled, the accepted
      one's is untouched, and both recipients get a 🚫
      `seat_offer_trip_cancelled` notification linking back to their thread
- [ ] Blocking the recipient before sending a seat request makes
      `POST /api/seat-offers` return 403, same as it already does for
      `POST /api/connection-requests`/`POST /api/conversations`

## Parent Link Approval (2026-08-28)

- [ ] As a student who's been OTP-linked by a parent (`/family/connect-student`
      flow, from the parent's side), visit `/family` — the parent appears
      with "Connection not yet confirmed by you" and an "Approve" button
- [ ] Clicking "Approve" shows a confirm() dialog; cancelling does nothing
- [ ] Confirming flips the row to "Approved" with no page reload, and the
      button disappears (no way to un-approve)
- [ ] As the parent, check `/notifications` — a 🤝 `parent_link_approved`
      row appears, clicking it lands on `/profile`, where the "Linked
      Students" section already shows the student without the "connection
      not yet confirmed" caveat
- [ ] `POST /api/family/link/[id]/approve` as someone who isn't that link's
      student (including the parent themselves) returns 403
- [ ] Calling it again on an already-`approved` link, or a `revoked` one,
      returns 400
- [ ] As a parent account, visiting `/family` shows a message pointing to
      `/profile` instead of duplicating the linked-students list
- [ ] As a student with no parent links yet, `/family` shows "No parent
      connections yet."
- [ ] As an alumni/traveler account with no `StudentRecord` at all,
      `/family` shows a neutral explanatory message, no error

## Home Page (2026-08-27)

- [ ] Logged out, hitting `/` redirects to `/login` (previously showed the
      placeholder with no login required — this is the behavior change)
- [ ] As a student with a home city in one region and a verified
      university in a different region that has a `RouteCommunity` row,
      `/` shows "Your route: X ↔ Y"
- [ ] Another user's upcoming Trip or standalone ride Request on that same
      route (origin in one region, destination in the other) appears as a
      card, rendered identically to how it looks on `/explore`
- [ ] A package-type Request never appears on `/` (ride-only, by design)
- [ ] Your own posts never appear on your own `/` feed, even if they're on
      your route
- [ ] Blocking a user whose post would otherwise match makes it disappear
      from `/` (same as it already does on `/explore`)
- [ ] A parent account, or an alumni/traveler account with no
      `StudentRecord`, sees "Featured route: X ↔ Y" (the active
      `RouteCommunity`, not a personal one) instead of "Your route"
- [ ] A student whose home region has no matching `RouteCommunity` row
      also falls back to "Featured route" the same way
- [ ] With zero matching upcoming trips/requests on the resolved route,
      `/` shows "Nothing on your route right now." with working links to
      `/explore` and `/post` — no blank page or error
- [ ] Clicking an offer's "Request to Connect" (or seeing "Connected" if
      you already have one) on a Home card works identically to the same
      trip's card on `/explore` — confirms the batched `ConnectionRequest`
      status lookup carried over correctly

## Reviews (2026-08-27)

- [ ] Continuing from a completed Request (User A posted, User B fulfilled
      and marked it completed — see the Matching Lifecycle checklist below):
      as A, `/requests/[id]` shows a rating `<select>` + optional comment
      form, no "they reviewed you" text yet (B hasn't reviewed)
- [ ] Submitting with no rating selected is blocked (disabled submit); pick
      a rating (e.g. 4 stars) + a comment and submit — page updates to
      "You rated B 4/5" in place of the form, no reload needed
- [ ] As B, load the same page — sees "A rated you 4/5: <comment>" plus
      their own still-empty rating form (they haven't reviewed A yet)
- [ ] B submits a 5-star review with no comment — as A, reload and confirm
      "B rated you 5/5" (no comment shown, since none was given)
- [ ] As A, check `/notifications` — a new row with a ⭐ icon (not the
      generic 🔔 fallback), title "You got a new review," clicking it
      lands on `/requests/[id]`
- [ ] Try `POST /api/reviews` again as A for the same request — expect 409
      "You've already reviewed this."
- [ ] Try `POST /api/reviews` as a third user with no connection to this
      request — expect 403
- [ ] Try `POST /api/reviews` against a Request that's only `accepted`
      (not yet completed) — expect 400 "This request isn't completed yet."
- [ ] Try `rating: 6`, `rating: 0`, or an omitted `requestId` — expect 400
      in each case
- [ ] Nothing changed on `/profile` or `/profile/[userId]` — no aggregate
      rating or review list appears anywhere outside the specific
      request's own page (deliberately out of scope this pass)

## Request/Trip Matching Lifecycle (2026-08-26)

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
      profile (`/profile/[userId]`), a trip you don't own, a request you
      don't own, and a message thread — never on the equivalent page for
      yourself
- [ ] Clicking it shows a confirm() dialog explaining what blocking does;
      cancelling the dialog does nothing
- [ ] After confirming, the button flips to "Unblock user" with no page
      reload; clicking that (with its own confirm dialog) flips it back
- [ ] A blocked user's Trips/Requests disappear from **your** `/explore`,
      and your Trips/Requests disappear from **theirs** — bidirectional,
      even though the `Block` row is one-directional
- [ ] Neither of you can start a **new** conversation with the other:
      `POST /api/conversations` and `POST /api/connection-requests` both
      return 403 once blocked (in either direction)
- [ ] If a `ConnectionRequest` was already pending when the block happened,
      accepting it afterward also fails (403) instead of creating a
      conversation
- [ ] An **existing** conversation/history between the two of you (trip
      history, reviews) is unaffected by a later block — it isn't hidden or
      deleted
- [ ] `/profile` (your own profile) has a "Blocked Users" section listing
      everyone you've blocked, each with an "Unblock user" button — section
      only appears once you've blocked at least one person
- [ ] Blocking the same user twice doesn't error (idempotent); unblocking a
      user you never blocked, or that belongs to someone else, returns 404
- [ ] `POST /api/blocks` with `blockedId` equal to your own id returns 400;
      a nonexistent `blockedId` returns 404; logged out returns 401
- [ ] Opening any conversation thread (`/messages/[id]`) — a brand-new one
      or a previously-existing one — always shows the "⚠️ Safety notice"
      banner about handling payment in person, above the message list,
      every time the page loads

## Report a User (2026-08-22)

- [ ] "Report user" appears on another user's public profile
      (`/profile/[userId]`), a trip you don't own, a request you don't own,
      and a message thread — and never on the equivalent page for yourself
      (your own profile, your own trip/request, or — trivially, since every
      thread is 2-party — never lets you target yourself in a thread)
- [ ] Clicking it reveals a composer (reason dropdown + optional detail),
      not an immediate submit
- [ ] Submit is disabled/blocked until a reason is selected; leaving detail
      blank still submits fine
- [ ] "Cancel" collapses the composer back to the plain button without
      sending anything
- [ ] After submitting, the control is replaced by a "Reported. Our team
      will review this." message — no page reload
- [ ] Each submission creates the right `Report` row (verify via Prisma
      Studio): `reporterId`/`reportedUserId` correct, `status = "open"`,
      and `contextType`/`contextId` match the surface it was sent from
      (`"profile"` with no `contextId`; `"trip"`/`"request"` with the
      post's id; `"message"` with the **conversation's** id, not a single
      message)
- [ ] The same reporter can report the same user a second time (e.g. a
      different incident) and it succeeds both times — no duplicate
      blocking exists, by design
- [ ] `POST /api/reports` while logged out returns 401; `reportedUserId`
      equal to your own id returns 400; a nonexistent `reportedUserId`
      returns 404
- [ ] Nothing else in the app changes as a result of a report — no visible
      report count anywhere (profile, trip/request cards, nav), no
      notification to anyone, no moderation queue page exists to check

## Connection Request Note (2026-08-20, made mandatory 2026-08-22)

- [ ] Clicking "Request to Connect" (on `/trips/[id]` or an Explore card)
      reveals a note composer labeled "Tell the trip owner why you're
      connecting" instead of firing immediately
- [ ] Submit is disabled until a note is entered (whitespace-only doesn't
      count) — a plain one-click request with no note is no longer possible
- [ ] Submitting with a note attached: button shows "Request Sent"
- [ ] Posting directly to `POST /api/connection-requests` with `message`
      omitted or blank returns 400, not a request created with no note
- [ ] "Cancel" on the composer collapses it back to the plain button
      without sending anything
- [ ] The trip owner sees the note on `/connections` (Received tab) under
      the pending row, in quotes, *before* they Accept/Decline
- [ ] The note also appears in the "New connection request" notification
      text (truncated if long)
- [ ] The requester also sees their own note on `/connections?tab=sent`
- [ ] If the owner **accepts** a request that had a note, the resulting
      conversation's first message is that exact note, shown as sent by the
      requester (not the owner) when the owner lands on `/messages/[id]`
- [ ] If the owner **declines** a request that had a note, no message is
      created anywhere — the note just stays visible as history on
      `/connections`
- [ ] A note over 500 characters is rejected/truncated by the input
      (`maxLength`) — no need to test the server 500-char cap directly

## Trip Participants / Seat Confirmation (2026-08-20)

- [ ] Owner of an upcoming trip with at least one accepted connection sees a
      "Participants" section on `/trips/[id]` listing each accepted
      requester with an "Add as Participant" button
- [ ] Clicking "Add as Participant" decrements "Seats available" by one,
      the row switches to "✓ Confirmed" + "Remove", and the requester gets
      a "You have a confirmed seat" notification (🪑 icon) linking back to
      the trip
- [ ] The confirmed rider, viewing `/trips/[id]` themselves, sees
      "✓ You have a confirmed seat on this trip." next to their connection
      status
- [ ] "Add as Participant" is disabled (or shows "No seats remaining")
      once `seatsRemaining` hits 0 — trying to confirm-seat a full trip
      directly against the API also 400s
- [ ] Clicking "Remove" on a confirmed participant asks for confirmation,
      then gives the seat back (`seatsRemaining` increments) and reverts
      that row to "Add as Participant" — no notification is sent for this
- [ ] Only the trip owner can confirm/release a seat (try POSTing
      confirm-seat/release-seat as someone else — expect 403)
- [ ] confirm-seat is rejected (400) against a connection that isn't
      `accepted` yet (still pending), and against a non-upcoming trip
- [ ] Editing a trip (`PATCH`/`/trips/[id]/edit`) to reduce `seatsTotal`
      below the number of already-confirmed riders is rejected (400) with
      a clear message instead of silently desyncing `seatsRemaining`
- [ ] Editing a trip's `seatsTotal` upward (or with confirmed riders
      present) still leaves `seatsRemaining` correct — it should reflect
      `seatsTotal - confirmedRiderCount`, not reset to `seatsTotal`
      outright
- [ ] The Participants section (and a confirmed rider's Remove ability)
      still shows correctly on a trip the owner later marks Completed or
      Cancels — participant history isn't hidden once the trip is
      no longer upcoming

## Notifications bell moved to the top bar (2026-08-20)

- [ ] The bottom nav no longer has a "🔔 Alerts" text item — Notifications
      is only reachable via the bell icon in the top header now
- [ ] The bell icon shows in the header (next to the signed-in user's name)
      only when logged in — logged-out visitors see no bell
- [ ] With unread notifications, a small red count badge sits on the
      bell's corner — same count `getUnreadNotificationCount()` always
      produced, just relocated
- [ ] With zero unread notifications, no badge shows on the bell at all
- [ ] Clicking the bell navigates to `/notifications`, same as before
- [ ] The bell has an accessible label (hover/inspect — screen reader
      users should hear "Notifications" or "Notifications (N unread)",
      not just a bell emoji)
- [ ] Layout still looks right on a narrow/mobile viewport — the header
      shouldn't overflow or wrap awkwardly with the bell added
- [ ] With exactly one unread notification, clicking its "Mark as read"
      button (on `/notifications`) makes the bell's badge disappear
      immediately, without a full page reload
- [ ] With multiple unread notifications, marking just one as read
      decrements the bell's badge count by one (doesn't clear it, doesn't
      require a reload)
- [ ] Clicking straight into a notification (the row itself, not the
      "Mark as read" button) also clears/decrements the bell's badge
- [ ] "Mark all as read" still clears the badge entirely (already worked
      before this fix, via the same fetch-then-`router.refresh()` shape)

## Fix: duplicate messages in a thread (2026-08-20)

- [ ] Open a Conversation thread (`/messages/[id]`) and leave it open for
      several poll cycles (each poll is every 4s) with no new activity —
      no message should ever appear more than once
- [ ] Send several messages back-to-back quickly (before the next 4s poll
      tick) — each appears exactly once, not duplicated when the next poll
      comes back and also sees them via `?since=`
- [ ] With the thread open, have the other participant send a message —
      it appears exactly once on the next poll, not 2-3x (this was the
      original bug: an in-flight poll request that took longer than 4s let
      a second poll tick fire before `since` advanced, so both requests
      fetched and appended the same not-yet-seen message)
- [ ] Throttle the network (DevTools → Network → Slow 3G) on one thread
      tab to widen the race window, then send a message from the other
      participant — still appears exactly once
- [ ] Confirm unread-read behavior is unaffected: opening a thread and
      receiving a new message while it's open still clears the unread
      badge on `/messages` and the nav "Messages" item

## Trip Management / Trip Lifecycle (2026-08-20)

- [ ] Creating a Trip lands it in status "upcoming" — shows in `/my-posts`
      Upcoming tab and in `/explore` (for other users, not yourself)
- [ ] Owner sees Edit, Mark Completed, and Cancel Trip on an upcoming trip's
      detail page — none of the three show once the trip is completed or
      cancelled
- [ ] Non-owner does NOT see any of those three actions, ever
- [ ] **Edit**: change origin/destination/date/time/flexible-time/seats/
      package toggle/notes on an upcoming trip — changes show correctly on
      the detail page, in `/my-posts`, and in `/explore`
- [ ] Editing a completed or cancelled trip is blocked — both hitting
      `/trips/[id]/edit` directly (redirects back to the detail page) and
      `PATCH /api/trips/[id]` directly (400)
- [ ] Only the trip owner can edit (try PATCH as someone else — expect 403)
- [ ] **Cancel**: clicking "Cancel Trip" asks for confirmation first
- [ ] After cancelling: trip status shows "cancelled"; it disappears from
      `/explore` and from the Upcoming tab in `/my-posts` (moves to History
      → Cancelled)
- [ ] A pending connection request on the cancelled trip flips to
      "Cancelled" (visible on the requester's `/connections?tab=sent`) and
      the trip owner can no longer see Accept/Decline for it
- [ ] An already-accepted connection on the cancelled trip is untouched —
      still shows "Accepted" on `/connections`, the conversation/messages
      are still fully accessible, and the trip detail page still shows
      "Connected" for that requester (not the generic "no longer accepting
      connections" message)
- [ ] Both the pending-holder and the accepted-holder get a "Trip
      cancelled" notification (different wording for each), and clicking it
      lands on `/connections?tab=sent`
- [ ] Trying to send a NEW connection request or message to a cancelled
      trip is rejected server-side
- [ ] Only the trip owner can cancel (try DELETE as someone else — expect
      403); cancelling an already-cancelled/completed trip is rejected (400)
- [ ] **Mark Completed**: clicking it asks for confirmation first
- [ ] After marking completed: trip status shows "completed"; it
      disappears from `/explore` and moves to History → Completed in
      `/my-posts`, with its connection-request count still shown
- [ ] Existing pending/accepted connection requests on a completed trip are
      left completely alone (status unchanged, conversation untouched)
- [ ] Trying to Accept a still-pending connection request against a
      completed trip is rejected server-side (400) — Decline still works
      (harmless cleanup)
- [ ] Only the trip owner can mark completed (try POST as someone else —
      expect 403); doing it twice, or on a cancelled trip, is rejected (400)
- [ ] `/my-posts` History tab clearly separates Completed / Cancelled / (if
      any) Past due trips into their own labeled groups, not one flat list
- [ ] A trip whose date has passed without being marked completed or
      cancelled shows under "Past due" and still offers Edit/Cancel/Mark
      Completed (its real DB status is still "upcoming")

## Notifications (2026-08-20)

- [ ] Trip owner gets a notification when someone sends a connection request
- [ ] Requester gets a notification when their connection request is accepted
- [ ] Requester gets a notification when their connection request is declined
- [ ] Recipient gets a notification when they receive a new message (both the
      first message via "Register for a seat" and later replies)
- [ ] Sender never gets notified about their own message
- [ ] Header shows a 🔔 bell icon with a red unread-count badge (moved
      from the bottom nav to the top bar — see the dated section above)
- [ ] Badge count matches the number of unread notifications, and updates
      after a full page reload (not expected to update instantly on a
      client-side `<Link>` navigation — that's a known Next.js layout
      caveat, same as the Messages badge)
- [ ] `/notifications` lists all of the caller's notifications, most recent
      first, each with an icon, title, message, timestamp
- [ ] Unread notifications are visually distinct (highlighted background,
      bold title, "New" badge) from read ones
- [ ] Clicking a notification navigates to the right place and marks it read:
  - connection request → `/connections` (Received tab)
  - accepted request → the resulting conversation thread
  - declined request → `/connections?tab=sent`
  - new message → the conversation thread
- [ ] The small "Mark as read" button on an unread row marks it read without
      navigating away
- [ ] "Mark all as read" clears every unread notification at once
- [ ] A user with zero notifications sees a friendly empty state, not a blank
      page
- [ ] A user cannot mark another user's notification as read (try hitting
      `POST /api/notifications/<someone else's id>/read` directly — expect 404)

## Connection Requests (2026-08-19)

- [ ] "Request to Connect" button appears on `/trips/[id]` and offer cards in
      `/explore` for non-owner viewers of an active trip, not for the owner
- [ ] Clicking it sends a pending request and the button changes to "Request
      Sent"
- [ ] Can't request to connect on your own trip
- [ ] Can't request to connect on a non-active (past-due/cancelled) trip
- [ ] Can't send a second pending request for the same trip while one is
      already pending (button already reflects this)
- [ ] After a decline or cancel, the button reverts to a fresh clickable
      "Request to Connect" (a new attempt is allowed)
- [ ] `/connections` — Received tab (default) shows requests sent to you,
      with Accept/Decline buttons on pending ones
- [ ] `/connections?tab=sent` shows requests you sent, with a Cancel button
      on pending ones
- [ ] Accepting a request redirects straight into the resulting message
      thread (not back to `/connections`)
- [ ] Declining or cancelling stays on `/connections` and updates the status
      label in place
- [ ] Only the recipient can accept/decline; only the requester can cancel
      (try the wrong role — expect 403)
- [ ] Accepting the same trip's request that was also reached via "Register
      for a seat" lands in the same single conversation thread, not two

## Unread Message Indicators (2026-08-18)

- [ ] `/messages` shows unread conversations in bold with a "New" badge
- [ ] Nav "Messages" item shows a red unread-count badge
- [ ] Opening a thread (`/messages/[id]`) marks it read and clears the badge
      on next reload
- [ ] A reply arriving while the thread is already open doesn't re-mark it
      unread

## Explore Page (2026-08-18)

- [ ] `/explore` shows other users' active Trips and pending ride Requests
      merged into one feed — never your own posts
- [ ] Package requests are excluded (rides only, by design)
- [ ] Origin/destination/date/offer-vs-request filters work via the URL
      query params and a normal form submit (no JS)
- [ ] A trip/request that's past its date but never got cancelled shows as
      "expired" instead of still-open
- [ ] Loading and error states render sensibly (throttle network or break a
      query temporarily to check the error boundary)

## Trip/Request Posting (2026-08-17 to 2026-08-18)

- [ ] `/post` links to "Offer a Ride" / "Offer Package Space" (both create a
      Trip) and "Need a Ride" / "Need Something Delivered" (both create a
      Request)
- [ ] Create, view, edit, and cancel both a Trip and a standalone Request
- [ ] Only the poster sees Edit/Cancel on their own posts
- [ ] Cancel is a soft cancel (status flips to cancelled, post still visible
      in history) not a deletion
- [ ] `/my-posts` splits into Upcoming/History tabs by date, independent of
      status — cancelled posts still show with their status label
- [ ] Destination picker: choosing a listed city works, and typing a
      write-in destination (e.g. an airport) works — but not both at once
- [ ] Posting rate limit kicks in after 10 Trip/Request creations in a
      rolling 12-hour window

## Profile & Onboarding (2026-08-17)

- [ ] Student onboarding (`/onboarding`): name, photo, home city, major,
      year, travel preferences, "looking for" multi-select all save
- [ ] Onboarding is a soft nudge — skipping it never blocks navigation
      anywhere else in the app
- [ ] Parent onboarding (step 0 of `/family/connect-student`): name, photo,
      home city, phone, linked-student name all save
- [ ] `/profile` shows your own editable profile plus verification badges
- [ ] `/profile/[userId]` shows another user's public profile only — email,
      phone, and StudentRecord/link details never leak through
- [ ] Uploading a profile photo works and shows up immediately

## Parent/Student Linking (2026-08-16 to 2026-08-17)

- [ ] Parent signup lands directly on `/family/connect-student` with no
      email confirmation step
- [ ] A parent-signup account cannot reach any other page until they link a
      student — verify both on first load AND on a client-side nav click
      (the two-layer gate described in CLAUDE.md)
- [ ] Entering a student's university email sends an 8-digit OTP to the
      *student's* inbox, not the parent's
- [ ] Confirming the OTP creates the link and unlocks the rest of the app
- [ ] A wrong OTP code fails, and attempts are capped
- [ ] The student notice email's objection link revokes the link only after
      an explicit button click (never on page load/GET)
- [ ] After the last link is revoked, `linkedStudentName` and the
      parent_relationship badge both clear
- [ ] A student who signs up later with the same email automatically
      attaches to a record a parent already created (no relinking needed)

## Auth (2026-08-16)

- [ ] Student/alumni/traveler signup: both the email link and the 8-digit
      OTP code confirm the account and land on `/onboarding`
- [ ] Signing up with a `uci.edu` (or other supported domain) email grants
      the university-verified badge immediately, no extra step
- [ ] `/verify` self-serve flow works for someone who signed up with a
      personal email and wants to add a university badge later
- [ ] Login and sign-out work
