begin;

-- A row represents an offline purchase already verified by Beryl operations.
-- Snapshot values remain authoritative if the originating listing later
-- changes visibility, is edited, or is deleted.
create table public.customer_completed_purchases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  source_listing_id uuid references public.customer_listings(id) on delete set null,
  property_code text not null check (char_length(property_code) between 1 and 80 and property_code=btrim(property_code) and property_code !~ '[[:cntrl:]]'),
  title text not null check (char_length(title) between 1 and 160 and title=btrim(title) and title !~ '[[:cntrl:]]'),
  state text not null check (char_length(state) between 1 and 80 and state=btrim(state) and state !~ '[[:cntrl:]]'),
  property_type text not null check (property_type in ('Residential','Commercial')),
  property_subtype text check (property_subtype is null or property_subtype in
    ('Bungalow','Semi-Detached House','Block of flats','Terraced Duplexes',
     'Terraced Bungalows','Semi-Detached Bungalows','Detached Bungalows','Detached Duplexes')),
  price_minor bigint not null check (price_minor between 1 and 999999999999999),
  closed_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint completed_purchase_type_check check (
    (property_type='Residential' and property_subtype is not null)
    or (property_type='Commercial' and property_subtype is null)
  )
);
create index customer_completed_purchases_owner_closed_idx
  on public.customer_completed_purchases(customer_id,closed_at desc,id desc);

create function public.list_customer_completed_purchases(
  p_owner uuid,p_query text default '',p_page integer default 1,p_page_size integer default 10
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_search text; v_total bigint; v_items jsonb;
begin
  if p_owner is null or p_query is null or char_length(p_query)>100
     or p_page not between 1 and 100000 or p_page_size not between 1 and 100 then
    raise exception using errcode='23514',message='Invalid completed-purchase query';
  end if;
  v_search := '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  select count(*) into v_total from public.customer_completed_purchases p
    where p.customer_id=p_owner and (p.title ilike v_search or p.property_code ilike v_search or p.state ilike v_search);
  select coalesce(jsonb_agg(jsonb_build_object(
    'propertyCode',p.property_code,'title',p.title,'state',p.state,
    'propertyType',p.property_type,'propertySubtype',p.property_subtype,
    'priceMinor',p.price_minor,'closedAt',p.closed_at
  ) order by p.closed_at desc,p.id desc),'[]'::jsonb) into v_items
  from (select property_code,title,state,property_type,property_subtype,price_minor,closed_at,id
    from public.customer_completed_purchases
    where customer_id=p_owner and (title ilike v_search or property_code ilike v_search or state ilike v_search)
    order by closed_at desc,id desc offset (p_page-1)*p_page_size limit p_page_size) p;
  return jsonb_build_object('items',v_items,'total',v_total);
end $$;

alter table public.customer_completed_purchases enable row level security;
revoke all on public.customer_completed_purchases from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.customer_completed_purchases to service_role;
revoke all on function public.list_customer_completed_purchases(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.list_customer_completed_purchases(uuid,text,integer,integer) to service_role;

commit;
