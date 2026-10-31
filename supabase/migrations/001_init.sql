-- Atlas: initial schema (Phase 1)
-- Run this whole file once in the Supabase SQL editor.
-- Conventions: uuid pk, user_id defaults to auth.uid(), created_at, RLS "user_id = auth.uid()".

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- settings (one row per user)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  display_name text,
  base_currency text not null default 'USD',
  theme text not null default 'system' check (theme in ('system', 'light', 'dark'))
);

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  description text,
  status text not null default 'planning' check (status in ('dreaming', 'planning', 'ongoing', 'completed')),
  start_date date,
  end_date date,
  total_budget numeric(12, 2),
  cover_path text,
  is_sample boolean not null default false
);
create index if not exists trips_user_id_idx on public.trips (user_id);

-- ---------------------------------------------------------------------------
-- trip_countries (a country inside a trip)
-- ---------------------------------------------------------------------------
create table if not exists public.trip_countries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips on delete cascade,
  country_code char(2) not null,
  order_index int not null default 0,
  status text not null default 'planned' check (status in ('wishlist', 'planned', 'visited')),
  arrive_date date,
  depart_date date,
  budget numeric(12, 2),
  notes text,
  cover_path text,
  unique (trip_id, country_code)
);
create index if not exists trip_countries_user_id_idx on public.trip_countries (user_id);
create index if not exists trip_countries_trip_id_idx on public.trip_countries (trip_id);

-- ---------------------------------------------------------------------------
-- cities
-- ---------------------------------------------------------------------------
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_country_id uuid not null references public.trip_countries on delete cascade,
  name text not null,
  lat double precision,
  lng double precision,
  order_index int not null default 0,
  status text not null default 'planned' check (status in ('wishlist', 'planned', 'visited')),
  arrive_date date,
  depart_date date,
  notes text,
  cover_path text
);
create index if not exists cities_user_id_idx on public.cities (user_id);
create index if not exists cities_trip_country_id_idx on public.cities (trip_country_id);

-- ---------------------------------------------------------------------------
-- places (sights and spots)
-- ---------------------------------------------------------------------------
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  city_id uuid not null references public.cities on delete cascade,
  name text not null,
  category text not null default 'sight' check (category in
    ('sight', 'museum', 'food', 'cafe', 'nightlife', 'nature', 'shopping', 'activity', 'stay', 'transport', 'other')),
  lat double precision,
  lng double precision,
  address text,
  url text,
  status text not null default 'want' check (status in ('want', 'planned', 'visited')),
  rating smallint check (rating between 1 and 5),
  cost_estimate numeric(10, 2),
  cost_currency text,
  opening_hours text,
  notes text,
  cover_path text
);
create index if not exists places_user_id_idx on public.places (user_id);
create index if not exists places_city_id_idx on public.places (city_id);

-- ---------------------------------------------------------------------------
-- itinerary
-- ---------------------------------------------------------------------------
create table if not exists public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_country_id uuid not null references public.trip_countries on delete cascade,
  day_number int not null,
  date date,
  city_id uuid references public.cities on delete set null,
  title text,
  notes text,
  unique (trip_country_id, day_number)
);
create index if not exists itinerary_days_user_id_idx on public.itinerary_days (user_id);
create index if not exists itinerary_days_trip_country_id_idx on public.itinerary_days (trip_country_id);
create index if not exists itinerary_days_city_id_idx on public.itinerary_days (city_id);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  day_id uuid not null references public.itinerary_days on delete cascade,
  place_id uuid references public.places on delete set null,
  title text not null,
  type text not null default 'activity' check (type in ('activity', 'food', 'transport', 'stay', 'free')),
  start_time time,
  end_time time,
  notes text,
  done boolean not null default false,
  order_index int not null default 0
);
create index if not exists itinerary_items_user_id_idx on public.itinerary_items (user_id);
create index if not exists itinerary_items_day_id_idx on public.itinerary_items (day_id);
create index if not exists itinerary_items_place_id_idx on public.itinerary_items (place_id);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips on delete cascade,
  trip_country_id uuid references public.trip_countries on delete set null,
  city_id uuid references public.cities on delete set null,
  date date not null default current_date,
  title text,
  category text not null default 'other' check (category in
    ('flights', 'accommodation', 'food', 'transport', 'activities', 'shopping', 'visa', 'insurance', 'other')),
  kind text not null default 'actual' check (kind in ('planned', 'actual')),
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  fx_rate numeric(18, 8) not null default 1,
  amount_base numeric(12, 2) not null,
  notes text
);
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_trip_id_idx on public.expenses (trip_id);
create index if not exists expenses_trip_country_id_idx on public.expenses (trip_country_id);
create index if not exists expenses_city_id_idx on public.expenses (city_id);

-- ---------------------------------------------------------------------------
-- memories
-- ---------------------------------------------------------------------------
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.trips on delete cascade,
  trip_country_id uuid references public.trip_countries on delete set null,
  city_id uuid references public.cities on delete set null,
  place_id uuid references public.places on delete set null,
  date date not null default current_date,
  title text,
  body text,
  mood text,
  tags text[] not null default '{}'
);
create index if not exists memories_user_id_idx on public.memories (user_id);
create index if not exists memories_trip_id_idx on public.memories (trip_id);
create index if not exists memories_trip_country_id_idx on public.memories (trip_country_id);
create index if not exists memories_city_id_idx on public.memories (city_id);
create index if not exists memories_place_id_idx on public.memories (place_id);

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_id uuid references public.trips on delete set null,
  trip_country_id uuid references public.trip_countries on delete set null,
  type text not null default 'other' check (type in
    ('passport', 'id', 'visa', 'flight', 'accommodation', 'insurance', 'vaccination', 'ticket', 'other')),
  title text not null,
  file_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  issue_date date,
  expiry_date date,
  reference_no text,
  notes text,
  is_sample boolean not null default false
);
create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists documents_trip_id_idx on public.documents (trip_id);
create index if not exists documents_trip_country_id_idx on public.documents (trip_country_id);

-- ---------------------------------------------------------------------------
-- photos (polymorphic: trip | country | city | place | memory)
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  entity_type text not null check (entity_type in ('trip', 'country', 'city', 'place', 'memory')),
  entity_id uuid not null,
  path text not null,
  thumb_path text,
  width int,
  height int,
  caption text,
  taken_at timestamptz,
  lat double precision,
  lng double precision,
  source text not null default 'upload' check (source in ('upload', 'wikimedia')),
  attribution text,
  order_index int not null default 0
);
create index if not exists photos_user_id_idx on public.photos (user_id);
create index if not exists photos_entity_idx on public.photos (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Row level security: one policy per table, user_id = auth.uid()
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.trips enable row level security;
alter table public.trip_countries enable row level security;
alter table public.cities enable row level security;
alter table public.places enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.expenses enable row level security;
alter table public.memories enable row level security;
alter table public.documents enable row level security;
alter table public.photos enable row level security;

create policy "own rows" on public.settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.trips for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.trip_countries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.cities for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.places for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.itinerary_days for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.itinerary_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.expenses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.memories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.documents for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: two private buckets
-- Path convention: {user_id}/{entity_type}/{entity_id}/{uuid}.webp
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 26214400, array['image/webp', 'image/jpeg', 'image/png']),
  ('documents', 'documents', false, 26214400, null)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "atlas own files select" on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'documents') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "atlas own files insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('photos', 'documents') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "atlas own files update" on storage.objects for update to authenticated
  using (bucket_id in ('photos', 'documents') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('photos', 'documents') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "atlas own files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'documents') and (storage.foldername(name))[1] = (select auth.uid())::text);
