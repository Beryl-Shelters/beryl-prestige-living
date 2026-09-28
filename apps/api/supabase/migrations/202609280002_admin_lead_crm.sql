begin;

-- Admin-only CRM identity and stage state. Source enquiry/request rows remain
-- authoritative for requester, property-interest and scheduling information.
create table public.admin_leads (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^ENQ-[A-HJ-NP-Z2-9]{6}$'),
  source_type text not null check (source_type in ('REAL_ESTATE_INQUIRY','BUY_ASSISTANCE','PROPERTY_VIEWING')),
  source_id uuid not null,
  stage text not null default 'NEW' check (stage in ('NEW','CONTACTED','WON','LOST')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (source_type,source_id)
);
create index admin_leads_stage_updated_idx on public.admin_leads(stage,updated_at desc,id desc);

-- Bounded retries protect the short human-facing identifier from the same
-- rare collision class as listing and referral display codes.
create function public.ensure_admin_lead(p_source_type text,p_source_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_attempt integer;
begin
  if p_source_type not in ('REAL_ESTATE_INQUIRY','BUY_ASSISTANCE','PROPERTY_VIEWING') or p_source_id is null then
    raise exception using errcode='23514',message='Invalid lead source';
  end if;
  for v_attempt in 1..5 loop
    begin
      insert into public.admin_leads(public_id,source_type,source_id)
        values(public.generate_display_code('ENQ'),p_source_type,p_source_id)
        on conflict(source_type,source_id) do nothing;
      return;
    exception when unique_violation then
      if v_attempt=5 then raise; end if;
    end;
  end loop;
end $$;

create function public.register_admin_lead_source() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_table_name='public_real_estate_inquiries'
     and to_jsonb(new)->>'inquiry_type' in ('Property Inquiry','Buying a Property','Property Viewing') then
    perform public.ensure_admin_lead('REAL_ESTATE_INQUIRY',new.id);
  elsif tg_table_name='public_buy_assistance_requests' and to_jsonb(new)->>'status'='ACCEPTED' then
    perform public.ensure_admin_lead('BUY_ASSISTANCE',new.id);
  elsif tg_table_name='public_property_viewings' then
    perform public.ensure_admin_lead('PROPERTY_VIEWING',new.id);
  end if;
  return new;
end $$;

create trigger public_real_estate_inquiry_admin_lead
after insert on public.public_real_estate_inquiries
for each row execute function public.register_admin_lead_source();
create trigger public_buy_assistance_admin_lead
after insert or update of status on public.public_buy_assistance_requests
for each row execute function public.register_admin_lead_source();
create trigger public_property_viewing_admin_lead
after insert on public.public_property_viewings
for each row execute function public.register_admin_lead_source();

-- Backfill only genuine buyer intent. Incomplete Buy Assistance upload
-- reservations are deliberately excluded until their source becomes ACCEPTED.
do $$
declare v_source record;
begin
  for v_source in
    select 'REAL_ESTATE_INQUIRY'::text source_type,id source_id
      from public.public_real_estate_inquiries
      where inquiry_type in ('Property Inquiry','Buying a Property','Property Viewing')
    union all
    select 'BUY_ASSISTANCE',id from public.public_buy_assistance_requests where status='ACCEPTED'
    union all
    select 'PROPERTY_VIEWING',id from public.public_property_viewings
  loop
    perform public.ensure_admin_lead(v_source.source_type,v_source.source_id);
  end loop;
end $$;

create table public.admin_lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.admin_leads(id) on delete cascade,
  from_stage text not null check (from_stage in ('NEW','CONTACTED')),
  to_stage text not null check (to_stage in ('CONTACTED','WON','LOST')),
  changed_by uuid not null references public.admin_profiles(user_id),
  changed_at timestamptz not null default clock_timestamp(),
  constraint admin_lead_stage_transition_check check (
    (from_stage='NEW' and to_stage in ('CONTACTED','WON','LOST'))
    or (from_stage='CONTACTED' and to_stage in ('WON','LOST'))
  )
);
create index admin_lead_stage_history_lead_time_idx
  on public.admin_lead_stage_history(lead_id,changed_at desc,id desc);

alter table public.admin_leads enable row level security;
alter table public.admin_lead_stage_history enable row level security;
revoke all on public.admin_leads,public.admin_lead_stage_history from public,anon,authenticated,service_role;
grant select on public.admin_leads,public.admin_lead_stage_history to service_role;

-- Normalized read projection over the three canonical source tables. No
-- requester is treated as an authenticated customer because none of these
-- submission paths currently persists a customer_id.
create function public.admin_lead_source_rows()
returns table (
  source_type text,source_id uuid,requester_name text,email text,phone text,
  preferred_contact text,message text,received_at timestamptz,property_interest text,
  inquiry_type text,source_page text,property_type text,property_subtype text,
  bedrooms text,bathrooms text,locality text,state text,city text,facilities text[],
  budget_minor bigint,payment_intent text,timing text,additional_preferences text,
  preferred_date date,preferred_time time without time zone,flexible_dates boolean,
  listing_id uuid
)
language sql stable security definer set search_path=public,pg_temp as $$
  select 'REAL_ESTATE_INQUIRY'::text,r.id,r.full_name,r.email,r.phone,null::text,r.message,
    r.created_at,null::text,r.inquiry_type,r.source_page,null::text,null::text,null::text,
    null::text,null::text,null::text,null::text,'{}'::text[],null::bigint,null::text,
    null::text,null::text,null::date,null::time without time zone,null::boolean,null::uuid
  from public.public_real_estate_inquiries r
  where r.inquiry_type in ('Property Inquiry','Buying a Property','Property Viewing')
  union all
  select 'BUY_ASSISTANCE',b.id,b.contact_name,b.contact_email,b.contact_phone,
    b.preferred_contact_method,null::text,b.created_at,
    concat_ws(' · ',concat_ws(' ',b.property_type,b.property_subtype),
      nullif(concat_ws(', ',b.locality,b.city,b.state),'')),
    null::text,null::text,b.property_type,b.property_subtype,b.bedrooms,b.bathrooms,
    b.locality,b.state,b.city,b.facilities,b.budget_minor,b.payment_intent,b.timing,
    b.likely_transferable_giftings,null::date,null::time without time zone,null::boolean,null::uuid
  from public.public_buy_assistance_requests b where b.status='ACCEPTED'
  union all
  select 'PROPERTY_VIEWING',v.id,concat_ws(' ',v.first_name,v.last_name),v.email,v.phone,
    null::text,null::text,v.created_at,l.title,null::text,null::text,null::text,null::text,
    null::text,null::text,null::text,null::text,null::text,'{}'::text[],null::bigint,
    null::text,null::text,null::text,v.preferred_date,v.preferred_time,v.flexible_dates,v.listing_id
  from public.public_property_viewings v
  left join public.customer_listings l on l.id=v.listing_id
$$;

create function public.list_admin_leads(
  p_query text default '',p_page integer default 1,p_page_size integer default 40
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_query is null or char_length(p_query)>100
     or p_page not between 1 and 100000 or p_page_size not between 1 and 100 then
    raise exception using errcode='23514',message='Invalid Admin lead query';
  end if;
  with base as (
    select l.id,l.public_id,l.stage,l.version,s.source_type,s.requester_name,
      s.property_interest,s.received_at
    from public.admin_leads l join public.admin_lead_source_rows() s
      on s.source_type=l.source_type and s.source_id=l.source_id
  ), overall as (select count(*)::integer total from base), matched as (
    select * from base where btrim(p_query)=''
      or strpos(lower(public_id),lower(btrim(p_query)))>0
      or strpos(lower(requester_name),lower(btrim(p_query)))>0
      or strpos(lower(coalesce(property_interest,'')),lower(btrim(p_query)))>0
  ), counts as (
    select count(*) filter(where stage='NEW')::integer new_count,
      count(*) filter(where stage='CONTACTED')::integer contacted_count,
      count(*) filter(where stage='WON')::integer won_count,
      count(*) filter(where stage='LOST')::integer lost_count
    from matched
  ), matched_total as (select count(*)::integer total from matched), paged as (
    select * from matched order by received_at desc,public_id asc
    offset (p_page-1)*p_page_size limit p_page_size
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'publicId',public_id,'stage',stage,'version',version,'sourceType',source_type,
      'requesterName',requester_name,'propertyInterest',property_interest,'receivedAt',received_at
    ) order by received_at desc,public_id asc),'[]'::jsonb) value from paged
  )
  select jsonb_build_object(
    'counts',jsonb_build_object('new',c.new_count,'contacted',c.contacted_count,
      'won',c.won_count,'lost',c.lost_count),
    'items',i.value,'page',p_page,'pageSize',p_page_size,'total',m.total,'allTotal',o.total,
    'totalPages',case when m.total=0 then 0 else ((m.total+p_page_size-1)/p_page_size) end
  ) into v_result from overall o cross join counts c cross join matched_total m cross join items i;
  return v_result;
