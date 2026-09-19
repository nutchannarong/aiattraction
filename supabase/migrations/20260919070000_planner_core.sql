-- Trip planner core: provinces (main/secondary city), place groups, user profiles and trips.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Provinces with the Ministry of Tourism and Sports "เมืองรอง" (55 secondary
-- cities, 2024 tax-deduction list). The other 22 are main cities.
-- ---------------------------------------------------------------------------
create table public.provinces (
  id text primary key,                      -- matches attraction.att_province_id
  name_th text not null unique,
  region_th text,
  is_secondary_city boolean not null default false,
  latitude double precision,
  longitude double precision
);

insert into public.provinces (id, name_th, region_th, latitude, longitude)
select
  a.att_province_id,
  mode() within group (order by a.province_name_th),
  mode() within group (order by a.region_name_th),
  avg(a.latitude) filter (where a.latitude between 5 and 21),
  avg(a.longitude) filter (where a.longitude between 97 and 106)
from public.attraction a
where a.province_name_th is not null and a.att_province_id <> '1'
group by a.att_province_id;

update public.provinces set is_secondary_city = true where name_th in (
  'ชุมพร','ตรัง','นครศรีธรรมราช','นราธิวาส','ปัตตานี','พัทลุง','ยะลา','ระนอง','สตูล',
  'กาฬสินธุ์','ชัยภูมิ','นครพนม','บึงกาฬ','บุรีรัมย์','มหาสารคาม','มุกดาหาร','ยโสธร','ร้อยเอ็ด',
  'เลย','ศรีสะเกษ','สกลนคร','สุรินทร์','หนองคาย','หนองบัวลำภู','อุดรธานี','อุบลราชธานี','อำนาจเจริญ',
  'กำแพงเพชร','เชียงราย','ตาก','นครสวรรค์','น่าน','พะเยา','พิจิตร','พิษณุโลก','เพชรบูรณ์','แพร่',
  'แม่ฮ่องสอน','ลำปาง','ลำพูน','สุโขทัย','อุตรดิตถ์','อุทัยธานี',
  'จันทบุรี','ชัยนาท','ตราด','นครนายก','ปราจีนบุรี','ราชบุรี','ลพบุรี','สมุทรสงคราม','สระแก้ว',
  'สิงห์บุรี','สุพรรณบุรี','อ่างทอง'
);

alter table public.provinces enable row level security;
create policy "provinces_public_read" on public.provinces for select to anon, authenticated using (true);
grant select on public.provinces to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 13 place groups from DESIGN.md §2.2, with an effort level (0 easy – 2 hard)
-- used to keep plans comfortable for children and older travellers.
-- ---------------------------------------------------------------------------
create table public.place_groups (
  key text primary key,
  label_th text not null,
  color text not null,
  effort smallint not null default 0,
  sort smallint not null
);

insert into public.place_groups (key, label_th, color, effort, sort) values
  ('temple',   'วัด · ศาสนสถาน',              '#E8A11F', 0, 1),
  ('sea',      'ทะเล · หาด · เกาะ',            '#2E7FB8', 1, 2),
  ('mountain', 'ภูเขา · น้ำตก · ถ้ำ',           '#0E5C55', 2, 3),
  ('view',     'จุดชมวิว · ถ่ายรูป',            '#E8377D', 1, 4),
  ('nature',   'อุทยาน · ธรรมชาติ',            '#3D8B4E', 2, 5),
  ('market',   'ตลาด · ของฝาก · ช้อปปิ้ง',      '#C0472B', 0, 6),
  ('museum',   'พิพิธภัณฑ์ · แหล่งเรียนรู้',      '#6A5FA8', 0, 7),
  ('history',  'ประวัติศาสตร์ · โบราณสถาน',     '#8A6432', 1, 8),
  ('local',    'ชุมชน · วิถีชีวิต',             '#96662F', 1, 9),
  ('farm',     'ฟาร์ม · สวนเกษตร',             '#7FA22E', 1, 10),
  ('kids',     'เด็กเล่น · สวนสนุก · สัตว์',      '#D6417A', 0, 11),
  ('spa',      'สปา · นวด · สุขภาพ',            '#149187', 0, 12),
  ('other',    'อื่น ๆ',                       '#87889A', 0, 13);

create table public.attraction_type_group (
  att_type integer primary key,
  group_key text not null references public.place_groups (key),
  effort smallint not null
);

