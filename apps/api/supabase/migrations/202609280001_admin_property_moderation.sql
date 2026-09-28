begin;

-- Immutable Admin moderation history. The canonical listing row continues to
-- own lifecycle state and current customer-visible rejection feedback.
create table public.admin_listing_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.customer_listings(id) on delete cascade,
  reviewer_id uuid not null references public.admin_profiles(user_id),
  action text not null check (action in ('APPROVED','REJECTED')),
  reason text,
  submission_requested_at timestamptz,
  reviewed_at timestamptz not null default clock_timestamp(),
  constraint admin_listing_review_reason_check check (
    (action='APPROVED' and reason is null)
    or (action='REJECTED' and reason is not null and char_length(reason) between 1 and 2000
      and reason=btrim(reason)
      and replace(replace(reason,E'\n',''),E'\r','') !~ '[[:cntrl:]]')
  )
);
create index admin_listing_reviews_listing_time_idx
  on public.admin_listing_reviews(listing_id,reviewed_at desc,id desc);

alter table public.admin_listing_reviews enable row level security;
revoke all on public.admin_listing_reviews from public,anon,authenticated,service_role;
grant select,insert on public.admin_listing_reviews to service_role;

create function public.list_admin_properties(
  p_query text default '',
  p_status text default 'ALL',
  p_sort text default 'NEWEST',
  p_page integer default 1,
  p_page_size integer default 6
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_query is null or char_length(p_query)>100
     or p_status not in ('ALL','UNLISTED','PENDING','LISTED','REJECTED')
     or p_sort not in ('NEWEST','OLDEST','TITLE_ASC','TITLE_DESC')
     or p_page not between 1 and 100000 or p_page_size not between 1 and 100 then
    raise exception using errcode='23514',message='Invalid Admin property query';
  end if;

  with base as (
    select l.id,l.listing_code,l.title,l.property_type,l.property_subtype,l.city,l.state,
      l.listing_status,l.created_at,l.updated_at,l.requested_at,l.listed_at,
      p.id as seller_id,
      coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email) as seller_name,
      p.email as seller_email,
      image.url as thumbnail_url,
      (m.id is not null) as has_mandate
    from public.customer_listings l
    join public.customer_profiles p on p.id=l.user_id
    left join lateral (
      select i.url from public.customer_listing_images i
      where i.listing_id=l.id order by i.sort_order,i.id limit 1
    ) image on true
    left join public.sales_mandates m on m.listing_id=l.id
  ), counts as (
    select count(*)::integer as all_count,
      count(*) filter(where listing_status='UNLISTED')::integer as unlisted_count,
      count(*) filter(where listing_status='PENDING')::integer as pending_count,
      count(*) filter(where listing_status='LISTED')::integer as listed_count,
      count(*) filter(where listing_status='REJECTED')::integer as rejected_count
    from base
  ), matched as (
    select * from base where
      (p_status='ALL' or listing_status=p_status)
      and (btrim(p_query)='' or strpos(lower(title),lower(btrim(p_query)))>0
        or strpos(lower(listing_code),lower(btrim(p_query)))>0
        or strpos(lower(seller_name),lower(btrim(p_query)))>0
        or strpos(lower(seller_email),lower(btrim(p_query)))>0
        or strpos(lower(city),lower(btrim(p_query)))>0
        or strpos(lower(state),lower(btrim(p_query)))>0)
  ), matched_total as (select count(*)::integer total from matched),
  paged as (
    select * from matched order by
      case when p_sort='NEWEST' then coalesce(requested_at,updated_at,created_at) end desc,
      case when p_sort='OLDEST' then coalesce(requested_at,updated_at,created_at) end asc,
      case when p_sort='TITLE_ASC' then lower(title) end asc,
      case when p_sort='TITLE_DESC' then lower(title) end desc,
      id asc
    offset (p_page-1)*p_page_size limit p_page_size
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'code',listing_code,'title',title,'propertyType',property_type,
      'propertySubtype',property_subtype,'city',city,'state',state,'status',listing_status,
      'createdAt',created_at,'updatedAt',updated_at,'submittedAt',requested_at,'listedAt',listed_at,
      'sellerId',seller_id,'sellerName',seller_name,'thumbnailUrl',thumbnail_url,
      'hasMandate',has_mandate
    ) order by
      case when p_sort='NEWEST' then coalesce(requested_at,updated_at,created_at) end desc,
      case when p_sort='OLDEST' then coalesce(requested_at,updated_at,created_at) end asc,
      case when p_sort='TITLE_ASC' then lower(title) end asc,
      case when p_sort='TITLE_DESC' then lower(title) end desc,
      id asc),'[]'::jsonb) value from paged
  )
  select jsonb_build_object(
    'counts',jsonb_build_object('all',c.all_count,'unlisted',c.unlisted_count,
      'pending',c.pending_count,'approved',c.listed_count,'rejected',c.rejected_count),
    'items',i.value,'page',p_page,'pageSize',p_page_size,'total',m.total,
    'totalPages',case when m.total=0 then 0 else ((m.total+p_page_size-1)/p_page_size) end
  ) into v_result from counts c cross join matched_total m cross join items i;
  return v_result;