end $$;

create function public.read_admin_lead(p_public_id text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_public_id is null or p_public_id !~ '^ENQ-[A-HJ-NP-Z2-9]{6}$' then
    raise exception using errcode='23514',message='Invalid lead';
  end if;
  select jsonb_build_object(
    'publicId',lead.public_id,'stage',lead.stage,'version',lead.version,
    'sourceType',source.source_type,'receivedAt',source.received_at,
    'requester',jsonb_build_object('name',source.requester_name,'email',source.email,
      'phone',source.phone,'preferredContact',source.preferred_contact,
      'accountLinked',false,'customerId',null,'accountType',null,'profileType',null,'kycStatus',null),
    'message',source.message,
    'request',jsonb_strip_nulls(jsonb_build_object(
      'inquiryType',source.inquiry_type,'sourcePage',source.source_page,
      'propertyType',source.property_type,'propertySubtype',source.property_subtype,
      'bedrooms',source.bedrooms,'bathrooms',source.bathrooms,'locality',source.locality,
      'state',source.state,'city',source.city,'facilities',source.facilities,
      'budgetMinor',source.budget_minor,'paymentIntent',source.payment_intent,
      'timing',source.timing,'additionalPreferences',source.additional_preferences,
      'preferredDate',source.preferred_date,'preferredTime',source.preferred_time,
      'flexibleDates',source.flexible_dates)),
    'property',case when listing.id is null then null else jsonb_build_object(
      'code',listing.listing_code,'title',listing.title,'status',listing.listing_status,
      'imageUrl',image.url,'city',listing.city,'state',listing.state,'location',listing.location,
      'priceMinor',listing.property_cost_minor,'minimumDownPaymentMinor',listing.minimum_down_payment_minor,
      'propertyType',listing.property_type,'propertySubtype',listing.property_subtype,
      'seller',jsonb_build_object('id',seller.id,'name',coalesce(
        nullif(btrim(concat_ws(' ',seller.first_name,seller.last_name)),''),seller.email))
    ) end,
    'referral',null,
    'history',coalesce(history.value,'[]'::jsonb)
  ) into v_result
  from public.admin_leads lead
  join public.admin_lead_source_rows() source
    on source.source_type=lead.source_type and source.source_id=lead.source_id
  left join public.customer_listings listing on listing.id=source.listing_id
  left join public.customer_profiles seller on seller.id=listing.user_id
  left join lateral (
    select i.url from public.customer_listing_images i
    where i.listing_id=listing.id order by i.sort_order,i.id limit 1
  ) image on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id',h.id,'fromStage',h.from_stage,
      'toStage',h.to_stage,'changedAt',h.changed_at,
      'admin',jsonb_build_object('id',a.user_id,'name',a.full_name))
      order by h.changed_at desc,h.id desc) value
    from public.admin_lead_stage_history h
    join public.admin_profiles a on a.user_id=h.changed_by where h.lead_id=lead.id
  ) history on true
  where lead.public_id=p_public_id;
  if v_result is null then raise exception using errcode='P0002',message='Lead not found'; end if;
  return v_result;
