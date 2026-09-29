begin;

-- Immutable evidence that Beryl recorded one externally-completed commission
-- payment. This ledger does not initiate or transfer money.
create table public.referral_commission_payouts (
  id uuid primary key,
  public_id text not null unique check (public_id ~ '^PAY-[A-HJ-NP-Z2-9]{6}$'),
  commission_entitlement_id uuid not null unique references public.referral_commission_entitlements(id) on delete restrict,
  referrer_id uuid not null references auth.users(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  recorded_by uuid not null references public.admin_profiles(user_id) on delete restrict,
  paid_at timestamptz not null default clock_timestamp(),
  receipt_public_id text not null unique check (char_length(receipt_public_id) between 1 and 300),
  receipt_resource_type text not null check (receipt_resource_type='raw'),
  receipt_delivery_type text not null check (receipt_delivery_type='authenticated'),
  receipt_mime_type text not null check (receipt_mime_type in ('application/pdf','image/png','image/jpeg')),
  receipt_size_bytes integer not null check (receipt_size_bytes between 1 and 10485760),
  account_name_snapshot text not null check (char_length(account_name_snapshot) between 1 and 160),
  bank_name_snapshot text not null check (char_length(bank_name_snapshot) between 1 and 120),
  account_number_last4 text not null check (account_number_last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default clock_timestamp()
);
create index referral_commission_payouts_referrer_paid_idx
  on public.referral_commission_payouts(referrer_id,paid_at desc,id desc);
create trigger referral_commission_payout_immutable before update or delete
  on public.referral_commission_payouts for each row execute function public.reject_referral_financial_mutation();
alter table public.referral_commission_payouts enable row level security;
revoke all on public.referral_commission_payouts from public,anon,authenticated,service_role;

create function public.list_admin_referrers(
  p_query text default '',p_filter text default 'ALL',p_sort text default 'NEWEST',
  p_page integer default 1,p_page_size integer default 6
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_query is null or char_length(p_query)>100 or p_filter not in ('ALL','OWED','PAID')
     or p_sort not in ('NEWEST','OLDEST','NAME_ASC','NAME_DESC','OUTSTANDING_DESC')
     or p_page not between 1 and 100000 or p_page_size not between 1 and 100 then
    raise exception using errcode='23514',message='Invalid Admin referrer query';
  end if;
  with base as (
    select p.id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email) full_name,
      p.phone_number_normalized phone,la.first_referral_at,la.referral_count,
      ea.completed_count,ea.earned_minor,ea.paid_minor,
      (p.bank_account_name is not null and p.bank_name is not null and p.bank_account_number is not null) bank_complete
    from public.customer_profiles p
    join lateral (select min(created_at) first_referral_at,count(*)::integer referral_count
      from public.customer_referral_links where user_id=p.id) la on la.referral_count>0
    left join lateral (select count(*)::integer completed_count,
      coalesce(sum(e.commission_amount_minor),0)::bigint earned_minor,
      coalesce(sum(pay.amount_minor),0)::bigint paid_minor
      from public.referral_commission_entitlements e
      left join public.referral_commission_payouts pay on pay.commission_entitlement_id=e.id
      where e.referrer_id=p.id) ea on true
  ), labelled as (
    select *,earned_minor-paid_minor outstanding_minor,
      case when earned_minor=0 then 'NOT_NEEDED' when bank_complete then 'ON_FILE' else 'MISSING' end bank_status
    from base
  ), counts as (
    select count(*)::integer all_count,
      count(*) filter(where outstanding_minor>0)::integer owed_count,
      count(*) filter(where earned_minor>0 and outstanding_minor=0)::integer paid_count,
      coalesce(sum(referral_count),0)::integer referrals,
      coalesce(sum(completed_count),0)::integer completed,
      coalesce(sum(outstanding_minor),0)::bigint outstanding_minor from labelled
  ), matched as (
    select * from labelled where
      (btrim(p_query)='' or strpos(lower(full_name),lower(btrim(p_query)))>0 or strpos(coalesce(phone,''),btrim(p_query))>0)
      and (p_filter='ALL' or (p_filter='OWED' and outstanding_minor>0)
        or (p_filter='PAID' and earned_minor>0 and outstanding_minor=0))
  ), matched_total as (select count(*)::integer total from matched), paged as (
    select * from matched order by
      case when p_sort='NEWEST' then first_referral_at end desc,
      case when p_sort='OLDEST' then first_referral_at end asc,
      case when p_sort='NAME_ASC' then lower(full_name) end asc,
      case when p_sort='NAME_DESC' then lower(full_name) end desc,
      case when p_sort='OUTSTANDING_DESC' then outstanding_minor end desc,
      id asc offset (p_page-1)*p_page_size limit p_page_size
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'fullName',full_name,'phone',phone,
      'referrals',referral_count,'completed',completed_count,'earnedMinor',earned_minor,
      'paidMinor',paid_minor,'outstandingMinor',outstanding_minor,'bankStatus',bank_status)
      order by case when p_sort='NEWEST' then first_referral_at end desc,
      case when p_sort='OLDEST' then first_referral_at end asc,
      case when p_sort='NAME_ASC' then lower(full_name) end asc,
      case when p_sort='NAME_DESC' then lower(full_name) end desc,
      case when p_sort='OUTSTANDING_DESC' then outstanding_minor end desc,id asc),'[]'::jsonb) value from paged
  )
  select jsonb_build_object('summary',jsonb_build_object('referrers',c.all_count,'referrals',c.referrals,
    'completed',c.completed,'outstandingMinor',c.outstanding_minor),
    'counts',jsonb_build_object('all',c.all_count,'owed',c.owed_count,'paid',c.paid_count),
    'items',i.value,'page',p_page,'pageSize',p_page_size,'total',m.total,
    'totalPages',case when m.total=0 then 0 else ((m.total+p_page_size-1)/p_page_size) end)
  into v_result from counts c cross join matched_total m cross join items i;
  return v_result;