end $$;

create function public.read_admin_property(p_code text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_code is null or char_length(p_code) not between 1 and 80 or p_code !~ '^[A-Za-z0-9-]+$' then
    raise exception using errcode='23514',message='Invalid property code';
  end if;

  select jsonb_build_object(
    'id',l.id,'code',l.listing_code,'version',l.version,'title',l.title,
    'description',l.description,'occupancyType',l.occupancy_type,'ownershipType',l.ownership_type,
    'propertyType',l.property_type,'propertySubtype',l.property_subtype,'hasLien',l.has_lien,
    'bedrooms',l.bedrooms,'bathrooms',l.bathrooms,'toilets',l.toilet_count,
    'parkingSpaces',l.parking_spaces,'units',l.units,'landArea',l.land_area,'yearBuilt',l.year_built,
    'facilities',l.facilities,'priceMinor',l.property_cost_minor,
    'minimumDownPaymentMinor',l.minimum_down_payment_minor,'location',l.location,
    'state',l.state,'city',l.city,'registeredTitleDocument',l.registered_title_document,
    'additionalInformation',l.additional_information,'status',l.listing_status,
    'createdAt',l.created_at,'updatedAt',l.updated_at,'submittedAt',l.requested_at,
    'listedAt',l.listed_at,'rejectionReason',case when l.listing_status='REJECTED' then l.rejection_reason end,
    'rejectedAt',case when l.listing_status='REJECTED' then l.rejected_at end,
    'seller',jsonb_build_object('id',p.id,
      'name',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email),
      'email',p.email,'phone',p.phone_number_normalized),
    'images',coalesce(images.value,'[]'::jsonb),
    'documents',coalesce(documents.value,'[]'::jsonb),
    'mandate',case when m.id is null then null else jsonb_build_object(
      'id',m.id,'type','Exclusive','commissionPercent',5,'signerName',m.signer_name,
      'mandateDate',m.mandate_date,'signedAt',m.signed_at,'submittedAt',m.submitted_at,
      'hasSignature',m.signature_public_id is not null,'documents',coalesce(mandate_documents.value,'[]'::jsonb)
    ) end,
    'reviews',coalesce(reviews.value,'[]'::jsonb)
  ) into v_result
  from public.customer_listings l
  join public.customer_profiles p on p.id=l.user_id
  left join public.sales_mandates m on m.listing_id=l.id
  left join lateral (
    select jsonb_agg(jsonb_build_object('id',i.id,'url',i.url,'sortOrder',i.sort_order,
      'mimeType',i.mime_type,'sizeBytes',i.size_bytes) order by i.sort_order,i.id) value
    from public.customer_listing_images i where i.listing_id=l.id
  ) images on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'documentType',d.document_type,
      'description',d.description,'sortOrder',d.sort_order,'mimeType',d.mime_type,
      'sizeBytes',d.size_bytes) order by d.created_at,d.batch_id,d.sort_order,d.id) value
    from public.customer_listing_documents d where d.listing_id=l.id
  ) documents on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'sortOrder',d.sort_order,
      'mimeType',d.mime_type,'sizeBytes',d.size_bytes) order by d.sort_order,d.id) value
    from public.sales_mandate_documents d where d.mandate_id=m.id
  ) mandate_documents on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id',r.id,'action',r.action,'reason',r.reason,
      'submissionRequestedAt',r.submission_requested_at,'reviewedAt',r.reviewed_at,
      'reviewer',jsonb_build_object('id',a.user_id,'name',a.full_name))
      order by r.reviewed_at desc,r.id desc) value
    from public.admin_listing_reviews r join public.admin_profiles a on a.user_id=r.reviewer_id
    where r.listing_id=l.id
  ) reviews on true
  where upper(l.listing_code)=upper(p_code);

  if v_result is null then raise exception using errcode='P0002',message='Property not found'; end if;
  return v_result;
