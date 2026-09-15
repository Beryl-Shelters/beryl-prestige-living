begin;

create table public.customer_kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null check (char_length(btrim(country)) between 2 and 100),
  document_type text not null check (document_type in ('PASSPORT','DRIVERS_LICENSE','NATIONAL_ID')),
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW','APPROVED','REJECTED')),
  declaration_accepted_at timestamptz not null,
  submitted_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason)<=1000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint customer_kyc_review_state check ((status='PENDING_REVIEW' and reviewed_at is null and rejection_reason is null)
    or (status='APPROVED' and reviewed_at is not null and rejection_reason is null)
    or (status='REJECTED' and reviewed_at is not null))
);
create index customer_kyc_submissions_owner_latest on public.customer_kyc_submissions(user_id,submitted_at desc,id desc);

create table public.customer_kyc_uploads (
  public_id text primary key check (public_id like 'beryl-v2/kyc/%'),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text check (filename is null or char_length(filename) between 1 and 120),
  mime_type text check (mime_type is null or mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes integer check (size_bytes is null or size_bytes between 1 and 10485760),
  created_at timestamptz not null default clock_timestamp(),
  claimed boolean not null default false,
  constraint customer_kyc_upload_metadata check ((filename is null and mime_type is null and size_bytes is null)
    or (filename is not null and mime_type is not null and size_bytes is not null))
);
create index customer_kyc_uploads_cleanup on public.customer_kyc_uploads(user_id,created_at);

create table public.customer_kyc_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.customer_kyc_submissions(id) on delete cascade,
  side text not null check (side in ('FRONT','BACK')),
  public_id text not null unique
   check (public_id like 'beryl-v2/kyc/%'),
  filename text not null check (char_length(filename) between 1 and 120),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default clock_timestamp(),
  unique(submission_id,side)
);

alter table public.customer_kyc_submissions enable row level security;
alter table public.customer_kyc_uploads enable row level security;
alter table public.customer_kyc_documents enable row level security;
revoke all on public.customer_kyc_submissions,public.customer_kyc_uploads,public.customer_kyc_documents from public,anon,authenticated,service_role;

create function public.read_customer_kyc(p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_submission public.customer_kyc_submissions%rowtype;
begin
  select * into v_submission from public.customer_kyc_submissions where user_id=p_owner order by submitted_at desc,id desc limit 1;
  if not found then return jsonb_build_object('status','NOT_SUBMITTED','country',null,'documentType',null,'submittedAt',null,'rejectionReason',null,'documents','[]'::jsonb); end if;
  return jsonb_build_object('status',v_submission.status,'country',v_submission.country,'documentType',v_submission.document_type,
    'submittedAt',v_submission.submitted_at,'rejectionReason',case when v_submission.status='REJECTED' then v_submission.rejection_reason else null end,
    'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'side',d.side,'filename',d.filename,'mimeType',d.mime_type,'sizeBytes',d.size_bytes) order by d.side desc)
      from public.customer_kyc_documents d where d.submission_id=v_submission.id),'[]'::jsonb));
end $$;

