-- Atlas: route tools (country closing notes, date shifts with one-step undo).
-- Run after 004_extra_lock.sql. Safe to run twice.

-- ---------------------------------------------------------------------------
-- Closing notes: what I'd want to remember about a country, years later
-- ---------------------------------------------------------------------------
create table if not exists public.country_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trip_country_id uuid not null unique references public.trip_countries on delete cascade,
  best_experience text,
  best_food text,
  overpriced text,
  recommended_hotel text,
  enough_days int check (enough_days is null or enough_days between 1 and 999),
  return_again text check (return_again is null or return_again in ('yes', 'maybe', 'no')),
  next_visit text[] not null default '{}',
  -- Written, or waved away with "Not now". Neither is asked about again; the notes can still be opened.
  completed_at timestamptz,
  dismissed_at timestamptz
);
create index if not exists country_reviews_user_id_idx on public.country_reviews (user_id);

-- ---------------------------------------------------------------------------
-- Date shifts: every date a shift changed, before and after, so it can be undone in one step
-- ---------------------------------------------------------------------------
create table if not exists public.date_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips on delete cascade,
  days int not null,
  label text not null,
  changes jsonb not null,
  undone_at timestamptz
);
create index if not exists date_shifts_user_id_idx on public.date_shifts (user_id);
create index if not exists date_shifts_trip_id_idx on public.date_shifts (trip_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: owner-only, and two-factor when enrolled (see 004)
-- ---------------------------------------------------------------------------
alter table public.country_reviews enable row level security;
alter table public.date_shifts enable row level security;

drop policy if exists "own rows" on public.country_reviews;
create policy "own rows" on public.country_reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own rows" on public.date_shifts;
create policy "own rows" on public.date_shifts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "two-factor when enrolled" on public.country_reviews;
create policy "two-factor when enrolled" on public.country_reviews as restrictive for all to authenticated
  using ((select public.atlas_mfa_ok())) with check ((select public.atlas_mfa_ok()));
drop policy if exists "two-factor when enrolled" on public.date_shifts;
create policy "two-factor when enrolled" on public.date_shifts as restrictive for all to authenticated
  using ((select public.atlas_mfa_ok())) with check ((select public.atlas_mfa_ok()));

-- ---------------------------------------------------------------------------
-- Apply and undo. One function each, so a shift lands completely or not at all.
-- Both run as the caller (no security definer): row level security still decides what they can touch.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_apply_date_shift(p_trip_id uuid, p_days int, p_label text, p_changes jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  -- Row level security only finds my own trips. Without this, someone else's trip id would write nothing but still log.
  if not exists (select 1 from public.trips t where t.id = p_trip_id) then
    raise exception 'Trip not found.';
  end if;

  update public.trips t
  set start_date = (c.value ->> 'start_after')::date,
      end_date = (c.value ->> 'end_after')::date
  from jsonb_array_elements(coalesce(p_changes -> 'trips', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid and t.id = p_trip_id;

  update public.trip_countries t
  set arrive_date = (c.value ->> 'start_after')::date,
      depart_date = (c.value ->> 'end_after')::date
  from jsonb_array_elements(coalesce(p_changes -> 'countries', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid and t.trip_id = p_trip_id;

  update public.cities t
  set arrive_date = (c.value ->> 'start_after')::date,
      depart_date = (c.value ->> 'end_after')::date
  from jsonb_array_elements(coalesce(p_changes -> 'cities', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid;

  update public.itinerary_days t
  set date = (c.value ->> 'start_after')::date
  from jsonb_array_elements(coalesce(p_changes -> 'days', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid;

  update public.bookings t
  set start_at = (c.value ->> 'start_after')::timestamptz,
      end_at = (c.value ->> 'end_after')::timestamptz
  from jsonb_array_elements(coalesce(p_changes -> 'bookings', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid and t.trip_id = p_trip_id;

  insert into public.date_shifts (trip_id, days, label, changes)
  values (p_trip_id, p_days, p_label, p_changes)
  returning id into v_id;
  return v_id;
end;
$$;

-- Puts back only what still holds the shifted value: a date edited by hand since then is left alone,
-- and the answer says how many were skipped. Newest first, so undoing can't leave dates half way.
create or replace function public.atlas_undo_date_shift(p_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v public.date_shifts%rowtype;
  n int;
  restored int := 0;
  total int := 0;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into v from public.date_shifts s where s.id = p_id and s.undone_at is null for update;
  if not found then
    raise exception 'This change was already undone.';
  end if;
  if exists (select 1 from public.date_shifts s where s.trip_id = v.trip_id and s.undone_at is null and s.created_at > v.created_at) then
    raise exception 'Undo the newer date change first.';
  end if;

  update public.trips t
  set start_date = (c.value ->> 'start_before')::date,
      end_date = (c.value ->> 'end_before')::date
  from jsonb_array_elements(coalesce(v.changes -> 'trips', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid
    and t.start_date is not distinct from (c.value ->> 'start_after')::date
    and t.end_date is not distinct from (c.value ->> 'end_after')::date;

  update public.trip_countries t
  set arrive_date = (c.value ->> 'start_before')::date,
      depart_date = (c.value ->> 'end_before')::date
  from jsonb_array_elements(coalesce(v.changes -> 'countries', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid
    and t.arrive_date is not distinct from (c.value ->> 'start_after')::date
    and t.depart_date is not distinct from (c.value ->> 'end_after')::date;
  get diagnostics n = row_count;
  restored := restored + n;

  update public.cities t
  set arrive_date = (c.value ->> 'start_before')::date,
      depart_date = (c.value ->> 'end_before')::date
  from jsonb_array_elements(coalesce(v.changes -> 'cities', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid
    and t.arrive_date is not distinct from (c.value ->> 'start_after')::date
    and t.depart_date is not distinct from (c.value ->> 'end_after')::date;
  get diagnostics n = row_count;
  restored := restored + n;

  update public.itinerary_days t
  set date = (c.value ->> 'start_before')::date
  from jsonb_array_elements(coalesce(v.changes -> 'days', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid
    and t.date is not distinct from (c.value ->> 'start_after')::date;
  get diagnostics n = row_count;
  restored := restored + n;

  update public.bookings t
  set start_at = (c.value ->> 'start_before')::timestamptz,
      end_at = (c.value ->> 'end_before')::timestamptz
  from jsonb_array_elements(coalesce(v.changes -> 'bookings', '[]'::jsonb)) as c
  where t.id = (c.value ->> 'id')::uuid
    and t.start_at is not distinct from (c.value ->> 'start_after')::timestamptz
    and t.end_at is not distinct from (c.value ->> 'end_after')::timestamptz;
  get diagnostics n = row_count;
  restored := restored + n;

  total := jsonb_array_length(coalesce(v.changes -> 'countries', '[]'::jsonb))
    + jsonb_array_length(coalesce(v.changes -> 'cities', '[]'::jsonb))
    + jsonb_array_length(coalesce(v.changes -> 'days', '[]'::jsonb))
    + jsonb_array_length(coalesce(v.changes -> 'bookings', '[]'::jsonb));

  update public.date_shifts s set undone_at = now() where s.id = p_id;
  return jsonb_build_object('restored', restored, 'total', total);
end;
$$;

revoke all on function public.atlas_apply_date_shift(uuid, int, text, jsonb) from public, anon;
revoke all on function public.atlas_undo_date_shift(uuid) from public, anon;
grant execute on function public.atlas_apply_date_shift(uuid, int, text, jsonb) to authenticated;
grant execute on function public.atlas_undo_date_shift(uuid) to authenticated;
