begin;

-- Keep the legacy five-argument signature for the currently deployed Production
-- API, but do not trust either compatibility timestamp for OTP or proof expiry.
create or replace function public.verify_customer_password_reset_otp(
  p_email text,
  p_code_hash text,
  p_proof_hash text,
  p_proof_expires_at timestamptz default now(),
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
  v_now timestamptz := clock_timestamp();
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
  elsif v_challenge.expires_at <= v_now then
    update public.otp_challenges set invalidated_at = v_now where id = v_challenge.id;
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
  set consumed_at = v_now,
      verified_proof_hash = p_proof_hash,
      verified_proof_expires_at = v_now + interval '10 minutes',
      verified_proof_consumed_at = null
  where id = v_challenge.id;

  return query select 'VERIFIED', null::integer;
end;
$$;

-- Reassert the existing service-role-only posture after replacing the body.
revoke all on function public.verify_customer_password_reset_otp(text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.verify_customer_password_reset_otp(text, text, text, timestamptz, timestamptz) to service_role;

commit;
