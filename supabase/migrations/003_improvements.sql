-- Atlas: feature pack 2 (visa/entry, climate, time zones, essentials, transport, cash, receipts,
-- PIN vault, recap, share links). Run after 001_init.sql and 002_extras.sql.
-- Idempotent where practical: safe to run twice.

-- ---------------------------------------------------------------------------
-- settings: home location, passport country, vault timeout
-- ---------------------------------------------------------------------------
alter table public.settings add column if not exists passport_country char(2);
alter table public.settings add column if not exists home_city text;
alter table public.settings add column if not exists home_lat double precision;
alter table public.settings add column if not exists home_lng double precision;
alter table public.settings add column if not exists home_timezone text;
alter table public.settings add column if not exists lock_timeout_minutes int not null default 5;
alter table public.settings drop constraint if exists settings_lock_timeout_check;
alter table public.settings add constraint settings_lock_timeout_check check (lock_timeout_minutes in (1, 5, 15, 30));

-- ---------------------------------------------------------------------------
-- transport: how I get HERE from the previous stop (first stop = from home)
-- ---------------------------------------------------------------------------
alter table public.trip_countries add column if not exists transport_mode text;
alter table public.trip_countries add column if not exists transport_note text;
alter table public.trip_countries drop constraint if exists trip_countries_transport_mode_check;
alter table public.trip_countries add constraint trip_countries_transport_mode_check
  check (transport_mode is null or transport_mode in ('flight', 'train', 'bus', 'ferry', 'car', 'bike', 'walk', 'other'));

alter table public.cities add column if not exists timezone text;
alter table public.cities add column if not exists transport_mode text;
alter table public.cities add column if not exists transport_note text;
alter table public.cities drop constraint if exists cities_transport_mode_check;
alter table public.cities add constraint cities_transport_mode_check
  check (transport_mode is null or transport_mode in ('flight', 'train', 'bus', 'ferry', 'car', 'bike', 'walk', 'other'));

-- ---------------------------------------------------------------------------
-- documents: sensitive flag (PIN vault)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'sensitive') then
    alter table public.documents add column sensitive boolean not null default false;
    update public.documents set sensitive = true where type in ('passport', 'id', 'visa', 'insurance', 'vaccination');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- cash wallets (before expenses.wallet_id references it)
-- ---------------------------------------------------------------------------
create table if not exists public.cash_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  label text,
  low_balance_alert numeric(12, 2),
  unique (user_id, currency)
);
create index if not exists cash_wallets_user_id_idx on public.cash_wallets (user_id);

-- ---------------------------------------------------------------------------
-- expenses: payment method, wallet link, "fees" category
-- ---------------------------------------------------------------------------
alter table public.expenses add column if not exists payment_method text not null default 'card';
alter table public.expenses drop constraint if exists expenses_payment_method_check;
alter table public.expenses add constraint expenses_payment_method_check check (payment_method in ('card', 'cash', 'other'));
alter table public.expenses add column if not exists wallet_id uuid references public.cash_wallets on delete set null;
create index if not exists expenses_wallet_id_idx on public.expenses (wallet_id);
alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (category in
  ('flights', 'accommodation', 'food', 'transport', 'activities', 'shopping', 'visa', 'insurance', 'fees', 'other'));

-- ---------------------------------------------------------------------------
-- photos: receipts attach to expenses
-- ---------------------------------------------------------------------------
alter table public.photos drop constraint if exists photos_entity_type_check;
alter table public.photos add constraint photos_entity_type_check
  check (entity_type in ('trip', 'country', 'city', 'place', 'memory', 'expense'));

-- ---------------------------------------------------------------------------
-- cash transactions (amount is signed, in the wallet currency)
-- ---------------------------------------------------------------------------
create table if not exists public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  wallet_id uuid not null references public.cash_wallets on delete cascade,
  type text not null check (type in ('withdrawal', 'exchange_in', 'exchange_out', 'spend', 'received', 'adjustment')),
  date date not null default current_date,
  amount numeric(12, 2) not null,
  counter_amount numeric(12, 2),
  counter_currency text,
  fee_amount numeric(12, 2),
  fee_currency text,
  effective_rate numeric(18, 8),
  mid_market_rate numeric(18, 8),
  linked_transaction_id uuid,
  expense_id uuid references public.expenses on delete set null,
  fee_expense_id uuid references public.expenses on delete set null,
  note text
);
create index if not exists cash_transactions_user_id_idx on public.cash_transactions (user_id);
create index if not exists cash_transactions_wallet_id_idx on public.cash_transactions (wallet_id);
create index if not exists cash_transactions_expense_id_idx on public.cash_transactions (expense_id);
create index if not exists cash_transactions_fee_expense_id_idx on public.cash_transactions (fee_expense_id);
create index if not exists cash_transactions_linked_idx on public.cash_transactions (linked_transaction_id);

