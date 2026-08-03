begin;

create or replace function public.create_customer_session(
  p_user_id uuid,
  p_session_id uuid,
  p_refresh_token_hash text,
  p_expires_at timestamptz,
  p_now timestamptz default now()
)
returns table (result_status text, result_session_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_persona public.persona_type;
begin
  select p.* into v_profile
  from public.profiles p where p.id = p_user_id for update;

  if not found then
    return query select 'ACCOUNT_NOT_FOUND', null::integer; return;
  elsif v_profile.account_status = 'PENDING_VERIFICATION'
    or v_profile.email_verified_at is null then
    return query select 'ACCOUNT_VERIFICATION_REQUIRED', v_profile.session_version; return;
  elsif v_profile.account_status = 'SUSPENDED' then
    return query select 'ACCOUNT_SUSPENDED', v_profile.session_version; return;
  elsif v_profile.account_status = 'LOCKED' then
    return query select 'ACCOUNT_LOCKED', v_profile.session_version; return;
  end if;

  select up.persona_type into v_persona
  from public.user_personas up
  where up.user_id = p_user_id
    and up.persona_type = coalesce(
      v_profile.last_active_persona,
      v_profile.active_persona,
      v_profile.initial_persona
    )
  limit 1;

  if not found then
    select up.persona_type into v_persona
    from public.user_personas up
    where up.user_id = p_user_id
    order by up.activated_at
    limit 1;
  end if;

  if v_persona is null then
    return query select 'ACCOUNT_NOT_FOUND', v_profile.session_version; return;
  end if;

  insert into public.customer_sessions (
    id, user_id, refresh_token_hash, session_version, expires_at, created_at
  ) values (
    p_session_id, p_user_id, p_refresh_token_hash,
    v_profile.session_version, p_expires_at, p_now
  );

  update public.profiles
  set active_persona = v_persona,
      last_active_persona = v_persona,
      last_login_at = p_now
  where id = p_user_id;

  insert into public.customer_records (user_id, registration_source, updated_at)
  values (p_user_id, 'CUSTOMER_APP', p_now)
  on conflict (user_id) do update set updated_at = p_now;

  return query select 'OK', v_profile.session_version;
end;
$$;

create or replace function public.rotate_customer_session(
  p_user_id uuid,
  p_session_id uuid,
  p_refresh_token_hash text,
  p_replacement_session_id uuid,
  p_replacement_refresh_token_hash text,
  p_replacement_expires_at timestamptz,
  p_now timestamptz default now()
)
returns table (result_status text, result_session_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.customer_sessions%rowtype;
  v_profile public.profiles%rowtype;
begin
  select cs.* into v_session
  from public.customer_sessions cs
  where cs.id = p_session_id and cs.user_id = p_user_id
  for update;

  if not found then
    return query select 'SESSION_NOT_FOUND', null::integer; return;
  elsif v_session.replaced_by_session_id is not null then
    update public.customer_sessions
    set revoked_at = coalesce(revoked_at, p_now)
    where user_id = p_user_id and revoked_at is null;
    return query select 'REFRESH_TOKEN_REUSED', v_session.session_version; return;
  elsif v_session.revoked_at is not null then
    return query select 'REFRESH_TOKEN_REVOKED', v_session.session_version; return;
  elsif v_session.expires_at <= p_now then
    update public.customer_sessions set revoked_at = p_now where id = v_session.id;
    return query select 'REFRESH_TOKEN_EXPIRED', v_session.session_version; return;
  elsif not public.secure_hash_equals(
    v_session.refresh_token_hash,
    p_refresh_token_hash
  ) then
    return query select 'INVALID_REFRESH_TOKEN', v_session.session_version; return;
  end if;

  select p.* into v_profile
  from public.profiles p where p.id = p_user_id for update;

  if not found then
    return query select 'ACCOUNT_NOT_FOUND', null::integer; return;
  elsif v_profile.account_status = 'PENDING_VERIFICATION'
    or v_profile.email_verified_at is null then
    return query select 'ACCOUNT_VERIFICATION_REQUIRED', v_profile.session_version; return;
  elsif v_profile.account_status = 'SUSPENDED' then
    return query select 'ACCOUNT_SUSPENDED', v_profile.session_version; return;
  elsif v_profile.account_status = 'LOCKED' then
    return query select 'ACCOUNT_LOCKED', v_profile.session_version; return;
  elsif v_session.session_version <> v_profile.session_version then
    update public.customer_sessions set revoked_at = coalesce(revoked_at, p_now)
    where id = v_session.id;
    return query select 'REFRESH_TOKEN_REVOKED', v_profile.session_version; return;
  end if;

  insert into public.customer_sessions (
    id, user_id, refresh_token_hash, session_version, expires_at, created_at
  ) values (
    p_replacement_session_id, p_user_id, p_replacement_refresh_token_hash,
    v_profile.session_version, p_replacement_expires_at, p_now
  );

  update public.customer_sessions
  set revoked_at = p_now,
      replaced_by_session_id = p_replacement_session_id,
      last_used_at = p_now
  where id = v_session.id;

  return query select 'OK', v_profile.session_version;
end;
$$;

create or replace function public.revoke_customer_session(
  p_user_id uuid,
  p_session_id uuid,
  p_refresh_token_hash text,
  p_now timestamptz default now()
)
returns table (result_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.customer_sessions%rowtype;
begin
  select cs.* into v_session
  from public.customer_sessions cs
  where cs.id = p_session_id and cs.user_id = p_user_id
  for update;

  if not found then
    return query select 'SESSION_NOT_FOUND'; return;
  elsif not public.secure_hash_equals(
    v_session.refresh_token_hash,
    p_refresh_token_hash
  ) then
    return query select 'INVALID_REFRESH_TOKEN'; return;
  end if;

  update public.customer_sessions
  set revoked_at = coalesce(revoked_at, p_now), last_used_at = p_now
  where id = v_session.id;

  return query select 'OK';
end;
$$;

create or replace function public.replace_customer_password_reset_otp(
  p_email text,
  p_code_hash text,
  p_expires_at timestamptz,
  p_resend_available_at timestamptz,
  p_max_attempts smallint default 3,
  p_now timestamptz default now()
)
returns table (
  result_status text,
  result_challenge_id uuid,
  result_user_id uuid,
  result_email text,
  result_full_name text,
  result_resend_available_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_current public.otp_challenges%rowtype;
  v_challenge_id uuid;
begin
  select p.* into v_profile
  from public.profiles p
  where lower(trim(p.email)) = lower(trim(p_email))
  for update;

  if not found or v_profile.account_status <> 'ACTIVE'
    or v_profile.email_verified_at is null then
    return query select 'NOT_ELIGIBLE', null::uuid, null::uuid, null::text,
      null::text, null::timestamptz; return;
  end if;

  select oc.* into v_current
  from public.otp_challenges oc
  where oc.customer_user_id = v_profile.id
    and oc.purpose = 'CUSTOMER_PASSWORD_RESET'
    and oc.consumed_at is null and oc.invalidated_at is null
  order by oc.created_at desc limit 1 for update;

  if found and v_current.resend_available_at > p_now then
    return query select 'COOLDOWN', v_current.id, v_profile.id, null::text,
      null::text, v_current.resend_available_at; return;
  end if;

  update public.otp_challenges
  set invalidated_at = p_now
  where customer_user_id = v_profile.id
    and purpose = 'CUSTOMER_PASSWORD_RESET'
    and consumed_at is null and invalidated_at is null;

  insert into public.otp_challenges (
    customer_user_id, purpose, code_hash, attempt_count, max_attempts,
    expires_at, resend_available_at
  ) values (
    v_profile.id, 'CUSTOMER_PASSWORD_RESET', p_code_hash, 0,
    p_max_attempts, p_expires_at, p_resend_available_at
  ) returning id into v_challenge_id;

  return query select 'REPLACED', v_challenge_id, v_profile.id,
    v_profile.email, v_profile.full_name, p_resend_available_at;
end;
$$;

create or replace function public.verify_customer_password_reset_otp(
  p_email text,
  p_code_hash text,
  p_proof_hash text,
  p_proof_expires_at timestamptz,
  p_now timestamptz default now()
)
returns table (result_status text, result_attempts_remaining integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_challenge public.otp_challenges%rowtype;
begin
  select p.* into v_profile
  from public.profiles p
  where lower(trim(p.email)) = lower(trim(p_email))
  for update;

  if not found then
    return query select 'INVALID_OTP', 0; return;
  end if;

  if exists (
    select 1 from public.otp_challenges oc
    where oc.customer_user_id = v_profile.id
      and oc.purpose = 'CUSTOMER_PASSWORD_RESET'
      and public.secure_hash_equals(oc.code_hash, p_code_hash)
      and (oc.consumed_at is not null or oc.invalidated_at is not null)
  ) then
    return query select 'OTP_CONSUMED', 0; return;
  end if;

  select oc.* into v_challenge
  from public.otp_challenges oc
  where oc.customer_user_id = v_profile.id
    and oc.purpose = 'CUSTOMER_PASSWORD_RESET'
    and oc.consumed_at is null and oc.invalidated_at is null
  order by oc.created_at desc limit 1 for update;

  if not found then
    return query select 'INVALID_OTP', 0; return;
  elsif v_challenge.expires_at <= p_now then
    update public.otp_challenges set invalidated_at = p_now where id = v_challenge.id;
    return query select 'OTP_EXPIRED', 0; return;
  elsif v_challenge.attempt_count >= v_challenge.max_attempts then
    return query select 'OTP_MAX_ATTEMPTS', 0; return;
  elsif not public.secure_hash_equals(v_challenge.code_hash, p_code_hash) then
    update public.otp_challenges
    set attempt_count = attempt_count + 1 where id = v_challenge.id;
    if v_challenge.attempt_count + 1 >= v_challenge.max_attempts then
      return query select 'OTP_MAX_ATTEMPTS', 0; return;
    end if;
    return query select 'INVALID_OTP',
      greatest(v_challenge.max_attempts - (v_challenge.attempt_count + 1), 0)::integer;
    return;
  end if;

  update public.otp_challenges
  set consumed_at = p_now,
      verified_proof_hash = p_proof_hash,
      verified_proof_expires_at = p_proof_expires_at,
      verified_proof_consumed_at = null
  where id = v_challenge.id;

  return query select 'VERIFIED', null::integer;
end;
$$;

create or replace function public.finalize_customer_password_reset(
  p_proof_hash text,
  p_new_password text,
  p_now timestamptz default now()
)
returns table (result_status text)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_challenge public.otp_challenges%rowtype;
begin
  select oc.* into v_challenge
  from public.otp_challenges oc
  where oc.purpose = 'CUSTOMER_PASSWORD_RESET'
    and oc.verified_proof_hash is not null
    and public.secure_hash_equals(oc.verified_proof_hash, p_proof_hash)
  order by oc.created_at desc limit 1 for update;

  if not found then
    return query select 'INVALID_RESET_TOKEN'; return;
  elsif v_challenge.verified_proof_consumed_at is not null then
    return query select 'RESET_TOKEN_USED'; return;
  elsif v_challenge.verified_proof_expires_at is null
    or v_challenge.verified_proof_expires_at <= p_now then
    return query select 'RESET_TOKEN_EXPIRED'; return;
  end if;

  if exists (
    select 1 from auth.users au
    where au.id = v_challenge.customer_user_id
      and au.encrypted_password = crypt(p_new_password, au.encrypted_password)
  ) then
    return query select 'NEW_PASSWORD_SAME_AS_CURRENT'; return;
  end if;

  perform 1 from public.profiles p
  where p.id = v_challenge.customer_user_id for update;
  if not found then raise exception 'Customer profile missing'; end if;

  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf', 12)),
      updated_at = p_now
  where id = v_challenge.customer_user_id;
  if not found then raise exception 'Managed Auth user missing'; end if;

  update public.otp_challenges
  set verified_proof_consumed_at = p_now
  where id = v_challenge.id;

  update public.profiles
  set session_version = session_version + 1
  where id = v_challenge.customer_user_id;

  update public.customer_sessions
  set revoked_at = coalesce(revoked_at, p_now)
  where user_id = v_challenge.customer_user_id and revoked_at is null;

  return query select 'OK';
end;
$$;

create or replace function public.change_customer_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text,
  p_now timestamptz default now()
)
returns table (result_status text)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select p.* into v_profile
  from public.profiles p where p.id = p_user_id for update;

  if not found then
    return query select 'ACCOUNT_NOT_FOUND'; return;
  elsif v_profile.account_status = 'PENDING_VERIFICATION'
    or v_profile.email_verified_at is null then
    return query select 'ACCOUNT_VERIFICATION_REQUIRED'; return;
  elsif v_profile.account_status = 'SUSPENDED' then
    return query select 'ACCOUNT_SUSPENDED'; return;
  elsif v_profile.account_status = 'LOCKED' then
    return query select 'ACCOUNT_LOCKED'; return;
  end if;

  if not exists (
    select 1 from auth.users au
    where au.id = p_user_id
      and au.encrypted_password = crypt(p_current_password, au.encrypted_password)
  ) then
    return query select 'CURRENT_PASSWORD_INCORRECT'; return;
  end if;

  if exists (
    select 1 from auth.users au
    where au.id = p_user_id
      and au.encrypted_password = crypt(p_new_password, au.encrypted_password)
  ) then
    return query select 'NEW_PASSWORD_SAME_AS_CURRENT'; return;
  end if;

  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf', 12)),
      updated_at = p_now
  where id = p_user_id;
  if not found then raise exception 'Managed Auth user missing'; end if;

  update public.profiles
  set session_version = session_version + 1
  where id = p_user_id;

  update public.customer_sessions
  set revoked_at = coalesce(revoked_at, p_now)
  where user_id = p_user_id and revoked_at is null;

  return query select 'OK';
end;
$$;

revoke all on function public.create_customer_session(uuid, uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.create_customer_session(uuid, uuid, text, timestamptz, timestamptz) to service_role;
revoke all on function public.rotate_customer_session(uuid, uuid, text, uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.rotate_customer_session(uuid, uuid, text, uuid, text, timestamptz, timestamptz) to service_role;
revoke all on function public.revoke_customer_session(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.revoke_customer_session(uuid, uuid, text, timestamptz) to service_role;
revoke all on function public.replace_customer_password_reset_otp(text, text, timestamptz, timestamptz, smallint, timestamptz) from public, anon, authenticated;
grant execute on function public.replace_customer_password_reset_otp(text, text, timestamptz, timestamptz, smallint, timestamptz) to service_role;
revoke all on function public.verify_customer_password_reset_otp(text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.verify_customer_password_reset_otp(text, text, text, timestamptz, timestamptz) to service_role;
revoke all on function public.finalize_customer_password_reset(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_customer_password_reset(text, text, timestamptz) to service_role;
revoke all on function public.change_customer_password(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.change_customer_password(uuid, text, text, timestamptz) to service_role;

commit;
