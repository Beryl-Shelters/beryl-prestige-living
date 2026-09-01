begin;

-- A referral is a submission event, and each newly accepted referral receives
-- one canonical Admin Lead projection in public.inquiries. Historical referral
-- rows remain valid and intentionally stay unlinked until explicitly handled.
alter table public.referrals
  add column if not exists lead_inquiry_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'referrals_lead_inquiry_id_fkey'
      and conrelid = 'public.referrals'::regclass
  ) then
    alter table public.referrals
      add constraint referrals_lead_inquiry_id_fkey
      foreign key (lead_inquiry_id)
      references public.inquiries(id)
      on delete restrict;
  end if;
end $$;

create unique index if not exists referrals_lead_inquiry_uidx
  on public.referrals(lead_inquiry_id)
  where lead_inquiry_id is not null;

create or replace function public.prevent_referral_lead_reassignment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.lead_inquiry_id is not null
     and new.lead_inquiry_id is distinct from old.lead_inquiry_id then
    raise exception using errcode = '23514', message = 'Referral Lead projection is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists referrals_lead_inquiry_immutable on public.referrals;
create trigger referrals_lead_inquiry_immutable
before update of lead_inquiry_id on public.referrals
for each row execute function public.prevent_referral_lead_reassignment();

revoke all on function public.prevent_referral_lead_reassignment() from public, anon, authenticated;

