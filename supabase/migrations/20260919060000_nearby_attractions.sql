-- Spatial lookup on the existing latitude/longitude columns. An expression index
-- avoids adding a column to public.attraction, which is loaded by an external import.
create index attraction_geog_idx on public.attraction using gist (
  (extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography)
) where latitude is not null and longitude is not null;

create function public.nearby_attractions(
  lat double precision,
  lng double precision,
  max_results integer default 24,
  radius_m integer default 100000
)
returns table (
  att_id text,
  att_name_th text,
  att_name_en text,
  att_category integer,
  att_type_label text,
  province_name_th text,
  district_name_th text,
  latitude double precision,
  longitude double precision,
  distance_m integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  )
  select
    a.att_id, a.att_name_th, a.att_name_en, a.att_category, a.att_type_label,
    a.province_name_th, a.district_name_th, a.latitude, a.longitude,
    round(extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography,
      o.g
    ))::integer as distance_m
  from public.attraction a, origin o
  where a.latitude is not null
    and a.longitude is not null
    and extensions.st_dwithin(
      extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography,
      o.g,
      least(radius_m, 500000)
    )
  order by
    extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography
      operator(extensions.<->) o.g
  limit least(max_results, 100);
$$;

grant execute on function public.nearby_attractions(double precision, double precision, integer, integer)
  to anon, authenticated;
