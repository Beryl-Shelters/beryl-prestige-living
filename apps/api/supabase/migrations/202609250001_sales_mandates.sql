-- 202609250001_sales_mandates.sql
begin;

create table public.sales_mandates (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null unique references public.customer_listings(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    seller_title text not null check (char_length(seller_title) <= 50),
    surname text not null check (char_length(surname) <= 100),
    first_names text not null check (char_length(first_names) <= 150),
    gender text not null check (char_length(gender) <= 20),
    email text not null check (char_length(email) <= 255),
    telephone text not null check (char_length(telephone) <= 50),
    date_of_birth date not null,
    nationality text not null check (char_length(nationality) <= 100),
    post_code text not null check (char_length(post_code) <= 20),
    address text not null check (char_length(address) <= 500),
    property_development_name text not null check (char_length(property_development_name) <= 160),
    document_title text not null check (char_length(document_title) <= 200),
    signer_name text not null check (char_length(btrim(signer_name)) between 1 and 250),
    signer_address text not null check (char_length(btrim(signer_address)) between 1 and 500),
    signer_email text not null check (char_length(btrim(signer_email)) between 3 and 255),
    mandate_date date not null default current_date,
    agreed_to_mandate boolean not null default false,
    signature_public_id text not null check (char_length(btrim(signature_public_id)) between 1 and 200),
    signature_mime_type text not null check (signature_mime_type = 'image/png'),
    signature_size_bytes bigint not null check (signature_size_bytes between 1 and 2097152),
    signed_at timestamptz not null default clock_timestamp(),
    submitted_at timestamptz,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp()
);

create table public.sales_mandate_documents (
    id uuid primary key default gen_random_uuid(),
    mandate_id uuid not null references public.sales_mandates(id) on delete cascade,
    title text not null check (char_length(btrim(title)) between 1 and 160),
    public_id text not null check (char_length(btrim(public_id)) between 1 and 200),
    resource_type text not null check (resource_type = 'raw'),
    delivery_type text not null check (delivery_type = 'authenticated'),
    mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
    size_bytes bigint not null check (size_bytes between 1 and 10485760),
    sort_order integer not null check (sort_order between 0 and 9),
    created_at timestamptz not null default clock_timestamp(),
    unique (mandate_id, public_id, resource_type, delivery_type),
    unique (mandate_id, sort_order)
);

alter table public.customer_listings add column registered_title_document text check (char_length(registered_title_document) <= 200);
alter table public.customer_listings add column additional_information text check (char_length(additional_information) <= 5000);

-- Update cleanup claim logic to check mandate assets
create or replace function public.claim_customer_listing_cleanup(p_owner uuid, p_public_id text, p_resource_type text, p_delivery_type text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_intent public.customer_listing_media_cleanup%rowtype;
begin
  select * into v_intent from public.customer_listing_media_cleanup
    where user_id=p_owner and public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type for update;
  if not found then return false; end if;
  if not v_intent.detached and v_intent.created_at > clock_timestamp()-interval '1 hour' then return false; end if;
  if exists(select 1 from public.customer_listing_images where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type)
     or exists(select 1 from public.customer_listing_documents where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type)
     or exists(select 1 from public.sales_mandate_documents where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type)
     or exists(select 1 from public.sales_mandates where signature_public_id=p_public_id and p_resource_type='raw' and p_delivery_type='authenticated') then
    return false;
  end if;
  update public.customer_listing_media_cleanup set claimed=true
    where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type;
  return true;
end $$;

-- RPC for final submission
create or replace function public.submit_customer_listing(p_owner uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old public.customer_listings;
  v_mandate public.sales_mandates;
  v_doc_count integer;
begin
  select * into v_old from public.customer_listings where id = p_id and user_id = p_owner for update;
  if not found then raise exception using errcode='P0002', message='Listing not found'; end if;
  if v_old.listing_status not in ('UNLISTED', 'REJECTED') then raise exception using errcode='23514', message='Listing is not eligible for submission'; end if;

  -- Required Property Data completeness
  if v_old.title is null or char_length(trim(v_old.title)) = 0 or
     v_old.description is null or char_length(trim(v_old.description)) = 0 or
     v_old.occupancy_type is null or v_old.ownership_type is null or
     v_old.property_type is null or v_old.property_subtype is null or
     v_old.has_lien is null or
     v_old.bedrooms is null or v_old.bedrooms < 0 or
     v_old.bathrooms is null or v_old.bathrooms < 0 or
     v_old.parking_spaces is null or v_old.parking_spaces < 0 or
     v_old.property_cost_minor is null or v_old.property_cost_minor <= 0 or
     v_old.minimum_down_payment_minor is null or v_old.minimum_down_payment_minor < 0 or
     v_old.minimum_down_payment_minor > v_old.property_cost_minor or
     v_old.location is null or char_length(trim(v_old.location)) = 0 or
     v_old.state is null or v_old.city is null or char_length(trim(v_old.city)) = 0 then
    raise exception using errcode='23514', message='Property data is incomplete';
  end if;

  if not exists(select 1 from public.customer_listing_images where listing_id = p_id) then
    raise exception using errcode='23514', message='Listing images are required';
  end if;

  select * into v_mandate from public.sales_mandates where listing_id = p_id and user_id = p_owner for update;
  if not found then raise exception using errcode='23514', message='Sales mandate is missing'; end if;

  -- Verify all required mandate fields
  if v_mandate.seller_title is null or char_length(trim(v_mandate.seller_title)) = 0 or
     v_mandate.surname is null or char_length(trim(v_mandate.surname)) = 0 or
     v_mandate.first_names is null or char_length(trim(v_mandate.first_names)) = 0 or
     v_mandate.gender is null or char_length(trim(v_mandate.gender)) = 0 or
     v_mandate.email is null or char_length(trim(v_mandate.email)) = 0 or
     v_mandate.telephone is null or char_length(trim(v_mandate.telephone)) = 0 or
     v_mandate.date_of_birth is null or
     v_mandate.nationality is null or char_length(trim(v_mandate.nationality)) = 0 or
     v_mandate.post_code is null or char_length(trim(v_mandate.post_code)) = 0 or
     v_mandate.address is null or char_length(trim(v_mandate.address)) = 0 or
     v_mandate.property_development_name is null or char_length(trim(v_mandate.property_development_name)) = 0 or
     v_mandate.document_title is null or char_length(trim(v_mandate.document_title)) = 0 or
     v_mandate.signer_name is null or char_length(trim(v_mandate.signer_name)) = 0 or
     v_mandate.signer_address is null or char_length(trim(v_mandate.signer_address)) = 0 or
     v_mandate.signer_email is null or char_length(trim(v_mandate.signer_email)) = 0 or
     v_mandate.mandate_date is null or
     v_mandate.agreed_to_mandate <> true or
     v_mandate.signature_public_id is null or char_length(trim(v_mandate.signature_public_id)) = 0 or
     v_mandate.signature_mime_type <> 'image/png' or
     v_mandate.signature_size_bytes <= 0 or v_mandate.signature_size_bytes > 2097152 or
     v_mandate.signed_at is null then
    raise exception using errcode='23514', message='Sales mandate is incomplete';
  end if;

  select count(*) into v_doc_count from public.sales_mandate_documents where mandate_id = v_mandate.id;
  if v_doc_count not between 1 and 10 then raise exception using errcode='23514', message='Between 1 and 10 mandate documents are required'; end if;

  update public.customer_listings set listing_status = 'PENDING', requested_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp() where id = p_id;
  update public.sales_mandates set submitted_at = clock_timestamp(), updated_at = clock_timestamp() where id = v_mandate.id;
end $$;

-- RPC for updating mandate and handling cleanup correctly
create or replace function public.mutate_sales_mandate(
  p_owner uuid, p_listing_id uuid, p_content jsonb, p_documents jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_listing public.customer_listings;
  v_mandate_id uuid;
  v_asset jsonb;
  v_claimed boolean;
  v_new public.sales_mandates;
begin
  select * into v_listing from public.customer_listings where id = p_listing_id and user_id = p_owner for update;
  if not found then raise exception using errcode='P0002', message='Listing not found'; end if;
  if v_listing.listing_status not in ('UNLISTED', 'REJECTED') then raise exception using errcode='23514', message='Listing is not eligible for mandate edits'; end if;
  if jsonb_array_length(p_documents) not between 1 and 10 then raise exception using errcode='23514', message='Between 1 and 10 mandate documents required'; end if;

  v_new := jsonb_populate_record(null::public.sales_mandates, p_content);
  if v_new.document_title is null or char_length(trim(v_new.document_title)) = 0 then
    raise exception using errcode='23514', message='Document title is required';
  end if;
  if v_new.signature_mime_type <> 'image/png' or v_new.signature_size_bytes <= 0 or v_new.signature_size_bytes > 2097152 then
    raise exception using errcode='23514', message='Valid PNG signature within 2 MiB required';
  end if;

  -- Lock cleanup assets
  for v_asset in select val from (
    select value as val from jsonb_array_elements(p_documents)
    union all
    select jsonb_build_object('public_id', v_new.signature_public_id, 'resource_type', 'raw', 'delivery_type', 'authenticated') as val
  ) s order by val->>'public_id', val->>'resource_type', val->>'delivery_type'
  loop
    -- if asset is already attached to this mandate, skip locking
    if exists(select 1 from public.sales_mandates m where m.listing_id=p_listing_id and m.user_id=p_owner and m.signature_public_id=v_asset->>'public_id' and v_asset->>'resource_type'='raw' and v_asset->>'delivery_type'='authenticated') then continue; end if;
    if exists(select 1 from public.sales_mandate_documents d join public.sales_mandates m on m.id=d.mandate_id where m.listing_id=p_listing_id and m.user_id=p_owner and d.public_id=v_asset->>'public_id' and d.resource_type=v_asset->>'resource_type' and d.delivery_type=v_asset->>'delivery_type') then continue; end if;

    select claimed into v_claimed from public.customer_listing_media_cleanup
      where user_id=p_owner and public_id=v_asset->>'public_id' and resource_type=v_asset->>'resource_type' and delivery_type=v_asset->>'delivery_type' for update;
    if not found or v_claimed then raise exception using errcode='23514', message='Upload is not available'; end if;
  end loop;

  -- Create or Update mandate
  select id into v_mandate_id from public.sales_mandates where listing_id = p_listing_id for update;
  if found then
    -- Detach old signature and documents
    insert into public.customer_listing_media_cleanup(public_id, user_id, resource_type, delivery_type, detached)
    select signature_public_id, p_owner, 'raw', 'authenticated', true from public.sales_mandates where id = v_mandate_id
      and signature_public_id <> v_new.signature_public_id
    union all
    select public_id, p_owner, resource_type, delivery_type, true from public.sales_mandate_documents d where mandate_id = v_mandate_id
      and not exists(select 1 from jsonb_array_elements(p_documents) e(value) where e.value->>'public_id'=d.public_id and e.value->>'resource_type'=d.resource_type and e.value->>'delivery_type'=d.delivery_type)
    on conflict (public_id, resource_type, delivery_type) do update set detached=true;

    update public.sales_mandates set 
      seller_title=v_new.seller_title, surname=v_new.surname, first_names=v_new.first_names, gender=v_new.gender, email=v_new.email, telephone=v_new.telephone, date_of_birth=v_new.date_of_birth,
      nationality=v_new.nationality, post_code=v_new.post_code, address=v_new.address, property_development_name=v_new.property_development_name,
      document_title=v_new.document_title, signer_name=v_new.signer_name, signer_address=v_new.signer_address, signer_email=v_new.signer_email,
      mandate_date=coalesce(v_new.mandate_date, current_date), agreed_to_mandate=v_new.agreed_to_mandate,
      signature_public_id=v_new.signature_public_id, signature_mime_type=v_new.signature_mime_type, signature_size_bytes=v_new.signature_size_bytes,
      signed_at=case when signature_public_id <> v_new.signature_public_id then clock_timestamp() else signed_at end,
      updated_at=clock_timestamp()
    where id = v_mandate_id;

    delete from public.sales_mandate_documents where mandate_id = v_mandate_id;
  else
    insert into public.sales_mandates(listing_id, user_id, seller_title, surname, first_names, gender, email, telephone, date_of_birth, nationality, post_code, address, property_development_name, document_title, signer_name, signer_address, signer_email, mandate_date, agreed_to_mandate, signature_public_id, signature_mime_type, signature_size_bytes)
    values(p_listing_id, p_owner, v_new.seller_title, v_new.surname, v_new.first_names, v_new.gender, v_new.email, v_new.telephone, v_new.date_of_birth, v_new.nationality, v_new.post_code, v_new.address, v_new.property_development_name, v_new.document_title, v_new.signer_name, v_new.signer_address, v_new.signer_email, coalesce(v_new.mandate_date, current_date), v_new.agreed_to_mandate, v_new.signature_public_id, v_new.signature_mime_type, v_new.signature_size_bytes)
    returning id into v_mandate_id;
  end if;

  insert into public.sales_mandate_documents(mandate_id, title, public_id, resource_type, delivery_type, mime_type, size_bytes, sort_order)
  select v_mandate_id, d.title, d.public_id, d.resource_type, d.delivery_type, d.mime_type, d.size_bytes, (e.ordinality-1)::integer
  from jsonb_array_elements(p_documents) with ordinality e(value,ordinality)
  cross join lateral jsonb_to_record(e.value) d(title text, public_id text, resource_type text, delivery_type text, mime_type text, size_bytes bigint);

  delete from public.customer_listing_media_cleanup c where c.user_id=p_owner and (
    exists(select 1 from public.sales_mandate_documents d where d.mandate_id=v_mandate_id and (d.public_id,d.resource_type,d.delivery_type)=(c.public_id,c.resource_type,c.delivery_type))
    or (c.public_id=v_new.signature_public_id and c.resource_type='raw' and c.delivery_type='authenticated')
  );

  return v_mandate_id;
end $$;

alter table public.sales_mandates enable row level security;
alter table public.sales_mandate_documents enable row level security;

revoke all on public.sales_mandates, public.sales_mandate_documents from public, anon, authenticated;
grant all on public.sales_mandates, public.sales_mandate_documents to service_role;

revoke all on function public.submit_customer_listing(uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_customer_listing(uuid, uuid) to service_role;

revoke all on function public.mutate_sales_mandate(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.mutate_sales_mandate(uuid, uuid, jsonb, jsonb) to service_role;

create or replace function public.mutate_customer_listing(p_owner uuid, p_id uuid, p_action text, p_version integer, p_content jsonb default '{}', p_images jsonb default '[]', p_documents jsonb default '[]')
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
    insert into public.customer_listings(user_id,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,units,land_area,year_built,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,longitude,latitude,registered_title_document,additional_information)
    values(p_owner,v_new.title,v_new.description,v_new.occupancy_type,v_new.ownership_type,v_new.property_type,v_new.property_subtype,v_new.has_lien,v_new.bedrooms,v_new.bathrooms,v_new.parking_spaces,v_new.units,v_new.land_area,v_new.year_built,v_new.facilities,v_new.property_cost_minor,v_new.minimum_down_payment_minor,v_new.location,v_new.state,v_new.city,v_new.longitude,v_new.latitude,v_new.registered_title_document,v_new.additional_information)
    returning id into v_id;
  else
    select * into v_old from public.customer_listings where id=p_id and user_id=p_owner for update;
    if not found then raise exception using errcode='P0002', message='Listing not found'; end if;
    if p_version is distinct from v_old.version then raise exception using errcode='40001', message='Listing changed'; end if;
    v_id := v_old.id;
    if p_action='EDIT' then
      if v_old.listing_status not in ('UNLISTED','REJECTED') then raise exception using errcode='23514', message='Unlist before editing'; end if;
      v_new := jsonb_populate_record(null::public.customer_listings, p_content);
      update public.customer_listings set (title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,units,land_area,year_built,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,longitude,latitude,registered_title_document,additional_information)
      = (v_new.title,v_new.description,v_new.occupancy_type,v_new.ownership_type,v_new.property_type,v_new.property_subtype,v_new.has_lien,v_new.bedrooms,v_new.bathrooms,v_new.parking_spaces,v_new.units,v_new.land_area,v_new.year_built,v_new.facilities,v_new.property_cost_minor,v_new.minimum_down_payment_minor,v_new.location,v_new.state,v_new.city,v_new.longitude,v_new.latitude,v_new.registered_title_document,v_new.additional_information) where id=v_id;
    elsif p_action='REQUEST_APPROVAL' then
      raise exception using errcode='23514', message='Legacy approval bypassed. Use submit_customer_listing.';
    elsif p_action='UNLIST' then
      if v_old.listing_status <> 'PENDING' then raise exception using errcode='23514', message='Listing cannot be unlisted'; end if;
      update public.customer_listings set listing_status='UNLISTED', requested_at=null where id=v_id;
    elsif p_action='DOCUMENTS' then
      if v_old.listing_status not in ('UNLISTED','REJECTED') then raise exception using errcode='23514', message='Unlist before editing'; end if;
      if jsonb_array_length(p_documents) <> 1 then raise exception using errcode='23514', message='Exactly one document is required'; end if;
      insert into public.customer_listing_documents(listing_id,batch_id,title,document_type,description,sort_order,public_id,resource_type,delivery_type,mime_type,size_bytes)
      select v_id,v_batch,d.title,d.document_type,d.description,(e.ordinality-1)::integer,d.public_id,d.resource_type,d.delivery_type,d.mime_type,d.size_bytes
      from jsonb_array_elements(p_documents) with ordinality e(value,ordinality)
      cross join lateral jsonb_to_record(e.value) d(title text,document_type text,description text,public_id text,resource_type text,delivery_type text,mime_type text,size_bytes bigint);
      update public.customer_listings set updated_at=clock_timestamp() where id=v_id;
    elsif p_action='DELETE' then
      insert into public.customer_listing_media_cleanup(public_id,user_id,resource_type,delivery_type,detached)
      select public_id,p_owner,resource_type,delivery_type,true from public.customer_listing_images where listing_id=v_id
      union all select public_id,p_owner,resource_type,delivery_type,true from public.customer_listing_documents where listing_id=v_id
      union all select public_id,p_owner,resource_type,delivery_type,true from public.sales_mandate_documents d join public.sales_mandates m on m.id=d.mandate_id where m.listing_id=v_id
      union all select signature_public_id,p_owner,'raw'::text,'authenticated'::text,true from public.sales_mandates where listing_id=v_id
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

revoke all on function public.mutate_customer_listing(uuid,uuid,text,integer,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.mutate_customer_listing(uuid,uuid,text,integer,jsonb,jsonb,jsonb) to service_role;

commit;
