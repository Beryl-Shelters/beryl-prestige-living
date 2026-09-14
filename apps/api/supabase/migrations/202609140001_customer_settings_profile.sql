begin;

alter table public.customer_profiles
  add column brief_bio text check (brief_bio is null or char_length(brief_bio)<=1000),
  add column bank_account_name text check (bank_account_name is null or char_length(btrim(bank_account_name)) between 1 and 160),
  add column bank_name text check (bank_name is null or char_length(btrim(bank_name)) between 1 and 120),
  add column bank_account_number text check (bank_account_number is null or bank_account_number ~ '^[0-9]{6,20}$'),
  add column street_address text check (street_address is null or char_length(btrim(street_address)) between 1 and 300),
  add column zip_code text check (zip_code is null or zip_code ~ '^[A-Za-z0-9 -]{2,20}$'),
  add column city text check (city is null or char_length(btrim(city)) between 1 and 100),
  add column state text check (state is null or char_length(btrim(state)) between 1 and 100),
  add column country text check (country is null or char_length(btrim(country)) between 1 and 100),
  add column profile_image_public_id text unique,
  add column profile_image_url text check (profile_image_url is null or profile_image_url like 'https://%'),
  add column profile_image_mime_type text check (profile_image_mime_type is null or profile_image_mime_type in ('image/png','image/jpeg','image/webp')),
  add column profile_image_size_bytes integer check (profile_image_size_bytes is null or profile_image_size_bytes between 1 and 2097152),
  add constraint customer_profile_image_complete check ((profile_image_public_id is null and profile_image_url is null and profile_image_mime_type is null and profile_image_size_bytes is null)
    or (profile_image_public_id is not null and profile_image_url is not null and profile_image_mime_type is not null and profile_image_size_bytes is not null));

-- Settings data is available only through owner-scoped service RPCs.
revoke select on public.customer_profiles from authenticated;
revoke update (first_name,last_name) on public.customer_profiles from authenticated;

create table public.customer_profile_image_cleanup (
  public_id text primary key check (public_id like 'beryl-v2/profiles/%'),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text check (url is null or url like 'https://%'),
  mime_type text check (mime_type is null or mime_type in ('image/png','image/jpeg','image/webp')),
  size_bytes integer check (size_bytes is null or size_bytes between 1 and 2097152),
  created_at timestamptz not null default clock_timestamp(),
  detached boolean not null default false,
  claimed boolean not null default false,
  constraint customer_profile_image_cleanup_metadata check (
    (url is null and mime_type is null and size_bytes is null)
    or (url is not null and mime_type is not null and size_bytes is not null))
);
alter table public.customer_profile_image_cleanup enable row level security;
revoke all on public.customer_profile_image_cleanup from public,anon,authenticated,service_role;

