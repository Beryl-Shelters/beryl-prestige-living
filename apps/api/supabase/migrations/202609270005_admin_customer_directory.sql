begin;

-- Read-only Admin projections over canonical customer classifications and
-- persisted activity. Activity is not a formal customer profile.
create function public.list_admin_customers(
  p_query text default '',
  p_account_type text default 'ALL',
  p_profile_type text default 'ALL',
  p_sort text default 'NEWEST',
  p_page integer default 1,
  p_page_size integer default 6
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_query is null or char_length(p_query)>100
     or p_account_type not in ('ALL','INVESTOR','PROPERTY_DEVELOPER','LANDLORD','REGISTERED_AGENT','FREELANCE_AGENT')
     or p_profile_type not in ('ALL','PERSONAL','BUSINESS')
     or p_sort not in ('NEWEST','OLDEST','NAME_ASC','NAME_DESC')
     or p_page not between 1 and 100000 or p_page_size not between 1 and 100 then
    raise exception using errcode='23514',message='Invalid Admin customer query';
  end if;

  with base as (
    select p.id,
      coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email) as full_name,
      p.email,p.phone_number_normalized as phone,p.created_at,p.account_type,p.profile_type,
      (coalesce(pa.saved_count,0)+coalesce(pa.completed_count,0)>0) as has_property_activity,
      (coalesce(la.listing_count,0)>0) as has_listing_activity,
      (coalesce(ra.referral_link_count,0)>0) as has_referral_activity,
      ra.referral_code,coalesce(k.status,'NOT_SUBMITTED') as kyc_status
    from public.customer_profiles p
    left join lateral (
      select count(*) filter(where kind='SAVED')::integer as saved_count,
        count(*) filter(where kind='COMPLETED')::integer as completed_count
      from (
        select 'SAVED'::text as kind from public.customer_saved_properties sp where sp.user_id=p.id
        union all
        select 'COMPLETED'::text from public.customer_completed_purchases cp where cp.customer_id=p.id
      ) property_activity
    ) pa on true
    left join lateral (
      select count(*)::integer as listing_count from public.customer_listings l where l.user_id=p.id
    ) la on true
    left join lateral (
      select count(*)::integer as referral_link_count,
        (array_agg(rl.referral_code order by (rl.referral_type='SELLER') desc,rl.created_at,rl.id))[1] as referral_code
      from public.customer_referral_links rl where rl.user_id=p.id
    ) ra on true
    left join lateral (
      select ks.status from public.customer_kyc_submissions ks where ks.user_id=p.id
      order by ks.submitted_at desc,ks.id desc limit 1
    ) k on true
  ), summary as (
    select count(*)::integer as total_users,
      count(*) filter(where has_property_activity)::integer as property_activity_customers,
      count(*) filter(where has_listing_activity)::integer as listing_activity_customers,
      count(*) filter(where has_referral_activity)::integer as referral_activity_customers
    from base
  ), matched as (
    select * from base
    where (btrim(p_query)='' or strpos(lower(full_name),lower(btrim(p_query)))>0
      or strpos(lower(email),lower(btrim(p_query)))>0
      or strpos(coalesce(phone,''),btrim(p_query))>0)
      and (p_account_type='ALL' or account_type=p_account_type)
      and (p_profile_type='ALL' or profile_type=p_profile_type)
  ), matched_total as (
    select count(*)::integer as total from matched
  ), paged as (
    select * from matched
    order by
      case when p_sort='NEWEST' then created_at end desc,
      case when p_sort='OLDEST' then created_at end asc,
      case when p_sort='NAME_ASC' then lower(full_name) end asc,
      case when p_sort='NAME_DESC' then lower(full_name) end desc,
      id asc
    offset (p_page-1)*p_page_size limit p_page_size
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'fullName',full_name,'email',email,'phone',phone,'joinedAt',created_at,
      'accountType',account_type,'profileType',profile_type,
      'hasPropertyActivity',has_property_activity,'hasListingActivity',has_listing_activity,
      'hasReferralActivity',has_referral_activity,'referralCode',referral_code,'kycStatus',kyc_status
    ) order by
      case when p_sort='NEWEST' then created_at end desc,
      case when p_sort='OLDEST' then created_at end asc,
      case when p_sort='NAME_ASC' then lower(full_name) end asc,
      case when p_sort='NAME_DESC' then lower(full_name) end desc,
      id asc),'[]'::jsonb) as value
    from paged
  )
  select jsonb_build_object(
    'summary',jsonb_build_object('totalUsers',s.total_users,
      'propertyActivityCustomers',s.property_activity_customers,
      'listingActivityCustomers',s.listing_activity_customers,
      'referralActivityCustomers',s.referral_activity_customers),
    'items',i.value,'page',p_page,'pageSize',p_page_size,'total',m.total,
    'totalPages',case when m.total=0 then 0 else ((m.total+p_page_size-1)/p_page_size) end
  ) into v_result from summary s cross join matched_total m cross join items i;
  return v_result;
