-- Rename TripStatus enum value 'active' -> 'upcoming' to match the product's
-- own three-stage trip lifecycle vocabulary exactly. RENAME VALUE is a
-- metadata-only operation in Postgres -- existing rows keep their identity
-- and are read back under the new label with no data rewrite, unlike a
-- naive "remove old value, add new value" approach (which Prisma's own
-- migrate diff would have generated, and which fails outright if any row
-- still uses the old value).
ALTER TYPE "TripStatus" RENAME VALUE 'active' TO 'upcoming';

-- New notification event: a ConnectionRequest's requester (pending or
-- accepted) gets notified when the trip owner cancels the trip out from
-- under it. Must run in its own migration/transaction from anything that
-- uses the new value, per Postgres's rule that a freshly added enum value
-- can't be referenced in the same transaction that added it.
ALTER TYPE "NotificationType" ADD VALUE 'trip_cancelled';
