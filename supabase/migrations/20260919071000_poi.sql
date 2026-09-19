-- Points of interest from OpenStreetMap (© OpenStreetMap contributors, ODbL):
-- food, lodging, museums, ATMs, health, car services, parking and toilets.
-- Replaces roadside_poi; its rows move here and nearby_roadside_poi keeps working.

create table public.poi (
  osm_id text primary key,                  -- 'node/123', 'way/456'
  kind text not null check (kind in (
    'restaurant', 'cafe',
    'hotel', 'guest_house', 'hostel', 'motel', 'apartment', 'resort',
    'museum', 'atm', 'pharmacy', 'hospital', 'clinic',
    'fuel', 'rest_area', 'services', 'parking', 'toilets'
  )),
  subkind text,                             -- e.g. fast_food, multi-storey
  name text,
  name_th text,
  name_en text,
  brand text,
  phone text,
  website text,
  opening_hours text,
  stars smallint,
  cuisine text,
  fee boolean,
  image_url text,
  wikidata text,
  address text,
  location extensions.geography(point, 4326) not null,
  imported_at timestamptz not null default now()
);

create index poi_location_idx on public.poi using gist (location);
create index poi_kind_idx on public.poi (kind);
create index poi_name_trgm_idx on public.poi using gin ((coalesce(name_th, name, name_en)) extensions.gin_trgm_ops);

alter table public.poi enable row level security;
create policy "poi_public_read" on public.poi for select to anon, authenticated using (true);
grant select on public.poi to anon, authenticated;

insert into public.poi (osm_id, kind, name, name_th, name_en, brand, opening_hours, location, imported_at)
select osm_id, kind, name, name_th, name_en, brand, opening_hours, location, imported_at
from public.roadside_poi;

-- Same signature and output as before, now backed by poi.
create or replace function public.nearby_roadside_poi(
  lat double precision,
  lng double precision,
  radius_m integer default 20000,
  per_kind integer default 5
)
returns table (
  osm_id text, kind text, name text, brand text, opening_hours text,
  latitude double precision, longitude double precision, distance_m integer
)
language sql stable security invoker set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  ),
  ranked as (
    select p.osm_id, p.kind, coalesce(p.name_th, p.name, p.name_en) as name, p.brand, p.opening_hours,
      extensions.st_y(p.location::extensions.geometry) as latitude,
      extensions.st_x(p.location::extensions.geometry) as longitude,
      round(extensions.st_distance(p.location, o.g))::integer as distance_m,
      row_number() over (partition by (p.kind = 'fuel') order by p.location operator(extensions.<->) o.g) as rn
    from public.poi p, origin o
    where p.kind in ('fuel', 'rest_area', 'services')
      and extensions.st_dwithin(p.location, o.g, least(radius_m, 50000))
  )
  select osm_id, kind, name, brand, opening_hours, latitude, longitude, distance_m
  from ranked where rn <= least(per_kind, 10)
  order by kind = 'fuel' desc, distance_m;
$$;

drop function public.import_roadside_poi(text);
drop table public.roadside_poi;

