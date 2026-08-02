-- Additive authentication/onboarding foundation.
-- Transactional: duplicate legacy identifiers fail the unique-index step and
-- roll back so data can be cleaned before retrying.
begin;

create extension if not exists pgcrypto;

do $$ begin create type public.customer_account_status as enum ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.persona_type as enum ('BUYER', 'SELLER_DEVELOPER'); exception when duplicate_object then null; end $$;
do $$ begin create type public.persona_onboarding_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.profile_type_v2 as enum ('INDIVIDUAL', 'BUSINESS'); exception when duplicate_object then null; end $$;
do $$ begin create type public.supported_currency as enum ('NGN', 'USD', 'GBP', 'EUR'); exception when duplicate_object then null; end $$;
do $$ begin create type public.admin_status as enum ('PENDING', 'ACTIVE', 'SUSPENDED', 'LOCKED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.admin_role as enum ('ADMIN', 'SUPER_ADMIN'); exception when duplicate_object then null; end $$;
do $$ begin create type public.admin_department as enum ('TECH', 'MANAGEMENT'); exception when duplicate_object then null; end $$;
do $$ begin create type public.otp_purpose as enum ('CUSTOMER_EMAIL_VERIFICATION', 'CUSTOMER_PASSWORD_RESET', 'ADMIN_ACTIVATION', 'ADMIN_LOGIN'); exception when duplicate_object then null; end $$;
do $$ begin create type public.invitation_status as enum ('PENDING', 'USED', 'REVOKED', 'EXPIRED'); exception when duplicate_object then null; end $$;

-- profiles remains the compatibility account because current domain foreign
-- keys point to profiles.id = auth.users.id.
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists account_status public.customer_account_status not null default 'ACTIVE',
  add column if not exists is_whatsapp_number boolean,
  add column if not exists whatsapp_number text,
  add column if not exists initial_persona public.persona_type,
  add column if not exists active_persona public.persona_type,
  add column if not exists last_active_persona public.persona_type,
  add column if not exists email_verified_at timestamptz,
  add column if not exists registration_source text not null default 'LEGACY',
  add column if not exists session_version integer not null default 1;

-- New customer authorization is persona-based. Legacy registration continues
-- to provide these columns explicitly, but new customer accounts store neither
-- mutually-exclusive legacy role nor legacy personal/business profile type.
alter table public.profiles
  alter column role drop not null,
  alter column role drop default,
  alter column profile_type drop not null,
  alter column profile_type drop default;

do $$ begin
  alter table public.profiles add constraint profiles_session_version_positive check (session_version > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_whatsapp_number_required check (
    is_whatsapp_number is null or is_whatsapp_number = true or whatsapp_number is not null
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_phone_e164 check (
    phone_number is null or phone_number ~ '^\+[1-9][0-9]{7,14}$'
  ) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_whatsapp_e164 check (
    whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
  ) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_pending_initial_persona check (
    account_status <> 'PENDING_VERIFICATION' or initial_persona is not null
  ) not valid;
exception when duplicate_object then null; end $$;

update public.profiles
set full_name = trim(concat_ws(' ', first_name, last_name))
where full_name is null;

create unique index if not exists profiles_email_normalized_uidx on public.profiles (lower(trim(email)));
create unique index if not exists profiles_phone_number_uidx on public.profiles (phone_number) where phone_number is not null;
create unique index if not exists profiles_phone_normalized_uidx on public.profiles (
  (
    case
      when regexp_replace(trim(phone_number), '[\s().-]', '', 'g') like '+%'
        then regexp_replace(trim(phone_number), '[\s().-]', '', 'g')
      when regexp_replace(trim(phone_number), '[\s().-]', '', 'g') like '00%'
        then '+' || substring(regexp_replace(trim(phone_number), '[\s().-]', '', 'g') from 3)
      when regexp_replace(trim(phone_number), '[\s().-]', '', 'g') like '234%'
        then '+' || regexp_replace(trim(phone_number), '[\s().-]', '', 'g')
      when regexp_replace(trim(phone_number), '[\s().-]', '', 'g') like '0%'
        then '+234' || substring(regexp_replace(trim(phone_number), '[\s().-]', '', 'g') from 2)
      else '+234' || regexp_replace(trim(phone_number), '[\s().-]', '', 'g')
    end
  )
) where phone_number is not null;

create table if not exists public.user_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  persona_type public.persona_type not null,
  onboarding_status public.persona_onboarding_status not null default 'NOT_STARTED',
  activated_at timestamptz not null default now(),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_personas_user_type_key unique (user_id, persona_type),
  constraint user_personas_completion_consistent check (
    (onboarding_status = 'COMPLETED' and onboarding_completed_at is not null)
    or (onboarding_status <> 'COMPLETED' and onboarding_completed_at is null)
  )
);
create index if not exists user_personas_user_id_idx on public.user_personas(user_id);

create table if not exists public.buyer_profiles (
  user_persona_id uuid primary key references public.user_personas(id) on delete cascade,
  preferred_locations text[] not null,
  budget_min numeric(18,2),
  budget_max numeric(18,2),
  currency public.supported_currency not null default 'NGN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyer_profiles_locations_present check (cardinality(preferred_locations) > 0),
  constraint buyer_profiles_budget_min_nonnegative check (budget_min is null or budget_min >= 0),
  constraint buyer_profiles_budget_max_nonnegative check (budget_max is null or budget_max >= 0),
  constraint buyer_profiles_budget_order check (budget_min is null or budget_max is null or budget_max >= budget_min)
);

create table if not exists public.seller_profiles (
  user_persona_id uuid primary key references public.user_personas(id) on delete cascade,
  profile_type public.profile_type_v2 not null,
  company_name text,
  company_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_profiles_business_fields check (
    profile_type = 'INDIVIDUAL' or (company_name is not null and company_address is not null)
  )
);

create table if not exists public.customer_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  registration_source text not null default 'CUSTOMER_APP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_records_user_id_key unique (user_id)
);

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  department public.admin_department not null,
  admin_role public.admin_role not null,
  status public.admin_status not null default 'PENDING',
  password_hash text not null,
  requires_password_change boolean not null default true,
  session_version integer not null default 1,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admins_session_version_positive check (session_version > 0),
  constraint admins_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
);
create unique index if not exists admins_email_normalized_uidx on public.admins(lower(trim(email)));
create unique index if not exists admins_phone_uidx on public.admins(phone) where phone is not null;

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id) on delete cascade,
  invited_by_admin_id uuid not null references public.admins(id) on delete restrict,
  token_hash text not null,
  status public.invitation_status not null default 'PENDING',
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists admin_invitations_token_hash_uidx on public.admin_invitations(token_hash);
create unique index if not exists admin_invitations_one_pending_uidx on public.admin_invitations(admin_id) where status = 'PENDING';
create index if not exists admin_invitations_expiry_idx on public.admin_invitations(expires_at) where status = 'PENDING';

