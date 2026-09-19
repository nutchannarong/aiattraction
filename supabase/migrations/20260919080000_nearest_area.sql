-- Name a GPS fix or map pin by its nearest district, with the province's main/secondary-city flag.
create function public.nearest_admin_area(lat double precision, lng double precision)
returns table (
  district text, province text, province_id text, is_secondary_city boolean, distance_m integer
)
language sql stable security invoker set search_path = ''
as $$
  select a.name, p.name_th, p.id, p.is_secondary_city,
    round(extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(a.longitude, a.latitude), 4326)::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
    ))::integer as d
  from public.admin_areas a
  join public.provinces p on p.id = a.province_id
  where a.level = 'district'
  order by d
  limit 1;
$$;
grant execute on function public.nearest_admin_area(double precision, double precision) to anon, authenticated;
