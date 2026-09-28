begin;

-- Historical rows remain valid and unattributed. New verified offline purchases
-- recorded through the Admin RPC retain the acting Admin for auditability.
alter table public.customer_completed_purchases
  add column recorded_by uuid references public.admin_profiles(user_id) on delete restrict;
create index customer_completed_purchases_recorded_by_idx
  on public.customer_completed_purchases(recorded_by,created_at desc) where recorded_by is not null;

-- This is the explicit, one-time statement that a completed offline purchase
-- is attributable to one exact canonical referral link.
create table public.completed_purchase_referral_attributions (
  id uuid primary key default gen_random_uuid(),
  completed_purchase_id uuid not null unique references public.customer_completed_purchases(id) on delete restrict,
  referral_link_id uuid not null references public.customer_referral_links(id) on delete restrict,
  referrer_id uuid not null references auth.users(id) on delete restrict,
  referred_customer_id uuid not null references auth.users(id) on delete restrict,
  referral_code text not null check (referral_code ~ '^REF-[A-HJ-NP-Z2-9]{6}$'),
  referral_type text not null check (referral_type in ('PROPERTY','SELLER')),
  referral_property_code text,
  attributed_by uuid not null references public.admin_profiles(user_id) on delete restrict,
  attributed_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint completed_purchase_referral_property_check check (
    (referral_type='PROPERTY' and referral_property_code is not null)
    or (referral_type='SELLER' and referral_property_code is null)
  )
);
create index completed_purchase_referral_referrer_idx
  on public.completed_purchase_referral_attributions(referrer_id,attributed_at desc,id desc);
create index completed_purchase_referral_link_idx
  on public.completed_purchase_referral_attributions(referral_link_id,attributed_at desc,id desc);

-- Immutable financial snapshot. Payout state is deliberately deferred.
create table public.referral_commission_entitlements (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^COM-[A-HJ-NP-Z2-9]{6}$'),
  attribution_id uuid not null unique references public.completed_purchase_referral_attributions(id) on delete restrict,
  completed_purchase_id uuid not null unique references public.customer_completed_purchases(id) on delete restrict,
  referral_link_id uuid not null references public.customer_referral_links(id) on delete restrict,
  referrer_id uuid not null references auth.users(id) on delete restrict,
  referred_customer_id uuid not null references auth.users(id) on delete restrict,
  referral_code text not null check (referral_code ~ '^REF-[A-HJ-NP-Z2-9]{6}$'),
  referral_type text not null check (referral_type in ('PROPERTY','SELLER')),
  property_code text not null check (char_length(property_code) between 1 and 80 and property_code=btrim(property_code)),
  commission_basis_minor bigint not null check (commission_basis_minor between 1 and 999999999999999),
  commission_rate_bps integer not null check (commission_rate_bps=200),
  commission_amount_minor bigint not null check (commission_amount_minor>=0),
  earned_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint referral_commission_exact_amount check (
    commission_amount_minor=floor(commission_basis_minor::numeric*commission_rate_bps/10000)::bigint
  )
);
create index referral_commission_entitlements_owner_earned_idx
  on public.referral_commission_entitlements(referrer_id,earned_at desc,id desc);

create function public.reject_referral_financial_mutation() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  raise exception using errcode='42501',message='Referral financial records are immutable';
end $$;
create trigger completed_purchase_referral_immutable before update or delete
  on public.completed_purchase_referral_attributions for each row execute function public.reject_referral_financial_mutation();
create trigger referral_commission_entitlement_immutable before update or delete
  on public.referral_commission_entitlements for each row execute function public.reject_referral_financial_mutation();

alter table public.completed_purchase_referral_attributions enable row level security;
alter table public.referral_commission_entitlements enable row level security;
revoke all on public.completed_purchase_referral_attributions,public.referral_commission_entitlements
  from public,anon,authenticated,service_role;
-- All future purchases use the atomic RPC; existing reads remain available.
revoke insert,update,delete on public.customer_completed_purchases from service_role;

