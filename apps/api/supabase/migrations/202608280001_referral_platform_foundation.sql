begin;

create sequence if not exists public.referral_display_reference_seq;

create or replace function public.generate_referral_display_reference()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select 'REF-' || to_char(current_date, 'YYMM') || '-' ||
    lpad(nextval('public.referral_display_reference_seq')::text, 4, '0');
$$;

create table if not exists public.referrers (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid unique references public.profiles(id) on delete cascade,
  full_name text not null,
  phone_e164 text,
  referral_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referrers_identity_check check (customer_user_id is not null or phone_e164 is not null),
  constraint referrers_phone_check check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create unique index if not exists referrers_guest_phone_uidx
  on public.referrers(phone_e164) where phone_e164 is not null;

insert into public.referrers(customer_user_id, full_name, phone_e164, referral_code)
select p.id,
  coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Beryl customer'),
  nullif(btrim(p.phone_number), ''),
  p.referral_code
from public.profiles p
where nullif(btrim(p.referral_code), '') is not null
on conflict do nothing;

-- Reuse the legacy referrals table and retain its compatibility columns for
-- transaction/dashboard consumers while making the canonical Phase 1 fields explicit.
alter table public.referrals
  alter column referrer_id drop not null,
  add column if not exists referrer_identity_id uuid references public.referrers(id) on delete restrict,
  add column if not exists reference_id text,
  add column if not exists purpose text,
  add column if not exists preferred_contact_method text,
  add column if not exists referred_full_name text,
  add column if not exists referred_contact_value text,
  add column if not exists private_referrer_disclosure boolean not null default false,
  add column if not exists consent_confirmed_at timestamptz,
  add column if not exists lifecycle_status text,
  add column if not exists reward_amount numeric,
  add column if not exists payment_status text,
  add column if not exists contacted_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists lost_at timestamptz;

alter table public.referrals
  alter column commission_rate drop not null,
  alter column commission_rate drop default;

update public.referrals r
set referrer_identity_id = rr.id
from public.referrers rr
where r.referrer_identity_id is null and rr.customer_user_id = r.referrer_id;

update public.referrals
set reference_id = public.generate_referral_display_reference()
where reference_id is null;

update public.referrals
set purpose = case lower(coalesce(referral_type::text, 'buyer')) when 'seller' then 'SELLING' else 'BUYING' end,
    preferred_contact_method = case when nullif(btrim(referred_email), '') is not null then 'EMAIL' else 'CALL' end,
    referred_full_name = coalesce(nullif(btrim(referred_name), ''), 'Referral contact'),
    referred_contact_value = coalesce(nullif(btrim(referred_phone), ''), nullif(btrim(referred_email), ''), ''),
    consent_confirmed_at = coalesce(created_at, now()),
    lifecycle_status = case lower(coalesce(status::text, 'pending'))
      when 'qualified' then 'CONTACTED'
      when 'converted' then 'COMPLETED'
      when 'rejected' then 'LOST'
      else 'NEW'
    end,
    reward_amount = case when lower(coalesce(status::text, '')) = 'converted' then earned_commission else null end,
    payment_status = case
      when lower(coalesce(status::text, '')) = 'converted' and coalesce(earned_commission, 0) > 0 then 'OUTSTANDING'
      else 'NOT_ELIGIBLE'
    end
where purpose is null or lifecycle_status is null or payment_status is null;

alter table public.referrals
  alter column reference_id set default public.generate_referral_display_reference(),
  alter column reference_id set not null,
  alter column purpose set not null,
  alter column preferred_contact_method set not null,
  alter column referred_full_name set not null,
  alter column referred_contact_value set not null,
  alter column consent_confirmed_at set not null,
  alter column lifecycle_status set default 'NEW',
  alter column lifecycle_status set not null,
  alter column payment_status set default 'NOT_ELIGIBLE',
  alter column payment_status set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'referrals_reference_id_key') then
    alter table public.referrals add constraint referrals_reference_id_key unique(reference_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referrals_purpose_check') then
    alter table public.referrals add constraint referrals_purpose_check check (purpose in ('BUYING','SELLING'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referrals_contact_method_check') then
    alter table public.referrals add constraint referrals_contact_method_check check (preferred_contact_method in ('WHATSAPP','CALL','EMAIL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referrals_lifecycle_status_check') then
    alter table public.referrals add constraint referrals_lifecycle_status_check check (lifecycle_status in ('NEW','CONTACTED','IN_PROGRESS','COMPLETED','LOST'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referrals_payment_status_check') then
    alter table public.referrals add constraint referrals_payment_status_check check (payment_status in ('NOT_ELIGIBLE','OUTSTANDING','PAID'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referrals_reward_amount_check') then
    alter table public.referrals add constraint referrals_reward_amount_check check (reward_amount is null or reward_amount >= 0);
  end if;
end $$;

create index if not exists referrals_referrer_identity_created_idx
  on public.referrals(referrer_identity_id, created_at desc, id desc);
create index if not exists referrals_referrer_lifecycle_idx
  on public.referrals(referrer_identity_id, lifecycle_status, created_at desc);

create table if not exists public.referrer_payout_details (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null unique references public.referrers(id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_name text not null,
  account_number_ciphertext text not null,
  account_number_iv text not null,
  account_number_auth_tag text not null,
  account_number_last4 text not null check (account_number_last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_tracking_challenges (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.referrers(id) on delete cascade,
  code_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  resend_available_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referral_tracking_challenges_referrer_idx
  on public.referral_tracking_challenges(referrer_id, created_at desc);

create table if not exists public.referral_tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.referrers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referral_tracking_sessions_referrer_idx
  on public.referral_tracking_sessions(referrer_id, expires_at desc);

create table if not exists public.referral_payments (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete restrict,
  amount numeric not null check (amount >= 0),
  status text not null default 'OUTSTANDING' check (status in ('OUTSTANDING','PAID')),
  receipt_mime_type text,
  receipt_storage_public_id text,
  receipt_original_name text,
  paid_at timestamptz,
  recorded_by_admin_id uuid references public.admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_payments_referral_idx
  on public.referral_payments(referral_id, created_at desc);

alter table public.referrers enable row level security;
alter table public.referrals enable row level security;
alter table public.referrer_payout_details enable row level security;
alter table public.referral_tracking_challenges enable row level security;
alter table public.referral_tracking_sessions enable row level security;
alter table public.referral_payments enable row level security;

revoke all on function public.generate_referral_display_reference() from public, anon, authenticated;
grant execute on function public.generate_referral_display_reference() to service_role;

commit;