end $$;

create function public.read_admin_referrer(p_referrer uuid,p_page integer default 1,p_page_size integer default 10) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_referrer is null or p_page not between 1 and 100000 or p_page_size not between 1 and 100 then
    raise exception using errcode='23514',message='Invalid Admin referrer query';
  end if;
  with profile as (
    select p.*,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email) full_name,
      (p.bank_account_name is not null and p.bank_name is not null and p.bank_account_number is not null) bank_complete
    from public.customer_profiles p where p.id=p_referrer
      and exists(select 1 from public.customer_referral_links l where l.user_id=p.id)
  ), totals as (
    select (select count(*)::integer from public.customer_referral_links where user_id=p_referrer) referrals,
      count(e.id)::integer completed,coalesce(sum(e.commission_amount_minor),0)::bigint earned_minor,
      coalesce(sum(pay.amount_minor),0)::bigint paid_minor
    from public.referral_commission_entitlements e
    left join public.referral_commission_payouts pay on pay.commission_entitlement_id=e.id where e.referrer_id=p_referrer
  ), history_total as (select count(*)::integer total from public.referral_commission_entitlements where referrer_id=p_referrer),
  history as (
    select e.*,coalesce(nullif(btrim(concat_ws(' ',rp.first_name,rp.last_name)),''),rp.email) referred_name,
      pay.public_id payment_id,pay.paid_at
    from public.referral_commission_entitlements e
    join public.customer_profiles rp on rp.id=e.referred_customer_id
    left join public.referral_commission_payouts pay on pay.commission_entitlement_id=e.id
    where e.referrer_id=p_referrer order by e.earned_at desc,e.id desc
    offset (p_page-1)*p_page_size limit p_page_size
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object('commissionId',public_id,'referralCode',referral_code,
      'referredName',referred_name,'referralType',referral_type,'propertyCode',property_code,
      'earnedAt',earned_at,'status','COMPLETED','rewardMinor',commission_amount_minor,
      'paymentState',case when payment_id is null then 'OUTSTANDING' else 'PAID' end,
      'paymentId',payment_id,'paidAt',paid_at) order by earned_at desc,id desc),'[]'::jsonb) value from history
  )
  select jsonb_build_object('referrer',jsonb_build_object('id',p.id,'fullName',p.full_name,'email',p.email,'phone',p.phone_number_normalized),
    'summary',jsonb_build_object('referrals',t.referrals,'completed',t.completed,'earnedMinor',t.earned_minor,
      'paidMinor',t.paid_minor,'outstandingMinor',t.earned_minor-t.paid_minor),
    'bank',jsonb_build_object('status',case when t.earned_minor=0 then 'NOT_NEEDED' when p.bank_complete then 'ON_FILE' else 'MISSING' end,
      'accountName',case when p.bank_complete then p.bank_account_name end,'bankName',case when p.bank_complete then p.bank_name end,
      'maskedAccountNumber',case when p.bank_complete then '••••••'||right(p.bank_account_number,4) end),
    'items',i.value,'page',p_page,'pageSize',p_page_size,'total',h.total,
    'totalPages',case when h.total=0 then 0 else ((h.total+p_page_size-1)/p_page_size) end)
  into v_result from profile p cross join totals t cross join history_total h cross join items i;
  if v_result is null then raise exception using errcode='P0002',message='Referrer not found'; end if;
  return v_result;
end $$;

