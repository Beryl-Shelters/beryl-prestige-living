begin;

-- A withdrawal request reserves already-earned commission. It never transfers
-- money and never changes the immutable entitlement that created the balance.
create table public.referral_withdrawal_requests (
  id uuid primary key,
  public_id text not null unique check (public_id ~ '^WDR-[A-HJ-NP-Z2-9]{6}$'),
  referrer_id uuid not null references auth.users(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','PAID','REJECTED','CANCELLED')),
  account_name_snapshot text not null check (char_length(account_name_snapshot) between 1 and 160),
  bank_name_snapshot text not null check (char_length(bank_name_snapshot) between 1 and 120),
  account_number_last4 text not null check (account_number_last4 ~ '^[0-9]{4}$'),
  requested_at timestamptz not null default clock_timestamp(),
  processing_started_at timestamptz,
  processing_started_by uuid references public.admin_profiles(user_id) on delete restrict,
  rejected_at timestamptz,
  rejected_by uuid references public.admin_profiles(user_id) on delete restrict,
  rejection_reason text,
  cancelled_at timestamptz,
  paid_at timestamptz,
  constraint referral_withdrawal_state_check check (
    (status='PENDING' and processing_started_at is null and processing_started_by is null and rejected_at is null and rejected_by is null and rejection_reason is null and cancelled_at is null and paid_at is null)
    or (status='PROCESSING' and processing_started_at is not null and processing_started_by is not null and rejected_at is null and rejected_by is null and rejection_reason is null and cancelled_at is null and paid_at is null)
    or (status='PAID' and processing_started_at is not null and processing_started_by is not null and rejected_at is null and rejected_by is null and rejection_reason is null and cancelled_at is null and paid_at is not null)
    or (status='REJECTED' and processing_started_at is null and processing_started_by is null and rejected_at is not null and rejected_by is not null and rejection_reason is not null and char_length(rejection_reason) between 1 and 2000 and rejection_reason=btrim(rejection_reason) and replace(replace(rejection_reason,E'\n',''),E'\r','') !~ '[[:cntrl:]]' and cancelled_at is null and paid_at is null)
    or (status='CANCELLED' and processing_started_at is null and processing_started_by is null and rejected_at is null and rejected_by is null and rejection_reason is null and cancelled_at is not null and paid_at is null)
  )
);
create index referral_withdrawal_requests_owner_time_idx
  on public.referral_withdrawal_requests(referrer_id,requested_at desc,id desc);
create index referral_withdrawal_requests_active_idx
  on public.referral_withdrawal_requests(referrer_id,status,requested_at)
  where status in ('PENDING','PROCESSING');

-- Oldest-earned-first reservations are explicit and remain for audit after a
-- request is paid, rejected, or cancelled.
create table public.referral_withdrawal_allocations (
  withdrawal_request_id uuid not null references public.referral_withdrawal_requests(id) on delete restrict,
  commission_entitlement_id uuid not null references public.referral_commission_entitlements(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  primary key (withdrawal_request_id,commission_entitlement_id)
);
create index referral_withdrawal_allocations_entitlement_idx
  on public.referral_withdrawal_allocations(commission_entitlement_id,withdrawal_request_id);

-- The original payout ledger remains canonical. The former unique entitlement
-- pointer is retained for legacy/direct payments, while request payments point
-- to their withdrawal. Exact partial attribution lives in payout allocations.
alter table public.referral_commission_payouts
  drop constraint referral_commission_payouts_commission_entitlement_id_key,
  alter column commission_entitlement_id drop not null,
  add column withdrawal_request_id uuid unique references public.referral_withdrawal_requests(id) on delete restrict,
  add constraint referral_commission_payout_source_check check (
    (commission_entitlement_id is not null and withdrawal_request_id is null)
    or (commission_entitlement_id is null and withdrawal_request_id is not null)
  );

create table public.referral_commission_payout_allocations (
  payout_id uuid not null references public.referral_commission_payouts(id) on delete restrict,
  commission_entitlement_id uuid not null references public.referral_commission_entitlements(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  primary key (payout_id,commission_entitlement_id)
);
create index referral_payout_allocations_entitlement_idx
  on public.referral_commission_payout_allocations(commission_entitlement_id,payout_id);

-- Every 202609280004 payout contains exact proof of a full entitlement payment.
insert into public.referral_commission_payout_allocations(payout_id,commission_entitlement_id,amount_minor)
select id,commission_entitlement_id,amount_minor from public.referral_commission_payouts
where commission_entitlement_id is not null;

create function public.enforce_referral_withdrawal_transition() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if old.id<>new.id or old.public_id<>new.public_id or old.referrer_id<>new.referrer_id
     or old.amount_minor<>new.amount_minor or old.account_name_snapshot<>new.account_name_snapshot
     or old.bank_name_snapshot<>new.bank_name_snapshot or old.account_number_last4<>new.account_number_last4
     or old.requested_at<>new.requested_at then
    raise exception using errcode='42501',message='Withdrawal financial details are immutable';
  end if;
  if not ((old.status='PENDING' and new.status in ('PROCESSING','REJECTED','CANCELLED'))
      or (old.status='PROCESSING' and new.status='PAID')) then
    raise exception using errcode='23514',message='Illegal withdrawal transition';
  end if;
  return new;
end $$;
create trigger referral_withdrawal_transition before update or delete
  on public.referral_withdrawal_requests for each row execute function public.enforce_referral_withdrawal_transition();
create trigger referral_withdrawal_allocation_immutable before update or delete
  on public.referral_withdrawal_allocations for each row execute function public.reject_referral_financial_mutation();
create trigger referral_payout_allocation_immutable before update or delete
  on public.referral_commission_payout_allocations for each row execute function public.reject_referral_financial_mutation();

alter table public.referral_withdrawal_requests enable row level security;
alter table public.referral_withdrawal_allocations enable row level security;
alter table public.referral_commission_payout_allocations enable row level security;
revoke all on public.referral_withdrawal_requests,public.referral_withdrawal_allocations,
  public.referral_commission_payout_allocations from public,anon,authenticated,service_role;

create function public.list_customer_referral_withdrawals(
  p_owner uuid,p_minimum_minor bigint,p_page integer default 1,p_page_size integer default 10
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_owner is null or p_minimum_minor<1 or p_page not between 1 and 100000 or p_page_size not between 1 and 50 then
    raise exception using errcode='23514',message='Invalid withdrawal query'; end if;
  with totals as (
    select coalesce((select sum(commission_amount_minor) from public.referral_commission_entitlements where referrer_id=p_owner),0)::bigint earned,
      coalesce((select sum(amount_minor) from public.referral_commission_payouts where referrer_id=p_owner),0)::bigint paid,
      coalesce((select sum(amount_minor) from public.referral_withdrawal_requests where referrer_id=p_owner and status in ('PENDING','PROCESSING')),0)::bigint reserved
  ), profile as (
    select p.*,(nullif(btrim(p.bank_account_name),'') is not null and nullif(btrim(p.bank_name),'') is not null
      and p.bank_account_number ~ '^[0-9]{4,30}$') bank_complete from public.customer_profiles p where p.id=p_owner
  ), request_total as (
    select count(*)::integer total from public.referral_withdrawal_requests where referrer_id=p_owner
  ), requests as (
    select r.*,pay.public_id payment_id from public.referral_withdrawal_requests r
    left join public.referral_commission_payouts pay on pay.withdrawal_request_id=r.id
    where r.referrer_id=p_owner order by r.requested_at desc,r.id desc
    offset (p_page-1)*p_page_size limit p_page_size
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object('id',public_id,'amountMinor',amount_minor,'status',status,
      'requestedAt',requested_at,'processingStartedAt',processing_started_at,'paidAt',paid_at,
      'rejectedAt',rejected_at,'rejectionReason',rejection_reason,'cancelledAt',cancelled_at,
      'paymentId',payment_id) order by requested_at desc,id desc),'[]'::jsonb) value from requests
  )
  select jsonb_build_object('balance',jsonb_build_object('totalEarnedMinor',t.earned,'totalPaidMinor',t.paid,
      'grossOutstandingMinor',t.earned-t.paid,'pendingMinor',t.reserved,
      'availableMinor',greatest(t.earned-t.paid-t.reserved,0),'minimumMinor',p_minimum_minor),
    'bank',jsonb_build_object('complete',p.bank_complete,
      'accountName',case when p.bank_complete then p.bank_account_name end,
      'bankName',case when p.bank_complete then p.bank_name end,
      'maskedAccountNumber',case when p.bank_complete then '••••••'||right(p.bank_account_number,4) end),
    'items',i.value,'page',p_page,'pageSize',p_page_size,'total',rt.total,
    'totalPages',case when rt.total=0 then 0 else ((rt.total+p_page_size-1)/p_page_size) end)
  into v_result from totals t cross join profile p cross join request_total rt cross join items i;
  if v_result is null then raise exception using errcode='P0002',message='Customer not found'; end if;
  return v_result;
end $$;

create function public.create_customer_referral_withdrawal(
  p_request_id uuid,p_owner uuid,p_amount_minor bigint,p_minimum_minor bigint
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_profile public.customer_profiles%rowtype;v_existing public.referral_withdrawal_requests%rowtype;
  v_public_id text;v_attempt integer;v_available bigint;v_remaining bigint;v_take bigint;v_allocated bigint:=0;v_row record;
begin
  if p_request_id is null or p_owner is null or p_amount_minor is null or p_minimum_minor<1
     or p_amount_minor<p_minimum_minor or p_amount_minor>999999999999999 then
    raise exception using errcode='23514',message='Invalid withdrawal amount'; end if;
  select * into v_existing from public.referral_withdrawal_requests where id=p_request_id;
  if found then
    if v_existing.referrer_id<>p_owner or v_existing.amount_minor<>p_amount_minor then
      raise exception using errcode='23505',message='Withdrawal request already used'; end if;
    return jsonb_build_object('id',v_existing.public_id,'amountMinor',v_existing.amount_minor,
      'status',v_existing.status,'requestedAt',v_existing.requested_at);
  end if;
  select * into v_profile from public.customer_profiles where id=p_owner for update;
  if not found then raise exception using errcode='P0002',message='Customer not found'; end if;
  select * into v_existing from public.referral_withdrawal_requests where id=p_request_id;
  if found then
    if v_existing.referrer_id<>p_owner or v_existing.amount_minor<>p_amount_minor then
      raise exception using errcode='23505',message='Withdrawal request already used'; end if;
    return jsonb_build_object('id',v_existing.public_id,'amountMinor',v_existing.amount_minor,
      'status',v_existing.status,'requestedAt',v_existing.requested_at);
  end if;
  if nullif(btrim(v_profile.bank_account_name),'') is null or nullif(btrim(v_profile.bank_name),'') is null
     or v_profile.bank_account_number !~ '^[0-9]{4,30}$' then
    raise exception using errcode='23514',message='Payment details are incomplete'; end if;
  select coalesce((select sum(commission_amount_minor) from public.referral_commission_entitlements where referrer_id=p_owner),0)
    -coalesce((select sum(amount_minor) from public.referral_commission_payouts where referrer_id=p_owner),0)
    -coalesce((select sum(amount_minor) from public.referral_withdrawal_requests where referrer_id=p_owner and status in ('PENDING','PROCESSING')),0)
    into v_available;
  if p_amount_minor>v_available then raise exception using errcode='23514',message='Withdrawal amount exceeds available balance'; end if;
  for v_attempt in 1..5 loop begin
    v_public_id:=public.generate_display_code('WDR');
    insert into public.referral_withdrawal_requests(id,public_id,referrer_id,amount_minor,
      account_name_snapshot,bank_name_snapshot,account_number_last4)
    values(p_request_id,v_public_id,p_owner,p_amount_minor,btrim(v_profile.bank_account_name),
      btrim(v_profile.bank_name),right(v_profile.bank_account_number,4));
    exit;
  exception when unique_violation then if v_attempt=5 then raise; end if; end; end loop;
  v_remaining:=p_amount_minor;
  for v_row in
    select e.id,e.commission_amount_minor
      -coalesce((select sum(a.amount_minor) from public.referral_commission_payout_allocations a where a.commission_entitlement_id=e.id),0)
      -coalesce((select sum(a.amount_minor) from public.referral_withdrawal_allocations a
        join public.referral_withdrawal_requests r on r.id=a.withdrawal_request_id
        where a.commission_entitlement_id=e.id and r.status in ('PENDING','PROCESSING') and r.id<>p_request_id),0) available
    from public.referral_commission_entitlements e where e.referrer_id=p_owner
    order by e.earned_at,e.id for update
  loop
    exit when v_remaining=0;
    if v_row.available>0 then
      v_take:=least(v_remaining,v_row.available);
      insert into public.referral_withdrawal_allocations(withdrawal_request_id,commission_entitlement_id,amount_minor)
        values(p_request_id,v_row.id,v_take);
      v_remaining:=v_remaining-v_take;v_allocated:=v_allocated+v_take;
    end if;
  end loop;
  if v_remaining<>0 or v_allocated<>p_amount_minor then
    raise exception using errcode='40001',message='Withdrawal balance changed'; end if;
  return jsonb_build_object('id',v_public_id,'amountMinor',p_amount_minor,'status','PENDING','requestedAt',
    (select requested_at from public.referral_withdrawal_requests where id=p_request_id));
end $$;

create function public.cancel_customer_referral_withdrawal(p_owner uuid,p_withdrawal text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.referral_withdrawal_requests%rowtype;
begin
  if p_owner is null or p_withdrawal is null or p_withdrawal !~ '^WDR-[A-HJ-NP-Z2-9]{6}$' then
    raise exception using errcode='23514',message='Invalid withdrawal request'; end if;
  perform 1 from public.customer_profiles where id=p_owner for update;
  select * into v_request from public.referral_withdrawal_requests
    where public_id=p_withdrawal and referrer_id=p_owner for update;
  if not found then raise exception using errcode='P0002',message='Withdrawal request not found'; end if;
  if v_request.status<>'PENDING' then raise exception using errcode='23514',message='Only pending withdrawals can be cancelled'; end if;
  update public.referral_withdrawal_requests set status='CANCELLED',cancelled_at=clock_timestamp() where id=v_request.id;
  return jsonb_build_object('id',v_request.public_id,'status','CANCELLED');
end $$;

create function public.begin_admin_referral_withdrawal(p_admin uuid,p_withdrawal text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.referral_withdrawal_requests%rowtype;v_now timestamptz:=clock_timestamp();
begin
  if p_admin is null or p_withdrawal is null or p_withdrawal !~ '^WDR-[A-HJ-NP-Z2-9]{6}$' then
    raise exception using errcode='23514',message='Invalid withdrawal request'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select * into v_request from public.referral_withdrawal_requests where public_id=p_withdrawal for update;
  if not found then raise exception using errcode='P0002',message='Withdrawal request not found'; end if;
  if v_request.status='PROCESSING' and v_request.processing_started_by=p_admin then
    return jsonb_build_object('id',v_request.public_id,'status',v_request.status); end if;
  if v_request.status<>'PENDING' then raise exception using errcode='23514',message='Only pending withdrawals can begin processing'; end if;
  update public.referral_withdrawal_requests set status='PROCESSING',processing_started_at=v_now,processing_started_by=p_admin where id=v_request.id;
  return jsonb_build_object('id',v_request.public_id,'status','PROCESSING');
end $$;

create function public.reject_admin_referral_withdrawal(p_admin uuid,p_withdrawal text,p_reason text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.referral_withdrawal_requests%rowtype;v_now timestamptz:=clock_timestamp();
begin
  if p_admin is null or p_withdrawal is null or p_withdrawal !~ '^WDR-[A-HJ-NP-Z2-9]{6}$'
     or p_reason is null or char_length(p_reason) not between 1 and 2000 or p_reason<>btrim(p_reason)
     or replace(replace(p_reason,E'\n',''),E'\r','') ~ '[[:cntrl:]]' then
    raise exception using errcode='23514',message='Invalid withdrawal rejection'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select * into v_request from public.referral_withdrawal_requests where public_id=p_withdrawal for update;
  if not found then raise exception using errcode='P0002',message='Withdrawal request not found'; end if;
  if v_request.status<>'PENDING' then raise exception using errcode='23514',message='Only pending withdrawals can be rejected'; end if;
  update public.referral_withdrawal_requests set status='REJECTED',rejected_at=v_now,rejected_by=p_admin,rejection_reason=p_reason where id=v_request.id;
  return jsonb_build_object('id',v_request.public_id,'status','REJECTED','rejectionReason',p_reason);
end $$;

create function public.read_admin_referral_withdrawal_payment_preview(p_admin uuid,p_withdrawal text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_admin is null or p_withdrawal is null or p_withdrawal !~ '^WDR-[A-HJ-NP-Z2-9]{6}$' then
    raise exception using errcode='23514',message='Invalid withdrawal payment'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select jsonb_build_object('withdrawalId',r.public_id,'referrerId',r.referrer_id,
    'referrerName',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email),
    'amountMinor',r.amount_minor,'accountName',p.bank_account_name,'bankName',p.bank_name,
    'accountNumber',p.bank_account_number)
  into v_result from public.referral_withdrawal_requests r join public.customer_profiles p on p.id=r.referrer_id
  where r.public_id=p_withdrawal and r.status='PROCESSING' and p.bank_account_name is not null
    and p.bank_name is not null and p.bank_account_number ~ '^[0-9]{4,30}$';
  if v_result is null then
    if exists(select 1 from public.referral_withdrawal_requests where public_id=p_withdrawal and status='PAID') then
      raise exception using errcode='23505',message='Withdrawal already paid';
    elsif exists(select 1 from public.referral_withdrawal_requests where public_id=p_withdrawal) then
      raise exception using errcode='23514',message='Withdrawal is not ready for payment or payment details are incomplete';
    else raise exception using errcode='P0002',message='Withdrawal request not found'; end if;
  end if;
  return v_result;
end $$;

create function public.read_admin_referral_withdrawal_payment_request(p_admin uuid,p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_admin is null or p_request_id is null then raise exception using errcode='23514',message='Invalid payout request'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select jsonb_build_object('paymentId',p.public_id,'withdrawalId',r.public_id,'referrerId',p.referrer_id,
    'amountMinor',p.amount_minor,'paidAt',p.paid_at) into v_result
  from public.referral_commission_payouts p join public.referral_withdrawal_requests r on r.id=p.withdrawal_request_id
  where p.id=p_request_id and p.recorded_by=p_admin;
  return v_result;
end $$;

create function public.record_admin_referral_withdrawal_payout(
  p_request_id uuid,p_admin uuid,p_withdrawal text,p_receipt_public_id text,
  p_receipt_resource_type text,p_receipt_delivery_type text,p_receipt_mime_type text,p_receipt_size_bytes integer
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.referral_withdrawal_requests%rowtype;v_profile public.customer_profiles%rowtype;
  v_existing public.referral_commission_payouts%rowtype;v_public_id text;v_attempt integer;v_allocated bigint;v_now timestamptz:=clock_timestamp();
begin
  if p_request_id is null or p_admin is null or p_withdrawal is null or p_withdrawal !~ '^WDR-[A-HJ-NP-Z2-9]{6}$'
     or p_receipt_public_id is null or char_length(p_receipt_public_id) not between 1 and 300
     or p_receipt_resource_type<>'raw' or p_receipt_delivery_type<>'authenticated'
     or p_receipt_mime_type not in ('application/pdf','image/png','image/jpeg')
     or p_receipt_size_bytes not between 1 and 10485760 then
    raise exception using errcode='23514',message='Invalid withdrawal payment'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select * into v_existing from public.referral_commission_payouts where id=p_request_id;
  if found then
    select * into v_request from public.referral_withdrawal_requests where id=v_existing.withdrawal_request_id;
    if v_request.public_id<>p_withdrawal or v_existing.recorded_by<>p_admin
       or v_existing.receipt_public_id<>p_receipt_public_id or v_existing.receipt_mime_type<>p_receipt_mime_type
       or v_existing.receipt_size_bytes<>p_receipt_size_bytes then
      raise exception using errcode='23505',message='Payment request already used'; end if;
    return jsonb_build_object('paymentId',v_existing.public_id,'withdrawalId',v_request.public_id,
      'referrerId',v_existing.referrer_id,'amountMinor',v_existing.amount_minor,'paidAt',v_existing.paid_at);
  end if;
  select * into v_request from public.referral_withdrawal_requests where public_id=p_withdrawal;
  if not found then raise exception using errcode='P0002',message='Withdrawal request not found'; end if;
  select * into v_profile from public.customer_profiles where id=v_request.referrer_id for update;
  select * into v_request from public.referral_withdrawal_requests where id=v_request.id for update;
  select * into v_existing from public.referral_commission_payouts where id=p_request_id;
  if found then
    if v_existing.withdrawal_request_id<>v_request.id or v_existing.recorded_by<>p_admin
       or v_existing.receipt_public_id<>p_receipt_public_id or v_existing.receipt_mime_type<>p_receipt_mime_type
       or v_existing.receipt_size_bytes<>p_receipt_size_bytes then
      raise exception using errcode='23505',message='Payment request already used'; end if;
    return jsonb_build_object('paymentId',v_existing.public_id,'withdrawalId',v_request.public_id,
      'referrerId',v_existing.referrer_id,'amountMinor',v_existing.amount_minor,'paidAt',v_existing.paid_at);
  end if;
  if v_request.status<>'PROCESSING' then raise exception using errcode='23514',message='Withdrawal is not ready for payment'; end if;
  if p_receipt_public_id <> ('beryl-v2/referral-payouts/withdrawals/'||v_request.public_id||'/'||p_request_id::text||
    case p_receipt_mime_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end) then
    raise exception using errcode='23514',message='Invalid payment receipt'; end if;
  if v_profile.bank_account_name is null or v_profile.bank_name is null or v_profile.bank_account_number !~ '^[0-9]{4,30}$' then
    raise exception using errcode='23514',message='Payment details are incomplete'; end if;
  select coalesce(sum(amount_minor),0)::bigint into v_allocated from public.referral_withdrawal_allocations where withdrawal_request_id=v_request.id;
  if v_allocated<>v_request.amount_minor then raise exception using errcode='23514',message='Invalid withdrawal allocation'; end if;
  if exists(select 1 from public.referral_withdrawal_allocations wa where wa.withdrawal_request_id=v_request.id
    and wa.amount_minor + coalesce((select sum(pa.amount_minor) from public.referral_commission_payout_allocations pa where pa.commission_entitlement_id=wa.commission_entitlement_id),0)
      > (select commission_amount_minor from public.referral_commission_entitlements where id=wa.commission_entitlement_id)) then
    raise exception using errcode='23514',message='Commission allocation exceeds entitlement'; end if;
  for v_attempt in 1..5 loop begin
    v_public_id:=public.generate_display_code('PAY');
    insert into public.referral_commission_payouts(id,public_id,commission_entitlement_id,withdrawal_request_id,referrer_id,amount_minor,
      recorded_by,paid_at,receipt_public_id,receipt_resource_type,receipt_delivery_type,receipt_mime_type,receipt_size_bytes,
      account_name_snapshot,bank_name_snapshot,account_number_last4)
    values(p_request_id,v_public_id,null,v_request.id,v_request.referrer_id,v_request.amount_minor,p_admin,v_now,
      p_receipt_public_id,p_receipt_resource_type,p_receipt_delivery_type,p_receipt_mime_type,p_receipt_size_bytes,
      btrim(v_profile.bank_account_name),btrim(v_profile.bank_name),right(v_profile.bank_account_number,4));
    exit;
  exception when unique_violation then if v_attempt=5 then raise; end if; end; end loop;
  insert into public.referral_commission_payout_allocations(payout_id,commission_entitlement_id,amount_minor)
    select p_request_id,commission_entitlement_id,amount_minor from public.referral_withdrawal_allocations where withdrawal_request_id=v_request.id;
  if (select coalesce(sum(amount_minor),0) from public.referral_commission_payout_allocations where payout_id=p_request_id)<>v_request.amount_minor then
    raise exception using errcode='23514',message='Invalid payout allocation'; end if;
  update public.referral_withdrawal_requests set status='PAID',paid_at=v_now where id=v_request.id;
  return jsonb_build_object('paymentId',v_public_id,'withdrawalId',v_request.public_id,
    'referrerId',v_request.referrer_id,'amountMinor',v_request.amount_minor,'paidAt',v_now);
end $$;

-- Direct Admin payments now pay the exact unreserved remainder of one selected
-- entitlement and write through the same allocation ledger.
create or replace function public.read_admin_referral_payment_preview(p_admin uuid,p_commission text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;v_exists boolean;v_remaining bigint;
begin
  if p_admin is null or p_commission is null or p_commission !~ '^COM-[A-HJ-NP-Z2-9]{6}$' then
    raise exception using errcode='23514',message='Invalid commission payment'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required'; end if;
  select true,e.commission_amount_minor
    -coalesce((select sum(a.amount_minor) from public.referral_commission_payout_allocations a where a.commission_entitlement_id=e.id),0)
    -coalesce((select sum(a.amount_minor) from public.referral_withdrawal_allocations a join public.referral_withdrawal_requests r on r.id=a.withdrawal_request_id where a.commission_entitlement_id=e.id and r.status in ('PENDING','PROCESSING')),0)
    into v_exists,v_remaining from public.referral_commission_entitlements e where e.public_id=p_commission;
  select jsonb_build_object('commissionId',e.public_id,'referrerId',e.referrer_id,
    'referrerName',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email),
    'referralCode',e.referral_code,'amountMinor',v_remaining,'accountName',p.bank_account_name,
    'bankName',p.bank_name,'accountNumber',p.bank_account_number)
  into v_result from public.referral_commission_entitlements e join public.customer_profiles p on p.id=e.referrer_id
  where e.public_id=p_commission and v_remaining>0 and p.bank_account_name is not null and p.bank_name is not null
    and p.bank_account_number ~ '^[0-9]{4,30}$';
  if v_result is null then
    if not coalesce(v_exists,false) then raise exception using errcode='P0002',message='Commission not found';
    elsif v_remaining<=0 then raise exception using errcode='23505',message='Commission is paid or reserved';
    else raise exception using errcode='23514',message='Payment details are incomplete'; end if;
  end if;
  return v_result;
end $$;

create or replace function public.record_admin_referral_payout(
  p_request_id uuid,p_admin uuid,p_commission text,p_receipt_public_id text,
  p_receipt_resource_type text,p_receipt_delivery_type text,p_receipt_mime_type text,p_receipt_size_bytes integer
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_entitlement public.referral_commission_entitlements%rowtype;v_profile public.customer_profiles%rowtype;
  v_existing public.referral_commission_payouts%rowtype;v_public_id text;v_attempt integer;v_amount bigint;
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
  select * into v_entitlement from public.referral_commission_entitlements where public_id=p_commission;
  if not found then raise exception using errcode='P0002',message='Commission not found'; end if;
  select * into v_profile from public.customer_profiles where id=v_entitlement.referrer_id for update;
  select * into v_entitlement from public.referral_commission_entitlements where id=v_entitlement.id for update;
  select * into v_existing from public.referral_commission_payouts where id=p_request_id;
  if found then
    if v_existing.commission_entitlement_id<>v_entitlement.id or v_existing.recorded_by<>p_admin
       or v_existing.receipt_public_id<>p_receipt_public_id or v_existing.receipt_mime_type<>p_receipt_mime_type
       or v_existing.receipt_size_bytes<>p_receipt_size_bytes then
      raise exception using errcode='23505',message='Payment request already used'; end if;
    return jsonb_build_object('paymentId',v_existing.public_id,'commissionId',v_entitlement.public_id,
      'referrerId',v_existing.referrer_id,'amountMinor',v_existing.amount_minor,'paidAt',v_existing.paid_at);
  end if;
  select v_entitlement.commission_amount_minor
    -coalesce((select sum(a.amount_minor) from public.referral_commission_payout_allocations a where a.commission_entitlement_id=v_entitlement.id),0)
    -coalesce((select sum(a.amount_minor) from public.referral_withdrawal_allocations a join public.referral_withdrawal_requests r on r.id=a.withdrawal_request_id where a.commission_entitlement_id=v_entitlement.id and r.status in ('PENDING','PROCESSING')),0)
    into v_amount;
  if v_amount<=0 then raise exception using errcode='23505',message='Commission is paid or reserved'; end if;
  if p_receipt_public_id <> ('beryl-v2/referral-payouts/'||v_entitlement.public_id||'/'||p_request_id::text||
    case p_receipt_mime_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end) then
    raise exception using errcode='23514',message='Invalid payment receipt'; end if;
  if v_profile.bank_account_name is null or v_profile.bank_name is null or v_profile.bank_account_number !~ '^[0-9]{4,30}$' then
    raise exception using errcode='23514',message='Payment details are incomplete'; end if;
  for v_attempt in 1..5 loop begin
    v_public_id:=public.generate_display_code('PAY');
    insert into public.referral_commission_payouts(id,public_id,commission_entitlement_id,referrer_id,amount_minor,
      recorded_by,receipt_public_id,receipt_resource_type,receipt_delivery_type,receipt_mime_type,receipt_size_bytes,
      account_name_snapshot,bank_name_snapshot,account_number_last4)
    values(p_request_id,v_public_id,v_entitlement.id,v_entitlement.referrer_id,v_amount,p_admin,p_receipt_public_id,
      p_receipt_resource_type,p_receipt_delivery_type,p_receipt_mime_type,p_receipt_size_bytes,
      btrim(v_profile.bank_account_name),btrim(v_profile.bank_name),right(v_profile.bank_account_number,4));
    exit;
  exception when unique_violation then if v_attempt=5 then raise; end if; end; end loop;
  insert into public.referral_commission_payout_allocations(payout_id,commission_entitlement_id,amount_minor)
    values(p_request_id,v_entitlement.id,v_amount);
  return jsonb_build_object('paymentId',v_public_id,'commissionId',v_entitlement.public_id,
    'referrerId',v_entitlement.referrer_id,'amountMinor',v_amount,'paidAt',
    (select paid_at from public.referral_commission_payouts where id=p_request_id));
end $$;

-- Customer financial summary separates earned, paid, gross outstanding, active
-- reservations, and balance still available to request.
create or replace function public.list_customer_referrals(p_owner uuid,p_page integer default 1,p_page_size integer default 10) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_total integer;v_earned bigint;v_paid bigint;v_reserved bigint;v_items jsonb;v_bank_complete boolean;
begin
  if p_owner is null or p_page not between 1 and 100000 or p_page_size not between 1 and 50 then
    raise exception using errcode='23514',message='Invalid referral query'; end if;
  select count(*)::integer,coalesce(sum(commission_amount_minor),0)::bigint into v_total,v_earned
    from public.referral_commission_entitlements where referrer_id=p_owner;
  select coalesce(sum(amount_minor),0)::bigint into v_paid from public.referral_commission_payouts where referrer_id=p_owner;
  select coalesce(sum(amount_minor),0)::bigint into v_reserved from public.referral_withdrawal_requests
    where referrer_id=p_owner and status in ('PENDING','PROCESSING');
  select nullif(btrim(bank_account_name),'') is not null and nullif(btrim(bank_name),'') is not null
    and bank_account_number ~ '^[0-9]{4,30}$' into v_bank_complete from public.customer_profiles where id=p_owner;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.public_id,'referralType',c.referral_type,
    'saleAmount',c.commission_basis_minor,'propertyCode',c.property_code,'earnings',c.commission_amount_minor,
    'status','COMPLETED','completedAt',c.earned_at,
    'paymentState',case when c.paid_minor=0 then 'OUTSTANDING' when c.paid_minor<c.commission_amount_minor then 'PARTIALLY_PAID' else 'PAID' end,
    'paidMinor',c.paid_minor,'paidAt',c.paid_at) order by c.earned_at desc,c.id desc),'[]'::jsonb) into v_items
  from (select e.*,coalesce(pa.paid_minor,0)::bigint paid_minor,pa.paid_at from public.referral_commission_entitlements e
    left join lateral (select sum(a.amount_minor)::bigint paid_minor,max(p.paid_at) paid_at
      from public.referral_commission_payout_allocations a join public.referral_commission_payouts p on p.id=a.payout_id
      where a.commission_entitlement_id=e.id) pa on true
    where e.referrer_id=p_owner order by e.earned_at desc,e.id desc offset (p_page-1)*p_page_size limit p_page_size) c;
  return jsonb_build_object('summary',jsonb_build_object('availableBalance',greatest(v_earned-v_paid-v_reserved,0),
    'totalEarnings',v_earned,'paid',v_paid,'pendingWithdrawals',v_reserved,'grossOutstanding',v_earned-v_paid,
    'bankComplete',coalesce(v_bank_complete,false),'referrals',v_total,'propertiesSold',v_total),
    'items',v_items,'page',p_page,'pageSize',p_page_size,'total',v_total,
    'totalPages',case when v_total=0 then 0 else ((v_total+p_page_size-1)/p_page_size) end);
end $$;

-- Admin projections use allocation truth, not the legacy entitlement pointer.
create or replace function public.list_admin_referrers(
  p_query text default '',p_filter text default 'ALL',p_sort text default 'NEWEST',
  p_page integer default 1,p_page_size integer default 6
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_query is null or char_length(p_query)>100 or p_filter not in ('ALL','OWED','PAID')
     or p_sort not in ('NEWEST','OLDEST','NAME_ASC','NAME_DESC','OUTSTANDING_DESC')
     or p_page not between 1 and 100000 or p_page_size not between 1 and 100 then
    raise exception using errcode='23514',message='Invalid Admin referrer query'; end if;
  with base as (
    select p.id,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email) full_name,
      p.phone_number_normalized phone,la.first_referral_at,la.referral_count,
      coalesce(ea.completed_count,0) completed_count,coalesce(ea.earned_minor,0)::bigint earned_minor,
      coalesce(pay.paid_minor,0)::bigint paid_minor,coalesce(w.reserved_minor,0)::bigint reserved_minor,
      coalesce(w.pending_requests,0) pending_requests,
      (nullif(btrim(p.bank_account_name),'') is not null and nullif(btrim(p.bank_name),'') is not null and p.bank_account_number ~ '^[0-9]{4,30}$') bank_complete
    from public.customer_profiles p
    join lateral (select min(created_at) first_referral_at,count(*)::integer referral_count from public.customer_referral_links where user_id=p.id) la on la.referral_count>0
    left join lateral (select count(*)::integer completed_count,coalesce(sum(commission_amount_minor),0)::bigint earned_minor from public.referral_commission_entitlements where referrer_id=p.id) ea on true
    left join lateral (select coalesce(sum(amount_minor),0)::bigint paid_minor from public.referral_commission_payouts where referrer_id=p.id) pay on true
    left join lateral (select coalesce(sum(amount_minor),0)::bigint reserved_minor,count(*)::integer pending_requests from public.referral_withdrawal_requests where referrer_id=p.id and status in ('PENDING','PROCESSING')) w on true
  ), labelled as (
    select *,earned_minor-paid_minor outstanding_minor,greatest(earned_minor-paid_minor-reserved_minor,0) available_minor,
      case when earned_minor=0 then 'NOT_NEEDED' when bank_complete then 'ON_FILE' else 'MISSING' end bank_status from base
  ), counts as (
    select count(*)::integer all_count,count(*) filter(where outstanding_minor>0)::integer owed_count,
      count(*) filter(where earned_minor>0 and outstanding_minor=0)::integer paid_count,
      coalesce(sum(referral_count),0)::integer referrals,coalesce(sum(completed_count),0)::integer completed,
      coalesce(sum(outstanding_minor),0)::bigint outstanding_minor,coalesce(sum(reserved_minor),0)::bigint reserved_minor,
      coalesce(sum(pending_requests),0)::integer pending_requests from labelled
  ), matched as (
    select * from labelled where (btrim(p_query)='' or strpos(lower(full_name),lower(btrim(p_query)))>0 or strpos(coalesce(phone,''),btrim(p_query))>0)
      and (p_filter='ALL' or (p_filter='OWED' and outstanding_minor>0) or (p_filter='PAID' and earned_minor>0 and outstanding_minor=0))
  ), matched_total as (select count(*)::integer total from matched), paged as (
    select * from matched order by case when p_sort='NEWEST' then first_referral_at end desc,
      case when p_sort='OLDEST' then first_referral_at end asc,case when p_sort='NAME_ASC' then lower(full_name) end asc,
      case when p_sort='NAME_DESC' then lower(full_name) end desc,case when p_sort='OUTSTANDING_DESC' then outstanding_minor end desc,id asc
    offset (p_page-1)*p_page_size limit p_page_size
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'fullName',full_name,'phone',phone,'referrals',referral_count,
      'completed',completed_count,'earnedMinor',earned_minor,'paidMinor',paid_minor,'outstandingMinor',outstanding_minor,
      'reservedMinor',reserved_minor,'availableMinor',available_minor,'pendingRequests',pending_requests,'bankStatus',bank_status)
      order by case when p_sort='NEWEST' then first_referral_at end desc,case when p_sort='OLDEST' then first_referral_at end asc,
      case when p_sort='NAME_ASC' then lower(full_name) end asc,case when p_sort='NAME_DESC' then lower(full_name) end desc,
      case when p_sort='OUTSTANDING_DESC' then outstanding_minor end desc,id asc),'[]'::jsonb) value from paged
  )
  select jsonb_build_object('summary',jsonb_build_object('referrers',c.all_count,'referrals',c.referrals,'completed',c.completed,
    'outstandingMinor',c.outstanding_minor,'reservedMinor',c.reserved_minor,'pendingRequests',c.pending_requests),
    'counts',jsonb_build_object('all',c.all_count,'owed',c.owed_count,'paid',c.paid_count),'items',i.value,
    'page',p_page,'pageSize',p_page_size,'total',m.total,'totalPages',case when m.total=0 then 0 else ((m.total+p_page_size-1)/p_page_size) end)
  into v_result from counts c cross join matched_total m cross join items i;return v_result;
end $$;

create or replace function public.read_admin_referrer(p_referrer uuid,p_page integer default 1,p_page_size integer default 10) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_referrer is null or p_page not between 1 and 100000 or p_page_size not between 1 and 100 then
    raise exception using errcode='23514',message='Invalid Admin referrer query'; end if;
  with profile as (
    select p.*,coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email) full_name,
      (nullif(btrim(p.bank_account_name),'') is not null and nullif(btrim(p.bank_name),'') is not null and p.bank_account_number ~ '^[0-9]{4,30}$') bank_complete
    from public.customer_profiles p where p.id=p_referrer and exists(select 1 from public.customer_referral_links l where l.user_id=p.id)
  ), totals as (
    select (select count(*)::integer from public.customer_referral_links where user_id=p_referrer) referrals,
      (select count(*)::integer from public.referral_commission_entitlements where referrer_id=p_referrer) completed,
      coalesce((select sum(commission_amount_minor) from public.referral_commission_entitlements where referrer_id=p_referrer),0)::bigint earned_minor,
      coalesce((select sum(amount_minor) from public.referral_commission_payouts where referrer_id=p_referrer),0)::bigint paid_minor,
      coalesce((select sum(amount_minor) from public.referral_withdrawal_requests where referrer_id=p_referrer and status in ('PENDING','PROCESSING')),0)::bigint reserved_minor
  ), history_total as (select count(*)::integer total from public.referral_commission_entitlements where referrer_id=p_referrer),
  history as (
    select e.*,coalesce(nullif(btrim(concat_ws(' ',rp.first_name,rp.last_name)),''),rp.email) referred_name,
      coalesce(pa.paid_minor,0)::bigint paid_minor,pa.payment_id,pa.paid_at,
      coalesce(ra.reserved_minor,0)::bigint reserved_minor
    from public.referral_commission_entitlements e join public.customer_profiles rp on rp.id=e.referred_customer_id
    left join lateral (select sum(a.amount_minor)::bigint paid_minor,(array_agg(p.public_id order by p.paid_at desc,p.id desc))[1] payment_id,max(p.paid_at) paid_at
      from public.referral_commission_payout_allocations a join public.referral_commission_payouts p on p.id=a.payout_id where a.commission_entitlement_id=e.id) pa on true
    left join lateral (select sum(a.amount_minor)::bigint reserved_minor from public.referral_withdrawal_allocations a
      join public.referral_withdrawal_requests r on r.id=a.withdrawal_request_id where a.commission_entitlement_id=e.id and r.status in ('PENDING','PROCESSING')) ra on true
    where e.referrer_id=p_referrer order by e.earned_at desc,e.id desc offset (p_page-1)*p_page_size limit p_page_size
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object('commissionId',public_id,'referralCode',referral_code,'referredName',referred_name,
      'referralType',referral_type,'propertyCode',property_code,'earnedAt',earned_at,'status','COMPLETED','rewardMinor',commission_amount_minor,
      'paidMinor',paid_minor,'reservedMinor',reserved_minor,'availableMinor',greatest(commission_amount_minor-paid_minor-reserved_minor,0),
      'paymentState',case when paid_minor=0 then 'OUTSTANDING' when paid_minor<commission_amount_minor then 'PARTIALLY_PAID' else 'PAID' end,
      'paymentId',payment_id,'paidAt',paid_at) order by earned_at desc,id desc),'[]'::jsonb) value from history
  ), withdrawals as (
    select coalesce(jsonb_agg(jsonb_build_object('id',w.public_id,'amountMinor',w.amount_minor,'status',w.status,
      'requestedAt',w.requested_at,'processingStartedAt',w.processing_started_at,'paidAt',w.paid_at,
      'rejectedAt',w.rejected_at,'rejectionReason',w.rejection_reason,'cancelledAt',w.cancelled_at,
      'maskedAccountNumber','••••••'||w.account_number_last4,'bankName',w.bank_name_snapshot,
      'paymentId',pay.public_id) order by w.requested_at desc,w.id desc),'[]'::jsonb) value
    from (select * from public.referral_withdrawal_requests where referrer_id=p_referrer order by requested_at desc,id desc limit 50) w
    left join public.referral_commission_payouts pay on pay.withdrawal_request_id=w.id
  )
  select jsonb_build_object('referrer',jsonb_build_object('id',p.id,'fullName',p.full_name,'email',p.email,'phone',p.phone_number_normalized),
    'summary',jsonb_build_object('referrals',t.referrals,'completed',t.completed,'earnedMinor',t.earned_minor,'paidMinor',t.paid_minor,
      'outstandingMinor',t.earned_minor-t.paid_minor,'reservedMinor',t.reserved_minor,
      'availableMinor',greatest(t.earned_minor-t.paid_minor-t.reserved_minor,0)),
    'bank',jsonb_build_object('status',case when t.earned_minor=0 then 'NOT_NEEDED' when p.bank_complete then 'ON_FILE' else 'MISSING' end,
      'accountName',case when p.bank_complete then p.bank_account_name end,'bankName',case when p.bank_complete then p.bank_name end,
      'maskedAccountNumber',case when p.bank_complete then '••••••'||right(p.bank_account_number,4) end),
    'withdrawals',w.value,'items',i.value,'page',p_page,'pageSize',p_page_size,'total',h.total,
    'totalPages',case when h.total=0 then 0 else ((h.total+p_page_size-1)/p_page_size) end)
  into v_result from profile p cross join totals t cross join history_total h cross join items i cross join withdrawals w;
  if v_result is null then raise exception using errcode='P0002',message='Referrer not found'; end if;return v_result;