create table if not exists public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid references public.profiles(id) on delete cascade,
  admin_id uuid references public.admins(id) on delete cascade,
  purpose public.otp_purpose not null,
  code_hash text not null,
  attempt_count smallint not null default 0,
  max_attempts smallint not null default 3,
  expires_at timestamptz not null,
  resend_available_at timestamptz not null,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  verified_proof_hash text,
  verified_proof_expires_at timestamptz,
  verified_proof_consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint otp_challenges_one_subject check (
    (customer_user_id is not null and admin_id is null) or (customer_user_id is null and admin_id is not null)
  ),
  constraint otp_challenges_attempts_valid check (max_attempts > 0 and attempt_count >= 0 and attempt_count <= max_attempts),
  constraint otp_challenges_purpose_subject check (
    (purpose in ('CUSTOMER_EMAIL_VERIFICATION', 'CUSTOMER_PASSWORD_RESET') and customer_user_id is not null)
    or (purpose in ('ADMIN_ACTIVATION', 'ADMIN_LOGIN') and admin_id is not null)
  )
);
create index if not exists otp_challenges_customer_lookup_idx on public.otp_challenges(customer_user_id, purpose, created_at desc);
create index if not exists otp_challenges_admin_lookup_idx on public.otp_challenges(admin_id, purpose, created_at desc);
create unique index if not exists otp_challenges_one_live_customer_uidx on public.otp_challenges(customer_user_id, purpose) where customer_user_id is not null and consumed_at is null and invalidated_at is null;
create unique index if not exists otp_challenges_one_live_admin_uidx on public.otp_challenges(admin_id, purpose) where admin_id is not null and consumed_at is null and invalidated_at is null;

create table if not exists public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  refresh_token_hash text not null,
  session_version integer not null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  replaced_by_session_id uuid references public.customer_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists customer_sessions_refresh_hash_uidx on public.customer_sessions(refresh_token_hash);
create index if not exists customer_sessions_user_live_idx on public.customer_sessions(user_id, expires_at) where revoked_at is null;

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id) on delete cascade,
  refresh_token_hash text not null,
  session_version integer not null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  replaced_by_session_id uuid references public.admin_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists admin_sessions_refresh_hash_uidx on public.admin_sessions(refresh_token_hash);
create index if not exists admin_sessions_admin_live_idx on public.admin_sessions(admin_id, expires_at) where revoked_at is null;

create or replace function public.set_auth_domain_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['user_personas', 'buyer_profiles', 'seller_profiles', 'customer_records', 'admins', 'admin_invitations', 'otp_challenges'] loop
    execute format('drop trigger if exists set_auth_domain_updated_at on public.%I', table_name);
    execute format('create trigger set_auth_domain_updated_at before update on public.%I for each row execute function public.set_auth_domain_updated_at()', table_name);
  end loop;
end $$;

-- Express uses the service-role client after request authentication and
-- authorization. No direct PostgREST policies are granted for security tables.
alter table public.user_personas enable row level security;
alter table public.buyer_profiles enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.customer_records enable row level security;
alter table public.admins enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.admin_sessions enable row level security;

commit;
