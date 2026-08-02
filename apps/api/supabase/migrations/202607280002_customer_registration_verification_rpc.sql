begin;

create or replace function public.secure_hash_equals(left_hash text, right_hash text)
returns boolean
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  left_bytes bytea;
  right_bytes bytea;
  difference integer := 0;
  position integer;
begin
  left_bytes := decode(left_hash, 'hex');
  right_bytes := decode(right_hash, 'hex');

  if octet_length(left_bytes) <> octet_length(right_bytes) then
    return false;
  end if;

  if octet_length(left_bytes) = 0 then
    return false;
  end if;

  for position in 0..octet_length(left_bytes) - 1 loop
    difference := difference |
      (get_byte(left_bytes, position) # get_byte(right_bytes, position));
  end loop;

  return difference = 0;
exception when invalid_parameter_value or data_exception then
  return false;
end;
$$;

create or replace function public.verify_customer_email_otp(
  p_email text,
  p_code_hash text,
  p_now timestamptz default now()
)
returns table (
  result_status text,
  result_user_id uuid,
  result_account_status public.customer_account_status,
  result_email_verified boolean,
  result_active_persona public.persona_type,
  result_personas public.persona_type[],
  result_onboarding_status public.persona_onboarding_status,
  result_next_action text,
  result_attempts_remaining integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_challenge public.otp_challenges%rowtype;
  v_onboarding public.persona_onboarding_status;
  v_personas public.persona_type[];
begin
  select p.*
  into v_profile
  from public.profiles p
  where lower(trim(p.email)) = lower(trim(p_email))
  for update;

  if not found then
    return query select 'INVALID_OTP', null::uuid, null::public.customer_account_status,
      false, null::public.persona_type, array[]::public.persona_type[],
      null::public.persona_onboarding_status, null::text, 0;
    return;
  end if;

  if exists (
    select 1 from public.otp_challenges oc
    where oc.customer_user_id = v_profile.id
      and oc.purpose = 'CUSTOMER_EMAIL_VERIFICATION'
      and public.secure_hash_equals(oc.code_hash, p_code_hash)
      and oc.invalidated_at is not null
  ) then
    return query select 'OTP_SUPERSEDED', v_profile.id, v_profile.account_status,
      v_profile.email_verified_at is not null, v_profile.active_persona,
      array[]::public.persona_type[], null::public.persona_onboarding_status, null::text, 0;
    return;
  end if;

  if exists (
    select 1 from public.otp_challenges oc
    where oc.customer_user_id = v_profile.id
      and oc.purpose = 'CUSTOMER_EMAIL_VERIFICATION'
      and public.secure_hash_equals(oc.code_hash, p_code_hash)
      and oc.consumed_at is not null
  ) then
    return query select 'OTP_CONSUMED', v_profile.id, v_profile.account_status,
      v_profile.email_verified_at is not null, v_profile.active_persona,
      array[]::public.persona_type[], null::public.persona_onboarding_status, null::text, 0;
    return;
  end if;

  select oc.*
  into v_challenge
  from public.otp_challenges oc
  where oc.customer_user_id = v_profile.id
    and oc.purpose = 'CUSTOMER_EMAIL_VERIFICATION'
    and oc.consumed_at is null
    and oc.invalidated_at is null
  order by oc.created_at desc
  limit 1
  for update;

  if not found then
    return query select 'INVALID_OTP', v_profile.id, v_profile.account_status,
      v_profile.email_verified_at is not null, v_profile.active_persona,
      array[]::public.persona_type[], null::public.persona_onboarding_status, null::text, 0;
    return;
  end if;

  if v_challenge.expires_at <= p_now then
    update public.otp_challenges
    set invalidated_at = p_now
    where id = v_challenge.id;

    return query select 'OTP_EXPIRED', v_profile.id, v_profile.account_status,
      false, null::public.persona_type, array[]::public.persona_type[],
      null::public.persona_onboarding_status, null::text, 0;
    return;
  end if;

  if v_challenge.attempt_count >= v_challenge.max_attempts then
    return query select 'OTP_MAX_ATTEMPTS', v_profile.id, v_profile.account_status,
      false, null::public.persona_type, array[]::public.persona_type[],
      null::public.persona_onboarding_status, null::text, 0;
    return;
  end if;

  if not public.secure_hash_equals(v_challenge.code_hash, p_code_hash) then
    update public.otp_challenges
    set attempt_count = attempt_count + 1
    where id = v_challenge.id;

    if v_challenge.attempt_count + 1 >= v_challenge.max_attempts then
      return query select 'OTP_MAX_ATTEMPTS', v_profile.id, v_profile.account_status,
        false, null::public.persona_type, array[]::public.persona_type[],
        null::public.persona_onboarding_status, null::text, 0;
    else
      return query select 'INVALID_OTP', v_profile.id, v_profile.account_status,
        false, null::public.persona_type, array[]::public.persona_type[],
        null::public.persona_onboarding_status, null::text,
        greatest(v_challenge.max_attempts - (v_challenge.attempt_count + 1), 0)::integer;
    end if;
    return;
  end if;

  update public.otp_challenges
  set consumed_at = p_now
  where id = v_challenge.id;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, p_now),
      updated_at = p_now
  where id = v_profile.id;

  if not found then
    raise exception 'Managed Auth user is missing for customer profile';
  end if;

  update public.profiles
  set account_status = 'ACTIVE',
      email_verified_at = coalesce(email_verified_at, p_now),
      active_persona = initial_persona,
      last_active_persona = initial_persona,
      verification_status = 'verified',
      is_active = true
  where id = v_profile.id
  returning * into v_profile;

  insert into public.user_personas (
    user_id, persona_type, onboarding_status, activated_at
  ) values (
    v_profile.id, v_profile.initial_persona, 'NOT_STARTED', p_now
  )
  on conflict (user_id, persona_type) do nothing;

  select up.onboarding_status
  into v_onboarding
  from public.user_personas up
  where up.user_id = v_profile.id
    and up.persona_type = v_profile.initial_persona;

  insert into public.customer_records (user_id, registration_source)
  values (v_profile.id, 'CUSTOMER_APP')
  on conflict (user_id) do update
    set updated_at = p_now;

  select coalesce(array_agg(up.persona_type order by up.activated_at), array[]::public.persona_type[])
  into v_personas
  from public.user_personas up
  where up.user_id = v_profile.id;

  return query select
    'VERIFIED',
    v_profile.id,
    v_profile.account_status,
    true,
    v_profile.active_persona,
    v_personas,
    v_onboarding,
    case v_profile.active_persona
      when 'BUYER' then 'COMPLETE_BUYER_ONBOARDING'
      else 'COMPLETE_SELLER_ONBOARDING'
    end,
    null::integer;
end;
$$;

create or replace function public.replace_customer_verification_otp(
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
  select p.*
  into v_profile
  from public.profiles p
  where lower(trim(p.email)) = lower(trim(p_email))
  for update;

  if not found then
    return query select 'NOT_ELIGIBLE', null::uuid, null::uuid, null::text,
      null::text, null::timestamptz;
    return;
  end if;

  if v_profile.account_status <> 'PENDING_VERIFICATION'
    or v_profile.email_verified_at is not null then
    return query select 'NOT_ELIGIBLE', null::uuid, null::uuid, null::text,
      null::text, null::timestamptz;
    return;
  end if;

  select oc.*
  into v_current
  from public.otp_challenges oc
  where oc.customer_user_id = v_profile.id
    and oc.purpose = 'CUSTOMER_EMAIL_VERIFICATION'
    and oc.consumed_at is null
    and oc.invalidated_at is null
  order by oc.created_at desc
  limit 1
  for update;

  if found and v_current.resend_available_at > p_now then
    return query select 'COOLDOWN', v_current.id, v_profile.id, null::text,
      null::text, v_current.resend_available_at;
    return;
  end if;

  update public.otp_challenges
  set invalidated_at = p_now
  where customer_user_id = v_profile.id
    and purpose = 'CUSTOMER_EMAIL_VERIFICATION'
    and consumed_at is null
    and invalidated_at is null;

  insert into public.otp_challenges (
    customer_user_id,
    purpose,
    code_hash,
    attempt_count,
    max_attempts,
    expires_at,
    resend_available_at
  ) values (
    v_profile.id,
    'CUSTOMER_EMAIL_VERIFICATION',
    p_code_hash,
    0,
    p_max_attempts,
    p_expires_at,
    p_resend_available_at
  ) returning id into v_challenge_id;

  return query select 'REPLACED', v_challenge_id, v_profile.id,
    v_profile.email, v_profile.full_name, p_resend_available_at;
end;
$$;

revoke all on function public.verify_customer_email_otp(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.verify_customer_email_otp(text, text, timestamptz)
  to service_role;

revoke all on function public.replace_customer_verification_otp(text, text, timestamptz, timestamptz, smallint, timestamptz)
  from public, anon, authenticated;
grant execute on function public.replace_customer_verification_otp(text, text, timestamptz, timestamptz, smallint, timestamptz)
  to service_role;

revoke all on function public.secure_hash_equals(text, text)
  from public, anon, authenticated;

commit;
