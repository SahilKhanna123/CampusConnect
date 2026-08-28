-- New notification event: a ParentStudentLink's parent gets notified when
-- the student explicitly approves it (otp_verified -> approved) via
-- POST /api/family/link/[id]/approve.
ALTER TYPE "NotificationType" ADD VALUE 'parent_link_approved';