end $$;

create function public.read_admin_customer(p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_customer is null then raise exception using errcode='23514',message='Invalid customer'; end if;

  select jsonb_build_object(
    'id',p.id,
    'fullName',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email),
    'email',p.email,'phone',p.phone_number_normalized,'joinedAt',p.created_at,
    'accountType',p.account_type,'profileType',p.profile_type,
    'hasPropertyActivity',coalesce(pa.saved_count,0)+coalesce(pa.completed_count,0)>0,
    'hasListingActivity',coalesce(la.listing_count,0)>0,
    'hasReferralActivity',coalesce(ra.referral_link_count,0)>0,
    'referralCode',ra.referral_code,'kycStatus',coalesce(k.status,'NOT_SUBMITTED'),
    'propertyActivity',jsonb_build_object(
      'hasActivity',coalesce(pa.saved_count,0)+coalesce(pa.completed_count,0)>0,
      'firstActivityAt',pa.first_activity_at,'savedProperties',coalesce(pa.saved_count,0),
      'completedPurchases',coalesce(pa.completed_count,0)
    ),
    'listingActivity',jsonb_build_object(
      'hasActivity',coalesce(la.listing_count,0)>0,
      'firstListingAt',la.first_listing_at,'listingCount',coalesce(la.listing_count,0)
    ),
    'referralActivity',jsonb_build_object(
      'hasActivity',coalesce(ra.referral_link_count,0)>0,
      'firstReferralLinkAt',ra.first_referral_link_at,
      'referralLinkCount',coalesce(ra.referral_link_count,0),'referralCode',ra.referral_code
    ),
    'businessInformation',jsonb_build_object(
      'exists',bp.user_id is not null,'companyName',bp.company_name,
      'companyAddress',nullif(concat_ws(', ',nullif(btrim(bp.street_address),''),nullif(btrim(bp.city),''),
        nullif(btrim(bp.state),''),nullif(btrim(bp.country),'')), '')
    )
  ) into v_result
  from public.customer_profiles p
  left join public.customer_business_profiles bp on bp.user_id=p.id
  left join lateral (
    select min(activity_at) as first_activity_at,
      count(*) filter(where kind='SAVED')::integer as saved_count,
      count(*) filter(where kind='COMPLETED')::integer as completed_count
    from (
      select sp.created_at as activity_at,'SAVED'::text as kind from public.customer_saved_properties sp where sp.user_id=p.id
      union all
      select cp.closed_at,'COMPLETED'::text from public.customer_completed_purchases cp where cp.customer_id=p.id
    ) property_activity
  ) pa on true
  left join lateral (
    select count(*)::integer as listing_count,min(l.created_at) as first_listing_at
    from public.customer_listings l where l.user_id=p.id
  ) la on true
  left join lateral (
    select count(*)::integer as referral_link_count,min(rl.created_at) as first_referral_link_at,
      (array_agg(rl.referral_code order by (rl.referral_type='SELLER') desc,rl.created_at,rl.id))[1] as referral_code
    from public.customer_referral_links rl where rl.user_id=p.id
  ) ra on true
  left join lateral (
    select ks.status from public.customer_kyc_submissions ks where ks.user_id=p.id
    order by ks.submitted_at desc,ks.id desc limit 1
  ) k on true
  where p.id=p_customer;

  if v_result is null then raise exception using errcode='P0002',message='Customer not found'; end if;
  return v_result;
end $$;

revoke all on function public.list_admin_customers(text,text,text,text,integer,integer),
  public.read_admin_customer(uuid) from public,anon,authenticated;
grant execute on function public.list_admin_customers(text,text,text,text,integer,integer),
  public.read_admin_customer(uuid) to service_role;

commit;