end $$;

create function public.review_admin_property(
  p_code text,p_reviewer uuid,p_action text,p_version integer,p_reason text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_listing public.customer_listings%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if p_code is null or char_length(p_code) not between 1 and 80 or p_code !~ '^[A-Za-z0-9-]+$'
     or p_reviewer is null or p_action not in ('APPROVE','REJECT') or p_version is null or p_version<1
     or (p_action='APPROVE' and p_reason is not null)
     or (p_action='REJECT' and (p_reason is null or char_length(btrim(p_reason)) not between 1 and 2000
       or p_reason<>btrim(p_reason) or replace(replace(p_reason,E'\n',''),E'\r','') ~ '[[:cntrl:]]')) then
    raise exception using errcode='23514',message='Invalid property review';
  end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_reviewer and active) then
    raise exception using errcode='42501',message='Active Admin required';
  end if;

  select * into v_listing from public.customer_listings
  where upper(listing_code)=upper(p_code) for update;
  if not found then raise exception using errcode='P0002',message='Property not found'; end if;
  if v_listing.version<>p_version then raise exception using errcode='40001',message='Property changed'; end if;
  if v_listing.listing_status<>'PENDING' then
    raise exception using errcode='23514',message='Only pending properties can be reviewed';
  end if;

  if p_action='APPROVE' then
    update public.customer_listings set listing_status='LISTED' where id=v_listing.id;
    insert into public.admin_listing_reviews(listing_id,reviewer_id,action,submission_requested_at,reviewed_at)
      values(v_listing.id,p_reviewer,'APPROVED',v_listing.requested_at,v_now);
  else
    update public.customer_listings set listing_status='REJECTED',rejection_reason=p_reason,rejected_at=v_now
      where id=v_listing.id;
    insert into public.admin_listing_reviews(listing_id,reviewer_id,action,reason,submission_requested_at,reviewed_at)
      values(v_listing.id,p_reviewer,'REJECTED',p_reason,v_listing.requested_at,v_now);
  end if;

  return jsonb_build_object('code',v_listing.listing_code,
    'status',case when p_action='APPROVE' then 'LISTED' else 'REJECTED' end);
end $$;

revoke all on function public.list_admin_properties(text,text,text,integer,integer),
  public.read_admin_property(text),public.review_admin_property(text,uuid,text,integer,text)
  from public,anon,authenticated,service_role;
grant execute on function public.list_admin_properties(text,text,text,integer,integer),
  public.read_admin_property(text),public.review_admin_property(text,uuid,text,integer,text)
  to service_role;

commit;