create function public.read_admin_referral_payment_preview(p_admin uuid,p_commission text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_admin is null or p_commission is null or p_commission !~ '^COM-[A-HJ-NP-Z2-9]{6}$' then
    raise exception using errcode='23514',message='Invalid commission payment'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select jsonb_build_object('commissionId',e.public_id,'referrerId',e.referrer_id,
    'referrerName',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email),
    'referralCode',e.referral_code,'amountMinor',e.commission_amount_minor,
    'accountName',p.bank_account_name,'bankName',p.bank_name,'accountNumber',p.bank_account_number)
  into v_result from public.referral_commission_entitlements e join public.customer_profiles p on p.id=e.referrer_id
  left join public.referral_commission_payouts pay on pay.commission_entitlement_id=e.id
  where e.public_id=p_commission and e.commission_amount_minor>0 and pay.id is null and p.bank_account_name is not null
    and p.bank_name is not null and p.bank_account_number is not null;
  if v_result is null then
    if exists(select 1 from public.referral_commission_entitlements e join public.referral_commission_payouts pay on pay.commission_entitlement_id=e.id where e.public_id=p_commission) then
      raise exception using errcode='23505',message='Commission already paid';
    elsif exists(select 1 from public.referral_commission_entitlements where public_id=p_commission and commission_amount_minor=0) then
      raise exception using errcode='23514',message='No payable commission';
    elsif exists(select 1 from public.referral_commission_entitlements where public_id=p_commission) then
      raise exception using errcode='23514',message='Payment details are incomplete';
    else raise exception using errcode='P0002',message='Commission not found'; end if;
  end if;
  return v_result;
end $$;