create function public.journal_customer_kyc_upload(p_owner uuid,p_public_id text) returns void
language sql security definer set search_path=public,pg_temp as $$ insert into public.customer_kyc_uploads(user_id,public_id) values(p_owner,p_public_id); $$;
create function public.reserve_customer_kyc_upload(p_owner uuid,p_asset jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if jsonb_typeof(p_asset) is distinct from 'object' then raise exception using errcode='23514',message='Invalid KYC document'; end if;
  update public.customer_kyc_uploads set filename=p_asset->>'filename',mime_type=p_asset->>'mime_type',size_bytes=(p_asset->>'size_bytes')::integer
    where user_id=p_owner and public_id=p_asset->>'public_id' and not claimed and filename is null;
  if not found then raise exception using errcode='23514',message='Upload is not available'; end if;
end $$;

create function public.submit_customer_kyc(p_owner uuid,p_country text,p_document_type text,p_declaration boolean,p_documents jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_latest text; v_submission uuid; v_item jsonb; v_upload public.customer_kyc_uploads%rowtype; v_sides text[]:=array[]::text[];
begin
  if p_owner is null or p_declaration is distinct from true or p_country is null or char_length(btrim(p_country)) not between 2 and 100
    or p_document_type not in ('PASSPORT','DRIVERS_LICENSE','NATIONAL_ID') or jsonb_typeof(p_documents) is distinct from 'array' then
    raise exception using errcode='23514',message='Invalid KYC submission';
  end if;
  perform 1 from public.customer_profiles where id=p_owner for update;
  if not found then raise exception using errcode='P0002',message='Profile not found'; end if;
  select status into v_latest from public.customer_kyc_submissions where user_id=p_owner order by submitted_at desc,id desc limit 1 for update;
  if v_latest in ('PENDING_REVIEW','APPROVED') then raise exception using errcode='23514',message='KYC submission cannot be replaced'; end if;
  if jsonb_array_length(p_documents)<>(case when p_document_type='PASSPORT' then 1 else 2 end) then raise exception using errcode='23514',message='Required KYC documents are missing'; end if;
  for v_item in select value from jsonb_array_elements(p_documents) loop
    if jsonb_typeof(v_item) is distinct from 'object' or v_item->>'side' not in ('FRONT','BACK') or v_item->>'publicId' is null or (v_item-'side'-'publicId')<>'{}'::jsonb then raise exception using errcode='23514',message='Invalid KYC document'; end if;
    v_sides:=array_append(v_sides,v_item->>'side');
    select * into v_upload from public.customer_kyc_uploads where user_id=p_owner and public_id=v_item->>'publicId' for update;
    if not found or v_upload.claimed or v_upload.filename is null then raise exception using errcode='23514',message='Upload is not available'; end if;
  end loop;
  if array_length(v_sides,1)<>array_length(array(select distinct unnest(v_sides)),1) or not ('FRONT'=any(v_sides))
    or (p_document_type='PASSPORT' and 'BACK'=any(v_sides)) or (p_document_type<>'PASSPORT' and not ('BACK'=any(v_sides))) then raise exception using errcode='23514',message='Invalid document sides'; end if;
  insert into public.customer_kyc_submissions(user_id,country,document_type,status,declaration_accepted_at) values(p_owner,btrim(p_country),p_document_type,'PENDING_REVIEW',clock_timestamp()) returning id into v_submission;
  insert into public.customer_kyc_documents(submission_id,side,public_id,filename,mime_type,size_bytes)
    select v_submission,e.value->>'side',u.public_id,u.filename,u.mime_type,u.size_bytes from jsonb_array_elements(p_documents)e(value)
    join public.customer_kyc_uploads u on u.user_id=p_owner and u.public_id=e.value->>'publicId';
  delete from public.customer_kyc_uploads u where u.user_id=p_owner and exists(select 1 from jsonb_array_elements(p_documents)e(value) where e.value->>'publicId'=u.public_id);
  return public.read_customer_kyc(p_owner);
end $$;

create function public.get_customer_kyc_document(p_owner uuid,p_document uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  select jsonb_build_object('public_id',d.public_id,'resource_type','raw','delivery_type','authenticated','url','',
    'mime_type',d.mime_type,'size_bytes',d.size_bytes,'filename',d.filename) into v_result from public.customer_kyc_documents d
    join public.customer_kyc_submissions s on s.id=d.submission_id where s.user_id=p_owner and d.id=p_document;
  if v_result is null then raise exception using errcode='P0002',message='KYC document not found'; end if;
  return v_result;
end $$;

create function public.claim_customer_kyc_upload_cleanup(p_owner uuid) returns setof text language sql security definer set search_path=public,pg_temp as $$
  with candidates as (select public_id from public.customer_kyc_uploads where user_id=p_owner and not claimed and created_at<clock_timestamp()-interval '1 hour' order by created_at,public_id limit 10 for update skip locked)
  update public.customer_kyc_uploads u set claimed=true from candidates c where u.public_id=c.public_id returning u.public_id;
$$;
create function public.release_customer_kyc_upload_cleanup(p_owner uuid,p_public_id text,p_remove boolean) returns void language sql security definer set search_path=public,pg_temp as $$
  delete from public.customer_kyc_uploads where p_remove and user_id=p_owner and public_id=p_public_id and claimed;
  update public.customer_kyc_uploads set claimed=false where not p_remove and user_id=p_owner and public_id=p_public_id and claimed;
$$;

revoke all on function public.read_customer_kyc(uuid),public.journal_customer_kyc_upload(uuid,text),public.reserve_customer_kyc_upload(uuid,jsonb),
  public.submit_customer_kyc(uuid,text,text,boolean,jsonb),public.get_customer_kyc_document(uuid,uuid),public.claim_customer_kyc_upload_cleanup(uuid),
  public.release_customer_kyc_upload_cleanup(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.read_customer_kyc(uuid),public.journal_customer_kyc_upload(uuid,text),public.reserve_customer_kyc_upload(uuid,jsonb),
  public.submit_customer_kyc(uuid,text,text,boolean,jsonb),public.get_customer_kyc_document(uuid,uuid),public.claim_customer_kyc_upload_cleanup(uuid),
  public.release_customer_kyc_upload_cleanup(uuid,text,boolean) to service_role;
commit;
