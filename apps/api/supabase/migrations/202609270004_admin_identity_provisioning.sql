begin;

-- Supabase Auth may persist app_metadata after the initial auth.users INSERT.
-- This one-time server nonce lets the existing INSERT trigger identify an
-- already-authorized Admin provisioning operation without trusting public
-- user_metadata for authorization.
create table public.admin_identity_provisioning (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid unique references public.admin_invitations(id) on delete cascade,
  email text not null check (email=lower(btrim(email)) and char_length(email)<=254),
  account_domain text not null check (account_domain in ('ADMIN_INVITED','ADMIN')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  constraint admin_identity_provisioning_purpose check (
    (account_domain='ADMIN_INVITED' and invitation_id is not null)
    or (account_domain='ADMIN' and invitation_id is null)
  ),
  constraint admin_identity_provisioning_consumption check (
    (consumed_at is null and auth_user_id is null)
    or (consumed_at is not null and auth_user_id is not null)
  )
);
create index admin_identity_provisioning_expiry_idx
  on public.admin_identity_provisioning(expires_at)
  where consumed_at is null;

alter table public.admin_identity_provisioning enable row level security;
revoke all on public.admin_identity_provisioning from public,anon,authenticated,service_role;

create function public.reserve_admin_identity_provisioning(p_invitation uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_invitation public.admin_invitations%rowtype; v_id uuid;
begin
  select * into v_invitation from public.admin_invitations
    where id=p_invitation and auth_user_id is null and accepted_at is null
      and revoked_at is null and expires_at>clock_timestamp()
    for update;
  if not found then
    raise exception using errcode='P0002',message='Invitation is invalid or expired';
  end if;
  delete from public.admin_identity_provisioning
    where invitation_id=p_invitation and consumed_at is null;
  insert into public.admin_identity_provisioning(invitation_id,email,account_domain,expires_at)
    values(p_invitation,v_invitation.email,'ADMIN_INVITED',clock_timestamp()+interval '10 minutes')
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.sync_customer_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_google boolean := coalesce(new.raw_app_meta_data->>'provider', '') = 'google';
  v_admin boolean := coalesce(new.raw_app_meta_data->>'account_domain','') in ('ADMIN_INVITED','ADMIN');
  v_provisioning_text text := nullif(new.raw_user_meta_data->>'admin_provisioning_id','');
  v_provisioned_domain text;
  v_first text := nullif(btrim(coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name')), '');
  v_last text := nullif(btrim(coalesce(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name')), '');
begin
  if v_admin then return new; end if;

  if tg_op='INSERT' and v_provisioning_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    update public.admin_identity_provisioning
      set consumed_at=clock_timestamp(),auth_user_id=new.id
      where id=v_provisioning_text::uuid
        and email=lower(btrim(new.email))
        and consumed_at is null
        and expires_at>clock_timestamp()
      returning account_domain into v_provisioned_domain;
    if found and v_provisioned_domain in ('ADMIN_INVITED','ADMIN') then
      return new;
    end if;
  end if;

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

create or replace function public.attach_admin_invitation_identity(p_invitation uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.admin_invitations i set auth_user_id=p_user,updated_at=clock_timestamp() from auth.users u
    where i.id=p_invitation and i.accepted_at is null and i.revoked_at is null and u.id=p_user and lower(u.email)=i.email
      and u.raw_app_meta_data->>'account_domain'='ADMIN_INVITED' and i.auth_user_id is null
      and exists(select 1 from public.admin_identity_provisioning p
        where p.invitation_id=i.id and p.auth_user_id=p_user and p.account_domain='ADMIN_INVITED' and p.consumed_at is not null);
  if not found then raise exception using errcode='23514',message='Invitation identity cannot be attached'; end if;
end $$;

revoke all on function public.reserve_admin_identity_provisioning(uuid) from public,anon,authenticated;
grant execute on function public.reserve_admin_identity_provisioning(uuid) to service_role;

commit;
