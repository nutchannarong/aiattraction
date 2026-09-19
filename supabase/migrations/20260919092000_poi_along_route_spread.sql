-- poi_along_route kept the `per_kind` places closest to the line, which on long trips
-- clustered them in a few stretches and left others (where lunch or a fuel stop falls)
-- empty. Split the route into 20 equal stretches and keep the closest ones in each.

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
  located as (
    select h.*,
      extensions.st_distance(h.location, l.geom::extensions.geography) as d,
      extensions.st_linelocatepoint(l.geom, h.location::extensions.geometry) as f
    from hits h, line l
  ),
  ranked as (
    select located.*,
      row_number() over (
        partition by kind, least(floor(f * 20), 19)
        -- Named places first within a stretch, then the closest to the road.
        order by (coalesce(name_th, name, name_en, brand) is null), d
      ) as rn
    from located
  )
  select osm_id, kind, subkind, coalesce(name_th, name, name_en), brand, phone, opening_hours, stars,
    image_url, address,
    extensions.st_y(location::extensions.geometry), extensions.st_x(location::extensions.geometry),
    round(d)::integer, f
  from ranked
  where rn <= greatest(1, ceil(least(per_kind, 200) / 20.0))
  order by 14;
$$;
