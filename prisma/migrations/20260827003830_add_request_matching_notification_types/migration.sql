-- New notification events for the Request/Trip matching lifecycle: a
-- standalone Request's postedById gets notified when a Trip owner accepts
-- it (request_accepted), and again if that Trip is later cancelled while
-- the Request is still accepted (request_trip_cancelled) -- kept distinct
-- from the existing trip_cancelled value since notificationLink() has no
-- way to tell a ConnectionRequest.id apart from a Request.id sharing the
-- same relatedId shape, and the two need different destination URLs.
ALTER TYPE "NotificationType" ADD VALUE 'request_accepted';
ALTER TYPE "NotificationType" ADD VALUE 'request_trip_cancelled';