-- ---------------------------------------------------------------------------
-- entry requirements (one per trip country, all entered by me)
-- ---------------------------------------------------------------------------
create table if not exists public.entry_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  trip_country_id uuid not null unique references public.trip_countries on delete cascade,
  country_code char(2) not null,
  passport_country char(2),
  requirement_type text not null default 'not_checked'
    check (requirement_type in ('not_checked', 'visa_free', 'e_visa', 'visa_on_arrival', 'visa_required', 'other')),
  status text not null default 'not_checked'
    check (status in ('not_checked', 'not_needed', 'to_apply', 'applied', 'approved', 'rejected')),
  allowed_stay_days int check (allowed_stay_days is null or allowed_stay_days > 0),
  apply_by date,
  applied_on date,
  valid_from date,
  valid_until date,
  fee numeric(10, 2),
  fee_currency text,
  official_url text,
  notes text,
  last_verified_on date,
  checklist jsonb not null default '[]'::jsonb,
  document_id uuid references public.documents on delete set null
);
create index if not exists entry_requirements_user_id_idx on public.entry_requirements (user_id);
create index if not exists entry_requirements_document_id_idx on public.entry_requirements (document_id);

-- ---------------------------------------------------------------------------
-- country info overrides (my edits win over the bundled baseline)
-- ---------------------------------------------------------------------------
create table if not exists public.country_info_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  country_code char(2) not null,
  emergency_general text,
  emergency_police text,
  emergency_ambulance text,
  emergency_fire text,
  plugs text[],
  voltage text,
  frequency text,
  tipping text,
  tap_water text,
  sim_tips text,
  embassy_name text,
  embassy_phone text,
  embassy_address text,
  embassy_url text,
  notes text,
  unique (user_id, country_code)
);
create index if not exists country_info_overrides_user_id_idx on public.country_info_overrides (user_id);

-- ---------------------------------------------------------------------------
-- share links (public reads go only through the server share route)
-- ---------------------------------------------------------------------------
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('memory', 'trip', 'recap')),
  target_id uuid,
  year int,
  token text not null unique,
  expires_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  revoked_at timestamptz
);
create index if not exists shares_user_id_idx on public.shares (user_id);
create index if not exists shares_token_idx on public.shares (token);
create index if not exists shares_target_id_idx on public.shares (target_id);

-- ---------------------------------------------------------------------------
-- Row level security: owner-only on every new table
-- ---------------------------------------------------------------------------
alter table public.cash_wallets enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.entry_requirements enable row level security;
alter table public.country_info_overrides enable row level security;
alter table public.shares enable row level security;

drop policy if exists "own rows" on public.cash_wallets;
create policy "own rows" on public.cash_wallets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own rows" on public.cash_transactions;
create policy "own rows" on public.cash_transactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own rows" on public.entry_requirements;
create policy "own rows" on public.entry_requirements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own rows" on public.country_info_overrides;
create policy "own rows" on public.country_info_overrides for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own rows" on public.shares;
create policy "own rows" on public.shares for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- PIN vault secrets. Kept OUT of `settings` on purpose: `settings` is readable and writable
-- by the signed-in browser client, so a hash stored there could be copied and brute-forced
-- offline, and the lockout counter could be reset. This table has RLS enabled and NO policies,
-- so the API roles cannot touch it at all; the server goes through the two security-definer
-- functions below, which are scoped to auth.uid().
-- ---------------------------------------------------------------------------
create table if not exists public.vault_secrets (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  pin_hash text,
  pin_salt text,
  pin_failed_attempts int not null default 0,
  pin_locked_until timestamptz
);
alter table public.vault_secrets enable row level security;
revoke all on public.vault_secrets from anon, authenticated;

create or replace function public.atlas_pin_state()
returns table (pin_hash text, pin_salt text, pin_failed_attempts int, pin_locked_until timestamptz)
language sql
security definer
set search_path = ''
as $$
  select v.pin_hash, v.pin_salt, v.pin_failed_attempts, v.pin_locked_until
  from public.vault_secrets v
  where v.user_id = (select auth.uid());
$$;

-- p_set_hash = true: store a new hash/salt (or clear with nulls) and reset the counter.
-- p_set_hash = false: only update the failed-attempt counter and lockout time.
create or replace function public.atlas_pin_write(p_hash text, p_salt text, p_failed int, p_locked_until timestamptz, p_set_hash boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  insert into public.vault_secrets (user_id) values ((select auth.uid())) on conflict (user_id) do nothing;
  if p_set_hash then
    update public.vault_secrets set pin_hash = p_hash, pin_salt = p_salt, pin_failed_attempts = 0, pin_locked_until = null
    where user_id = (select auth.uid());
  else
    update public.vault_secrets set pin_failed_attempts = coalesce(p_failed, 0), pin_locked_until = p_locked_until
    where user_id = (select auth.uid());
  end if;
end;
$$;

revoke all on function public.atlas_pin_state() from public, anon;
revoke all on function public.atlas_pin_write(text, text, int, timestamptz, boolean) from public, anon;
grant execute on function public.atlas_pin_state() to authenticated;
grant execute on function public.atlas_pin_write(text, text, int, timestamptz, boolean) to authenticated;