end $$;

revoke all on function public.enforce_referral_withdrawal_transition(),
  public.list_customer_referral_withdrawals(uuid,bigint,integer,integer),
  public.create_customer_referral_withdrawal(uuid,uuid,bigint,bigint),
  public.cancel_customer_referral_withdrawal(uuid,text),public.begin_admin_referral_withdrawal(uuid,text),
  public.reject_admin_referral_withdrawal(uuid,text,text),public.read_admin_referral_withdrawal_payment_preview(uuid,text),
  public.read_admin_referral_withdrawal_payment_request(uuid,uuid),
  public.record_admin_referral_withdrawal_payout(uuid,uuid,text,text,text,text,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.list_customer_referral_withdrawals(uuid,bigint,integer,integer),
  public.create_customer_referral_withdrawal(uuid,uuid,bigint,bigint),public.cancel_customer_referral_withdrawal(uuid,text),
  public.begin_admin_referral_withdrawal(uuid,text),public.reject_admin_referral_withdrawal(uuid,text,text),
  public.read_admin_referral_withdrawal_payment_preview(uuid,text),public.read_admin_referral_withdrawal_payment_request(uuid,uuid),
  public.record_admin_referral_withdrawal_payout(uuid,uuid,text,text,text,text,text,integer)
  to service_role;

commit;
