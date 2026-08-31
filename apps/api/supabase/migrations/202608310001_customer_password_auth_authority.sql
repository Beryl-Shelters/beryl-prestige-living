begin;

-- Supabase Auth owns password hashing and password-policy enforcement. These
-- additive RPCs only consume Beryl's narrow recovery proof and revoke Beryl
-- customer sessions; the API then performs the password update through the
-- server-only Supabase Admin Auth API. The legacy RPCs remain temporarily
-- because Preview and Production currently share this database while running
-- different API releases. Remove them only after every API environment uses
-- the replacement RPCs below.

create or replace function public.consume_customer_password_reset_proof(
  p_proof_hash text
)
returns table(result_status text, result_user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.otp_challenges%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select oc.* into v_challenge
  from public.otp_challenges oc
  where oc.purpose = 'CUSTOMER_PASSWORD_RESET'
    and oc.verified_proof_hash is not null
    and public.secure_hash_equals(oc.verified_proof_hash, p_proof_hash)
  order by oc.created_at desc
  limit 1
  for update;

  if not found then
    return query select 'INVALID_RESET_TOKEN'::text, null::uuid;
    return;
  elsif v_challenge.verified_proof_consumed_at is not null then
    return query select 'RESET_TOKEN_USED'::text, v_challenge.customer_user_id;
    return;
  elsif v_challenge.verified_proof_expires_at is null
    or v_challenge.verified_proof_expires_at <= v_now then
    return query select 'RESET_TOKEN_EXPIRED'::text, v_challenge.customer_user_id;
    return;
  end if;

  perform 1
  from public.profiles p
  where p.id = v_challenge.customer_user_id
  for update;
  if not found then
    raise exception 'Customer profile missing';
  end if;

  update public.otp_challenges
  set verified_proof_consumed_at = v_now
  where id = v_challenge.id;

  update public.profiles
  set session_version = session_version + 1
  where id = v_challenge.customer_user_id;

  update public.customer_sessions
  set revoked_at = coalesce(revoked_at, v_now)
  where user_id = v_challenge.customer_user_id
    and revoked_at is null;

  return query select 'OK'::text, v_challenge.customer_user_id;
end;
$$;

create or replace function public.revoke_customer_sessions_for_password_change(
  p_user_id uuid
)
returns table(result_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select p.* into v_profile
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return query select 'ACCOUNT_NOT_FOUND'::text;
    return;
  elsif v_profile.account_status = 'PENDING_VERIFICATION'
    or v_profile.email_verified_at is null then
    return query select 'ACCOUNT_VERIFICATION_REQUIRED'::text;
    return;
  elsif v_profile.account_status = 'SUSPENDED' then
    return query select 'ACCOUNT_SUSPENDED'::text;
    return;
  elsif v_profile.account_status = 'LOCKED' then
    return query select 'ACCOUNT_LOCKED'::text;
    return;
  end if;

  update public.profiles
  set session_version = session_version + 1
  where id = p_user_id;

  update public.customer_sessions
  set revoked_at = coalesce(revoked_at, v_now)
  where user_id = p_user_id
    and revoked_at is null;

  return query select 'OK'::text;
end;
$$;

revoke all on function public.consume_customer_password_reset_proof(text)
  from public, anon, authenticated;
grant execute on function public.consume_customer_password_reset_proof(text)
  to service_role;

revoke all on function public.revoke_customer_sessions_for_password_change(uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_customer_sessions_for_password_change(uuid)
  to service_role;

commit;