insert into public.attraction_type_group (att_type, group_key, effort) values
  (1,'sea',1),(2,'nature',2),(3,'nature',2),(4,'view',1),(5,'nature',1),(6,'mountain',2),
  (7,'nature',0),(8,'view',1),(9,'mountain',2),(10,'spa',0),(11,'sea',2),(12,'nature',1),
  (13,'mountain',2),(14,'nature',1),(15,'nature',1),(16,'nature',2),(17,'museum',0),(18,'nature',1),
  (19,'sea',0),(20,'nature',1),(21,'view',0),
  (31,'history',1),(32,'history',1),(33,'history',0),(34,'history',1),(35,'museum',0),(36,'temple',0),
  (37,'museum',0),(38,'history',0),(39,'history',1),(40,'local',0),(41,'museum',0),(42,'local',0),
  (43,'local',1),(44,'local',1),(45,'market',0),(46,'history',1),(47,'local',0),
  (61,'other',0),(62,'other',1),(63,'farm',0),(64,'farm',1),(65,'farm',1),(66,'nature',0),
  (67,'kids',1),(68,'kids',1),(69,'kids',1),(70,'temple',0),(71,'other',0),(72,'history',0),
  (73,'market',0),(74,'spa',0),(75,'other',0);

alter table public.place_groups enable row level security;
alter table public.attraction_type_group enable row level security;
create policy "place_groups_public_read" on public.place_groups for select to anon, authenticated using (true);
create policy "attraction_type_group_public_read" on public.attraction_type_group for select to anon, authenticated using (true);
grant select on public.place_groups, public.attraction_type_group to anon, authenticated;

create index attraction_name_trgm_idx on public.attraction using gin (att_name_th extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- User profiles (1:1 with auth.users). A row is created on sign-up, pre-filled
-- from the OAuth provider's name/avatar; the user completes the rest.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  birth_date date,
  gender text check (gender in ('male', 'female', 'other', 'unspecified')),
  home_province_id text references public.provinces (id),
  occupation text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
grant select, insert, update on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing users get a profile row too.
insert into public.profiles (id, full_name, avatar_url)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
       coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Trips. Every table carries user_id so RLS is a simple owner check.
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  origin jsonb not null,            -- {type: province|pin|place, label, lat, lng, province_id?}
  destination jsonb not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  travelers jsonb not null,         -- {adults, children, seniors, adult_ages: []}
  occasion text,
  interests text[] not null default '{}',
  stop_kinds text[] not null default '{}',
  vehicle jsonb not null,           -- {type, brand, model, cc, year, fuel, fuel_price, km_per_litre}
  route_style text not null,
  route_summary jsonb,              -- {distance_km, drive_minutes, waypoints: [...]}
  status text not null default 'upcoming' check (status in ('draft', 'upcoming', 'active', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_index smallint not null,
  date date not null,
  finished_at timestamptz,
  unique (trip_id, day_index)
);

create table public.trip_items (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.trip_days (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position smallint not null,
  start_time time,
  end_time time,
  activity text,
  kind text not null check (kind in ('attraction', 'poi', 'lodging', 'rest_stop', 'custom')),
  place_source text,                -- attraction | poi | osm | manual
  place_id text,
  place_name text,
  latitude double precision,
  longitude double precision,
  address text,
  cost_estimate numeric(12, 2),
  cost_category text check (cost_category in ('fuel', 'travel', 'admission', 'food', 'lodging', 'other')),
  phone text,
  opening_hours text,
  notes text,
  lodging jsonb,                    -- {type, filters, chosen_platform, prices: {agoda, booking, airbnb, direct}}
  created_at timestamptz not null default now()
);

create table public.trip_bookings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.trip_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  night_date date not null,
  platform text not null check (platform in ('agoda', 'booking', 'airbnb', 'direct', 'other')),
  url text,
  price numeric(12, 2),
  status text not null default 'todo' check (status in ('todo', 'opened', 'booked', 'skipped')),
  booked_at timestamptz
);

create index trips_user_idx on public.trips (user_id, start_date);
create index trip_days_trip_idx on public.trip_days (trip_id);
create index trip_items_day_idx on public.trip_items (day_id, position);
create index trip_bookings_item_idx on public.trip_bookings (item_id);

alter table public.trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.trip_items enable row level security;
alter table public.trip_bookings enable row level security;

create policy "trips_owner" on public.trips for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Children must also hang off a parent row the same user owns, so nobody can
-- attach rows to another user's trip by guessing its id.
create policy "trip_days_owner" on public.trip_days for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid()))
  );
create policy "trip_items_owner" on public.trip_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.trip_days d where d.id = day_id and d.user_id = (select auth.uid()))
  );
create policy "trip_bookings_owner" on public.trip_bookings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.trip_items i where i.id = item_id and i.user_id = (select auth.uid()))
  );

grant select, insert, update, delete on public.trips, public.trip_days, public.trip_items, public.trip_bookings to authenticated;
