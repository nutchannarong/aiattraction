-- Fuel stations and rest stops across Thailand, imported from OpenStreetMap
-- (© OpenStreetMap contributors, ODbL) via the Overpass API.

create extension if not exists postgis with schema extensions;
create extension if not exists http with schema extensions;

create table public.roadside_poi (
  osm_id text primary key,              -- e.g. 'node/123', 'way/456'
  kind text not null check (kind in ('fuel', 'rest_area', 'services')),
  name text,
  name_th text,
  name_en text,
  brand text,
  opening_hours text,
  location extensions.geography(point, 4326) not null,
  tags jsonb not null default '{}',
  imported_at timestamptz not null default now()
);

create index roadside_poi_location_idx on public.roadside_poi using gist (location);
create index roadside_poi_kind_idx on public.roadside_poi (kind);

alter table public.roadside_poi enable row level security;
create policy "roadside_poi_public_read"
  on public.roadside_poi for select to anon, authenticated using (true);
grant select on public.roadside_poi to anon, authenticated;

-- Nearest POIs of each kind around a point.
create function public.nearby_roadside_poi(
  lat double precision,
  lng double precision,
  radius_m integer default 20000,
  per_kind integer default 5
)
returns table (
  osm_id text,
  kind text,
  name text,
  brand text,
  opening_hours text,
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
  ),
  ranked as (
    select
      p.osm_id,
      p.kind,
      coalesce(p.name_th, p.name, p.name_en) as name,
      p.brand,
      p.opening_hours,
      extensions.st_y(p.location::extensions.geometry) as latitude,
      extensions.st_x(p.location::extensions.geometry) as longitude,
      round(extensions.st_distance(p.location, o.g))::integer as distance_m,
      row_number() over (
        partition by (p.kind = 'fuel')
        order by p.location operator(extensions.<->) o.g
      ) as rn
    from public.roadside_poi p, origin o
    where extensions.st_dwithin(p.location, o.g, least(radius_m, 50000))
  )
  select osm_id, kind, name, brand, opening_hours, latitude, longitude, distance_m
  from ranked
  where rn <= least(per_kind, 10)
  order by kind = 'fuel' desc, distance_m;
$$;

grant execute on function public.nearby_roadside_poi(double precision, double precision, integer, integer)
  to anon, authenticated;

-- Refresh the whole dataset from Overpass. Admin-only; run with a long statement timeout:
--   set statement_timeout = 0; select public.import_roadside_poi();
create function public.import_roadside_poi(
  endpoint text default 'https://overpass.kumi.systems/api/interpreter'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  query text := '[out:json][timeout:240];'
    || 'area["ISO3166-1"="TH"][admin_level=2]->.th;'
    || '(nwr["amenity"="fuel"](area.th);nwr["highway"~"^(rest_area|services)$"](area.th););'
    || 'out center tags;';
  started timestamptz := clock_timestamp();
  res extensions.http_response;
  body jsonb;
  imported integer;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '300');
  res := extensions.http((
    'POST',
    endpoint,
    array[extensions.http_header('User-Agent', 'aiattraction/0.1 (+https://github.com/nutchannarong/aiattraction)')],
    'application/x-www-form-urlencoded',
    'data=' || extensions.urlencode(query)
  )::extensions.http_request);

  if res.status <> 200 then
    raise exception 'Overpass returned HTTP %: %', res.status, left(res.content, 300);
  end if;
  body := res.content::jsonb;

  insert into public.roadside_poi as p
    (osm_id, kind, name, name_th, name_en, brand, opening_hours, location, tags, imported_at)
  select
    e->>'type' || '/' || (e->>'id'),
    case when e->'tags'->>'highway' in ('rest_area', 'services') then e->'tags'->>'highway' else 'fuel' end,
    e->'tags'->>'name',
    e->'tags'->>'name:th',
    e->'tags'->>'name:en',
    coalesce(e->'tags'->>'brand', e->'tags'->>'operator'),
    e->'tags'->>'opening_hours',
    extensions.st_setsrid(extensions.st_makepoint(
      coalesce((e->>'lon')::float8, (e->'center'->>'lon')::float8),
      coalesce((e->>'lat')::float8, (e->'center'->>'lat')::float8)
    ), 4326)::extensions.geography,
    coalesce(e->'tags', '{}'::jsonb),
    started
  from jsonb_array_elements(body->'elements') e
  where coalesce(e->>'lat', e->'center'->>'lat') is not null
  on conflict (osm_id) do update set
    kind = excluded.kind,
    name = excluded.name,
    name_th = excluded.name_th,
    name_en = excluded.name_en,
    brand = excluded.brand,
    opening_hours = excluded.opening_hours,
    location = excluded.location,
    tags = excluded.tags,
    imported_at = excluded.imported_at;
  get diagnostics imported = row_count;

  -- Drop places that no longer exist in OSM.
  delete from public.roadside_poi where imported_at < started;
  return imported;
end;
$$;

revoke execute on function public.import_roadside_poi(text) from public, anon, authenticated;
