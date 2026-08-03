begin;

create or replace function public.complete_customer_buyer_onboarding(
  p_user_id uuid,
  p_skip boolean default false,
  p_preferred_locations text[] default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_currency public.supported_currency default 'NGN',
  p_now timestamptz default now()
)
returns table (
  result_status text,
  result_active_persona public.persona_type,
  result_onboarding_status public.persona_onboarding_status,
  result_preferred_locations text[],
  result_budget_min numeric,
  result_budget_max numeric,
  result_currency public.supported_currency,
  result_skipped boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_persona public.user_personas%rowtype;
  v_buyer public.buyer_profiles%rowtype;
begin
  select p.* into v_profile
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return query select 'ACCOUNT_NOT_FOUND', null::public.persona_type,
      null::public.persona_onboarding_status, array[]::text[], null::numeric,
      null::numeric, null::public.supported_currency, p_skip;
    return;
  end if;

  if v_profile.account_status = 'PENDING_VERIFICATION'
    or v_profile.email_verified_at is null then
    return query select 'ACCOUNT_VERIFICATION_REQUIRED', v_profile.active_persona,
      null::public.persona_onboarding_status, array[]::text[], null::numeric,
      null::numeric, null::public.supported_currency, p_skip;
    return;
  elsif v_profile.account_status = 'SUSPENDED' then
    return query select 'ACCOUNT_SUSPENDED', v_profile.active_persona,
      null::public.persona_onboarding_status, array[]::text[], null::numeric,
      null::numeric, null::public.supported_currency, p_skip;
    return;
  elsif v_profile.account_status = 'LOCKED' then
    return query select 'ACCOUNT_LOCKED', v_profile.active_persona,
      null::public.persona_onboarding_status, array[]::text[], null::numeric,
      null::numeric, null::public.supported_currency, p_skip;
    return;
  end if;

  select up.* into v_persona
  from public.user_personas up
  where up.user_id = p_user_id and up.persona_type = 'BUYER'
  for update;

  if not found then
    return query select 'BUYER_PERSONA_NOT_ACTIVE', v_profile.active_persona,
      null::public.persona_onboarding_status, array[]::text[], null::numeric,
      null::numeric, null::public.supported_currency, p_skip;
    return;
  end if;

  if not p_skip then
    if p_preferred_locations is null or cardinality(p_preferred_locations) = 0 then
      return query select 'ONBOARDING_VALIDATION_ERROR', v_profile.active_persona,
        v_persona.onboarding_status, array[]::text[], null::numeric,
        null::numeric, null::public.supported_currency, false;
      return;
    end if;

    if p_budget_min < 0 or p_budget_max < 0 then
      return query select 'ONBOARDING_VALIDATION_ERROR', v_profile.active_persona,
        v_persona.onboarding_status, p_preferred_locations, p_budget_min,
        p_budget_max, p_currency, false;
      return;
    end if;

    if p_budget_min is not null and p_budget_max is not null
      and p_budget_max < p_budget_min then
      return query select 'INVALID_BUDGET_RANGE', v_profile.active_persona,
        v_persona.onboarding_status, p_preferred_locations, p_budget_min,
        p_budget_max, p_currency, false;
      return;
    end if;

    insert into public.buyer_profiles (
      user_persona_id, preferred_locations, budget_min, budget_max, currency,
      created_at, updated_at
    ) values (
      v_persona.id, p_preferred_locations, p_budget_min, p_budget_max,
      p_currency, p_now, p_now
    )
    on conflict (user_persona_id) do update set
      preferred_locations = excluded.preferred_locations,
      budget_min = excluded.budget_min,
      budget_max = excluded.budget_max,
      currency = excluded.currency,
      updated_at = p_now;
  end if;

  update public.user_personas
  set onboarding_status = 'COMPLETED',
      onboarding_completed_at = coalesce(onboarding_completed_at, p_now),
      updated_at = p_now
  where id = v_persona.id
  returning * into v_persona;

  update public.profiles
  set active_persona = 'BUYER', last_active_persona = 'BUYER'
  where id = p_user_id
  returning * into v_profile;

  insert into public.customer_records (user_id, registration_source, updated_at)
  values (p_user_id, 'CUSTOMER_APP', p_now)
  on conflict (user_id) do update set updated_at = p_now;

  select bp.* into v_buyer
  from public.buyer_profiles bp
  where bp.user_persona_id = v_persona.id;

  return query select 'OK', 'BUYER'::public.persona_type,
    v_persona.onboarding_status,
    coalesce(v_buyer.preferred_locations, array[]::text[]),
    v_buyer.budget_min, v_buyer.budget_max,
    coalesce(v_buyer.currency, 'NGN'::public.supported_currency), p_skip;
end;
$$;

create or replace function public.complete_customer_seller_onboarding(
  p_user_id uuid,
  p_skip boolean default false,
  p_profile_type public.profile_type_v2 default null,
  p_company_name text default null,
  p_company_address text default null,
  p_now timestamptz default now()
)
returns table (
  result_status text,
  result_active_persona public.persona_type,
  result_onboarding_status public.persona_onboarding_status,
  result_profile_type public.profile_type_v2,
  result_company_name text,
  result_company_address text,
  result_skipped boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_persona public.user_personas%rowtype;
  v_seller public.seller_profiles%rowtype;
begin
  select p.* into v_profile
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return query select 'ACCOUNT_NOT_FOUND', null::public.persona_type,
      null::public.persona_onboarding_status, null::public.profile_type_v2,
      null::text, null::text, p_skip;
    return;
  end if;

  if v_profile.account_status = 'PENDING_VERIFICATION'
    or v_profile.email_verified_at is null then
    return query select 'ACCOUNT_VERIFICATION_REQUIRED', v_profile.active_persona,
      null::public.persona_onboarding_status, null::public.profile_type_v2,
      null::text, null::text, p_skip;
    return;
  elsif v_profile.account_status = 'SUSPENDED' then
    return query select 'ACCOUNT_SUSPENDED', v_profile.active_persona,
      null::public.persona_onboarding_status, null::public.profile_type_v2,
      null::text, null::text, p_skip;
    return;
  elsif v_profile.account_status = 'LOCKED' then
    return query select 'ACCOUNT_LOCKED', v_profile.active_persona,
      null::public.persona_onboarding_status, null::public.profile_type_v2,
      null::text, null::text, p_skip;
    return;
  end if;

  select up.* into v_persona
  from public.user_personas up
  where up.user_id = p_user_id and up.persona_type = 'SELLER_DEVELOPER'
  for update;

  if not found then
    return query select 'SELLER_PERSONA_NOT_ACTIVE', v_profile.active_persona,
      null::public.persona_onboarding_status, null::public.profile_type_v2,
      null::text, null::text, p_skip;
    return;
  end if;

  if not p_skip then
    if p_profile_type is null then
      return query select 'ONBOARDING_VALIDATION_ERROR', v_profile.active_persona,
        v_persona.onboarding_status, null::public.profile_type_v2,
        null::text, null::text, false;
      return;
    end if;

    if p_profile_type = 'BUSINESS'
      and (nullif(trim(p_company_name), '') is null
        or nullif(trim(p_company_address), '') is null) then
      return query select 'ONBOARDING_VALIDATION_ERROR', v_profile.active_persona,
        v_persona.onboarding_status, p_profile_type,
        p_company_name, p_company_address, false;
      return;
    end if;

    insert into public.seller_profiles (
      user_persona_id, profile_type, company_name, company_address,
      created_at, updated_at
    ) values (
      v_persona.id, p_profile_type,
      case when p_profile_type = 'BUSINESS' then trim(p_company_name) else null end,
      case when p_profile_type = 'BUSINESS' then trim(p_company_address) else null end,
      p_now, p_now
    )
    on conflict (user_persona_id) do update set
      profile_type = excluded.profile_type,
      company_name = excluded.company_name,
      company_address = excluded.company_address,
      updated_at = p_now;
  end if;

  update public.user_personas
  set onboarding_status = 'COMPLETED',
      onboarding_completed_at = coalesce(onboarding_completed_at, p_now),
      updated_at = p_now
  where id = v_persona.id
  returning * into v_persona;

  update public.profiles
  set active_persona = 'SELLER_DEVELOPER',
      last_active_persona = 'SELLER_DEVELOPER'
  where id = p_user_id
  returning * into v_profile;

  insert into public.customer_records (user_id, registration_source, updated_at)
  values (p_user_id, 'CUSTOMER_APP', p_now)
  on conflict (user_id) do update set updated_at = p_now;

  select sp.* into v_seller
  from public.seller_profiles sp
  where sp.user_persona_id = v_persona.id;

  return query select 'OK', 'SELLER_DEVELOPER'::public.persona_type,
    v_persona.onboarding_status, v_seller.profile_type,
    v_seller.company_name, v_seller.company_address, p_skip;
end;
$$;

create or replace function public.activate_customer_persona(
  p_user_id uuid,
  p_persona_type public.persona_type,
  p_now timestamptz default now()
)
returns table (
  result_status text,
  result_active_persona public.persona_type,
  result_personas public.persona_type[],
  result_onboarding_status public.persona_onboarding_status,
  result_already_activated boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_persona public.user_personas%rowtype;
  v_personas public.persona_type[];
  v_already_activated boolean;
begin
  select p.* into v_profile
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return query select 'ACCOUNT_NOT_FOUND', null::public.persona_type,
      array[]::public.persona_type[], null::public.persona_onboarding_status, false;
    return;
  end if;

  if v_profile.account_status = 'PENDING_VERIFICATION'
    or v_profile.email_verified_at is null then
    return query select 'ACCOUNT_VERIFICATION_REQUIRED', v_profile.active_persona,
      array[]::public.persona_type[], null::public.persona_onboarding_status, false;
    return;
  elsif v_profile.account_status = 'SUSPENDED' then
    return query select 'ACCOUNT_SUSPENDED', v_profile.active_persona,
      array[]::public.persona_type[], null::public.persona_onboarding_status, false;
    return;
  elsif v_profile.account_status = 'LOCKED' then
    return query select 'ACCOUNT_LOCKED', v_profile.active_persona,
      array[]::public.persona_type[], null::public.persona_onboarding_status, false;
    return;
  end if;

  select exists (
    select 1 from public.user_personas up
    where up.user_id = p_user_id and up.persona_type = p_persona_type
  ) into v_already_activated;

  insert into public.user_personas (
    user_id, persona_type, onboarding_status, activated_at, created_at, updated_at
  ) values (
    p_user_id, p_persona_type, 'NOT_STARTED', p_now, p_now, p_now
  )
  on conflict (user_id, persona_type) do nothing;

  select up.* into v_persona
  from public.user_personas up
  where up.user_id = p_user_id and up.persona_type = p_persona_type;

  update public.profiles
  set active_persona = p_persona_type,
      last_active_persona = p_persona_type
  where id = p_user_id;

  insert into public.customer_records (user_id, registration_source, updated_at)
  values (p_user_id, 'CUSTOMER_APP', p_now)
  on conflict (user_id) do update set updated_at = p_now;

  select coalesce(
    array_agg(up.persona_type order by up.activated_at),
    array[]::public.persona_type[]
  ) into v_personas
  from public.user_personas up
  where up.user_id = p_user_id;

  return query select 'OK', p_persona_type, v_personas,
    v_persona.onboarding_status, v_already_activated;
end;
$$;

create or replace function public.switch_customer_active_persona(
  p_user_id uuid,
  p_persona_type public.persona_type,
  p_now timestamptz default now()
)
returns table (
  result_status text,
  result_active_persona public.persona_type,
  result_onboarding_status public.persona_onboarding_status,
  result_already_active boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_persona public.user_personas%rowtype;
  v_already_active boolean;
begin
  select p.* into v_profile
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return query select 'ACCOUNT_NOT_FOUND', null::public.persona_type,
      null::public.persona_onboarding_status, false;
    return;
  end if;

  if v_profile.account_status = 'PENDING_VERIFICATION'
    or v_profile.email_verified_at is null then
    return query select 'ACCOUNT_VERIFICATION_REQUIRED', v_profile.active_persona,
      null::public.persona_onboarding_status, false;
    return;
  elsif v_profile.account_status = 'SUSPENDED' then
    return query select 'ACCOUNT_SUSPENDED', v_profile.active_persona,
      null::public.persona_onboarding_status, false;
    return;
  elsif v_profile.account_status = 'LOCKED' then
    return query select 'ACCOUNT_LOCKED', v_profile.active_persona,
      null::public.persona_onboarding_status, false;
    return;
  end if;

  select up.* into v_persona
  from public.user_personas up
  where up.user_id = p_user_id and up.persona_type = p_persona_type
  for update;

  if not found then
    return query select 'PERSONA_NOT_ACTIVATED', v_profile.active_persona,
      null::public.persona_onboarding_status, false;
    return;
  end if;

  v_already_active := v_profile.active_persona = p_persona_type;

  update public.profiles
  set active_persona = p_persona_type,
      last_active_persona = p_persona_type
  where id = p_user_id;

  insert into public.customer_records (user_id, registration_source, updated_at)
  values (p_user_id, 'CUSTOMER_APP', p_now)
  on conflict (user_id) do update set updated_at = p_now;

  return query select 'OK', p_persona_type,
    v_persona.onboarding_status, v_already_active;
end;
$$;

revoke all on function public.complete_customer_buyer_onboarding(
  uuid, boolean, text[], numeric, numeric, public.supported_currency, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_customer_buyer_onboarding(
  uuid, boolean, text[], numeric, numeric, public.supported_currency, timestamptz
) to service_role;

revoke all on function public.complete_customer_seller_onboarding(
  uuid, boolean, public.profile_type_v2, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_customer_seller_onboarding(
  uuid, boolean, public.profile_type_v2, text, text, timestamptz
) to service_role;

revoke all on function public.activate_customer_persona(
  uuid, public.persona_type, timestamptz
) from public, anon, authenticated;
grant execute on function public.activate_customer_persona(
  uuid, public.persona_type, timestamptz
) to service_role;

revoke all on function public.switch_customer_active_persona(
  uuid, public.persona_type, timestamptz
) from public, anon, authenticated;
grant execute on function public.switch_customer_active_persona(
  uuid, public.persona_type, timestamptz
) to service_role;

commit;
