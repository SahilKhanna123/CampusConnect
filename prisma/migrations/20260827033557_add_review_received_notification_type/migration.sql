-- New notification event: a Request's reviewee gets notified when the other
-- participant leaves a Review via POST /api/reviews. Kept distinct from
-- request_accepted/request_trip_cancelled even though relatedId is the same
-- Request.id shape, since notificationLink() dispatches purely on `type`
-- and this is a semantically different event.
ALTER TYPE "NotificationType" ADD VALUE 'review_received';
