-- Phase 5: saving an edited plan as "แผนของฉัน".
-- The daily plan also has drive and meal rows, plus a few fields the editor shows.

alter table public.trip_items drop constraint if exists trip_items_kind_check;
alter table public.trip_items add constraint trip_items_kind_check
  check (kind in ('drive', 'attraction', 'poi', 'lodging', 'meal', 'rest_stop', 'custom'));

alter table public.trip_items
  add column if not exists place_category text,
  add column if not exists is_secondary_city boolean,
  add column if not exists parking text,
  add column if not exists warning text,
  add column if not exists drive_km numeric(8, 1);

-- One call saves the trip, its days, items and booking rows, so a failure part-way
-- never leaves half a trip behind. Runs as the caller: RLS still decides every insert.
create or replace function public.save_trip(p_trip jsonb, p_days jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trip uuid;
  v_day uuid;
  v_item uuid;
  d jsonb;
  it jsonb;
  pos integer;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  insert into public.trips (
    title, origin, destination, start_date, end_date, travelers, occasion,
    interests, stop_kinds, vehicle, route_style, route_summary, status
  ) values (
    left(p_trip ->> 'title', 200),
    p_trip -> 'origin',
    p_trip -> 'destination',
    (p_trip ->> 'start_date')::date,
    (p_trip ->> 'end_date')::date,
    p_trip -> 'travelers',
    p_trip ->> 'occasion',
    coalesce(array(select jsonb_array_elements_text(p_trip -> 'interests')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_trip -> 'stop_kinds')), '{}'),
    p_trip -> 'vehicle',
    p_trip ->> 'route_style',
    p_trip -> 'route_summary',
    'upcoming'
  )
  returning id into v_trip;

  for d in select value from jsonb_array_elements(p_days) loop
    insert into public.trip_days (trip_id, day_index, date, finished_at)
    values (
      v_trip,
      (d ->> 'index')::smallint,
      (d ->> 'date')::date,
      case when (d ->> 'finished')::boolean then now() end
    )
    returning id into v_day;

    pos := 0;
    for it in select value from jsonb_array_elements(d -> 'items') loop
      insert into public.trip_items (
        day_id, position, start_time, end_time, activity, kind,
        place_source, place_id, place_name, place_category, is_secondary_city,
        latitude, longitude, address, cost_estimate, cost_category,
        phone, opening_hours, notes, parking, warning, drive_km, lodging
      ) values (
        v_day, pos,
        nullif(it ->> 'start', '')::time,
        nullif(it ->> 'end', '')::time,
        it ->> 'activity',
        it ->> 'kind',
        it -> 'place' ->> 'source',
        it -> 'place' ->> 'id',
        it -> 'place' ->> 'name',
        it -> 'place' ->> 'category',
        (it -> 'place' ->> 'isSecondaryCity')::boolean,
        (it -> 'place' ->> 'latitude')::double precision,
        (it -> 'place' ->> 'longitude')::double precision,
        it -> 'place' ->> 'area',
        (it ->> 'costEstimate')::numeric,
        it ->> 'costCategory',
        it ->> 'phone',
        it ->> 'openingHours',
        it ->> 'notes',
        it ->> 'parking',
        it ->> 'warning',
        (it ->> 'driveKm')::numeric,
        case when jsonb_typeof(it -> 'lodging') = 'object' then it -> 'lodging' end
      )
      returning id into v_item;

      if it ->> 'kind' = 'lodging' and jsonb_typeof(it -> 'lodging') = 'object' then
        insert into public.trip_bookings (item_id, night_date, platform, url, price, status, booked_at)
        values (
          v_item,
          (d ->> 'date')::date,
          coalesce(it -> 'lodging' ->> 'platform', 'other'),
          it -> 'lodging' -> 'booking' ->> 'url',
          (it -> 'lodging' -> 'booking' ->> 'price')::numeric,
          coalesce(it -> 'lodging' -> 'booking' ->> 'status', 'todo'),
          (it -> 'lodging' -> 'booking' ->> 'bookedAt')::timestamptz
        );
      end if;
      pos := pos + 1;
    end loop;
  end loop;

  return v_trip;
end;
$$;

revoke execute on function public.save_trip(jsonb, jsonb) from public, anon;
grant execute on function public.save_trip(jsonb, jsonb) to authenticated;
