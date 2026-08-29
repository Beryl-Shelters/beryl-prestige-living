begin;

alter table public.referral_payments
  add column if not exists receipt_size_bytes bigint,
  add column if not exists receipt_storage_resource_type text not null default 'raw';

create unique index if not exists referral_payments_one_paid_per_referral_uidx
  on public.referral_payments(referral_id)
  where status = 'PAID';

create or replace function public.list_admin_referrers(
  p_query text default null,
  p_payment_filter text default 'ALL',
  p_sort text default 'MOST_RECENT',
  p_page integer default 1,
  p_limit integer default 10
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rollup as (
    select rr.id,
      rr.customer_user_id,
      rr.full_name,
      rr.phone_e164,
      rr.referral_code,
      rr.created_at,
      p.email,
      (pd.id is not null) as payout_on_file,
      count(r.id)::integer as referral_count,
      count(r.id) filter (where r.lifecycle_status = 'COMPLETED')::integer as completed_count,
      coalesce(sum(r.reward_amount) filter (
        where r.lifecycle_status = 'COMPLETED' and r.reward_amount is not null
      ), 0)::numeric as earned_amount,
      coalesce(sum(r.reward_amount) filter (
        where r.lifecycle_status = 'COMPLETED'
          and r.payment_status = 'OUTSTANDING'
          and r.reward_amount is not null
      ), 0)::numeric as outstanding_amount
    from public.referrers rr
    left join public.profiles p on p.id = rr.customer_user_id
    left join public.referrer_payout_details pd on pd.referrer_id = rr.id
    left join public.referrals r on r.referrer_identity_id = rr.id
    group by rr.id, p.email, pd.id
  ), matching as (
    select * from rollup x
    where (
      nullif(btrim(p_query), '') is null
      or x.full_name ilike '%' || btrim(p_query) || '%'
      or x.referral_code ilike '%' || btrim(p_query) || '%'
      or x.phone_e164 ilike '%' || btrim(p_query) || '%'
      or x.email ilike '%' || btrim(p_query) || '%'
    ) and case p_payment_filter
      when 'OWED' then x.outstanding_amount > 0
      when 'FULLY_PAID' then x.earned_amount > 0 and x.outstanding_amount = 0
      else true
    end
  ), ordered as (
    select m.* from matching m
    order by
      case when p_sort = 'MOST_OWED' then m.outstanding_amount end desc,
      case when p_sort = 'MOST_EARNED' then m.earned_amount end desc,
      case when p_sort = 'NAME_ASC' then lower(m.full_name) end asc,
      case when p_sort = 'OLDEST' then m.created_at end asc,
      case when p_sort = 'MOST_RECENT' then m.created_at end desc,
      m.created_at desc,
      m.id asc
    offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(1, least(coalesce(p_limit, 10), 50))
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'totalReferrers', (select count(*)::integer from rollup),
      'totalReferrals', (select coalesce(sum(referral_count), 0)::integer from rollup),
      'completedReferrals', (select coalesce(sum(completed_count), 0)::integer from rollup),
      'earnedAmount', (select coalesce(sum(earned_amount), 0)::numeric from rollup),
      'outstandingAmount', (select coalesce(sum(outstanding_amount), 0)::numeric from rollup)
    ),
    'filterCounts', jsonb_build_object(
      'all', (select count(*)::integer from rollup),
      'owed', (select count(*)::integer from rollup where outstanding_amount > 0),
      'fullyPaid', (select count(*)::integer from rollup where earned_amount > 0 and outstanding_amount = 0)
    ),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id,
      'customerId', customer_user_id,
      'fullName', full_name,
      'phone', phone_e164,
      'email', email,
      'referralCode', referral_code,
      'joinedAt', created_at,
      'referralCount', referral_count,
      'completedCount', completed_count,
      'earnedAmount', earned_amount,
      'outstandingAmount', outstanding_amount,
      'payoutStatus', case
        when payout_on_file then 'ON_FILE'
        when outstanding_amount > 0 then 'MISSING'
        else 'NOT_NEEDED'
      end
    ) order by
      case when p_sort = 'MOST_OWED' then outstanding_amount end desc,
      case when p_sort = 'MOST_EARNED' then earned_amount end desc,
      case when p_sort = 'NAME_ASC' then lower(full_name) end asc,
      case when p_sort = 'OLDEST' then created_at end asc,
      case when p_sort = 'MOST_RECENT' then created_at end desc,
      created_at desc, id asc) from ordered), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', greatest(coalesce(p_page, 1), 1),
      'limit', greatest(1, least(coalesce(p_limit, 10), 50)),
      'total', (select count(*)::integer from matching),
      'totalPages', case when (select count(*) from matching) = 0 then 0 else ceil((select count(*) from matching)::numeric / greatest(1, least(coalesce(p_limit, 10), 50)))::integer end
    )
  );
