begin;

create table public.customer_referral_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  referral_code text not null unique check (referral_code ~ '^REF-[A-HJ-NP-Z2-9]{6}$'),
  referral_type text not null check (referral_type in ('PROPERTY','SELLER')),
  listing_id uuid,
  property_code text,
  created_at timestamptz not null default clock_timestamp(),
  check ((referral_type='PROPERTY' and listing_id is not null and property_code is not null)
    or (referral_type='SELLER' and listing_id is null and property_code is null))
);
create unique index customer_referral_links_property_once on public.customer_referral_links(user_id,listing_id) where referral_type='PROPERTY';
create unique index customer_referral_links_seller_once on public.customer_referral_links(user_id) where referral_type='SELLER';
create index customer_referral_links_owner_created on public.customer_referral_links(user_id,created_at desc,id desc);

create function public.assign_customer_referral_link_code() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if new.referral_code is null then new.referral_code:=public.generate_display_code('REF'); end if;
  return new;
end $$;
create trigger customer_referral_link_code_before_insert before insert on public.customer_referral_links
for each row execute function public.assign_customer_referral_link_code();

create function public.create_customer_referral_link(p_owner uuid,p_type text,p_listing uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_code text; v_property_code text;
begin
  if p_owner is null or p_type not in ('PROPERTY','SELLER') or
     (p_type='PROPERTY' and p_listing is null) or (p_type='SELLER' and p_listing is not null) then
    raise exception using errcode='23514',message='Invalid referral';
  end if;
  if p_type='PROPERTY' then
    select listing_code into v_property_code from public.customer_listings where id=p_listing and user_id=p_owner;
    if not found then raise exception using errcode='P0002',message='Listing not found'; end if;
    insert into public.customer_referral_links(user_id,referral_code,referral_type,listing_id,property_code)
      values(p_owner,null,p_type,p_listing,v_property_code)
      on conflict (user_id,listing_id) where referral_type='PROPERTY' do nothing returning referral_code into v_code;
    if v_code is null then select referral_code into v_code from public.customer_referral_links
      where user_id=p_owner and referral_type='PROPERTY' and listing_id=p_listing; end if;
  else
    insert into public.customer_referral_links(user_id,referral_code,referral_type)
      values(p_owner,null,p_type)
      on conflict (user_id) where referral_type='SELLER' do nothing returning referral_code into v_code;
    if v_code is null then select referral_code into v_code from public.customer_referral_links
      where user_id=p_owner and referral_type='SELLER'; end if;
  end if;
  return jsonb_build_object('id',v_code,'referralType',p_type,'propertyCode',v_property_code);
end $$;

create function public.list_customer_referrals(p_owner uuid,p_page integer default 1,p_page_size integer default 10) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if p_owner is null or p_page not between 1 and 100000 or p_page_size not between 1 and 50 then
    raise exception using errcode='23514',message='Invalid referral query';
  end if;
  return jsonb_build_object('summary',jsonb_build_object('availableBalance',0,'totalEarnings',0,
    'referrals',0,'propertiesSold',0),'items','[]'::jsonb,'page',p_page,'pageSize',p_page_size,
    'total',0,'totalPages',0);
end $$;

alter table public.customer_referral_links enable row level security;
revoke all on public.customer_referral_links from public,anon,authenticated,service_role;
revoke all on function public.assign_customer_referral_link_code() from public,anon,authenticated,service_role;
revoke all on function public.create_customer_referral_link(uuid,text,uuid),
  public.list_customer_referrals(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.create_customer_referral_link(uuid,text,uuid),
  public.list_customer_referrals(uuid,integer,integer) to service_role;
commit;
