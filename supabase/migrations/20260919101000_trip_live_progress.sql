alter table public.trip_items
  add column if not exists progress_status text not null default 'pending'
    check (progress_status in ('pending', 'completed', 'skipped')),
  add column if not exists completed_at timestamptz;

alter table public.trips
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists trip_items_progress_idx
  on public.trip_items (day_id, progress_status);
