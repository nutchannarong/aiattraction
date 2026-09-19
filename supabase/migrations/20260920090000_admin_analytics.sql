-- Private reporting inputs. Browsers can only record their own activity via RPC.
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('login', 'plan_created')),
  provider text,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_date_idx on public.analytics_events(created_at);
create index if not exists analytics_events_user_kind_idx on public.analytics_events(user_id, kind, created_at);

create table if not exists public.analytics_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active_seconds integer not null default 0
);
create index if not exists analytics_sessions_date_idx on public.analytics_sessions(last_seen_at);

create table if not exists public.admin_login_limits (
  key text primary key,
  started_at timestamptz not null default now(),
  attempts integer not null default 1
);

alter table public.analytics_events enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.admin_login_limits enable row level security;

revoke all on public.analytics_events, public.analytics_sessions, public.admin_login_limits from anon, authenticated;
grant all on public.analytics_events, public.analytics_sessions, public.admin_login_limits to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Grant select to service_role for admin reports
grant select on public.profiles, public.trips, public.trip_days, public.trip_items, public.trip_bookings, public.provinces, public.place_groups to service_role;

create or replace function public.admin_login_attempt(p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_attempts integer;
begin
  delete from public.admin_login_limits where started_at < now() - interval '1 day';
  insert into public.admin_login_limits as l (key) values (left(p_key, 64))
  on conflict (key) do update set
    attempts = case when l.started_at < now() - interval '15 minutes' then 1 else l.attempts + 1 end,
    started_at = case when l.started_at < now() - interval '15 minutes' then now() else l.started_at end
  returning attempts into v_attempts;
  return v_attempts <= 10;
end;
$$;
revoke all on function public.admin_login_attempt(text) from public, anon, authenticated;
grant execute on function public.admin_login_attempt(text) to service_role;

create or replace function public.record_analytics_event(p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_kind not in ('login', 'plan_created') then return; end if;
  -- Best-effort telemetry: suppress accidental duplicate submits.
  if exists (select 1 from public.analytics_events where user_id = auth.uid() and kind = p_kind and created_at > now() - interval '5 seconds') then return; end if;
  insert into public.analytics_events(user_id, kind, provider)
  values (auth.uid(), p_kind, coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', 'email'));
end;
$$;
revoke all on function public.record_analytics_event(text) from public, anon;
grant execute on function public.record_analytics_event(text) to authenticated;

create or replace function public.record_activity(p_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.analytics_sessions as s (id, user_id) values (p_session, auth.uid())
  on conflict (id) do update set
    active_seconds = s.active_seconds + case when now() - s.last_seen_at between interval '15 seconds' and interval '90 seconds'
      then floor(extract(epoch from now() - s.last_seen_at))::integer else 0 end,
    last_seen_at = now()
  where s.user_id = auth.uid() and now() - s.last_seen_at >= interval '15 seconds';
end;
$$;
revoke all on function public.record_activity(uuid) from public, anon;
grant execute on function public.record_activity(uuid) to authenticated;