$$;

create or replace function public.record_admin_referral_payment(
  p_referral_id uuid,
  p_referrer_id uuid,
  p_admin_id uuid,
  p_receipt_public_id text,
  p_receipt_mime_type text,
  p_receipt_original_name text,
  p_receipt_size_bytes bigint
)
returns table(
  outcome text,
  payment_id uuid,
  referral_id uuid,
  referrer_id uuid,
  reference_id text,
  amount numeric,
  payment_status text,
  paid_at timestamptz,
  recorded_by_admin_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_referral public.referrals%rowtype;
  v_payment public.referral_payments%rowtype;
begin
  select * into v_referral
  from public.referrals r
  where r.id = p_referral_id and r.referrer_identity_id = p_referrer_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::uuid, null::uuid,
      null::text, null::numeric, null::text, null::timestamptz, null::uuid;
    return;
  end if;

  if v_referral.payment_status = 'PAID'
     or exists (select 1 from public.referral_payments rp where rp.referral_id = v_referral.id and rp.status = 'PAID') then
    return query select 'ALREADY_PAID'::text, null::uuid, v_referral.id,
      v_referral.referrer_identity_id, v_referral.reference_id, v_referral.reward_amount,
      v_referral.payment_status, null::timestamptz, null::uuid;
    return;
  end if;

  if v_referral.lifecycle_status <> 'COMPLETED'
     or v_referral.payment_status <> 'OUTSTANDING'
     or coalesce(v_referral.reward_amount, 0) <= 0 then
    return query select 'NOT_PAYABLE'::text, null::uuid, v_referral.id,
      v_referral.referrer_identity_id, v_referral.reference_id, v_referral.reward_amount,
      v_referral.payment_status, null::timestamptz, null::uuid;
    return;
  end if;

  if not exists (select 1 from public.referrer_payout_details pd where pd.referrer_id = p_referrer_id) then
    return query select 'PAYOUT_REQUIRED'::text, null::uuid, v_referral.id,
      v_referral.referrer_identity_id, v_referral.reference_id, v_referral.reward_amount,
      v_referral.payment_status, null::timestamptz, null::uuid;
    return;
  end if;

  if nullif(btrim(p_receipt_public_id), '') is null
     or p_receipt_mime_type not in ('application/pdf', 'image/png', 'image/jpeg')
     or nullif(btrim(p_receipt_original_name), '') is null
     or p_receipt_size_bytes is null
     or p_receipt_size_bytes < 1
     or p_receipt_size_bytes > 10485760 then
    return query select 'RECEIPT_INVALID'::text, null::uuid, v_referral.id,
      v_referral.referrer_identity_id, v_referral.reference_id, v_referral.reward_amount,
      v_referral.payment_status, null::timestamptz, null::uuid;
    return;
  end if;

  insert into public.referral_payments(
    referral_id, amount, status, receipt_mime_type, receipt_storage_public_id,
    receipt_storage_resource_type, receipt_original_name, receipt_size_bytes,
    paid_at, recorded_by_admin_id
  ) values (
    v_referral.id, v_referral.reward_amount, 'PAID', p_receipt_mime_type,
    p_receipt_public_id, 'raw', p_receipt_original_name, p_receipt_size_bytes,
    now(), p_admin_id
  ) returning * into v_payment;

  update public.referrals
  set payment_status = 'PAID'
  where id = v_referral.id;

  return query select 'PAID'::text, v_payment.id, v_referral.id,
    v_referral.referrer_identity_id, v_referral.reference_id, v_payment.amount,
    'PAID'::text, v_payment.paid_at, v_payment.recorded_by_admin_id;
end;
$$;

revoke all on function public.list_admin_referrers(text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.list_admin_referrers(text,text,text,integer,integer) to service_role;
revoke all on function public.record_admin_referral_payment(uuid,uuid,uuid,text,text,text,bigint) from public, anon, authenticated;
grant execute on function public.record_admin_referral_payment(uuid,uuid,uuid,text,text,text,bigint) to service_role;

commit;
