-- Candidate attractions for the planner, with group/effort, fees, phone and the
-- province's secondary-city flag (plans favour secondary cities a little).

drop function public.attractions_along_route(jsonb, text[], integer, integer);

create function public.attractions_along_route(
  route jsonb,
  groups text[],
  buffer_m integer default 15000,
  max_results integer default 200
)
returns table (
  att_id text, att_name_th text, att_name_en text, att_type integer, group_key text, effort smallint,
  att_type_label text, province_name_th text, district_name_th text, is_secondary_city boolean,
  att_start_end text, att_fee_th integer, att_fee_th_kid integer, att_tel text,
  latitude double precision, longitude double precision, distance_m integer, route_fraction double precision
)
language sql stable security invoker set search_path = ''
as $$
  with line as (
    select extensions.st_setsrid(extensions.st_geomfromgeojson(route::text), 4326) as geom
  )
  select a.att_id, a.att_name_th, a.att_name_en, a.att_type, g.group_key, g.effort, a.att_type_label,
    a.province_name_th, a.district_name_th, coalesce(pr.is_secondary_city, false),
    a.att_start_end, a.att_fee_th, a.att_fee_th_kid, a.att_tel,
    a.latitude, a.longitude,
    round(extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography,
      l.geom::extensions.geography))::integer,
    extensions.st_linelocatepoint(l.geom, extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326))
  from public.attraction a
  join public.attraction_type_group g on g.att_type = a.att_type
  left join public.provinces pr on pr.id = a.att_province_id
  cross join line l
  where a.latitude is not null and a.longitude is not null
    and a.att_status = 1
    and (groups is null or cardinality(groups) = 0 or g.group_key = any(groups))
    and extensions.st_dwithin(
      extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography,
      l.geom::extensions.geography, least(buffer_m, 50000))
  order by 17
  limit least(max_results, 500);
$$;

create function public.attractions_near(
  lat double precision,
  lng double precision,
  groups text[],
  radius_m integer default 40000,
  max_results integer default 120
)
returns table (
  att_id text, att_name_th text, att_name_en text, att_type integer, group_key text, effort smallint,
  att_type_label text, province_name_th text, district_name_th text, is_secondary_city boolean,
  att_start_end text, att_fee_th integer, att_fee_th_kid integer, att_tel text,
  latitude double precision, longitude double precision, distance_m integer
)
language sql stable security invoker set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  )
  select a.att_id, a.att_name_th, a.att_name_en, a.att_type, g.group_key, g.effort, a.att_type_label,
    a.province_name_th, a.district_name_th, coalesce(pr.is_secondary_city, false),
    a.att_start_end, a.att_fee_th, a.att_fee_th_kid, a.att_tel,
    a.latitude, a.longitude,
    round(extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography, o.g))::integer
  from public.attraction a
  join public.attraction_type_group g on g.att_type = a.att_type
  left join public.provinces pr on pr.id = a.att_province_id
  cross join origin o
  where a.latitude is not null and a.longitude is not null
    and a.att_status = 1
    and (groups is null or cardinality(groups) = 0 or g.group_key = any(groups))
    and extensions.st_dwithin(
      extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography,
      o.g, least(radius_m, 100000))
  order by extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography
    operator(extensions.<->) o.g
  limit least(max_results, 300);
$$;
grant execute on function public.attractions_near(double precision, double precision, text[], integer, integer) to anon, authenticated;
grant execute on function public.attractions_along_route(jsonb, text[], integer, integer) to anon, authenticated;
