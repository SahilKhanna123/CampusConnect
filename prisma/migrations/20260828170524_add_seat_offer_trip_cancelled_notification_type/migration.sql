-- New notification event: a SeatOffer's recipient (pending or accepted)
-- gets notified when the trip owner cancels the trip -- the SeatOffer-side
-- analogue of trip_cancelled/request_trip_cancelled, kept distinct for the
-- same notificationLink() disambiguation reason as request_trip_cancelled.
ALTER TYPE "NotificationType" ADD VALUE 'seat_offer_trip_cancelled';
