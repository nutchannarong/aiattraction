-- Route searches were slow on real routes (~300 vertices): one long line has a huge
-- bounding box, so the spatial index filtered little and every row paid for an exact
-- distance to all vertices. Split the route into short pieces (ST_Subdivide) so the
-- index does the work, then measure against the full line only for the matches.

create or replace function public.poi_along_route(
  route jsonb,
  kinds text[],
  buffer_m integer default 2000,
  per_kind integer default 40
)
returns table (
  osm_id text, kind text, subkind text, name text, brand text, phone text,
  opening_hours text, stars smallint, image_url text, address text,
  latitude double precision, longitude double precision, distance_m integer, route_fraction double precision
)
language sql stable security invoker set search_path = ''
as $$
  with line as (
    select extensions.st_setsrid(extensions.st_geomfromgeojson(route::text), 4326) as geom
  ),
  pieces as (
    select extensions.st_subdivide(geom, 10)::extensions.geography as piece from line
  ),
  hits as (
    select distinct on (p.osm_id) p.*
    from pieces s
    join public.poi p
      on p.kind = any(kinds)
     and extensions.st_dwithin(p.location, s.piece, least(buffer_m, 20000))
  ),
  ranked as (
    select h.*, l.geom,
      extensions.st_distance(h.location, l.geom::extensions.geography) as d,
      row_number() over (
        partition by h.kind
        order by extensions.st_distance(h.location, l.geom::extensions.geography),
                 (coalesce(h.name_th, h.name) is null)
      ) as rn
    from hits h, line l
  )
  select osm_id, kind, subkind, coalesce(name_th, name, name_en), brand, phone, opening_hours, stars,
    image_url, address,
    extensions.st_y(location::extensions.geometry), extensions.st_x(location::extensions.geometry),
    round(d)::integer,
    extensions.st_linelocatepoint(geom, location::extensions.geometry)
  from ranked
  where rn <= least(per_kind, 200)
  order by 14;
$$;

create or replace function public.attractions_along_route(
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
  ),
  pieces as (
    select extensions.st_subdivide(geom, 10)::extensions.geography as piece from line
  ),
  hits as (
    select distinct on (a.att_id) a.*
    from pieces s
    join public.attraction a
      on a.latitude is not null and a.longitude is not null
     and extensions.st_dwithin(
       extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography,
       s.piece, least(buffer_m, 50000))
    where a.att_status = 1
  )
  select h.att_id, h.att_name_th, h.att_name_en, h.att_type, g.group_key, g.effort, h.att_type_label,
    h.province_name_th, h.district_name_th, coalesce(pr.is_secondary_city, false),
    h.att_start_end, h.att_fee_th, h.att_fee_th_kid, h.att_tel,
    h.latitude, h.longitude,
    round(extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(h.longitude, h.latitude), 4326)::extensions.geography,
      l.geom::extensions.geography))::integer,
    extensions.st_linelocatepoint(l.geom, extensions.st_setsrid(extensions.st_makepoint(h.longitude, h.latitude), 4326))
  from hits h
  join public.attraction_type_group g on g.att_type = h.att_type
  left join public.provinces pr on pr.id = h.att_province_id
  cross join line l
  where groups is null or cardinality(groups) = 0 or g.group_key = any(groups)
  order by 17
  limit least(max_results, 500);
$$;