create function public.validate_admin_referral_attribution(
  p_admin uuid,p_referral_code text,p_buyer uuid,p_property_code text,p_closed_at timestamptz
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_link public.customer_referral_links%rowtype;
  v_listing public.customer_listings%rowtype;
  v_referrer public.customer_profiles%rowtype;
  v_referred uuid;
begin
  if p_admin is null or p_referral_code is null or p_referral_code !~ '^REF-[A-HJ-NP-Z2-9]{6}$'
     or p_buyer is null or p_property_code is null or char_length(p_property_code) not between 1 and 80
     or p_closed_at is null or p_closed_at>clock_timestamp()
     or p_property_code !~ '^[A-Za-z0-9-]+$' then
    raise exception using errcode='23514',message='Invalid referral attribution';
  end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required';
  end if;
  if not exists(select 1 from public.customer_profiles where id=p_buyer and email_verified_at is not null) then
    raise exception using errcode='P0002',message='Verified buyer not found';
  end if;
  select * into v_listing from public.customer_listings where upper(listing_code)=upper(p_property_code);
  if not found then raise exception using errcode='P0002',message='Property not found'; end if;
  select * into v_link from public.customer_referral_links where referral_code=p_referral_code;
  if not found then raise exception using errcode='P0002',message='Referral link not found'; end if;
  if v_link.created_at>p_closed_at then
    raise exception using errcode='23514',message='Referral link was created after the completed sale';
  end if;
  select * into v_referrer from public.customer_profiles where id=v_link.user_id and email_verified_at is not null;
  if not found then raise exception using errcode='23514',message='Referral owner is not eligible'; end if;
  if v_link.user_id=p_buyer then raise exception using errcode='23514',message='Self-referral is not permitted'; end if;

  if v_link.referral_type='PROPERTY' then
    if v_link.listing_id is distinct from v_listing.id or upper(v_link.property_code) is distinct from upper(v_listing.listing_code) then
      raise exception using errcode='23514',message='Referral does not match the purchased property';
    end if;
    v_referred:=p_buyer;
  else
    -- A SELLER link converts only when the purchased listing belongs to the
    -- explicitly referred seller; the completed purchase still identifies its buyer.
    if v_link.listing_id is not null or v_link.property_code is not null then
      raise exception using errcode='23514',message='Invalid seller referral';
    end if;
    if v_link.user_id=v_listing.user_id then raise exception using errcode='23514',message='Self-referral is not permitted'; end if;
    v_referred:=v_listing.user_id;
  end if;

  return jsonb_build_object(
    'referralLinkId',v_link.id,'referralCode',v_link.referral_code,'referralType',v_link.referral_type,
    'referrerId',v_link.user_id,'referrerName',coalesce(nullif(btrim(concat_ws(' ',v_referrer.first_name,v_referrer.last_name)),''),v_referrer.email),
    'referredCustomerId',v_referred,'referralPropertyCode',v_link.property_code,
    'propertyCode',v_listing.listing_code
  );
end $$;

create function public.record_admin_completed_purchase(
  p_request_id uuid,p_admin uuid,p_customer uuid,p_property_code text,
  p_price_minor bigint,p_closed_at timestamptz,p_referral_code text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_listing public.customer_listings%rowtype;
  v_purchase public.customer_completed_purchases%rowtype;
  v_attribution jsonb;
  v_attribution_id uuid;
  v_commission_public_id text;
  v_commission_amount bigint;
  v_inserted integer:=0;
  v_existing_attribution jsonb;
  v_existing_commission jsonb;
  v_attempt integer;
begin
  if p_request_id is null or p_admin is null or p_customer is null or p_property_code is null
     or char_length(p_property_code) not between 1 and 80 or p_property_code !~ '^[A-Za-z0-9-]+$'
     or p_price_minor not between 1 and 999999999999999 or p_closed_at is null
     or p_closed_at>clock_timestamp()
     or (p_referral_code is not null and p_referral_code !~ '^REF-[A-HJ-NP-Z2-9]{6}$') then
    raise exception using errcode='23514',message='Invalid completed purchase';
  end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required';
  end if;
  if not exists(select 1 from public.customer_profiles where id=p_customer and email_verified_at is not null) then
    raise exception using errcode='P0002',message='Verified buyer not found';
  end if;
  select * into v_listing from public.customer_listings where upper(listing_code)=upper(p_property_code) for share;
  if not found then raise exception using errcode='P0002',message='Property not found'; end if;
  if p_referral_code is not null then
    v_attribution:=public.validate_admin_referral_attribution(
      p_admin,p_referral_code,p_customer,v_listing.listing_code,p_closed_at
    );
  end if;

  insert into public.customer_completed_purchases(
    id,customer_id,source_listing_id,property_code,title,state,property_type,property_subtype,
    price_minor,closed_at,recorded_by
  ) values(
    p_request_id,p_customer,v_listing.id,v_listing.listing_code,v_listing.title,v_listing.state,
    v_listing.property_type,v_listing.property_subtype,p_price_minor,p_closed_at,p_admin
  ) on conflict(id) do nothing;
  get diagnostics v_inserted=row_count;

  if v_inserted=0 then
    select * into v_purchase from public.customer_completed_purchases where id=p_request_id;
    if not found or v_purchase.customer_id<>p_customer or v_purchase.source_listing_id is distinct from v_listing.id
       or v_purchase.property_code<>v_listing.listing_code or v_purchase.price_minor<>p_price_minor
       or v_purchase.closed_at<>p_closed_at or v_purchase.recorded_by is distinct from p_admin then
      raise exception using errcode='23505',message='Purchase request already used';
    end if;
    select jsonb_build_object('referralCode',a.referral_code,'referralType',a.referral_type,
      'referrerName',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email))
      into v_existing_attribution from public.completed_purchase_referral_attributions a
      join public.customer_profiles p on p.id=a.referrer_id
      where a.completed_purchase_id=p_request_id;
    if (v_existing_attribution->>'referralCode') is distinct from p_referral_code then
      raise exception using errcode='23505',message='Purchase request attribution differs';
    end if;
    select jsonb_build_object('reference',public_id,'basisMinor',commission_basis_minor,
      'rateBps',commission_rate_bps,'amountMinor',commission_amount_minor,'earnedAt',earned_at)
      into v_existing_commission from public.referral_commission_entitlements
      where completed_purchase_id=p_request_id;
    return jsonb_build_object('purchase',jsonb_build_object('id',v_purchase.id,'propertyCode',v_purchase.property_code,
      'priceMinor',v_purchase.price_minor,'closedAt',v_purchase.closed_at),
      'attribution',v_existing_attribution,
      'commission',v_existing_commission);
  end if;

  if v_attribution is not null then
    insert into public.completed_purchase_referral_attributions(
      completed_purchase_id,referral_link_id,referrer_id,referred_customer_id,referral_code,
      referral_type,referral_property_code,attributed_by,attributed_at
    ) values(
      p_request_id,(v_attribution->>'referralLinkId')::uuid,(v_attribution->>'referrerId')::uuid,
      (v_attribution->>'referredCustomerId')::uuid,v_attribution->>'referralCode',v_attribution->>'referralType',
      v_attribution->>'referralPropertyCode',p_admin,clock_timestamp()
    ) returning id into v_attribution_id;
    v_commission_amount:=floor(p_price_minor::numeric*200/10000)::bigint;
    for v_attempt in 1..5 loop
      begin
        v_commission_public_id:=public.generate_display_code('COM');
        insert into public.referral_commission_entitlements(
          public_id,attribution_id,completed_purchase_id,referral_link_id,referrer_id,referred_customer_id,
          referral_code,referral_type,property_code,commission_basis_minor,commission_rate_bps,
          commission_amount_minor,earned_at
        ) values(
          v_commission_public_id,v_attribution_id,p_request_id,(v_attribution->>'referralLinkId')::uuid,
          (v_attribution->>'referrerId')::uuid,(v_attribution->>'referredCustomerId')::uuid,
          v_attribution->>'referralCode',v_attribution->>'referralType',v_listing.listing_code,
          p_price_minor,200,v_commission_amount,p_closed_at
        );
        exit;
      exception when unique_violation then
        if v_attempt=5 then raise; end if;
      end;
    end loop;
  end if;

  return jsonb_build_object('purchase',jsonb_build_object('id',p_request_id,'propertyCode',v_listing.listing_code,
    'priceMinor',p_price_minor,'closedAt',p_closed_at),
    'attribution',case when v_attribution is null then null else jsonb_build_object(
      'referralCode',v_attribution->>'referralCode','referralType',v_attribution->>'referralType',
      'referrerName',v_attribution->>'referrerName') end,
    'commission',case when v_attribution is null then null else jsonb_build_object(
      'reference',v_commission_public_id,'basisMinor',p_price_minor,'rateBps',200,
      'amountMinor',v_commission_amount,'earnedAt',p_closed_at) end);
end $$;

-- Customer history now reflects only immutable, explicitly attributed and
-- verified completed offline purchases. With payouts deferred, all earned
-- commission is also outstanding/available.
create or replace function public.list_customer_referrals(p_owner uuid,p_page integer default 1,p_page_size integer default 10) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_total integer; v_earned bigint; v_items jsonb;
begin
  if p_owner is null or p_page not between 1 and 100000 or p_page_size not between 1 and 50 then
    raise exception using errcode='23514',message='Invalid referral query';
  end if;
  select count(*)::integer,coalesce(sum(commission_amount_minor),0)::bigint into v_total,v_earned
    from public.referral_commission_entitlements where referrer_id=p_owner;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.public_id,'referralType',c.referral_type,'saleAmount',c.commission_basis_minor,
    'propertyCode',c.property_code,'earnings',c.commission_amount_minor,
    'status','COMPLETED','completedAt',c.earned_at
  ) order by c.earned_at desc,c.id desc),'[]'::jsonb) into v_items
  from (select * from public.referral_commission_entitlements where referrer_id=p_owner
    order by earned_at desc,id desc offset (p_page-1)*p_page_size limit p_page_size) c;
  return jsonb_build_object('summary',jsonb_build_object('availableBalance',v_earned,
    'totalEarnings',v_earned,'referrals',v_total,'propertiesSold',v_total),
    'items',v_items,'page',p_page,'pageSize',p_page_size,'total',v_total,
    'totalPages',case when v_total=0 then 0 else ((v_total+p_page_size-1)/p_page_size) end);
end $$;

revoke all on function public.reject_referral_financial_mutation(),
  public.validate_admin_referral_attribution(uuid,text,uuid,text,timestamptz),
  public.record_admin_completed_purchase(uuid,uuid,uuid,text,bigint,timestamptz,text)
  from public,anon,authenticated,service_role;
grant execute on function public.validate_admin_referral_attribution(uuid,text,uuid,text,timestamptz),
  public.record_admin_completed_purchase(uuid,uuid,uuid,text,bigint,timestamptz,text)
  to service_role;
revoke all on function public.list_customer_referrals(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.list_customer_referrals(uuid,integer,integer) to service_role;

commit;
