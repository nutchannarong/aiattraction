-- Public (anon + signed-in) read access for the web app. Writes stay blocked by RLS.
create policy "attraction_public_read"
  on public.attraction
  for select
  to anon, authenticated
  using (true);

-- Filter lists. security_invoker makes the views respect the table's RLS.
-- Labels are keyed by id and use the most common spelling, so a few rows with
-- mis-encoded labels don't produce duplicate options.
create view public.attraction_type_options
  with (security_invoker = on) as
select
  att_category,
  att_type,
  mode() within group (order by att_type_label) as att_type_label,
  count(*)::int as total
from public.attraction
where att_type is not null
group by att_category, att_type;

create view public.attraction_province_options
  with (security_invoker = on) as
select
  att_province_id,
  mode() within group (order by province_name_th) as province_name_th,
  mode() within group (order by region_name_th) as region_name_th,
  count(*)::int as total
from public.attraction
where att_province_id is not null
group by att_province_id;

grant select on public.attraction_type_options, public.attraction_province_options to anon, authenticated;
