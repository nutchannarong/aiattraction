-- Run with an administrative SQL connection. All fixture changes are rolled back.
begin;
select pg_advisory_xact_lock(721638420196::bigint);
do $$
begin
  if has_function_privilege('anon', 'public.consume_ai_quota(uuid,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.consume_ai_quota(uuid,integer)', 'execute')
     or has_table_privilege('anon', 'public.ai_usage_limits', 'select')
     or has_table_privilege('authenticated', 'public.ai_usage_limits', 'update') then
    raise exception 'Quota must not be accessible to browser roles';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.ai_usage_limits'::regclass) then
    raise exception 'RLS must be enabled';
  end if;
end $$;
set local role service_role;
do $$
declare
  u uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  i integer;
begin
  -- Reset only this transaction's view of the global counter.
  update public.ai_usage_limits set model_calls = 0 where key = 'global-day';
  for i in 1..30 loop
    if not public.consume_ai_quota(u, 1) then raise exception 'Allowed request % blocked', i; end if;
  end loop;
  if public.consume_ai_quota(u, 1) then raise exception 'Short window bypass'; end if;
  if not public.consume_ai_quota(other_user, 1) then raise exception 'Users must have separate quotas'; end if;
  update public.ai_usage_limits set expires_at = now() - interval '1 second' where key = 'user-short:' || u;
  if not public.consume_ai_quota(u, 5) then raise exception 'Window expiry did not reset'; end if;
  update public.ai_usage_limits set requests = 100 where key = 'user-day:' || u;
  if public.consume_ai_quota(u, 1) then raise exception 'Daily user cap bypass'; end if;
  update public.ai_usage_limits set model_calls = 999 where key = 'global-day';
  if public.consume_ai_quota(other_user, 5) then raise exception 'Global reservation overshoot'; end if;
  if not public.consume_ai_quota(other_user, 1) then raise exception 'Last global unit rejected'; end if;
  if public.consume_ai_quota(gen_random_uuid(), 1) then raise exception 'New account bypasses global cap'; end if;
  if (select model_calls from public.ai_usage_limits where key = 'global-day') <> 1000 then
    raise exception 'Rejected reservations must not change counters';
  end if;
  update public.ai_usage_limits set expires_at = now() - interval '1 second' where key = 'global-day';
  if not public.consume_ai_quota(other_user, 1) then raise exception 'Daily global reset failed'; end if;
  begin
    perform public.consume_ai_quota(other_user, 0);
    raise exception 'Zero-cost reservation accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.consume_ai_quota(null, 1);
    raise exception 'Missing user accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
select 'AI quota checks passed' as result;
rollback;
