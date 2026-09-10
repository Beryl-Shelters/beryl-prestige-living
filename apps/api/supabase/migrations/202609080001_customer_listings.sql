begin;

create table public.customer_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_code text not null unique default ('BRL-' || upper(left(replace(gen_random_uuid()::text, '-', ''),16))),
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null check (length(btrim(description)) between 1 and 10000),
  occupancy_type text not null check (occupancy_type in ('Residential','Commercial')),
  ownership_type text not null check (ownership_type in ('Personal','Family')),
  property_type text not null check (property_type in ('Residential','Commercial')),
  property_subtype text not null check (property_subtype in ('Bungalow','Semi-Detached House')),
  has_lien boolean not null,
  bedrooms integer not null check (bedrooms between 0 and 10000),
  bathrooms integer not null check (bathrooms between 0 and 10000),
  parking_spaces integer not null check (parking_spaces between 0 and 10000),
  toilet_count integer check (toilet_count between 0 and 10000),
  units integer check (units between 0 and 10000),
  land_area numeric(14,4) check (land_area between 0 and 1000000000),
  year_built integer check (year_built between 1000 and extract(year from current_date)::integer + 1),
  facilities text[] not null default '{}' check (facilities <@ array['Swimming Pool','Gym/Fitness Center','CCTV','Balcony/Terrace','Air Conditioning','Laundry','Garden','Wi-Fi','Housekeeping Services','Car Park','24Hrs Security']::text[]),
  property_cost_minor bigint not null check (property_cost_minor between 1 and 999999999999999),
  minimum_down_payment_minor bigint not null check (minimum_down_payment_minor between 0 and property_cost_minor),
  location text not null check (length(btrim(location)) between 1 and 300),
  state text not null check (length(btrim(state)) between 1 and 80),
  city text not null check (length(btrim(city)) between 1 and 100),
  longitude numeric(10,7) check (longitude between -180 and 180),
  latitude numeric(10,7) check (latitude between -90 and 90),
  listing_status text not null default 'UNLISTED' check (listing_status in ('UNLISTED','PENDING','LISTED','REJECTED')),
  property_status text not null default 'AVAILABLE' check (property_status = 'AVAILABLE'),
  version integer not null default 1,
  requested_at timestamptz, listed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create index customer_listings_owner_created_idx on public.customer_listings(user_id, created_at desc, id desc);
create index customer_listings_owner_status_idx on public.customer_listings(user_id, listing_status, created_at desc);
create index customer_listings_owner_type_beds_idx on public.customer_listings(user_id, property_type, bedrooms);

create table public.customer_listing_images (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.customer_listings(id) on delete cascade,
  public_id text not null unique, resource_type text not null check (resource_type = 'image'),
  delivery_type text not null check (delivery_type = 'upload'), url text not null check (url like 'https://%'),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  sort_order integer not null check (sort_order between 0 and 23), created_at timestamptz not null default clock_timestamp(),
  unique(listing_id, sort_order)
);
create table public.customer_listing_documents (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.customer_listings(id) on delete cascade,
  batch_id uuid not null, title text not null check (length(btrim(title)) between 1 and 160),
  document_type text not null check (document_type in ('Ownership','Survey','Other')),
  description text not null check (length(btrim(description)) between 1 and 2000),
  sort_order integer not null check (sort_order in (0,1)),
  public_id text not null unique, resource_type text not null check (resource_type = 'raw'),
  delivery_type text not null check (delivery_type = 'authenticated'),
  url text not null default '', mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760), created_at timestamptz not null default clock_timestamp(),
  unique(batch_id, sort_order)
);
create index customer_listing_documents_listing_idx on public.customer_listing_documents(listing_id, created_at, batch_id, sort_order);

-- Durable storage cleanup intents. No secrets, customer files or binary data.
-- Entries also journal uploads before contacting the provider; cleanup checks
-- current references and a grace period before removing an unlinked asset.
create table public.customer_listing_media_cleanup (
  public_id text not null, user_id uuid not null, resource_type text not null check (resource_type in ('image','raw')),
  delivery_type text not null check (delivery_type in ('upload','authenticated')),
  created_at timestamptz not null default clock_timestamp(),
  detached boolean not null default false,
  claimed boolean not null default false,
  primary key (public_id, resource_type, delivery_type)
);
create index customer_listing_cleanup_created_idx on public.customer_listing_media_cleanup(created_at);

