-- Shared across instances and both AI endpoints. Only the server can reserve usage.
create table public.ai_usage_limits (
  key text primary key,
  requests integer not null default 0 check (requests >= 0),
  model_calls integer not null default 0 check (model_calls >= 0),
  expires_at timestamptz not null
);
create index ai_usage_limits_expiry_idx on public.ai_usage_limits(expires_at);
alter table public.ai_usage_limits enable row level security;
revoke all on public.ai_usage_limits from public, anon, authenticated;
grant select, insert, update, delete on public.ai_usage_limits to service_role;

create function public.consume_ai_quota(p_user uuid, p_model_calls integer)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day_end timestamptz := (date_trunc('day', v_now at time zone 'UTC') + interval '1 day') at time zone 'UTC';
  v_short text := 'user-short:' || p_user::text;
  v_daily text := 'user-day:' || p_user::text;
begin
  if p_user is null or p_model_calls is null or p_model_calls not between 1 and 5 then
    raise exception 'Invalid quota reservation' using errcode = '22023';
  end if;
  -- Serialize the small reservation transaction so concurrent requests cannot
  -- exceed the global budget or partially consume the three related buckets.
  perform pg_advisory_xact_lock(721638420196::bigint);
  delete from public.ai_usage_limits where expires_at <= v_now;
  insert into public.ai_usage_limits(key, expires_at) values
    ('global-day', v_day_end), (v_daily, v_day_end), (v_short, v_now + interval '10 minutes')
  on conflict (key) do nothing;

  if exists (
    select 1 from public.ai_usage_limits
    where (key = 'global-day' and model_calls + p_model_calls > 1000)
       or (key = v_daily and requests >= 100)
       or (key = v_short and requests >= 30)
  ) then return false; end if;

  update public.ai_usage_limits set requests = requests + 1, model_calls = model_calls + p_model_calls
  where key in ('global-day', v_daily, v_short);
  return true;
end;
$$;
revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
