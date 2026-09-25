begin;

create table public.customer_saved_properties (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.customer_listings(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, listing_id)
);
create index customer_saved_properties_owner_created_idx
  on public.customer_saved_properties(user_id, created_at desc, listing_id desc);
create index customer_saved_properties_listing_idx
  on public.customer_saved_properties(listing_id);

create function public.save_customer_property(p_owner uuid, p_property_code text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_listing_id uuid;
begin
  if p_owner is null or p_property_code is null or char_length(btrim(p_property_code)) not between 1 and 100
     or p_property_code is distinct from btrim(p_property_code) or p_property_code ~ '[[:cntrl:]]' then
    raise exception using errcode='23514',message='Invalid saved property';
  end if;
  select id into v_listing_id from public.customer_listings
    where listing_code=p_property_code and listing_status='LISTED' for share;
  if not found then raise exception using errcode='P0002',message='Property not available'; end if;
  insert into public.customer_saved_properties(user_id,listing_id) values(p_owner,v_listing_id)
    on conflict (user_id,listing_id) do nothing;
  return true;
end $$;

create function public.remove_customer_saved_property(p_owner uuid, p_property_code text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_listing_id uuid; v_removed integer;
begin
  if p_owner is null or p_property_code is null or char_length(btrim(p_property_code)) not between 1 and 100
     or p_property_code is distinct from btrim(p_property_code) or p_property_code ~ '[[:cntrl:]]' then
    raise exception using errcode='23514',message='Invalid saved property';
  end if;
  select id into v_listing_id from public.customer_listings where listing_code=p_property_code;
  if not found then return false; end if;
  delete from public.customer_saved_properties where user_id=p_owner and listing_id=v_listing_id;
  get diagnostics v_removed = row_count;
  return v_removed=1;
end $$;

create function public.customer_saved_property_states(p_owner uuid, p_property_codes text[]) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_owner is null or p_property_codes is null or cardinality(p_property_codes) not between 1 and 50
     or exists(select 1 from unnest(p_property_codes) code where code is null or char_length(btrim(code)) not between 1 and 100
       or code is distinct from btrim(code) or code ~ '[[:cntrl:]]') then
    raise exception using errcode='23514',message='Invalid saved-property states query';
  end if;
  select coalesce(jsonb_agg(l.listing_code order by l.listing_code),'[]'::jsonb) into v_result
    from public.customer_saved_properties s
    join public.customer_listings l on l.id=s.listing_id and l.listing_status='LISTED'
    where s.user_id=p_owner and l.listing_code=any(p_property_codes);
  return v_result;
end $$;

create function public.list_customer_saved_properties(p_owner uuid, p_query text default '', p_page integer default 1, p_page_size integer default 12) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_search text; v_total integer; v_items jsonb;
begin
  if p_owner is null or p_query is null or char_length(p_query)>100 or p_page not between 1 and 100000 or p_page_size not between 1 and 24 then
    raise exception using errcode='23514',message='Invalid saved-properties query';
  end if;
  v_search := replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_');
  with visible as (
    select l.id from public.customer_saved_properties s join public.customer_listings l on l.id=s.listing_id
    where s.user_id=p_owner and l.listing_status='LISTED' and (p_query='' or
      l.title ilike '%'||v_search||'%' escape '\' or l.listing_code ilike '%'||v_search||'%' escape '\' or
      l.state ilike '%'||v_search||'%' escape '\' or l.city ilike '%'||v_search||'%' escape '\')
  ) select count(*)::integer into v_total from visible;

  select coalesce(jsonb_agg(item order by saved_at desc, listing_id desc),'[]'::jsonb) into v_items from (
    select s.created_at saved_at,l.id listing_id,jsonb_build_object(
      'code',l.listing_code,'title',l.title,'description',l.description,'propertyType',l.property_type,
      'propertySubtype',l.property_subtype,'priceMinor',l.property_cost_minor,'state',l.state,'city',l.city,
      'bedrooms',l.bedrooms,'bathrooms',l.bathrooms,'parkingSpaces',l.parking_spaces,'facilities',l.facilities,
      'listedAt',l.listed_at,'images',coalesce(images.value,'[]'::jsonb)) item
    from public.customer_saved_properties s
    join public.customer_listings l on l.id=s.listing_id and l.listing_status='LISTED'
    left join lateral (select jsonb_agg(i.url order by i.sort_order) value from public.customer_listing_images i where i.listing_id=l.id) images on true
    where s.user_id=p_owner and (p_query='' or
      l.title ilike '%'||v_search||'%' escape '\' or l.listing_code ilike '%'||v_search||'%' escape '\' or
      l.state ilike '%'||v_search||'%' escape '\' or l.city ilike '%'||v_search||'%' escape '\')
    order by s.created_at desc,l.id desc offset (p_page-1)*p_page_size limit p_page_size
  ) page_rows;
  return jsonb_build_object('items',v_items,'page',p_page,'pageSize',p_page_size,'total',v_total,
    'totalPages',case when v_total=0 then 0 else (v_total+p_page_size-1)/p_page_size end);
end $$;

alter table public.customer_saved_properties enable row level security;
revoke all on public.customer_saved_properties from public,anon,authenticated,service_role;
grant select,insert,delete on public.customer_saved_properties to service_role;

revoke all on function public.save_customer_property(uuid,text),public.remove_customer_saved_property(uuid,text),
  public.customer_saved_property_states(uuid,text[]),public.list_customer_saved_properties(uuid,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.save_customer_property(uuid,text),public.remove_customer_saved_property(uuid,text),
  public.customer_saved_property_states(uuid,text[]),public.list_customer_saved_properties(uuid,text,integer,integer)
  to service_role;

commit;