-- ---------------------------------------------------------------------------
-- Import one group of POIs for all of Thailand from Overpass. Admin-only; run
-- each group separately with a long statement timeout, e.g.
--   set statement_timeout = 0; select public.import_poi('food');
-- Groups: food, lodging, museum, finance, health, car, amenities
-- ---------------------------------------------------------------------------
create function public.import_poi(
  p_group text,
  endpoint text default 'https://overpass.kumi.systems/api/interpreter'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  selectors text;
  kinds text[];
  query text;
  started timestamptz := clock_timestamp();
  res extensions.http_response;
  body jsonb;
  imported integer;
begin
  case p_group
    when 'food' then
      selectors := 'nwr["amenity"~"^(restaurant|fast_food|cafe)$"](area.th);';
      kinds := array['restaurant', 'cafe'];
    when 'lodging' then
      selectors := 'nwr["tourism"~"^(hotel|guest_house|hostel|motel|apartment|chalet)$"](area.th);nwr["leisure"="resort"](area.th);';
      kinds := array['hotel', 'guest_house', 'hostel', 'motel', 'apartment', 'resort'];
    when 'museum' then
      selectors := 'nwr["tourism"="museum"](area.th);';
      kinds := array['museum'];
    when 'finance' then
      selectors := 'nwr["amenity"="atm"](area.th);';
      kinds := array['atm'];
    when 'health' then
      selectors := 'nwr["amenity"~"^(pharmacy|hospital|clinic|doctors)$"](area.th);';
      kinds := array['pharmacy', 'hospital', 'clinic'];
    when 'car' then
      selectors := 'nwr["amenity"="fuel"](area.th);nwr["highway"~"^(rest_area|services)$"](area.th);';
      kinds := array['fuel', 'rest_area', 'services'];
    when 'amenities' then
      selectors := 'nwr["amenity"="parking"]["access"!~"^(private|no)$"](area.th);nwr["amenity"="toilets"](area.th);';
      kinds := array['parking', 'toilets'];
    else
      raise exception 'Unknown POI group %', p_group;
  end case;

  query := '[out:json][timeout:280];area["ISO3166-1"="TH"][admin_level=2]->.th;(' || selectors || ');out center tags;';

  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '30');
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '300');
  res := extensions.http((
    'POST', endpoint,
    array[extensions.http_header('User-Agent', 'thainhaidee/0.1 (+https://github.com/nutchannarong/aiattraction)')],
    'application/x-www-form-urlencoded',
    'data=' || extensions.urlencode(query)
  )::extensions.http_request);

  if res.status <> 200 then
    raise exception 'Overpass returned HTTP %: %', res.status, left(res.content, 300);
  end if;
  body := res.content::jsonb;

  insert into public.poi as p (
    osm_id, kind, subkind, name, name_th, name_en, brand, phone, website, opening_hours,
    stars, cuisine, fee, image_url, wikidata, address, location, imported_at
  )
  select * from (
    select
      e->>'type' || '/' || (e->>'id') as osm_id,
      -- Classify by the group being imported, so unrelated tags on the same
      -- object (e.g. a hotel that is also tagged amenity=bar) can't leak in.
      case p_group
        when 'food' then case t->>'amenity' when 'cafe' then 'cafe' else 'restaurant' end
        when 'lodging' then case
          when t->>'tourism' in ('hotel', 'guest_house', 'hostel', 'motel', 'apartment') then t->>'tourism'
          else 'resort' end
        when 'museum' then 'museum'
        when 'finance' then 'atm'
        when 'health' then case t->>'amenity' when 'doctors' then 'clinic' else t->>'amenity' end
        when 'car' then case when t->>'highway' in ('rest_area', 'services') then t->>'highway' else 'fuel' end
        when 'amenities' then case t->>'amenity' when 'toilets' then 'toilets' else 'parking' end
      end as kind,
      case
        when p_group = 'food' and t->>'amenity' = 'fast_food' then 'fast_food'
        when p_group = 'amenities' and t->>'amenity' = 'parking' then t->>'parking'
      end as subkind,
      t->>'name' as name, t->>'name:th' as name_th, t->>'name:en' as name_en,
      coalesce(t->>'brand', t->>'operator') as brand,
      coalesce(t->>'phone', t->>'contact:phone') as phone,
      coalesce(t->>'website', t->>'contact:website') as website,
      t->>'opening_hours' as opening_hours,
      case when t->>'stars' ~ '^[1-5]' then left(t->>'stars', 1)::smallint end as stars,
      t->>'cuisine' as cuisine,
      case t->>'fee' when 'yes' then true when 'no' then false end as fee,
      coalesce(t->>'image', case when t ? 'wikimedia_commons'
        then 'https://commons.wikimedia.org/wiki/' || (t->>'wikimedia_commons') end) as image_url,
      t->>'wikidata' as wikidata,
      nullif(concat_ws(' ', t->>'addr:housenumber', t->>'addr:street', t->>'addr:subdistrict',
        t->>'addr:district', coalesce(t->>'addr:province', t->>'addr:city'), t->>'addr:postcode'), '') as address,
      extensions.st_setsrid(extensions.st_makepoint(
        coalesce((e->>'lon')::float8, (e->'center'->>'lon')::float8),
        coalesce((e->>'lat')::float8, (e->'center'->>'lat')::float8)
      ), 4326)::extensions.geography as location,
      started as imported_at
    from jsonb_array_elements(body->'elements') e, lateral (select e->'tags' as t) x
    where coalesce(e->>'lat', e->'center'->>'lat') is not null
  ) rows
  where rows.kind = any(kinds)
  on conflict (osm_id) do update set
    kind = excluded.kind, subkind = excluded.subkind, name = excluded.name, name_th = excluded.name_th,
    name_en = excluded.name_en, brand = excluded.brand, phone = excluded.phone, website = excluded.website,
    opening_hours = excluded.opening_hours, stars = excluded.stars, cuisine = excluded.cuisine,
    fee = excluded.fee, image_url = excluded.image_url, wikidata = excluded.wikidata,
    address = excluded.address, location = excluded.location, imported_at = excluded.imported_at;
  get diagnostics imported = row_count;

  delete from public.poi where kind = any(kinds) and imported_at < started;
  return imported;
