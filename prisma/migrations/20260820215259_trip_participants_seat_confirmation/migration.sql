-- Marks an accepted ConnectionRequest as also holding a confirmed seat on
-- its trip -- distinct from `status` since not every accepted connection
-- necessarily becomes a rider. Always set/cleared in the same DB
-- transaction as an opposite decrement/increment of Trip.seatsRemaining
-- (see POST /api/connection-requests/[id]/confirm-seat and .../release-seat).
ALTER TABLE "ConnectionRequest" ADD COLUMN "seatConfirmedAt" TIMESTAMP(3);

-- New notification event: the requester of an accepted ConnectionRequest is
-- notified when the trip owner confirms them for an actual seat. Must run
-- in its own migration/transaction from anything that uses the new value,
-- per Postgres's rule that a freshly added enum value can't be referenced
-- in the same transaction that added it.
ALTER TYPE "NotificationType" ADD VALUE 'trip_seat_confirmed';