create function public.record_admin_referral_payout(
  p_request_id uuid,p_admin uuid,p_commission text,p_receipt_public_id text,
  p_receipt_resource_type text,p_receipt_delivery_type text,p_receipt_mime_type text,p_receipt_size_bytes integer
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_entitlement public.referral_commission_entitlements%rowtype;v_profile public.customer_profiles%rowtype;
  v_existing public.referral_commission_payouts%rowtype;v_public_id text;v_attempt integer;
begin
  if p_request_id is null or p_admin is null or p_commission is null or p_commission !~ '^COM-[A-HJ-NP-Z2-9]{6}$'
     or p_receipt_public_id is null or char_length(p_receipt_public_id) not between 1 and 300
     or p_receipt_resource_type<>'raw' or p_receipt_delivery_type<>'authenticated'
     or p_receipt_mime_type not in ('application/pdf','image/png','image/jpeg')
     or p_receipt_size_bytes not between 1 and 10485760 then
    raise exception using errcode='23514',message='Invalid commission payment'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select * into v_existing from public.referral_commission_payouts where id=p_request_id;
  if found then
    select * into v_entitlement from public.referral_commission_entitlements where id=v_existing.commission_entitlement_id;
    if v_entitlement.public_id<>p_commission or v_existing.recorded_by<>p_admin
       or v_existing.receipt_public_id<>p_receipt_public_id or v_existing.receipt_mime_type<>p_receipt_mime_type
       or v_existing.receipt_size_bytes<>p_receipt_size_bytes then
      raise exception using errcode='23505',message='Payment request already used'; end if;
    return jsonb_build_object('paymentId',v_existing.public_id,'commissionId',v_entitlement.public_id,
      'referrerId',v_existing.referrer_id,'amountMinor',v_existing.amount_minor,'paidAt',v_existing.paid_at);
  end if;
  select * into v_entitlement from public.referral_commission_entitlements where public_id=p_commission for update;
  if not found then raise exception using errcode='P0002',message='Commission not found'; end if;
  if v_entitlement.commission_amount_minor<=0 then
    raise exception using errcode='23514',message='No payable commission'; end if;
  if p_receipt_public_id <> ('beryl-v2/referral-payouts/'||v_entitlement.public_id||'/'||p_request_id::text||
    case p_receipt_mime_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end) then
    raise exception using errcode='23514',message='Invalid payment receipt'; end if;
  if exists(select 1 from public.referral_commission_payouts where commission_entitlement_id=v_entitlement.id) then
    raise exception using errcode='23505',message='Commission already paid'; end if;
  select * into v_profile from public.customer_profiles where id=v_entitlement.referrer_id;
  if v_profile.bank_account_name is null or v_profile.bank_name is null or v_profile.bank_account_number is null then
    raise exception using errcode='23514',message='Payment details are incomplete'; end if;
  for v_attempt in 1..5 loop begin
    v_public_id:=public.generate_display_code('PAY');
    insert into public.referral_commission_payouts(id,public_id,commission_entitlement_id,referrer_id,amount_minor,
      recorded_by,receipt_public_id,receipt_resource_type,receipt_delivery_type,receipt_mime_type,receipt_size_bytes,
      account_name_snapshot,bank_name_snapshot,account_number_last4)
    values(p_request_id,v_public_id,v_entitlement.id,v_entitlement.referrer_id,v_entitlement.commission_amount_minor,
      p_admin,p_receipt_public_id,p_receipt_resource_type,p_receipt_delivery_type,p_receipt_mime_type,p_receipt_size_bytes,
      v_profile.bank_account_name,v_profile.bank_name,right(v_profile.bank_account_number,4));
    exit;
  exception when unique_violation then if v_attempt=5 then raise; end if; end; end loop;
  select * into v_existing from public.referral_commission_payouts where id=p_request_id;
  return jsonb_build_object('paymentId',v_existing.public_id,'commissionId',v_entitlement.public_id,
    'referrerId',v_existing.referrer_id,'amountMinor',v_existing.amount_minor,'paidAt',v_existing.paid_at);
end $$;

create function public.read_admin_referral_payout_receipt(p_admin uuid,p_payment text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_admin is null or p_payment is null or p_payment !~ '^PAY-[A-HJ-NP-Z2-9]{6}$' then
    raise exception using errcode='23514',message='Invalid payout receipt'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select jsonb_build_object('public_id',receipt_public_id,'resource_type',receipt_resource_type,
    'delivery_type',receipt_delivery_type,'url','','mime_type',receipt_mime_type,'size_bytes',receipt_size_bytes)
    into v_result from public.referral_commission_payouts where public_id=p_payment;
  if v_result is null then raise exception using errcode='P0002',message='Payout receipt not found'; end if;
  return v_result;
end $$;

create function public.read_admin_referral_payout_request(p_admin uuid,p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_admin is null or p_request_id is null then raise exception using errcode='23514',message='Invalid payout request'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select jsonb_build_object('paymentId',p.public_id,'commissionId',e.public_id,'referrerId',p.referrer_id,
    'amountMinor',p.amount_minor,'paidAt',p.paid_at) into v_result
    from public.referral_commission_payouts p join public.referral_commission_entitlements e on e.id=p.commission_entitlement_id
    where p.id=p_request_id and p.recorded_by=p_admin;
  return v_result;
end $$;

-- Customer and Admin now read one payout ledger. Receipts remain Admin-only.
create or replace function public.list_customer_referrals(p_owner uuid,p_page integer default 1,p_page_size integer default 10) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_total integer;v_earned bigint;v_paid bigint;v_items jsonb;
begin
  if p_owner is null or p_page not between 1 and 100000 or p_page_size not between 1 and 50 then
    raise exception using errcode='23514',message='Invalid referral query'; end if;
  select count(*)::integer,coalesce(sum(e.commission_amount_minor),0)::bigint,coalesce(sum(pay.amount_minor),0)::bigint
    into v_total,v_earned,v_paid from public.referral_commission_entitlements e
    left join public.referral_commission_payouts pay on pay.commission_entitlement_id=e.id where e.referrer_id=p_owner;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.public_id,'referralType',c.referral_type,
    'saleAmount',c.commission_basis_minor,'propertyCode',c.property_code,'earnings',c.commission_amount_minor,
    'status','COMPLETED','completedAt',c.earned_at,'paymentState',case when c.payment_id is null then 'OUTSTANDING' else 'PAID' end,
    'paidAt',c.paid_at) order by c.earned_at desc,c.id desc),'[]'::jsonb) into v_items
  from (select e.*,pay.public_id payment_id,pay.paid_at from public.referral_commission_entitlements e
    left join public.referral_commission_payouts pay on pay.commission_entitlement_id=e.id
    where e.referrer_id=p_owner order by e.earned_at desc,e.id desc offset (p_page-1)*p_page_size limit p_page_size) c;
  return jsonb_build_object('summary',jsonb_build_object('availableBalance',v_earned-v_paid,
    'totalEarnings',v_earned,'referrals',v_total,'propertiesSold',v_total),
    'items',v_items,'page',p_page,'pageSize',p_page_size,'total',v_total,
    'totalPages',case when v_total=0 then 0 else ((v_total+p_page_size-1)/p_page_size) end);
end $$;

revoke all on function public.list_admin_referrers(text,text,text,integer,integer),
  public.read_admin_referrer(uuid,integer,integer),public.read_admin_referral_payment_preview(uuid,text),
  public.record_admin_referral_payout(uuid,uuid,text,text,text,text,text,integer),
  public.read_admin_referral_payout_receipt(uuid,text),public.read_admin_referral_payout_request(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.list_admin_referrers(text,text,text,integer,integer),
  public.read_admin_referrer(uuid,integer,integer),public.read_admin_referral_payment_preview(uuid,text),
  public.record_admin_referral_payout(uuid,uuid,text,text,text,text,text,integer),
  public.read_admin_referral_payout_receipt(uuid,text),public.read_admin_referral_payout_request(uuid,uuid)
  to service_role;
revoke all on function public.list_customer_referrals(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.list_customer_referrals(uuid,integer,integer) to service_role;

commit;