end;
$$;
revoke execute on function public.import_poi(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lookups
-- ---------------------------------------------------------------------------
create function public.nearby_poi(
  lat double precision,
  lng double precision,
  kinds text[],
  radius_m integer default 5000,
  max_results integer default 20
)
returns table (
  osm_id text, kind text, subkind text, name text, brand text, phone text, website text,
  opening_hours text, stars smallint, fee boolean, image_url text, address text,
  latitude double precision, longitude double precision, distance_m integer
)
language sql stable security invoker set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g
  )
  select p.osm_id, p.kind, p.subkind, coalesce(p.name_th, p.name, p.name_en), p.brand, p.phone, p.website,
    p.opening_hours, p.stars, p.fee, p.image_url, p.address,
    extensions.st_y(p.location::extensions.geometry), extensions.st_x(p.location::extensions.geometry),
    round(extensions.st_distance(p.location, o.g))::integer
  from public.poi p, origin o
  where p.kind = any(kinds)
    and extensions.st_dwithin(p.location, o.g, least(radius_m, 50000))
  order by p.location operator(extensions.<->) o.g
  limit least(max_results, 100);
$$;

-- route is a GeoJSON LineString ({"type":"LineString","coordinates":[[lng,lat],...]}).
create function public.poi_along_route(
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
  ranked as (
    select p.*, l.geom,
      extensions.st_distance(p.location, l.geom::extensions.geography) as d,
      row_number() over (
        partition by p.kind
        order by extensions.st_distance(p.location, l.geom::extensions.geography),
                 (coalesce(p.name_th, p.name) is null)
      ) as rn
    from public.poi p, line l
    where p.kind = any(kinds)
      and extensions.st_dwithin(p.location, l.geom::extensions.geography, least(buffer_m, 20000))
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

create function public.attractions_along_route(
  route jsonb,
  groups text[],
  buffer_m integer default 15000,
  max_results integer default 200
)
returns table (
  att_id text, att_name_th text, att_name_en text, group_key text, effort smallint,
  att_type_label text, province_name_th text, district_name_th text, att_start_end text,
  att_fee_th integer, att_fee_th_kid integer, att_tel text,
  latitude double precision, longitude double precision, distance_m integer, route_fraction double precision
)
language sql stable security invoker set search_path = ''
as $$
  with line as (
    select extensions.st_setsrid(extensions.st_geomfromgeojson(route::text), 4326) as geom
  ),
  pts as (
    select a.*, g.group_key, g.effort,
      extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography as pt
    from public.attraction a
    join public.attraction_type_group g on g.att_type = a.att_type
    where a.latitude is not null and a.longitude is not null
      and (groups is null or cardinality(groups) = 0 or g.group_key = any(groups))
  )
  select p.att_id, p.att_name_th, p.att_name_en, p.group_key, p.effort, p.att_type_label,
    p.province_name_th, p.district_name_th, p.att_start_end, p.att_fee_th, p.att_fee_th_kid, p.att_tel,
    p.latitude, p.longitude,
    round(extensions.st_distance(p.pt, l.geom::extensions.geography))::integer,
    extensions.st_linelocatepoint(l.geom, p.pt::extensions.geometry)
  from pts p, line l
  where extensions.st_dwithin(
    extensions.st_setsrid(extensions.st_makepoint(p.longitude, p.latitude), 4326)::extensions.geography,
    l.geom::extensions.geography, least(buffer_m, 50000))
  order by 15
  limit least(max_results, 500);
$$;

-- Districts and sub-districts (with a representative point) derived from attraction rows.
-- A plain table (not a materialized view) so it can have RLS; rebuild after big attraction imports.
create table public.admin_areas as
select 'district'::text as level, district_name_th as name, province_name_th as province,
  att_province_id as province_id, avg(latitude) as latitude, avg(longitude) as longitude
from public.attraction
where district_name_th is not null and latitude between 5 and 21 and longitude between 97 and 106
group by district_name_th, province_name_th, att_province_id
union all
select 'subdistrict', subdistrict_name_th, province_name_th || ' · อ.' || district_name_th,
  att_province_id, avg(latitude), avg(longitude)
from public.attraction
where subdistrict_name_th is not null and latitude between 5 and 21 and longitude between 97 and 106
group by subdistrict_name_th, district_name_th, province_name_th, att_province_id;

create index admin_areas_name_trgm_idx on public.admin_areas using gin (name extensions.gin_trgm_ops);
alter table public.admin_areas enable row level security;
create policy "admin_areas_public_read" on public.admin_areas for select to anon, authenticated using (true);
grant select on public.admin_areas to anon, authenticated;

-- One search box for provinces, districts, attractions and OSM places. Returns enough
-- context (type, address/area, coordinates) for the user to tell same-named places apart.
create function public.search_places(
  q text,
  near_lat double precision default null,
  near_lng double precision default null,
  max_results integer default 12
)
returns table (
  source text, id text, name text, kind text, area text,
  latitude double precision, longitude double precision, is_secondary_city boolean, score real
)
language sql stable security invoker set search_path = ''
as $$
  with term as (select trim(q) as t),
  near as (
    select case when near_lat is not null and near_lng is not null
      then extensions.st_setsrid(extensions.st_makepoint(near_lng, near_lat), 4326)::extensions.geography end as g
  ),
  hits as (
    select 'province'::text as source, p.id as id, p.name_th as name, 'จังหวัด'::text as kind,
      p.region_th as area, p.latitude as latitude, p.longitude as longitude,
      p.is_secondary_city as is_secondary_city,
      (extensions.similarity(p.name_th, t.t) + case when p.name_th like t.t || '%' then 1 else 0 end)::real as score
    from public.provinces p, term t
    where p.name_th like '%' || t.t || '%'
    union all
    select 'area', a.level || ':' || a.name || ':' || a.province, a.name,
      case a.level when 'district' then 'อำเภอ' else 'ตำบล' end, a.province,
      a.latitude, a.longitude, null,
      (extensions.similarity(a.name, t.t) + case when a.name like t.t || '%' then 0.6 else 0 end)::real
    from public.admin_areas a, term t
    where a.name like '%' || t.t || '%'
    union all
    select 'attraction', x.att_id, x.att_name_th, x.att_type_label,
      concat_ws(' · ', x.district_name_th, x.province_name_th),
      x.latitude, x.longitude, null,
      extensions.similarity(x.att_name_th, t.t)::real
    from public.attraction x, term t
    where x.att_name_th operator(extensions.%) t.t or x.att_name_th like '%' || t.t || '%'
    union all
    select 'poi', o.osm_id, coalesce(o.name_th, o.name, o.name_en), o.kind, o.address,
      extensions.st_y(o.location::extensions.geometry), extensions.st_x(o.location::extensions.geometry), null,
      extensions.similarity(coalesce(o.name_th, o.name, o.name_en), t.t)::real
    from public.poi o, term t
    where coalesce(o.name_th, o.name, o.name_en) operator(extensions.%) t.t
       or coalesce(o.name_th, o.name, o.name_en) like '%' || t.t || '%'
  )
  select h.*
  from hits h, near n
  where length((select t from term)) >= 2
  order by h.score
    + case when n.g is not null and h.latitude is not null then
        greatest(0, 0.5 - extensions.st_distance(
          n.g, extensions.st_setsrid(extensions.st_makepoint(h.longitude, h.latitude), 4326)::extensions.geography
        ) / 200000)
      else 0 end desc
  limit least(max_results, 30);
$$;
grant execute on function public.search_places(text, double precision, double precision, integer) to anon, authenticated;
