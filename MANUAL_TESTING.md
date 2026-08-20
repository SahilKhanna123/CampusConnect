# Manual Testing Checklist

A running list of every feature built in this project, kept up to date after
each feature is added, so it can be walked through by hand. Newest features
are at the top since they're the least likely to have been tested yet. Check
items off as you verify them; leave unchecked ones for the next pass.

No automated test suite exists in this project (see CLAUDE.md) — this file
is the actual test coverage.

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
- [ ] Nav shows a "🔔 Alerts" item with a red unread-count badge
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
