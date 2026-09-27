begin;

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 160 and full_name=btrim(full_name) and full_name !~ '[[:cntrl:]]'),
  email text not null unique check (email=lower(btrim(email)) and char_length(email)<=254),
  phone_normalized text not null unique check (phone_normalized ~ '^\+[1-9][0-9]{6,14}$'),
  department text not null check (department in ('TECH','MANAGEMENT')),
  admin_role text not null check (admin_role in ('ADMIN','SUPER_ADMIN')),
  active boolean not null default true,
  accepted_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email=lower(btrim(email)) and char_length(email)<=254),
  full_name text not null check (char_length(full_name) between 2 and 160 and full_name=btrim(full_name) and full_name !~ '[[:cntrl:]]'),
  phone_normalized text not null check (phone_normalized ~ '^\+[1-9][0-9]{6,14}$'),
  department text not null check (department in ('TECH','MANAGEMENT')),
  admin_role text not null check (admin_role in ('ADMIN','SUPER_ADMIN')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  acceptance_claim uuid,
  acceptance_claim_until timestamptz,
  invited_by uuid not null references public.admin_profiles(user_id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint admin_invitation_state check (accepted_at is null or (auth_user_id is not null and revoked_at is null)),
  constraint admin_invitation_claim check ((acceptance_claim is null)=(acceptance_claim_until is null))
);
create index admin_invitations_expiry_idx on public.admin_invitations(expires_at) where accepted_at is null and revoked_at is null;

create table public.admin_auth_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references public.admin_profiles(user_id) on delete cascade,
  encrypted_tokens text not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  refresh_lock uuid,
  refresh_lock_until timestamptz
);
create index admin_auth_sessions_user_idx on public.admin_auth_sessions(user_id);
create index admin_auth_sessions_expiry_idx on public.admin_auth_sessions(expires_at);

alter table public.admin_profiles enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.admin_auth_sessions enable row level security;
revoke all on public.admin_profiles,public.admin_invitations,public.admin_auth_sessions from public,anon,authenticated,service_role;

