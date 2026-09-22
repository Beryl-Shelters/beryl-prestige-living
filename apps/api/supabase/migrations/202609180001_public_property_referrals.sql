begin;

-- Keep owner-only create_customer_referral_link intact. The existing unique index
-- already enforces one link per referrer and listing, regardless of ownership.
create function public.create_listed_property_referral_link(p_referrer uuid, p_property_code text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_listing uuid; v_code text;
begin
  if p_referrer is null or p_property_code is null or length(p_property_code) > 100 then
    raise exception using errcode='23514',message='Invalid referral';
  end if;
  select id into v_listing from public.customer_listings
    where listing_code=p_property_code and listing_status='LISTED' for share;
  if not found then raise exception using errcode='P0002',message='Listing not found'; end if;
  insert into public.customer_referral_links(user_id,referral_code,referral_type,listing_id,property_code)
    values(p_referrer,null,'PROPERTY',v_listing,p_property_code)
    on conflict (user_id,listing_id) where referral_type='PROPERTY' do nothing returning referral_code into v_code;
  if v_code is null then
    select referral_code into v_code from public.customer_referral_links
      where user_id=p_referrer and referral_type='PROPERTY' and listing_id=v_listing;
  end if;
  return jsonb_build_object('id',v_code,'referralType','PROPERTY','propertyCode',p_property_code);
end $$;

revoke all on function public.create_listed_property_referral_link(uuid,text) from public,anon,authenticated;
grant execute on function public.create_listed_property_referral_link(uuid,text) to service_role;
commit;