create function public.read_customer_settings_profile(p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  select jsonb_build_object('firstName',first_name,'lastName',last_name,'email',email,'countryCode',country_code,
    'phoneNumber',phone_number,'accountType',account_type,'briefBio',coalesce(brief_bio,''),
    'accountName',coalesce(bank_account_name,''),'bankName',coalesce(bank_name,''),'accountNumber',coalesce(bank_account_number,''),
    'streetAddress',coalesce(street_address,''),'zipCode',coalesce(zip_code,''),'city',coalesce(city,''),
    'state',coalesce(state,''),'country',coalesce(country,''),'profileImageUrl',profile_image_url)
    into v_result from public.customer_profiles where id=p_owner;
  if v_result is null then raise exception using errcode='P0002',message='Profile not found'; end if;
  return v_result;
end $$;

create function public.journal_customer_profile_image_upload(p_owner uuid,p_public_id text) returns void
language sql security definer set search_path=public,pg_temp as $$
  insert into public.customer_profile_image_cleanup(user_id,public_id) values(p_owner,p_public_id);
$$;

create function public.reserve_customer_profile_image(p_owner uuid,p_image jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if jsonb_typeof(p_image) is distinct from 'object' then raise exception using errcode='23514',message='Invalid profile image'; end if;
  update public.customer_profile_image_cleanup set url=p_image->>'url',mime_type=p_image->>'mime_type',size_bytes=(p_image->>'size_bytes')::integer
    where user_id=p_owner and public_id=p_image->>'public_id' and not claimed and not detached and url is null;
  if not found then raise exception using errcode='23514',message='Upload is not available'; end if;
end $$;

create function public.update_customer_settings_profile(p_owner uuid,p_data jsonb,p_image_public_id text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old text; v_image public.customer_profile_image_cleanup%rowtype;
begin
  if p_owner is null or jsonb_typeof(p_data) is distinct from 'object' then
    raise exception using errcode='23514',message='Invalid profile';
  end if;
  if p_image_public_id is not null then
    select * into v_image from public.customer_profile_image_cleanup where user_id=p_owner and public_id=p_image_public_id for update;
    if not found or v_image.claimed or v_image.detached or v_image.url is null or v_image.mime_type is null or v_image.size_bytes is null then
      raise exception using errcode='23514',message='Upload is not available';
    end if;
  end if;
  select profile_image_public_id into v_old from public.customer_profiles where id=p_owner for update;
  if not found then raise exception using errcode='P0002',message='Profile not found'; end if;
  update public.customer_profiles set first_name=p_data->>'first_name',last_name=p_data->>'last_name',
    phone_number=p_data->>'phone_number',phone_number_normalized=p_data->>'phone_number_normalized',brief_bio=nullif(p_data->>'brief_bio',''),
    bank_account_name=nullif(p_data->>'bank_account_name',''),bank_name=nullif(p_data->>'bank_name',''),bank_account_number=nullif(p_data->>'bank_account_number',''),
    street_address=p_data->>'street_address',zip_code=p_data->>'zip_code',city=p_data->>'city',state=p_data->>'state',country=p_data->>'country',
    profile_image_public_id=case when p_image_public_id is null then profile_image_public_id else v_image.public_id end,
    profile_image_url=case when p_image_public_id is null then profile_image_url else v_image.url end,
    profile_image_mime_type=case when p_image_public_id is null then profile_image_mime_type else v_image.mime_type end,
    profile_image_size_bytes=case when p_image_public_id is null then profile_image_size_bytes else v_image.size_bytes end
    where id=p_owner;
  if p_image_public_id is not null then
    delete from public.customer_profile_image_cleanup where user_id=p_owner and public_id=p_image_public_id;
    if v_old is not null and v_old<>p_image_public_id then insert into public.customer_profile_image_cleanup(user_id,public_id,detached) values(p_owner,v_old,true) on conflict(public_id) do update set detached=true,claimed=false; end if;
  end if;
  return public.read_customer_settings_profile(p_owner);
end $$;

create function public.claim_customer_profile_image_cleanup(p_owner uuid) returns setof text
language sql security definer set search_path=public,pg_temp as $$
  with candidates as (select public_id from public.customer_profile_image_cleanup where user_id=p_owner and not claimed and
    (detached or created_at<clock_timestamp()-interval '1 hour') order by created_at,public_id limit 10 for update skip locked)
  update public.customer_profile_image_cleanup c set claimed=true from candidates x where c.public_id=x.public_id returning c.public_id;
$$;
create function public.release_customer_profile_image_cleanup(p_owner uuid,p_public_id text,p_remove boolean) returns void
language sql security definer set search_path=public,pg_temp as $$
  delete from public.customer_profile_image_cleanup where p_remove and user_id=p_owner and public_id=p_public_id and claimed;
  update public.customer_profile_image_cleanup set claimed=false where not p_remove and user_id=p_owner and public_id=p_public_id and claimed;
$$;

revoke all on function public.read_customer_settings_profile(uuid),public.journal_customer_profile_image_upload(uuid,text),
  public.reserve_customer_profile_image(uuid,jsonb),public.update_customer_settings_profile(uuid,jsonb,text),public.claim_customer_profile_image_cleanup(uuid),
  public.release_customer_profile_image_cleanup(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.read_customer_settings_profile(uuid),public.journal_customer_profile_image_upload(uuid,text),
  public.reserve_customer_profile_image(uuid,jsonb),public.update_customer_settings_profile(uuid,jsonb,text),public.claim_customer_profile_image_cleanup(uuid),
  public.release_customer_profile_image_cleanup(uuid,text,boolean) to service_role;
commit;
