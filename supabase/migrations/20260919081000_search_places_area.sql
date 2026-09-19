-- search_places: many OSM places have no address; fill the area from the nearest district
-- (computed only for the returned rows) so same-named places can still be told apart.
create or replace function public.search_places(
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
  ),
  top as (
    select h.*,
      h.score + case when n.g is not null and h.latitude is not null then
          greatest(0, 0.5 - extensions.st_distance(
            n.g, extensions.st_setsrid(extensions.st_makepoint(h.longitude, h.latitude), 4326)::extensions.geography
          ) / 200000)
        else 0 end as rank_score
    from hits h, near n
    where length((select t from term)) >= 2
    order by rank_score desc
    limit least(max_results, 30)
  )
  select top.source, top.id, top.name, top.kind,
    coalesce(top.area, 'ใกล้ อ.' || d.name || ' จ.' || d.province),
    top.latitude, top.longitude, top.is_secondary_city, top.score
  from top
  left join lateral (
    select a.name, a.province
    from public.admin_areas a
    where top.area is null and top.latitude is not null and a.level = 'district'
    order by (a.latitude - top.latitude) ^ 2 + ((a.longitude - top.longitude) * cos(radians(top.latitude))) ^ 2
    limit 1
  ) d on true
  order by top.rank_score desc;
$$;
