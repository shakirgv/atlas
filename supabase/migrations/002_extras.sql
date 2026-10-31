-- Atlas: Phase 2 extras (bookings, packing lists, packing templates)
-- Run after 001_init.sql.

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips on delete cascade,
  trip_country_id uuid references public.trip_countries on delete set null,
  city_id uuid references public.cities on delete set null,
  document_id uuid references public.documents on delete set null,
  type text not null default 'flight' check (type in
    ('flight', 'train', 'bus', 'ferry', 'car', 'hotel', 'hostel', 'apartment', 'tour', 'other')),
  title text not null,
  from_label text,
  to_label text,
  start_at timestamptz,
  end_at timestamptz,
  confirmation_no text,
  cost numeric(12, 2),
  currency text,
  status text not null default 'booked' check (status in ('booked', 'pending', 'cancelled'))
);
create index if not exists bookings_user_id_idx on public.bookings (user_id);
create index if not exists bookings_trip_id_idx on public.bookings (trip_id);
create index if not exists bookings_trip_country_id_idx on public.bookings (trip_country_id);
create index if not exists bookings_city_id_idx on public.bookings (city_id);
create index if not exists bookings_document_id_idx on public.bookings (document_id);

create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips on delete cascade,
  label text not null,
  category text not null default 'General',
  packed boolean not null default false,
  order_index int not null default 0
);
create index if not exists packing_items_user_id_idx on public.packing_items (user_id);
create index if not exists packing_items_trip_id_idx on public.packing_items (trip_id);

-- Reusable packing templates saved by the user (built-in templates live in code).
create table if not exists public.packing_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  items jsonb not null default '[]'::jsonb
);
create index if not exists packing_templates_user_id_idx on public.packing_templates (user_id);

alter table public.bookings enable row level security;
alter table public.packing_items enable row level security;
alter table public.packing_templates enable row level security;

create policy "own rows" on public.bookings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.packing_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.packing_templates for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
