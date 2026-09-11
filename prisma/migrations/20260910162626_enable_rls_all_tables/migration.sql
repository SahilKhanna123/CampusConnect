-- Enables Postgres Row Level Security on every table in the `public`
-- schema, with NO policies defined.
--
-- Why this is safe for the app: Prisma connects as the `postgres` role
-- (see DATABASE_URL), which has rolbypassrls = true -- RLS is a no-op for
-- that role regardless of what policies exist (or don't). Every
-- authorization check this app relies on (getCurrentUser() + explicit
-- ownership comparisons in each route handler, per CLAUDE.md's documented
-- "no Postgres RLS, enforced in application code" architecture) continues
-- to run exactly as before. Nothing in this codebase queries these tables
-- through Supabase's PostgREST REST API (grep for `.from(` turns up only
-- Array.from() and the Storage bucket API, both unrelated) or the Supabase
-- JS client for data access -- Storage uploads go through the service-role
-- admin client (src/lib/supabase/storage.ts), which also bypasses RLS.
--
-- What this actually fixes: Supabase auto-exposes every `public` schema
-- table over its REST API (https://<project>.supabase.co/rest/v1/<table>).
-- With RLS disabled, anyone holding the project's anon key (public by
-- design -- it ships in client-side JS) could query or write to any of
-- these tables directly, bypassing every authorization check this app's
-- own route handlers perform. Enabling RLS with zero policies makes
-- Postgres deny that access by default for every role without
-- rolbypassrls, closing that surface off entirely -- appropriate here
-- since the app was never designed to be used through PostgREST at all.
--
-- Deliberately NOT touching Supabase's own storage/auth/realtime schemas --
-- those are managed by Supabase itself and already have their own RLS
-- configuration (e.g. the "avatars" bucket's public-read policy on
-- storage.objects, set up via scripts/setup-storage.ts).

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportedUniversityDomain" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentStudentOtpRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentStudentInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentStudentLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Region" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "City" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RouteCommunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConnectionRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeatOffer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Block" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