end $$;

create function public.move_admin_lead(
  p_public_id text,p_admin uuid,p_to_stage text,p_version integer
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_lead public.admin_leads%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if p_public_id is null or p_public_id !~ '^ENQ-[A-HJ-NP-Z2-9]{6}$'
     or p_admin is null or p_to_stage not in ('CONTACTED','WON','LOST')
     or p_version is null or p_version<1 then
    raise exception using errcode='23514',message='Invalid lead transition';
  end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_admin and active) then
    raise exception using errcode='42501',message='Active Admin required';
  end if;
  select * into v_lead from public.admin_leads where public_id=p_public_id for update;
  if not found then raise exception using errcode='P0002',message='Lead not found'; end if;
  if v_lead.version<>p_version then
    raise exception using errcode='40001',message='Lead changed';
  end if;
  if not ((v_lead.stage='NEW' and p_to_stage in ('CONTACTED','WON','LOST'))
      or (v_lead.stage='CONTACTED' and p_to_stage in ('WON','LOST'))) then
    raise exception using errcode='23514',message='Lead transition is not permitted';
  end if;
  update public.admin_leads set stage=p_to_stage,version=version+1,updated_at=v_now where id=v_lead.id;
  insert into public.admin_lead_stage_history(lead_id,from_stage,to_stage,changed_by,changed_at)
    values(v_lead.id,v_lead.stage,p_to_stage,p_admin,v_now);
  return jsonb_build_object('publicId',v_lead.public_id,'stage',p_to_stage,'version',v_lead.version+1);
end $$;

revoke all on function public.ensure_admin_lead(text,uuid),public.register_admin_lead_source(),
  public.admin_lead_source_rows() from public,anon,authenticated,service_role;
revoke all on function public.list_admin_leads(text,integer,integer),public.read_admin_lead(text),
  public.move_admin_lead(text,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.list_admin_leads(text,integer,integer),public.read_admin_lead(text),
  public.move_admin_lead(text,uuid,text,integer) to service_role;

commit;
