begin;

create table public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text check (first_name is null or length(btrim(first_name)) between 1 and 100),
  last_name text check (last_name is null or length(btrim(last_name)) between 1 and 100),
  email text not null unique check (email = lower(btrim(email))),
  country_code text check (country_code is null or country_code ~ '^\+[1-9][0-9]{0,2}$'),
  phone_number text check (phone_number is null or phone_number ~ '^[0-9]{5,15}$'),
  phone_number_normalized text unique check (phone_number_normalized is null or phone_number_normalized ~ '^\+[1-9][0-9]{6,14}$'),
  account_type text check (account_type in ('INVESTOR','PROPERTY_DEVELOPER','LANDLORD','REGISTERED_AGENT','FREELANCE_AGENT')),
  profile_type text check (profile_type in ('PERSONAL','BUSINESS')),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((phone_number is null and phone_number_normalized is null and country_code is null)
      or (phone_number is not null and phone_number_normalized is not null and country_code is not null))
);
alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from public, anon, authenticated;
grant select on public.customer_profiles to authenticated;
-- Only names are currently customer-editable. Identity/contact changes must go
-- through a future validated service flow, never arbitrary profile updates.
grant update (first_name, last_name) on public.customer_profiles to authenticated;
grant all on public.customer_profiles to service_role;
create policy customer_profile_read_own on public.customer_profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy customer_profile_update_own on public.customer_profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function public.touch_customer_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger customer_profile_updated before update on public.customer_profiles
  for each row execute function public.touch_customer_profile();

-- One database transaction creates the identity and profile. A profile constraint
-- failure rolls back signup. Only INSERT metadata is copied; it is never a role.
create function public.sync_customer_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_google boolean := coalesce(new.raw_app_meta_data->>'provider', '') = 'google';
  v_first text := nullif(btrim(coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name')), '');
  v_last text := nullif(btrim(coalesce(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name')), '');
begin
  if tg_op = 'UPDATE' then
    update public.customer_profiles set email = lower(btrim(new.email)),
      email_verified_at = new.email_confirmed_at where id = new.id;
    return new;
  end if;
  if not v_google and (v_first is null or v_last is null
    or nullif(new.raw_user_meta_data->>'country_code', '') is null
    or nullif(new.raw_user_meta_data->>'phone_number', '') is null
    or nullif(new.raw_user_meta_data->>'phone_number_normalized', '') is null
    or nullif(new.raw_user_meta_data->>'account_type', '') is null
    or nullif(new.raw_user_meta_data->>'profile_type', '') is null) then
    raise exception using errcode = '23514', message = 'Manual registration profile is incomplete';
  end if;
  insert into public.customer_profiles(id, first_name, last_name, email, country_code,
    phone_number, phone_number_normalized, account_type, profile_type, email_verified_at)
  values (new.id, v_first, v_last, lower(btrim(new.email)),
    case when not v_google then new.raw_user_meta_data->>'country_code' end,
    case when not v_google then new.raw_user_meta_data->>'phone_number' end,
    case when not v_google then new.raw_user_meta_data->>'phone_number_normalized' end,
    case when not v_google then new.raw_user_meta_data->>'account_type' end,
    case when not v_google then new.raw_user_meta_data->>'profile_type' end,
    new.email_confirmed_at);
  return new;
end;
$$;
create trigger customer_auth_profile_created after insert on auth.users
  for each row execute function public.sync_customer_auth_profile();
create trigger customer_auth_profile_confirmed after update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_customer_auth_profile();
revoke all on function public.sync_customer_auth_profile() from public, anon, authenticated;
revoke all on function public.touch_customer_profile() from public, anon, authenticated;

-- Opaque application sessions: token hashes only; provider tokens are AES-GCM
-- encrypted by the API. Neither anonymous nor authenticated DB roles can read them.
create table public.customer_auth_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('ACCOUNT','RECOVERY')),
  encrypted_tokens text not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  refresh_lock uuid,
  refresh_lock_until timestamptz
);
create index customer_auth_sessions_user_idx on public.customer_auth_sessions(user_id);
create index customer_auth_sessions_expiry_idx on public.customer_auth_sessions(expires_at);
alter table public.customer_auth_sessions enable row level security;
revoke all on public.customer_auth_sessions from public, anon, authenticated;
grant all on public.customer_auth_sessions to service_role;

create function public.create_customer_auth_session(p_hash text, p_user_id uuid, p_purpose text, p_tokens text, p_seconds integer)
returns void language sql security definer set search_path = '' as $$
  insert into public.customer_auth_sessions(token_hash,user_id,purpose,encrypted_tokens,expires_at)
  values (p_hash,p_user_id,p_purpose,p_tokens,clock_timestamp() + make_interval(secs =>
    greatest(1,least(p_seconds,case when p_purpose='RECOVERY' then 600 else 604800 end))));
$$;
create function public.read_customer_auth_session(p_hash text, p_purpose text)
returns setof public.customer_auth_sessions language sql security definer set search_path = '' as $$
  select * from public.customer_auth_sessions where token_hash=p_hash and purpose=p_purpose and expires_at>clock_timestamp();
$$;
create function public.claim_customer_auth_refresh(p_hash text, p_lock uuid)
returns setof public.customer_auth_sessions language sql security definer set search_path = '' as $$
  update public.customer_auth_sessions set refresh_lock=p_lock, refresh_lock_until=clock_timestamp()+interval '30 seconds'
  where token_hash=p_hash and purpose='ACCOUNT' and expires_at>clock_timestamp()
    and (refresh_lock_until is null or refresh_lock_until<clock_timestamp()) returning *;
$$;
-- Consume once before contacting the password provider. Retries after a failed
-- provider update require a new recovery OTP; no replay or concurrent reset wins.
create function public.consume_customer_recovery(p_hash text)
returns setof public.customer_auth_sessions language sql security definer set search_path = '' as $$
  delete from public.customer_auth_sessions where token_hash=p_hash and purpose='RECOVERY'
    and expires_at>clock_timestamp() returning *;
$$;
revoke all on function public.create_customer_auth_session(text,uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.read_customer_auth_session(text,text) from public,anon,authenticated;
revoke all on function public.claim_customer_auth_refresh(text,uuid) from public,anon,authenticated;
revoke all on function public.consume_customer_recovery(text) from public,anon,authenticated;
grant execute on function public.create_customer_auth_session(text,uuid,text,text,integer) to service_role;
grant execute on function public.read_customer_auth_session(text,text) to service_role;
grant execute on function public.claim_customer_auth_refresh(text,uuid) to service_role;
grant execute on function public.consume_customer_recovery(text) to service_role;

commit;
