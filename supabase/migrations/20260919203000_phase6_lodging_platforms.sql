-- Phase 6 adds more outbound lodging channels while prices remain user-verified.
alter table public.trip_bookings
  drop constraint if exists trip_bookings_platform_check;

alter table public.trip_bookings
  add constraint trip_bookings_platform_check
  check (platform in (
    'agoda', 'booking', 'trip', 'traveloka', 'expedia', 'airbnb', 'direct', 'other'
  ));
