-- Feedback #12: immutable, physically signed Sales Mandate workflow.
-- Existing LISTED properties and already queued PENDING properties are
-- explicitly grandfathered. Editable UNLISTED/REJECTED properties enter the
-- new workflow without deleting legacy digital mandate evidence.
begin;

alter table public.customer_listings
  add column requires_signed_mandate boolean not null default true;

update public.customer_listings
set requires_signed_mandate = false
where listing_status in ('LISTED','PENDING');

create table public.listing_mandate_versions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.customer_listings(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  version integer not null check (version > 0),
  agreement_version text not null check (char_length(btrim(agreement_version)) between 1 and 120),
  agreement_snapshot jsonb not null check (jsonb_typeof(agreement_snapshot) = 'object'),
  snapshot_hash text not null check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  pdf_public_id text not null check (char_length(btrim(pdf_public_id)) between 1 and 240),
  pdf_resource_type text not null check (pdf_resource_type = 'raw'),
  pdf_delivery_type text not null check (pdf_delivery_type = 'authenticated'),
  pdf_mime_type text not null check (pdf_mime_type = 'application/pdf'),
  pdf_size_bytes bigint not null check (pdf_size_bytes between 1 and 10485760),
  generated_at timestamptz not null,
  email_status text not null default 'NOT_SENT' check (email_status in ('NOT_SENT','SENT','FAILED')),
  email_attempts integer not null default 0 check (email_attempts >= 0),
  last_email_attempt_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (listing_id, version),
  unique (listing_id, snapshot_hash)
);

