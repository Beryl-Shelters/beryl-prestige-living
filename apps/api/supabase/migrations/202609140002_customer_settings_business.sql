begin;

create table public.customer_business_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_code text not null unique check (company_code ~ '^BUS-[A-HJ-NP-Z2-9]{6}$'),
  company_name text check (company_name is null or char_length(btrim(company_name)) between 1 and 160),
  contact_email text check (contact_email is null or char_length(contact_email)<=254),
  phone_number text check (phone_number is null or phone_number ~ '^\+?[0-9]{5,15}$'),
  about_company text check (about_company is null or char_length(about_company)<=1000),
  logo_public_id text unique,
  logo_url text check (logo_url is null or logo_url like 'https://%'),
  logo_mime_type text check (logo_mime_type is null or logo_mime_type in ('image/png','image/jpeg','image/webp')),
  logo_size_bytes integer check (logo_size_bytes is null or logo_size_bytes between 1 and 2097152),
  street_address text check (street_address is null or char_length(btrim(street_address)) between 1 and 300),
  zip_code text check (zip_code is null or zip_code ~ '^[A-Za-z0-9 -]{2,20}$'),
  city text check (city is null or char_length(btrim(city)) between 1 and 100),
  state text check (state is null or char_length(btrim(state)) between 1 and 100),
  country text check (country is null or char_length(btrim(country)) between 1 and 100),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint customer_business_logo_complete check ((logo_public_id is null and logo_url is null and logo_mime_type is null and logo_size_bytes is null)
    or (logo_public_id is not null and logo_url is not null and logo_mime_type is not null and logo_size_bytes is not null))
);
alter table public.customer_business_profiles enable row level security;
revoke all on public.customer_business_profiles from public,anon,authenticated,service_role;

create table public.customer_business_logo_cleanup (
  public_id text primary key check (public_id like 'beryl-v2/business-logos/%'),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text check (url is null or url like 'https://%'),
  mime_type text check (mime_type is null or mime_type in ('image/png','image/jpeg','image/webp')),
  size_bytes integer check (size_bytes is null or size_bytes between 1 and 2097152),
  created_at timestamptz not null default clock_timestamp(),
  detached boolean not null default false,
  claimed boolean not null default false,
  constraint customer_business_logo_cleanup_metadata check ((url is null and mime_type is null and size_bytes is null)
    or (url is not null and mime_type is not null and size_bytes is not null))
);
alter table public.customer_business_logo_cleanup enable row level security;
revoke all on public.customer_business_logo_cleanup from public,anon,authenticated,service_role;