-- Admin identities share Supabase Auth but never become customer profiles.
create or replace function public.sync_customer_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_google boolean := coalesce(new.raw_app_meta_data->>'provider', '') = 'google';
  v_admin boolean := coalesce(new.raw_app_meta_data->>'account_domain','') in ('ADMIN_INVITED','ADMIN');
  v_first text := nullif(btrim(coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name')), '');
  v_last text := nullif(btrim(coalesce(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name')), '');
begin
  if v_admin then return new; end if;
  if tg_op = 'UPDATE' then
    update public.customer_profiles set email = lower(btrim(new.email)), email_verified_at = new.email_confirmed_at where id = new.id;
    return new;
  end if;
  if not v_google and (v_first is null or v_last is null or nullif(new.raw_user_meta_data->>'country_code', '') is null
    or nullif(new.raw_user_meta_data->>'phone_number', '') is null or nullif(new.raw_user_meta_data->>'phone_number_normalized', '') is null
    or nullif(new.raw_user_meta_data->>'account_type', '') is null or nullif(new.raw_user_meta_data->>'profile_type', '') is null) then
    raise exception using errcode = '23514', message = 'Manual registration profile is incomplete';
  end if;
  insert into public.customer_profiles(id, first_name, last_name, email, country_code, phone_number, phone_number_normalized, account_type, profile_type, email_verified_at)
  values (new.id, v_first, v_last, lower(btrim(new.email)), case when not v_google then new.raw_user_meta_data->>'country_code' end,
    case when not v_google then new.raw_user_meta_data->>'phone_number' end, case when not v_google then new.raw_user_meta_data->>'phone_number_normalized' end,
    case when not v_google then new.raw_user_meta_data->>'account_type' end, case when not v_google then new.raw_user_meta_data->>'profile_type' end, new.email_confirmed_at);
  return new;
end;
$$;

create function public.read_admin_profile(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  select jsonb_build_object('userId',user_id,'fullName',full_name,'email',email,'phone',phone_normalized,
    'department',department,'role',admin_role,'active',active) into v_result from public.admin_profiles where user_id=p_user;
  return v_result;
end $$;

create function public.reserve_admin_invitation(p_inviter uuid,p_full_name text,p_email text,p_phone text,p_department text,p_role text,p_token_hash text,p_seconds integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_existing public.admin_invitations%rowtype; v_auth uuid; v_domain text; v_result public.admin_invitations%rowtype;
begin
  if not exists(select 1 from public.admin_profiles where user_id=p_inviter and active and admin_role='SUPER_ADMIN') then
    raise exception using errcode='42501',message='Admin invitation is not permitted';
  end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 160 or p_email is null or p_email<>lower(btrim(p_email))
    or p_phone !~ '^\+[1-9][0-9]{6,14}$' or p_department not in ('TECH','MANAGEMENT') or p_role not in ('ADMIN','SUPER_ADMIN')
    or p_token_hash !~ '^[a-f0-9]{64}$' or p_seconds not between 3600 and 604800 then
    raise exception using errcode='23514',message='Invalid admin invitation';
  end if;
  select * into v_existing from public.admin_invitations where email=p_email for update;
  if found and v_existing.accepted_at is not null then raise exception using errcode='23505',message='Admin identity already exists'; end if;
  select id,raw_app_meta_data->>'account_domain' into v_auth,v_domain from auth.users where lower(email)=p_email;
  if v_auth is not null and (v_domain<>'ADMIN_INVITED' or (v_existing.id is not null and v_existing.auth_user_id is not null and v_existing.auth_user_id<>v_auth)) then
    raise exception using errcode='23505',message='Identity already exists';
  end if;
  insert into public.admin_invitations(email,full_name,phone_normalized,department,admin_role,token_hash,auth_user_id,expires_at,invited_by)
  values(p_email,btrim(p_full_name),p_phone,p_department,p_role,p_token_hash,v_auth,clock_timestamp()+make_interval(secs=>p_seconds),p_inviter)
  on conflict(email) do update set full_name=excluded.full_name,phone_normalized=excluded.phone_normalized,department=excluded.department,
    admin_role=excluded.admin_role,token_hash=excluded.token_hash,auth_user_id=coalesce(public.admin_invitations.auth_user_id,excluded.auth_user_id),
    expires_at=excluded.expires_at,accepted_at=null,revoked_at=null,acceptance_claim=null,acceptance_claim_until=null,invited_by=excluded.invited_by,updated_at=clock_timestamp()
  returning * into v_result;
  return jsonb_build_object('id',v_result.id,'fullName',v_result.full_name,'email',v_result.email,'phone',v_result.phone_normalized,
    'department',v_result.department,'role',v_result.admin_role,'authUserId',v_result.auth_user_id,'expiresAt',v_result.expires_at);
end $$;

create function public.attach_admin_invitation_identity(p_invitation uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.admin_invitations i set auth_user_id=p_user,updated_at=clock_timestamp() from auth.users u
    where i.id=p_invitation and i.accepted_at is null and i.revoked_at is null and u.id=p_user and lower(u.email)=i.email
      and u.raw_app_meta_data->>'account_domain'='ADMIN_INVITED' and i.auth_user_id is null;
  if not found then raise exception using errcode='23514',message='Invitation identity cannot be attached'; end if;
end $$;

create function public.preview_admin_invitation(p_hash text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v public.admin_invitations%rowtype;
begin
  select * into v from public.admin_invitations where token_hash=p_hash and auth_user_id is not null and accepted_at is null and revoked_at is null and expires_at>clock_timestamp();
  if not found then raise exception using errcode='P0002',message='Invitation is invalid or expired'; end if;
  return jsonb_build_object('fullName',v.full_name,'email',v.email,'department',v.department,'role',v.admin_role,'expiresAt',v.expires_at);
end $$;

create function public.claim_admin_invitation(p_hash text,p_claim uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.admin_invitations%rowtype;
begin
  update public.admin_invitations set acceptance_claim=p_claim,acceptance_claim_until=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp()
    where token_hash=p_hash and auth_user_id is not null and accepted_at is null and revoked_at is null and expires_at>clock_timestamp()
      and (acceptance_claim_until is null or acceptance_claim_until<clock_timestamp()) returning * into v;
  if not found then raise exception using errcode='P0002',message='Invitation is invalid or expired'; end if;
  return jsonb_build_object('authUserId',v.auth_user_id,'fullName',v.full_name,'email',v.email,'department',v.department,'role',v.admin_role);
end $$;

create function public.release_admin_invitation_claim(p_hash text,p_claim uuid) returns void
language sql security definer set search_path=public,pg_temp as $$
  update public.admin_invitations set acceptance_claim=null,acceptance_claim_until=null,updated_at=clock_timestamp()
    where token_hash=p_hash and acceptance_claim=p_claim and accepted_at is null;
$$;

create function public.accept_admin_invitation(p_hash text,p_claim uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.admin_invitations%rowtype; v_result jsonb;
begin
  select * into v from public.admin_invitations where token_hash=p_hash and acceptance_claim=p_claim and acceptance_claim_until>clock_timestamp()
    and auth_user_id=p_user and accepted_at is null and revoked_at is null for update;
  if not found then raise exception using errcode='P0002',message='Invitation is invalid or expired'; end if;
  if not exists(select 1 from auth.users where id=p_user and lower(email)=v.email and raw_app_meta_data->>'account_domain' in ('ADMIN_INVITED','ADMIN')) then
    raise exception using errcode='23514',message='Invitation identity does not match';
  end if;
  insert into public.admin_profiles(user_id,full_name,email,phone_normalized,department,admin_role,accepted_at)
    values(p_user,v.full_name,v.email,v.phone_normalized,v.department,v.admin_role,clock_timestamp());
  update public.admin_invitations set accepted_at=clock_timestamp(),acceptance_claim=null,acceptance_claim_until=null,updated_at=clock_timestamp() where id=v.id;
  select public.read_admin_profile(p_user) into v_result;
  return v_result;
end $$;

create function public.create_admin_auth_session(p_hash text,p_user uuid,p_tokens text,p_seconds integer) returns void
language sql security definer set search_path=public,pg_temp as $$
  insert into public.admin_auth_sessions(token_hash,user_id,encrypted_tokens,expires_at)
  values(p_hash,p_user,p_tokens,clock_timestamp()+make_interval(secs=>greatest(300,least(p_seconds,604800))));
$$;
create function public.read_admin_auth_session(p_hash text) returns setof public.admin_auth_sessions
language sql security definer set search_path=public,pg_temp as $$
  select * from public.admin_auth_sessions where token_hash=p_hash and expires_at>clock_timestamp();
$$;
create function public.claim_admin_auth_refresh(p_hash text,p_lock uuid) returns setof public.admin_auth_sessions
language sql security definer set search_path=public,pg_temp as $$
  update public.admin_auth_sessions set refresh_lock=p_lock,refresh_lock_until=clock_timestamp()+interval '30 seconds'
  where token_hash=p_hash and expires_at>clock_timestamp() and (refresh_lock_until is null or refresh_lock_until<clock_timestamp()) returning *;
$$;
create function public.finish_admin_auth_refresh(p_hash text,p_lock uuid,p_tokens text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.admin_auth_sessions set encrypted_tokens=p_tokens,refresh_lock=null,refresh_lock_until=null where token_hash=p_hash and refresh_lock=p_lock;
  return found;
end $$;
create function public.delete_admin_auth_session(p_hash text) returns void language sql security definer set search_path=public,pg_temp as $$ delete from public.admin_auth_sessions where token_hash=p_hash; $$;
create function public.delete_admin_auth_sessions(p_user uuid) returns void language sql security definer set search_path=public,pg_temp as $$ delete from public.admin_auth_sessions where user_id=p_user; $$;

revoke all on function public.sync_customer_auth_profile(),public.read_admin_profile(uuid),public.reserve_admin_invitation(uuid,text,text,text,text,text,text,integer),
  public.attach_admin_invitation_identity(uuid,uuid),public.preview_admin_invitation(text),public.claim_admin_invitation(text,uuid),
  public.release_admin_invitation_claim(text,uuid),public.accept_admin_invitation(text,uuid,uuid),public.create_admin_auth_session(text,uuid,text,integer),
  public.read_admin_auth_session(text),public.claim_admin_auth_refresh(text,uuid),public.finish_admin_auth_refresh(text,uuid,text),
  public.delete_admin_auth_session(text),public.delete_admin_auth_sessions(uuid) from public,anon,authenticated;
grant execute on function public.read_admin_profile(uuid),public.reserve_admin_invitation(uuid,text,text,text,text,text,text,integer),
  public.attach_admin_invitation_identity(uuid,uuid),public.preview_admin_invitation(text),public.claim_admin_invitation(text,uuid),
  public.release_admin_invitation_claim(text,uuid),public.accept_admin_invitation(text,uuid,uuid),public.create_admin_auth_session(text,uuid,text,integer),
  public.read_admin_auth_session(text),public.claim_admin_auth_refresh(text,uuid),public.finish_admin_auth_refresh(text,uuid,text),
  public.delete_admin_auth_session(text),public.delete_admin_auth_sessions(uuid) to service_role;

commit;
