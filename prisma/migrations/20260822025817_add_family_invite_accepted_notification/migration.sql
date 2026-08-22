-- New notification event: the inviting student is notified when the
-- parent they invited (student-initiated direction, ParentStudentInvite)
-- accepts. Must run in its own migration/transaction from anything that
-- uses the new value, per Postgres's rule that a freshly added enum value
-- can't be referenced in the same transaction that added it.
ALTER TYPE "NotificationType" ADD VALUE 'family_invite_accepted';