-- Claim and attachment serialize on the same intent row. A claimed upload
-- cannot subsequently be attached, even if an abandoned request resumes.
create function public.claim_customer_listing_cleanup(p_owner uuid, p_public_id text, p_resource_type text, p_delivery_type text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_intent public.customer_listing_media_cleanup%rowtype;
begin
  select * into v_intent from public.customer_listing_media_cleanup
    where user_id=p_owner and public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type for update;
  if not found then return false; end if;
  if not v_intent.detached and v_intent.created_at > clock_timestamp()-interval '1 hour' then return false; end if;
  if exists(select 1 from public.customer_listing_images where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type)
     or exists(select 1 from public.customer_listing_documents where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type) then return false; end if;
  update public.customer_listing_media_cleanup set claimed=true
    where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type;
  return true;
end $$;

create function public.touch_customer_listing() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (new.id,new.user_id,new.listing_code,new.created_at) is distinct from (old.id,old.user_id,old.listing_code,old.created_at) then
    raise exception using errcode='23514', message='Listing identity is immutable';
  end if;
  new.updated_at := clock_timestamp(); new.version := old.version + 1; return new;
end $$;
create trigger customer_listing_updated before update on public.customer_listings for each row execute function public.touch_customer_listing();

-- One transactional boundary is necessary for ordered media + content, the
-- two-document batch, and state transitions. No external provider I/O in SQL.
create function public.mutate_customer_listing(p_owner uuid, p_id uuid, p_action text, p_version integer, p_content jsonb default '{}', p_images jsonb default '[]', p_documents jsonb default '[]')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old public.customer_listings%rowtype; v_new public.customer_listings%rowtype; v_id uuid; v_batch uuid := gen_random_uuid(); v_asset jsonb; v_claimed boolean;
begin
  if p_owner is null or p_action is null or p_action not in ('CREATE','EDIT','DELETE','REQUEST_APPROVAL','UNLIST','DOCUMENTS') then
    raise exception using errcode='23514', message='Invalid listing action';
  end if;
  if jsonb_typeof(p_content) is distinct from 'object'
     or jsonb_typeof(p_images) is distinct from 'array'
     or jsonb_typeof(p_documents) is distinct from 'array' then
    raise exception using errcode='23514', message='Invalid listing payload';
  end if;
  if exists(select 1 from jsonb_array_elements(p_images || p_documents) e(value) where jsonb_typeof(e.value) is distinct from 'object') then
    raise exception using errcode='23514', message='Invalid media metadata';
  end if;
  -- Browser input is never passed here directly: new image UUIDs are generated
  -- by the API, retained metadata is resolved from the owner's current listing.
  -- Lock all new-upload intents in stable order before they can be attached.
  if p_action in ('CREATE','EDIT','DOCUMENTS') then
    for v_asset in select value from jsonb_array_elements(case when p_action='DOCUMENTS' then p_documents else p_images end)
      order by value->>'public_id',value->>'resource_type',value->>'delivery_type'
    loop
      if p_action='EDIT' and exists(select 1 from public.customer_listing_images i join public.customer_listings l on l.id=i.listing_id
        where l.id=p_id and l.user_id=p_owner and l.version=p_version and i.id::text=v_asset->>'id'
          and i.public_id=v_asset->>'public_id' and i.resource_type=v_asset->>'resource_type' and i.delivery_type=v_asset->>'delivery_type') then continue; end if;
      select claimed into v_claimed from public.customer_listing_media_cleanup
        where user_id=p_owner and public_id=v_asset->>'public_id' and resource_type=v_asset->>'resource_type' and delivery_type=v_asset->>'delivery_type' for update;
      if not found or v_claimed then raise exception using errcode='23514', message='Upload is not available'; end if;
    end loop;
  end if;
  if p_action = 'CREATE' then
    v_new := jsonb_populate_record(null::public.customer_listings, p_content);
    insert into public.customer_listings(user_id,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,units,land_area,year_built,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,longitude,latitude)
    values(p_owner,v_new.title,v_new.description,v_new.occupancy_type,v_new.ownership_type,v_new.property_type,v_new.property_subtype,v_new.has_lien,v_new.bedrooms,v_new.bathrooms,v_new.parking_spaces,v_new.units,v_new.land_area,v_new.year_built,v_new.facilities,v_new.property_cost_minor,v_new.minimum_down_payment_minor,v_new.location,v_new.state,v_new.city,v_new.longitude,v_new.latitude)
    returning id into v_id;
  else
    select * into v_old from public.customer_listings where id=p_id and user_id=p_owner for update;
    if not found then raise exception using errcode='P0002', message='Listing not found'; end if;
    if p_version is distinct from v_old.version then raise exception using errcode='40001', message='Listing changed'; end if;
    v_id := v_old.id;
    if p_action='EDIT' then
      if v_old.listing_status not in ('UNLISTED','REJECTED') then raise exception using errcode='23514', message='Unlist before editing'; end if;
      v_new := jsonb_populate_record(null::public.customer_listings, p_content);
      update public.customer_listings set (title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,units,land_area,year_built,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,longitude,latitude)
      = (v_new.title,v_new.description,v_new.occupancy_type,v_new.ownership_type,v_new.property_type,v_new.property_subtype,v_new.has_lien,v_new.bedrooms,v_new.bathrooms,v_new.parking_spaces,v_new.units,v_new.land_area,v_new.year_built,v_new.facilities,v_new.property_cost_minor,v_new.minimum_down_payment_minor,v_new.location,v_new.state,v_new.city,v_new.longitude,v_new.latitude) where id=v_id;
    elsif p_action='REQUEST_APPROVAL' then
      if v_old.listing_status <> 'UNLISTED' or not exists(select 1 from public.customer_listing_images where listing_id=v_id) then raise exception using errcode='23514', message='Listing is not ready'; end if;
      update public.customer_listings set listing_status='PENDING', requested_at=clock_timestamp() where id=v_id;
    elsif p_action='UNLIST' then
      if v_old.listing_status <> 'PENDING' then raise exception using errcode='23514', message='Listing cannot be unlisted'; end if;
      update public.customer_listings set listing_status='UNLISTED', requested_at=null where id=v_id;
    elsif p_action='DOCUMENTS' then
      if v_old.listing_status not in ('UNLISTED','REJECTED') then raise exception using errcode='23514', message='Unlist before editing'; end if;
      if jsonb_array_length(p_documents) <> 2 then raise exception using errcode='23514', message='Two documents are required'; end if;
      insert into public.customer_listing_documents(listing_id,batch_id,title,document_type,description,sort_order,public_id,resource_type,delivery_type,mime_type,size_bytes)
      select v_id,v_batch,d.title,d.document_type,d.description,(e.ordinality-1)::integer,d.public_id,d.resource_type,d.delivery_type,d.mime_type,d.size_bytes
      from jsonb_array_elements(p_documents) with ordinality e(value,ordinality)
      cross join lateral jsonb_to_record(e.value) d(title text,document_type text,description text,public_id text,resource_type text,delivery_type text,mime_type text,size_bytes bigint);
      update public.customer_listings set updated_at=clock_timestamp() where id=v_id;
    elsif p_action='DELETE' then
      insert into public.customer_listing_media_cleanup(public_id,user_id,resource_type,delivery_type,detached)
      select public_id,p_owner,resource_type,delivery_type,true from public.customer_listing_images where listing_id=v_id
      union all select public_id,p_owner,resource_type,delivery_type,true from public.customer_listing_documents where listing_id=v_id
      on conflict (public_id,resource_type,delivery_type) do update set detached=true;
      delete from public.customer_listings where id=v_id;
    else raise exception using errcode='23514', message='Invalid listing action';
    end if;
  end if;
  if p_action in ('CREATE','EDIT') then
    if jsonb_array_length(p_images) not between 1 and 24 then raise exception using errcode='23514', message='Listing images are required'; end if;
    insert into public.customer_listing_media_cleanup(public_id,user_id,resource_type,delivery_type,detached)
    select public_id,p_owner,resource_type,delivery_type,true from public.customer_listing_images i where listing_id=v_id
      and not exists(select 1 from jsonb_array_elements(p_images) e(value) where e.value->>'public_id'=i.public_id and e.value->>'resource_type'=i.resource_type and e.value->>'delivery_type'=i.delivery_type)
    on conflict (public_id,resource_type,delivery_type) do update set detached=true;
    delete from public.customer_listing_images where listing_id=v_id;
    insert into public.customer_listing_images(id,listing_id,public_id,resource_type,delivery_type,url,mime_type,size_bytes,sort_order)
    select i.id,v_id,i.public_id,i.resource_type,i.delivery_type,i.url,i.mime_type,i.size_bytes,(e.ordinality-1)::integer
    from jsonb_array_elements(p_images) with ordinality e(value,ordinality)
    cross join lateral jsonb_to_record(e.value) i(id uuid,public_id text,resource_type text,delivery_type text,url text,mime_type text,size_bytes bigint);
  end if;
  -- Acknowledgement belongs in this transaction, not a later API round trip
  -- that could erase a newer edit/delete's cleanup intent.
  if p_action in ('CREATE','EDIT','DOCUMENTS') then
    delete from public.customer_listing_media_cleanup c where c.user_id=p_owner and (
      exists(select 1 from public.customer_listing_images i where i.listing_id=v_id and (i.public_id,i.resource_type,i.delivery_type)=(c.public_id,c.resource_type,c.delivery_type))
      or exists(select 1 from public.customer_listing_documents d where d.listing_id=v_id and (d.public_id,d.resource_type,d.delivery_type)=(c.public_id,c.resource_type,c.delivery_type)));
  end if;
  return v_id;
end $$;

alter table public.customer_listings enable row level security;
alter table public.customer_listing_images enable row level security;
alter table public.customer_listing_documents enable row level security;
alter table public.customer_listing_media_cleanup enable row level security;
revoke all on public.customer_listings, public.customer_listing_images, public.customer_listing_documents, public.customer_listing_media_cleanup from public, anon, authenticated;
grant all on public.customer_listings, public.customer_listing_images, public.customer_listing_documents, public.customer_listing_media_cleanup to service_role;
revoke all on function public.touch_customer_listing() from public, anon, authenticated;
revoke all on function public.mutate_customer_listing(uuid,uuid,text,integer,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.mutate_customer_listing(uuid,uuid,text,integer,jsonb,jsonb,jsonb) to service_role;
revoke all on function public.claim_customer_listing_cleanup(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_customer_listing_cleanup(uuid,text,text,text) to service_role;
commit;