create function public.ensure_customer_business_profile(p_owner uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_owner is null or not exists(select 1 from auth.users where id=p_owner) then raise exception using errcode='P0002',message='Profile not found'; end if;
  for i in 1..5 loop
    begin
      insert into public.customer_business_profiles(user_id,company_code) values(p_owner,public.generate_display_code('BUS')) on conflict(user_id) do nothing;
      return;
    exception when unique_violation then
      if i=5 then raise; end if;
    end;
  end loop;
end $$;

create function public.read_customer_settings_business(p_owner uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  perform public.ensure_customer_business_profile(p_owner);
  select jsonb_build_object('companyId',company_code,'companyName',coalesce(company_name,''),'companyEmail',coalesce(contact_email,''),
    'companyPhoneNumber',coalesce(phone_number,''),'aboutCompany',coalesce(about_company,''),'companyLogoUrl',logo_url,
    'streetAddress',coalesce(street_address,''),'zipCode',coalesce(zip_code,''),'city',coalesce(city,''),
    'state',coalesce(state,''),'country',coalesce(country,'')) into v_result
    from public.customer_business_profiles where user_id=p_owner;
  return v_result;
end $$;

create function public.journal_customer_business_logo_upload(p_owner uuid,p_public_id text) returns void
language sql security definer set search_path=public,pg_temp as $$
  insert into public.customer_business_logo_cleanup(user_id,public_id) values(p_owner,p_public_id);
$$;
create function public.reserve_customer_business_logo(p_owner uuid,p_image jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if jsonb_typeof(p_image) is distinct from 'object' then raise exception using errcode='23514',message='Invalid company logo'; end if;
  update public.customer_business_logo_cleanup set url=p_image->>'url',mime_type=p_image->>'mime_type',size_bytes=(p_image->>'size_bytes')::integer
    where user_id=p_owner and public_id=p_image->>'public_id' and not claimed and not detached and url is null;
  if not found then raise exception using errcode='23514',message='Upload is not available'; end if;
end $$;

create function public.update_customer_settings_business(p_owner uuid,p_data jsonb,p_logo_public_id text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old text; v_logo public.customer_business_logo_cleanup%rowtype;
begin
  if p_owner is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception using errcode='23514',message='Invalid business profile'; end if;
  perform public.ensure_customer_business_profile(p_owner);
  if p_logo_public_id is not null then
    select * into v_logo from public.customer_business_logo_cleanup where user_id=p_owner and public_id=p_logo_public_id for update;
    if not found or v_logo.claimed or v_logo.detached or v_logo.url is null or v_logo.mime_type is null or v_logo.size_bytes is null then raise exception using errcode='23514',message='Upload is not available'; end if;
  end if;
  select logo_public_id into v_old from public.customer_business_profiles where user_id=p_owner for update;
  update public.customer_business_profiles set company_name=p_data->>'company_name',contact_email=lower(p_data->>'contact_email'),
    phone_number=p_data->>'phone_number',about_company=nullif(p_data->>'about_company',''),street_address=p_data->>'street_address',
    zip_code=p_data->>'zip_code',city=p_data->>'city',state=p_data->>'state',country=p_data->>'country',updated_at=clock_timestamp(),
    logo_public_id=case when p_logo_public_id is null then logo_public_id else v_logo.public_id end,
    logo_url=case when p_logo_public_id is null then logo_url else v_logo.url end,
    logo_mime_type=case when p_logo_public_id is null then logo_mime_type else v_logo.mime_type end,
    logo_size_bytes=case when p_logo_public_id is null then logo_size_bytes else v_logo.size_bytes end where user_id=p_owner;
  if p_logo_public_id is not null then
    delete from public.customer_business_logo_cleanup where user_id=p_owner and public_id=p_logo_public_id;
    if v_old is not null and v_old<>p_logo_public_id then insert into public.customer_business_logo_cleanup(user_id,public_id,detached) values(p_owner,v_old,true) on conflict(public_id) do update set detached=true,claimed=false; end if;
  end if;
  return public.read_customer_settings_business(p_owner);
end $$;

create function public.claim_customer_business_logo_cleanup(p_owner uuid) returns setof text
language sql security definer set search_path=public,pg_temp as $$
  with candidates as (select public_id from public.customer_business_logo_cleanup where user_id=p_owner and not claimed and
    (detached or created_at<clock_timestamp()-interval '1 hour') order by created_at,public_id limit 10 for update skip locked)
  update public.customer_business_logo_cleanup c set claimed=true from candidates x where c.public_id=x.public_id returning c.public_id;
$$;
create function public.release_customer_business_logo_cleanup(p_owner uuid,p_public_id text,p_remove boolean) returns void
language sql security definer set search_path=public,pg_temp as $$
  delete from public.customer_business_logo_cleanup where p_remove and user_id=p_owner and public_id=p_public_id and claimed;
  update public.customer_business_logo_cleanup set claimed=false where not p_remove and user_id=p_owner and public_id=p_public_id and claimed;
$$;

revoke all on function public.ensure_customer_business_profile(uuid),public.read_customer_settings_business(uuid),
  public.journal_customer_business_logo_upload(uuid,text),public.reserve_customer_business_logo(uuid,jsonb),
  public.update_customer_settings_business(uuid,jsonb,text),public.claim_customer_business_logo_cleanup(uuid),
  public.release_customer_business_logo_cleanup(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.ensure_customer_business_profile(uuid),public.read_customer_settings_business(uuid),
  public.journal_customer_business_logo_upload(uuid,text),public.reserve_customer_business_logo(uuid,jsonb),
  public.update_customer_settings_business(uuid,jsonb,text),public.claim_customer_business_logo_cleanup(uuid),
  public.release_customer_business_logo_cleanup(uuid,text,boolean) to service_role;
commit;