create or replace function public.create_referral_with_lead(
  p_referrer_identity_id uuid,
  p_referred_full_name text,
  p_referred_email text,
  p_referred_phone text,
  p_purpose text,
  p_preferred_contact_method text,
  p_notes text,
  p_private_referrer_disclosure boolean,
  p_referral_link text
)
returns table(
  referral_id uuid,
  reference_id text,
  purpose text,
  lifecycle_status text,
  created_at timestamptz,
  lead_inquiry_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_referrer public.referrers%rowtype;
  v_referral public.referrals%rowtype;
  v_lead_id uuid;
  v_now timestamptz := clock_timestamp();
  v_full_name text := nullif(btrim(p_referred_full_name), '');
  v_email text := nullif(lower(btrim(p_referred_email)), '');
  v_phone text := nullif(btrim(p_referred_phone), '');
  v_notes text := nullif(btrim(p_notes), '');
begin
  select * into v_referrer
  from public.referrers r
  where r.id = p_referrer_identity_id;

  if not found then
    raise exception using errcode = '23503', message = 'Referral identity does not exist';
  end if;

  if v_full_name is null then
    raise exception using errcode = '23514', message = 'Referred full name is required';
  end if;

  if p_purpose is null or p_purpose not in ('BUYING', 'SELLING') then
    raise exception using errcode = '23514', message = 'Referral purpose is invalid';
  end if;

  if p_preferred_contact_method is null
     or p_preferred_contact_method not in ('WHATSAPP', 'CALL', 'EMAIL') then
    raise exception using errcode = '23514', message = 'Preferred contact method is invalid';
  end if;

  if (p_preferred_contact_method = 'EMAIL' and v_email is null)
     or (p_preferred_contact_method in ('WHATSAPP', 'CALL') and v_phone is null) then
    raise exception using errcode = '23514', message = 'Preferred referral contact is missing';
  end if;

  insert into public.referrals(
    referrer_id,
    referrer_identity_id,
    referral_type,
    referral_code,
    referral_link,
    referred_name,
    referred_email,
    referred_phone,
    notes,
    status,
    registered_user_id,
    purpose,
    preferred_contact_method,
    referred_full_name,
    referred_contact_value,
    private_referrer_disclosure,
    consent_confirmed_at,
    lifecycle_status,
    reward_amount,
    payment_status,
    created_at,
    updated_at
  ) values (
    v_referrer.customer_user_id,
    v_referrer.id,
    (case when p_purpose = 'BUYING' then 'buyer' else 'seller' end)::public.referral_type,
    v_referrer.referral_code,
    p_referral_link,
    v_full_name,
    v_email,
    v_phone,
    v_notes,
    'pending'::public.referral_status,
    null,
    p_purpose,
    p_preferred_contact_method,
    v_full_name,
    case when p_preferred_contact_method = 'EMAIL' then v_email else v_phone end,
    coalesce(p_private_referrer_disclosure, false),
    v_now,
    'NEW',
    null,
    'NOT_ELIGIBLE',
    v_now,
    v_now
  )
  returning * into v_referral;

  insert into public.inquiries(
    user_id,
    property_id,
    inquiry_type,
    full_name,
    email,
    phone_number,
    message,
    status,
    lead_stage,
    created_at,
    updated_at
  ) values (
    null,
    null,
    'REFERRAL_' || p_purpose || '_' || p_preferred_contact_method,
    v_full_name,
    v_email,
    v_phone,
    null,
    'new'::public.inquiry_status,
    'NEW',
    v_now,
    v_now
  )
  returning id into v_lead_id;

  update public.referrals r
  set lead_inquiry_id = v_lead_id,
      updated_at = v_now
  where r.id = v_referral.id
    and r.lead_inquiry_id is null;

  if not found then
    raise exception using errcode = '23505', message = 'Referral already has a Lead projection';
  end if;

  return query select
    v_referral.id,
    v_referral.reference_id,
    v_referral.purpose,
    v_referral.lifecycle_status,
    v_referral.created_at,
    v_lead_id;
end;
$$;

revoke all on function public.create_referral_with_lead(uuid,text,text,text,text,text,text,boolean,text)
  from public, anon, authenticated;
grant execute on function public.create_referral_with_lead(uuid,text,text,text,text,text,text,boolean,text)
  to service_role;

-- PostgreSQL cannot replace a function while changing its table return shape.
drop function if exists public.list_admin_inquiry_leads(text, integer);

create function public.list_admin_inquiry_leads(
  p_query text default null,
  p_per_stage_limit integer default 20
)
returns table(
  lead_id uuid,
  reference_id text,
  customer_name text,
  property_id uuid,
  property_title text,
  property_reference_id text,
  stage text,
  inquiry_type text,
  received_at timestamptz,
  stage_total bigint,
  lead_source text,
  referrer_id uuid,
  referrer_full_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with matching as (
    select
      i.id,
      'ENQ-' || upper(left(replace(i.id::text, '-', ''), 8)) as reference_id,
      coalesce(nullif(btrim(i.full_name), ''), 'Unknown customer') as customer_name,
      i.property_id,
      p.title as property_title,
      p.property_code::text as property_reference_id,
      i.lead_stage,
      i.inquiry_type::text,
      i.created_at,
      case when r.id is not null then 'REFERRAL'::text else null::text end as lead_source,
      rr.id as referrer_id,
      rr.full_name as referrer_full_name,
      count(*) over (partition by i.lead_stage) as stage_total,
      row_number() over (partition by i.lead_stage order by i.created_at desc, i.id desc) as stage_row
    from public.inquiries i
    left join public.properties p on p.id = i.property_id
    left join public.referrals r on r.lead_inquiry_id = i.id
    left join public.referrers rr on rr.id = r.referrer_identity_id
    where nullif(btrim(p_query), '') is null
       or i.full_name ilike '%' || btrim(p_query) || '%'
       or p.title ilike '%' || btrim(p_query) || '%'
       or p.property_code::text ilike '%' || btrim(p_query) || '%'
       or i.id::text ilike '%' || btrim(p_query) || '%'
       or ('ENQ-' || upper(left(replace(i.id::text, '-', ''), 8))) ilike '%' || btrim(p_query) || '%'
  )
  select id, reference_id, customer_name, property_id, property_title,
    property_reference_id, lead_stage, inquiry_type, created_at, stage_total,
    lead_source, referrer_id, referrer_full_name
  from matching
  where stage_row <= greatest(1, least(coalesce(p_per_stage_limit, 20), 50))
  order by case lead_stage when 'NEW' then 1 when 'CONTACTED' then 2 when 'WON' then 3 else 4 end,
    created_at desc, id desc;
$$;

revoke all on function public.list_admin_inquiry_leads(text, integer)
  from public, anon, authenticated;
grant execute on function public.list_admin_inquiry_leads(text, integer)
  to service_role;

commit;