create table public.listing_mandate_submissions (
  id uuid primary key default gen_random_uuid(),
  mandate_version_id uuid not null references public.listing_mandate_versions(id) on delete restrict,
  listing_id uuid not null references public.customer_listings(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  submission_number integer not null check (submission_number > 0),
  status text not null default 'UNDER_REVIEW' check (status in ('UNDER_REVIEW','APPROVED','REJECTED')),
  uploaded_at timestamptz not null default clock_timestamp(),
  reviewed_by uuid references public.admin_profiles(user_id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default clock_timestamp(),
  unique (mandate_version_id, submission_number),
  check (
    (status = 'UNDER_REVIEW' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'APPROVED' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'REJECTED' and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null
      and char_length(btrim(rejection_reason)) between 1 and 2000)
  )
);

create table public.listing_mandate_submission_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.listing_mandate_submissions(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  public_id text not null check (char_length(btrim(public_id)) between 1 and 240),
  resource_type text not null check (resource_type = 'raw'),
  delivery_type text not null check (delivery_type = 'authenticated'),
  mime_type text not null check (mime_type in ('application/pdf','image/png','image/jpeg')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  sort_order integer not null check (sort_order between 0 and 23),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique (submission_id, sort_order),
  unique (public_id, resource_type, delivery_type)
);

create index listing_mandate_versions_owner_idx on public.listing_mandate_versions(user_id, listing_id, version desc);
create index listing_mandate_submissions_review_idx on public.listing_mandate_submissions(status, uploaded_at);
create index listing_mandate_submissions_listing_idx on public.listing_mandate_submissions(listing_id, uploaded_at desc);

alter table public.listing_mandate_versions enable row level security;
alter table public.listing_mandate_submissions enable row level security;
alter table public.listing_mandate_submission_documents enable row level security;
revoke all on public.listing_mandate_versions, public.listing_mandate_submissions, public.listing_mandate_submission_documents from public, anon, authenticated;
grant all on public.listing_mandate_versions, public.listing_mandate_submissions, public.listing_mandate_submission_documents to service_role;

create or replace function public.claim_customer_listing_cleanup(p_owner uuid,p_public_id text,p_resource_type text,p_delivery_type text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_intent public.customer_listing_media_cleanup%rowtype;
begin
  select * into v_intent from public.customer_listing_media_cleanup
    where user_id=p_owner and public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type for update;
  if not found then return false; end if;
  if not v_intent.detached and v_intent.created_at>clock_timestamp()-interval '1 hour' then return false; end if;
  if exists(select 1 from public.customer_listing_images where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type)
     or exists(select 1 from public.customer_listing_documents where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type)
     or exists(select 1 from public.sales_mandate_documents where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type)
     or exists(select 1 from public.sales_mandates where signature_public_id=p_public_id and p_resource_type='raw' and p_delivery_type='authenticated')
     or exists(select 1 from public.listing_mandate_versions where pdf_public_id=p_public_id and p_resource_type='raw' and p_delivery_type='authenticated')
     or exists(select 1 from public.listing_mandate_submission_documents where public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type) then
    return false;
  end if;
  update public.customer_listing_media_cleanup set claimed=true
    where user_id=p_owner and public_id=p_public_id and resource_type=p_resource_type and delivery_type=p_delivery_type;
  return true;
end $$;

create function public.create_listing_mandate_version(
  p_owner uuid, p_listing_id uuid, p_agreement_version text, p_agreement_snapshot jsonb,
  p_snapshot_hash text, p_pdf_public_id text, p_pdf_size_bytes bigint, p_generated_at timestamptz
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_listing public.customer_listings%rowtype; v_existing uuid; v_id uuid; v_version integer;
begin
  select * into v_listing from public.customer_listings where id=p_listing_id and user_id=p_owner for update;
  if not found then raise exception using errcode='P0002',message='Listing not found'; end if;
  if v_listing.listing_status='LISTED' then raise exception using errcode='23514',message='Published property mandates are historical'; end if;
  select id into v_existing from public.listing_mandate_versions where listing_id=p_listing_id and snapshot_hash=p_snapshot_hash;
  if found then return v_existing; end if;
  select coalesce(max(version),0)+1 into v_version from public.listing_mandate_versions where listing_id=p_listing_id;
  insert into public.listing_mandate_versions(listing_id,user_id,version,agreement_version,agreement_snapshot,snapshot_hash,pdf_public_id,pdf_resource_type,pdf_delivery_type,pdf_mime_type,pdf_size_bytes,generated_at)
  values(p_listing_id,p_owner,v_version,p_agreement_version,p_agreement_snapshot,p_snapshot_hash,p_pdf_public_id,'raw','authenticated','application/pdf',p_pdf_size_bytes,p_generated_at)
  returning id into v_id;
  update public.customer_listings set requires_signed_mandate=true where id=p_listing_id;
  return v_id;
end $$;

create function public.record_listing_mandate_email(p_owner uuid,p_version_id uuid,p_sent boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.listing_mandate_versions set
    email_status=case when p_sent then 'SENT' else 'FAILED' end,
    email_attempts=email_attempts+1,last_email_attempt_at=clock_timestamp(),
    email_sent_at=case when p_sent then clock_timestamp() else email_sent_at end
  where id=p_version_id and user_id=p_owner;
  if not found then raise exception using errcode='P0002',message='Mandate not found'; end if;
end $$;

create function public.create_listing_mandate_submission(p_owner uuid,p_listing_id uuid,p_version_id uuid,p_documents jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_listing public.customer_listings%rowtype; v_latest uuid; v_submission uuid; v_number integer; v_doc jsonb; v_upload public.customer_listing_media_cleanup%rowtype;
begin
  select * into v_listing from public.customer_listings where id=p_listing_id and user_id=p_owner for update;
  if not found then raise exception using errcode='P0002',message='Listing not found'; end if;
  if v_listing.listing_status not in ('UNLISTED','REJECTED') then raise exception using errcode='23514',message='Listing is not eligible for mandate upload'; end if;
  select id into v_latest from public.listing_mandate_versions where listing_id=p_listing_id and user_id=p_owner order by version desc limit 1;
  if v_latest is distinct from p_version_id then raise exception using errcode='23514',message='Use the latest mandate version'; end if;
  if p_documents is null or jsonb_typeof(p_documents)<>'array' or jsonb_array_length(p_documents) not between 1 and 24 then raise exception using errcode='23514',message='Upload the complete signed mandate'; end if;
  if exists(select 1 from public.listing_mandate_submissions where mandate_version_id=p_version_id and status in ('UNDER_REVIEW','APPROVED')) then
    raise exception using errcode='23514',message='This mandate already has an active submission';
  end if;
  select coalesce(max(submission_number),0)+1 into v_number from public.listing_mandate_submissions where mandate_version_id=p_version_id;
  insert into public.listing_mandate_submissions(mandate_version_id,listing_id,user_id,submission_number)
  values(p_version_id,p_listing_id,p_owner,v_number) returning id into v_submission;
  for v_doc in select value from jsonb_array_elements(p_documents) loop
    if jsonb_typeof(v_doc)<>'object'
       or v_doc->>'public_id' is null
       or position(('beryl-v2/mandates/signed/'||p_listing_id::text||'/') in (v_doc->>'public_id'))<>1 then
      raise exception using errcode='23514',message='Invalid signed mandate document';
    end if;
    select * into v_upload from public.customer_listing_media_cleanup
      where user_id=p_owner and public_id=v_doc->>'public_id'
        and resource_type='raw' and delivery_type='authenticated' and not claimed
      for update;
    if not found then raise exception using errcode='23514',message='Signed mandate upload was not found'; end if;
    insert into public.listing_mandate_submission_documents(submission_id,title,public_id,resource_type,delivery_type,mime_type,size_bytes,sort_order,uploaded_by)
    values(v_submission,v_doc->>'title',v_doc->>'public_id','raw','authenticated',v_doc->>'mime_type',(v_doc->>'size_bytes')::bigint,(v_doc->>'sort_order')::integer,p_owner);
  end loop;
  delete from public.customer_listing_media_cleanup c
    using public.listing_mandate_submission_documents d
    where d.submission_id=v_submission and c.user_id=p_owner
      and c.public_id=d.public_id and c.resource_type=d.resource_type and c.delivery_type=d.delivery_type;
  return v_submission;
end $$;

create function public.review_listing_mandate(p_code text,p_submission_id uuid,p_reviewer uuid,p_action text,p_reason text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_submission public.listing_mandate_submissions%rowtype; v_listing public.customer_listings%rowtype; v_latest_version_id uuid;
begin
  if p_action not in ('APPROVE','REJECT') or (p_action='APPROVE' and p_reason is not null)
     or (p_action='REJECT' and (p_reason is null or char_length(btrim(p_reason)) not between 1 and 2000)) then
    raise exception using errcode='23514',message='Invalid mandate review';
  end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_reviewer and active) then raise exception using errcode='42501',message='Active Admin required'; end if;
  -- All mandate/listing mutations lock the listing first. This serializes new
  -- agreement versions, submissions, mandate review and publication without
  -- introducing a submission->listing lock inversion.
  select * into v_listing from public.customer_listings where upper(listing_code)=upper(p_code) for update;
  if not found then raise exception using errcode='P0002',message='Property not found'; end if;
  select * into v_submission from public.listing_mandate_submissions where id=p_submission_id and listing_id=v_listing.id for update;
  if not found then raise exception using errcode='P0002',message='Mandate submission not found'; end if;
  select id into v_latest_version_id from public.listing_mandate_versions where listing_id=v_listing.id order by version desc limit 1;
  if v_submission.mandate_version_id is distinct from v_latest_version_id then raise exception using errcode='23514',message='Only the latest mandate version can be reviewed'; end if;
  if v_submission.status<>'UNDER_REVIEW' then raise exception using errcode='23514',message='Mandate is not awaiting review'; end if;
  update public.listing_mandate_submissions set status=case when p_action='APPROVE' then 'APPROVED' else 'REJECTED' end,
    reviewed_by=p_reviewer,reviewed_at=clock_timestamp(),rejection_reason=case when p_action='REJECT' then btrim(p_reason) else null end
  where id=p_submission_id;
  if p_action='REJECT' then
    update public.customer_listings set
      listing_status='REJECTED',rejection_reason=btrim(p_reason),rejected_at=clock_timestamp(),
      version=version+1,updated_at=clock_timestamp()
    where id=v_listing.id and listing_status='PENDING';
  end if;
end $$;

create function public.enforce_signed_mandate_publication()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.listing_status='LISTED' and new.requires_signed_mandate and not exists(
    select 1 from public.listing_mandate_submissions s
    join public.listing_mandate_versions mv on mv.id=s.mandate_version_id
    where s.listing_id=new.id and s.status='APPROVED'
      and mv.version=(select max(latest.version) from public.listing_mandate_versions latest where latest.listing_id=new.id)
  ) then
    raise exception using errcode='23514',message='Approved signed Sales Mandate required';
  end if;
  return new;
end $$;

create trigger customer_listing_signed_mandate_publication_gate
before insert or update of listing_status,requires_signed_mandate on public.customer_listings
for each row execute function public.enforce_signed_mandate_publication();

create or replace function public.submit_customer_listing(p_owner uuid,p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.customer_listings%rowtype; v_version uuid; v_submission uuid;
begin
  select * into v_old from public.customer_listings where id=p_id and user_id=p_owner for update;
  if not found then raise exception using errcode='P0002',message='Listing not found'; end if;
  if v_old.listing_status not in ('UNLISTED','REJECTED') then raise exception using errcode='23514',message='Listing is not eligible for submission'; end if;
  if v_old.title is null or char_length(btrim(v_old.title))=0 or v_old.description is null or char_length(btrim(v_old.description))=0
     or v_old.property_type is null or v_old.property_subtype is null or v_old.property_cost_minor is null or v_old.property_cost_minor<=0
     or v_old.location is null or char_length(btrim(v_old.location))=0 or v_old.state is null or v_old.city is null then
    raise exception using errcode='23514',message='Property data is incomplete';
  end if;
  if not exists(select 1 from public.customer_listing_images where listing_id=p_id) then raise exception using errcode='23514',message='Listing images are required'; end if;
  if v_old.requires_signed_mandate then
    select id into v_version from public.listing_mandate_versions where listing_id=p_id and user_id=p_owner order by version desc limit 1;
    if not found then raise exception using errcode='23514',message='Sales mandate is not prepared'; end if;
    select id into v_submission from public.listing_mandate_submissions where mandate_version_id=v_version and status in ('UNDER_REVIEW','APPROVED') order by submission_number desc limit 1;
    if not found then raise exception using errcode='23514',message='Signed Sales Mandate is required'; end if;
  end if;
  update public.customer_listings set
    listing_status='PENDING',requested_at=clock_timestamp(),rejection_reason=null,rejected_at=null,
    version=version+1,updated_at=clock_timestamp()
  where id=p_id;
end $$;

create or replace function public.review_admin_property(p_code text,p_reviewer uuid,p_action text,p_version integer,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_listing public.customer_listings%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if p_code is null or char_length(p_code) not between 1 and 80 or p_code !~ '^[A-Za-z0-9-]+$'
     or p_reviewer is null or p_action not in ('APPROVE','REJECT') or p_version is null or p_version<1
     or (p_action='APPROVE' and p_reason is not null)
     or (p_action='REJECT' and (p_reason is null or char_length(btrim(p_reason)) not between 1 and 2000)) then raise exception using errcode='23514',message='Invalid property review'; end if;
  if not exists(select 1 from public.admin_profiles where user_id=p_reviewer and active) then raise exception using errcode='42501',message='Active Admin required'; end if;
  select * into v_listing from public.customer_listings where upper(listing_code)=upper(p_code) for update;
  if not found then raise exception using errcode='P0002',message='Property not found'; end if;
  if v_listing.version<>p_version then raise exception using errcode='40001',message='Property changed'; end if;
  if v_listing.listing_status<>'PENDING' then raise exception using errcode='23514',message='Only pending properties can be reviewed'; end if;
  if p_action='APPROVE' and v_listing.requires_signed_mandate and not exists(
    select 1 from public.listing_mandate_submissions s
    join public.listing_mandate_versions mv on mv.id=s.mandate_version_id
    where s.listing_id=v_listing.id and s.status='APPROVED'
      and mv.version=(select max(latest.version) from public.listing_mandate_versions latest where latest.listing_id=v_listing.id)
  ) then raise exception using errcode='23514',message='Approved signed Sales Mandate required'; end if;
  if p_action='APPROVE' then
    update public.customer_listings set listing_status='LISTED' where id=v_listing.id;
    insert into public.admin_listing_reviews(listing_id,reviewer_id,action,submission_requested_at,reviewed_at) values(v_listing.id,p_reviewer,'APPROVED',v_listing.requested_at,v_now);
  else
    update public.customer_listings set listing_status='REJECTED',rejection_reason=btrim(p_reason),rejected_at=v_now where id=v_listing.id;
    insert into public.admin_listing_reviews(listing_id,reviewer_id,action,reason,submission_requested_at,reviewed_at) values(v_listing.id,p_reviewer,'REJECTED',btrim(p_reason),v_listing.requested_at,v_now);
  end if;
  return jsonb_build_object('code',v_listing.listing_code,'status',case when p_action='APPROVE' then 'LISTED' else 'REJECTED' end);
end $$;

revoke all on function public.claim_customer_listing_cleanup(uuid,text,text,text),
  public.create_listing_mandate_version(uuid,uuid,text,jsonb,text,text,bigint,timestamptz),
  public.record_listing_mandate_email(uuid,uuid,boolean),public.create_listing_mandate_submission(uuid,uuid,uuid,jsonb),
  public.review_listing_mandate(text,uuid,uuid,text,text),public.submit_customer_listing(uuid,uuid),
  public.review_admin_property(text,uuid,text,integer,text),public.enforce_signed_mandate_publication()
  from public,anon,authenticated,service_role;
grant execute on function public.claim_customer_listing_cleanup(uuid,text,text,text),
  public.create_listing_mandate_version(uuid,uuid,text,jsonb,text,text,bigint,timestamptz),
  public.record_listing_mandate_email(uuid,uuid,boolean),public.create_listing_mandate_submission(uuid,uuid,uuid,jsonb),
  public.review_listing_mandate(text,uuid,uuid,text,text),public.submit_customer_listing(uuid,uuid),
  public.review_admin_property(text,uuid,text,integer,text) to service_role;

commit;
