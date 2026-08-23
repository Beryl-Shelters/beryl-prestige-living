begin;

create or replace function public.list_admin_customer_users(
  p_query text default null,
  p_role text default null,
  p_verification text default null,
  p_sort text default 'MOST_RECENT',
  p_page integer default 1,
  p_limit integer default 6
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with customer_base as (
    select
      p.id,
      coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Unnamed customer') as full_name,
      p.email,
      p.phone_number,
      p.referral_code,
      p.email_verified_at,
      p.created_at,
      exists (
        select 1 from public.user_personas up
        where up.user_id = p.id and up.persona_type = 'BUYER' and up.onboarding_status = 'COMPLETED'
      ) as buyer_activated,
      exists (
        select 1 from public.user_personas up
        where up.user_id = p.id and up.persona_type = 'SELLER_DEVELOPER' and up.onboarding_status = 'COMPLETED'
      ) as seller_activated,
      nullif(btrim(p.referral_code), '') is not null as referrer_activated
    from public.profiles p
    where exists (select 1 from public.customer_records cr where cr.user_id = p.id)
  ),
  counts as (
    select
      count(*)::integer as total_users,
      count(*) filter (where buyer_activated)::integer as buyer_profiles,
      count(*) filter (where seller_activated)::integer as seller_profiles,
      count(*) filter (where referrer_activated)::integer as referrer_profiles
    from customer_base
  ),
  filtered as (
    select * from customer_base c
    where (
      nullif(btrim(p_query), '') is null
      or c.full_name ilike '%' || btrim(p_query) || '%'
      or c.email ilike '%' || btrim(p_query) || '%'
      or c.phone_number ilike '%' || btrim(p_query) || '%'
    )
    and (p_role is null
      or (p_role = 'BUYER' and c.buyer_activated)
      or (p_role = 'SELLER' and c.seller_activated)
      or (p_role = 'REFERRER' and c.referrer_activated))
    and (p_verification is null
      or (p_verification = 'VERIFIED' and c.email_verified_at is not null)
      or (p_verification = 'UNVERIFIED' and c.email_verified_at is null))
  ),
  filtered_count as (select count(*)::integer as total from filtered),
  page_rows as (
    select * from filtered
    order by
      case when p_sort = 'NAME_ASC' then lower(full_name) end asc,
      case when p_sort = 'NAME_DESC' then lower(full_name) end desc,
      case when p_sort = 'OLDEST' then created_at end asc,
      case when p_sort = 'MOST_RECENT' then created_at end desc,
      id asc
    offset (greatest(p_page, 1) - 1) * greatest(p_limit, 1)
    limit greatest(p_limit, 1)
  )
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'totalUsers', counts.total_users,
      'buyerProfiles', counts.buyer_profiles,
      'sellerProfiles', counts.seller_profiles,
      'referrerProfiles', counts.referrer_profiles
    ),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'fullName', r.full_name,
      'email', r.email,
      'phone', r.phone_number,
      'referralCode', r.referral_code,
      'verified', r.email_verified_at is not null,
      'joinedAt', r.created_at,
      'roles', array_remove(array[
        case when r.buyer_activated then 'BUYER' end,
        case when r.seller_activated then 'SELLER' end,
        case when r.referrer_activated then 'REFERRER' end
      ], null)
    ) order by
      case when p_sort = 'NAME_ASC' then lower(r.full_name) end asc,
      case when p_sort = 'NAME_DESC' then lower(r.full_name) end desc,
      case when p_sort = 'OLDEST' then r.created_at end asc,
      case when p_sort = 'MOST_RECENT' then r.created_at end desc,
      r.id asc) from page_rows r), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', greatest(p_page, 1),
      'limit', greatest(p_limit, 1),
      'total', filtered_count.total,
      'totalPages', case when filtered_count.total = 0 then 0 else ceil(filtered_count.total::numeric / greatest(p_limit, 1))::integer end
    )
  )
  from counts cross join filtered_count;
$$;

revoke all on function public.list_admin_customer_users(text,text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.list_admin_customer_users(text,text,text,text,integer,integer) to service_role;

commit;
