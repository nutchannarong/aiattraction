-- The table was created without SELECT for the API roles; RLS policy alone isn't enough.
grant select on public.attraction to anon, authenticated;
