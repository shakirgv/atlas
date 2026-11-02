-- Atlas: extra lock. Run after 003_improvements.sql. Safe to run twice.
--
-- 1. Two-factor login is enforced by the database, not only by the app. The anon key is public, so
--    someone holding a leaked password could otherwise skip the app and read the API directly.
-- 2. The PIN vault moves its checks into the database. The hash never leaves it, wrong attempts are
--    counted where they can't be reset, and a locked sensitive file can't be signed even by a direct call.

-- ---------------------------------------------------------------------------
-- Vault state. The unlock cookie holds a random token; only its hash is stored here.
-- ---------------------------------------------------------------------------
alter table public.vault_secrets add column if not exists pin_length int;
alter table public.vault_secrets add column if not exists unlock_token_hash text;
alter table public.vault_secrets add column if not exists unlock_until timestamptz;

-- Replaced: these handed the hash to the signed-in browser role and let it reset the attempt counter.
drop function if exists public.atlas_pin_state();
drop function if exists public.atlas_pin_write(text, text, int, timestamptz, boolean);

-- ---------------------------------------------------------------------------
-- True at aal2, or when the user has no verified factor at all.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified');
$$;

-- ---------------------------------------------------------------------------
-- Vault functions
-- ---------------------------------------------------------------------------

-- Always one row. The salt is not a secret: the server needs it to hash a PIN attempt.
create or replace function public.atlas_vault_status()
returns table (has_pin boolean, pin_salt text, pin_length int, locked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(v.pin_hash is not null, false),
    v.pin_salt,
    v.pin_length,
    case when v.pin_locked_until > now() then v.pin_locked_until end
  from (select 1) as one
  left join public.vault_secrets v on v.user_id = auth.uid();
$$;

-- Set, change or clear (null hash) the PIN. Only a session whose password was entered in the last two
-- minutes may do this, so an unlocked device can't replace the PIN without knowing the password.
create or replace function public.atlas_pin_set(p_hash text, p_salt text, p_length int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as method
    where method ->> 'method' = 'password'
      and (method ->> 'timestamp')::bigint > extract(epoch from now()) - 120
  ) then
    raise exception 'confirm your password first';
  end if;
  if p_hash is not null and (p_salt is null or p_length not between 4 and 8) then
    raise exception 'invalid PIN';
  end if;
  insert into public.vault_secrets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.vault_secrets
  set pin_hash = p_hash,
      pin_salt = p_salt,
      pin_length = p_length,
      pin_failed_attempts = 0,
      pin_locked_until = null,
      unlock_token_hash = null,
      unlock_until = null
  where user_id = auth.uid();
end;
$$;

-- Compare a hashed attempt. 5 wrong attempts lock the vault for 5 minutes. A correct one stores the
-- hash of the new unlock token and starts the timeout.
create or replace function public.atlas_pin_check(p_hash text, p_token_hash text)
returns table (ok boolean, locked_until timestamptz, attempts_left int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vault_secrets%rowtype;
  failed int;
  until timestamptz;
begin
  if auth.uid() is null or not public.atlas_mfa_ok() then
    raise exception 'two-factor verification required';
  end if;
  select * into v from public.vault_secrets s where s.user_id = auth.uid() for update;
  if not found or v.pin_hash is null then
    raise exception 'no PIN set';
  end if;
  if v.pin_locked_until > now() then
    return query select false, v.pin_locked_until, 0;
    return;
  end if;
  if v.pin_hash = p_hash then
    update public.vault_secrets s
    set pin_failed_attempts = 0,
        pin_locked_until = null,
        unlock_token_hash = p_token_hash,
        unlock_until = now() + make_interval(mins => coalesce((select st.lock_timeout_minutes from public.settings st where st.user_id = auth.uid()), 5))
    where s.user_id = auth.uid();
    return query select true, null::timestamptz, 5;
    return;
  end if;
  failed := v.pin_failed_attempts + 1;
  if failed >= 5 then
    until := now() + interval '5 minutes';
    update public.vault_secrets s set pin_failed_attempts = 0, pin_locked_until = until where s.user_id = auth.uid();
    return query select false, until, 0;
    return;
  end if;
  update public.vault_secrets s set pin_failed_attempts = failed, pin_locked_until = null where s.user_id = auth.uid();
  return query select false, null::timestamptz, 5 - failed;
end;
$$;

-- Is this token still good? If so the timeout starts over (sliding expiry).
create or replace function public.atlas_vault_touch(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.atlas_mfa_ok() then
    return false;
  end if;
  update public.vault_secrets s
  set unlock_until = now() + make_interval(mins => coalesce((select st.lock_timeout_minutes from public.settings st where st.user_id = auth.uid()), 5))
  where s.user_id = auth.uid() and s.unlock_token_hash = p_token_hash and s.unlock_until > now();
  return found;
end;
$$;

create or replace function public.atlas_vault_lock()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.vault_secrets set unlock_token_hash = null, unlock_until = null where user_id = auth.uid();
$$;

-- May this storage path be read? No when it is a sensitive document, a PIN exists and the vault is locked.
create or replace function public.atlas_document_open(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (select 1 from public.documents d where d.user_id = auth.uid() and d.sensitive and d.file_path = p_path)
    or not exists (select 1 from public.vault_secrets v where v.user_id = auth.uid() and v.pin_hash is not null)
    or exists (select 1 from public.vault_secrets v where v.user_id = auth.uid() and v.unlock_until > now());
$$;

revoke all on function public.atlas_mfa_ok() from public, anon;
revoke all on function public.atlas_vault_status() from public, anon;
revoke all on function public.atlas_pin_set(text, text, int) from public, anon;
revoke all on function public.atlas_pin_check(text, text) from public, anon;
revoke all on function public.atlas_vault_touch(text) from public, anon;
revoke all on function public.atlas_vault_lock() from public, anon;
revoke all on function public.atlas_document_open(text) from public, anon;
grant execute on function public.atlas_mfa_ok() to authenticated;
grant execute on function public.atlas_vault_status() to authenticated;
grant execute on function public.atlas_pin_set(text, text, int) to authenticated;
grant execute on function public.atlas_pin_check(text, text) to authenticated;
grant execute on function public.atlas_vault_touch(text) to authenticated;
grant execute on function public.atlas_vault_lock() to authenticated;
grant execute on function public.atlas_document_open(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: a restrictive policy on every table. It only narrows the "own rows" policies:
-- nothing changes until a factor is verified; after that, an aal1 session sees no rows.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists "two-factor when enrolled" on public.%I', t);
    execute format(
      'create policy "two-factor when enrolled" on public.%I as restrictive for all to authenticated using ((select public.atlas_mfa_ok())) with check ((select public.atlas_mfa_ok()))',
      t
    );
  end loop;
end $$;

drop policy if exists "atlas two-factor when enrolled" on storage.objects;
create policy "atlas two-factor when enrolled" on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('photos', 'documents') or (select public.atlas_mfa_ok()))
  with check (bucket_id not in ('photos', 'documents') or (select public.atlas_mfa_ok()));

-- Signing a URL needs SELECT, so this is what stops a locked sensitive file from getting one.
drop policy if exists "atlas locked documents" on storage.objects;
create policy "atlas locked documents" on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'documents' or public.atlas_document_open(name));
