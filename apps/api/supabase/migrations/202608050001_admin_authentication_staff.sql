-- Additive Admin authentication and staff-management transactions.
-- Admin records intentionally remain separate from customer profiles/auth users.
begin;

create or replace function public.create_admin_invitation(
  p_admin_id uuid,
  p_invited_by_admin_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_department public.admin_department,
  p_admin_role public.admin_role,
  p_password_hash text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_now timestamptz default now()
)
returns table (result_status text, result_admin_id uuid, result_email text, result_full_name text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_existing public.admins%rowtype;
begin
  select * into v_existing from public.admins where lower(trim(email)) = lower(trim(p_email)) for update;
  if found then return query select 'EMAIL_EXISTS', v_existing.id, null::text, null::text; return; end if;
  if p_phone is not null and exists (select 1 from public.admins where phone = p_phone) then
    return query select 'PHONE_EXISTS', null::uuid, null::text, null::text; return;
  end if;
  insert into public.admins (id, full_name, email, phone, department, admin_role, status, password_hash, requires_password_change, created_at, updated_at)
  values (p_admin_id, p_full_name, lower(trim(p_email)), p_phone, p_department, p_admin_role, 'PENDING', p_password_hash, true, p_now, p_now);
  insert into public.admin_invitations (admin_id, invited_by_admin_id, token_hash, status, expires_at, last_sent_at, created_at, updated_at)
  values (p_admin_id, p_invited_by_admin_id, p_token_hash, 'PENDING', p_expires_at, p_now, p_now, p_now);
  return query select 'OK', p_admin_id, lower(trim(p_email)), p_full_name;
end; $$;

create or replace function public.replace_admin_invitation(
  p_admin_id uuid, p_invited_by_admin_id uuid, p_password_hash text, p_token_hash text,
  p_expires_at timestamptz, p_allow_active boolean default false, p_now timestamptz default now()
)
returns table (result_status text, result_email text, result_full_name text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin public.admins%rowtype; v_current public.admin_invitations%rowtype;
begin
  select * into v_admin from public.admins where id = p_admin_id for update;
  if not found then return query select 'NOT_FOUND', null::text, null::text; return; end if;
  if v_admin.status <> 'PENDING' and not (p_allow_active and v_admin.status = 'ACTIVE') then return query select 'INVALID_STATE', null::text, null::text; return; end if;
  select * into v_current from public.admin_invitations where admin_id = p_admin_id and status = 'PENDING' order by created_at desc limit 1 for update;
  if found and v_current.last_sent_at + interval '60 seconds' > p_now then return query select 'COOLDOWN', null::text, null::text; return; end if;
  update public.admin_invitations set status = case when expires_at <= p_now then 'EXPIRED' else 'REVOKED' end, revoked_at = p_now, updated_at = p_now where admin_id = p_admin_id and status = 'PENDING';
  update public.admins set password_hash = p_password_hash, status = 'PENDING', requires_password_change = true, session_version = session_version + 1, updated_at = p_now where id = p_admin_id;
  update public.admin_sessions set revoked_at = coalesce(revoked_at, p_now) where admin_id = p_admin_id and revoked_at is null;
  insert into public.admin_invitations (admin_id, invited_by_admin_id, token_hash, status, expires_at, last_sent_at, created_at, updated_at)
  values (p_admin_id, p_invited_by_admin_id, p_token_hash, 'PENDING', p_expires_at, p_now, p_now, p_now);
  return query select 'OK', v_admin.email, v_admin.full_name;
end; $$;

create or replace function public.replace_admin_otp(
  p_admin_id uuid, p_purpose public.otp_purpose, p_code_hash text, p_expires_at timestamptz,
  p_resend_available_at timestamptz, p_max_attempts smallint default 3, p_now timestamptz default now()
)
returns table (result_status text, result_challenge_id uuid, result_email text, result_full_name text, result_resend_available_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin public.admins%rowtype; v_current public.otp_challenges%rowtype; v_id uuid;
begin
  select * into v_admin from public.admins where id = p_admin_id for update;
  if not found then return query select 'NOT_FOUND', null::uuid, null::text, null::text, null::timestamptz; return; end if;
  select * into v_current from public.otp_challenges where admin_id = p_admin_id and purpose = p_purpose and consumed_at is null and invalidated_at is null order by created_at desc limit 1 for update;
  if found and v_current.resend_available_at > p_now then return query select 'COOLDOWN', v_current.id, null::text, null::text, v_current.resend_available_at; return; end if;
  update public.otp_challenges set invalidated_at = p_now, updated_at = p_now where admin_id = p_admin_id and purpose = p_purpose and consumed_at is null and invalidated_at is null;
  insert into public.otp_challenges (admin_id, purpose, code_hash, attempt_count, max_attempts, expires_at, resend_available_at, created_at, updated_at)
  values (p_admin_id, p_purpose, p_code_hash, 0, p_max_attempts, p_expires_at, p_resend_available_at, p_now, p_now) returning id into v_id;
  return query select 'OK', v_id, v_admin.email, v_admin.full_name, p_resend_available_at;
end; $$;

create or replace function public.verify_admin_otp(
  p_challenge_id uuid, p_purpose public.otp_purpose, p_code_hash text,
  p_proof_hash text, p_proof_expires_at timestamptz, p_now timestamptz default now()
)
returns table (result_status text, result_admin_id uuid, result_attempts_remaining integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_challenge public.otp_challenges%rowtype;
begin
  select * into v_challenge from public.otp_challenges where id = p_challenge_id and purpose = p_purpose for update;
  if not found or v_challenge.admin_id is null then return query select 'INVALID_OTP', null::uuid, 0; return; end if;
  if v_challenge.consumed_at is not null or v_challenge.invalidated_at is not null then return query select 'OTP_CONSUMED', v_challenge.admin_id, 0; return; end if;
  if v_challenge.expires_at <= p_now then update public.otp_challenges set invalidated_at = p_now, updated_at = p_now where id = v_challenge.id; return query select 'OTP_EXPIRED', v_challenge.admin_id, 0; return; end if;
  if v_challenge.attempt_count >= v_challenge.max_attempts then return query select 'OTP_MAX_ATTEMPTS', v_challenge.admin_id, 0; return; end if;
  if not public.secure_hash_equals(v_challenge.code_hash, p_code_hash) then
    update public.otp_challenges set attempt_count = attempt_count + 1, updated_at = p_now where id = v_challenge.id;
    if v_challenge.attempt_count + 1 >= v_challenge.max_attempts then return query select 'OTP_MAX_ATTEMPTS', v_challenge.admin_id, 0; end if;
    return query select 'INVALID_OTP', v_challenge.admin_id, greatest(v_challenge.max_attempts - v_challenge.attempt_count - 1, 0)::integer; return;
  end if;
  update public.otp_challenges set consumed_at = p_now, verified_proof_hash = p_proof_hash, verified_proof_expires_at = p_proof_expires_at, verified_proof_consumed_at = null, updated_at = p_now where id = v_challenge.id;
  return query select 'VERIFIED', v_challenge.admin_id, null::integer;
end; $$;

create or replace function public.complete_admin_activation(
  p_proof_hash text, p_password_hash text, p_now timestamptz default now()
)
returns table (result_status text, result_admin_id uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_challenge public.otp_challenges%rowtype; v_invitation public.admin_invitations%rowtype;
begin
  select * into v_challenge from public.otp_challenges where purpose = 'ADMIN_ACTIVATION' and verified_proof_hash is not null and public.secure_hash_equals(verified_proof_hash, p_proof_hash) order by created_at desc limit 1 for update;
  if not found then return query select 'INVALID_PROOF', null::uuid; return; end if;
  if v_challenge.verified_proof_consumed_at is not null then return query select 'USED_PROOF', v_challenge.admin_id; return; end if;
  if v_challenge.verified_proof_expires_at is null or v_challenge.verified_proof_expires_at <= p_now then return query select 'EXPIRED_PROOF', v_challenge.admin_id; return; end if;
  select * into v_invitation from public.admin_invitations where admin_id = v_challenge.admin_id and status = 'PENDING' order by created_at desc limit 1 for update;
  if not found or v_invitation.expires_at <= p_now then return query select 'INVITATION_INVALID', v_challenge.admin_id; return; end if;
  update public.admins set password_hash = p_password_hash, status = 'ACTIVE', requires_password_change = false, updated_at = p_now where id = v_challenge.admin_id;
  update public.admin_invitations set status = 'USED', used_at = p_now, updated_at = p_now where id = v_invitation.id;
  update public.otp_challenges set verified_proof_consumed_at = p_now, invalidated_at = coalesce(invalidated_at, p_now), updated_at = p_now where admin_id = v_challenge.admin_id and purpose = 'ADMIN_ACTIVATION';
  return query select 'OK', v_challenge.admin_id;
end; $$;

/* Normal Admin login/session operations deliberately belong to the next slice.
create or replace function public.create_admin_session(
  p_admin_id uuid, p_session_id uuid, p_refresh_token_hash text, p_expires_at timestamptz, p_now timestamptz default now()
)
returns table (result_status text, result_session_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin public.admins%rowtype;
begin
  select * into v_admin from public.admins where id = p_admin_id for update;
  if not found then return query select 'ACCOUNT_NOT_FOUND', null::integer; return; end if;
  if v_admin.status <> 'ACTIVE' then return query select ('ACCOUNT_' || v_admin.status::text), v_admin.session_version; return; end if;
  insert into public.admin_sessions (id, admin_id, refresh_token_hash, session_version, expires_at, created_at) values (p_session_id, p_admin_id, p_refresh_token_hash, v_admin.session_version, p_expires_at, p_now);
  update public.admins set last_login_at = p_now, updated_at = p_now where id = p_admin_id;
  return query select 'OK', v_admin.session_version;
end; $$;

create or replace function public.rotate_admin_session(
  p_admin_id uuid, p_session_id uuid, p_refresh_token_hash text, p_replacement_session_id uuid,
  p_replacement_refresh_token_hash text, p_replacement_expires_at timestamptz, p_now timestamptz default now()
)
returns table (result_status text, result_session_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_session public.admin_sessions%rowtype; v_admin public.admins%rowtype;
begin
  select * into v_session from public.admin_sessions where id=p_session_id and admin_id=p_admin_id for update;
  if not found then return query select 'SESSION_NOT_FOUND', null::integer; return; end if;
  if v_session.replaced_by_session_id is not null then update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now) where admin_id=p_admin_id and revoked_at is null; return query select 'REFRESH_TOKEN_REUSED', v_session.session_version; return; end if;
  if v_session.revoked_at is not null then return query select 'REFRESH_TOKEN_REVOKED', v_session.session_version; return; end if;
  if v_session.expires_at <= p_now then update public.admin_sessions set revoked_at=p_now where id=v_session.id; return query select 'REFRESH_TOKEN_EXPIRED', v_session.session_version; return; end if;
  if not public.secure_hash_equals(v_session.refresh_token_hash,p_refresh_token_hash) then return query select 'INVALID_REFRESH_TOKEN', v_session.session_version; return; end if;
  select * into v_admin from public.admins where id=p_admin_id for update;
  if not found or v_admin.status <> 'ACTIVE' then return query select 'ACCOUNT_NOT_FOUND', null::integer; return; end if;
  if v_session.session_version <> v_admin.session_version then update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now) where id=v_session.id; return query select 'REFRESH_TOKEN_REVOKED',v_admin.session_version; return; end if;
  insert into public.admin_sessions (id,admin_id,refresh_token_hash,session_version,expires_at,created_at) values (p_replacement_session_id,p_admin_id,p_replacement_refresh_token_hash,v_admin.session_version,p_replacement_expires_at,p_now);
  update public.admin_sessions set revoked_at=p_now,replaced_by_session_id=p_replacement_session_id,last_used_at=p_now where id=v_session.id;
  return query select 'OK',v_admin.session_version;
end; $$;

create or replace function public.revoke_admin_session(p_admin_id uuid,p_session_id uuid,p_refresh_token_hash text,p_now timestamptz default now())
returns table (result_status text) language plpgsql security definer set search_path = public, pg_temp as $$
declare v_session public.admin_sessions%rowtype;
begin select * into v_session from public.admin_sessions where id=p_session_id and admin_id=p_admin_id for update;
  if not found then return query select 'SESSION_NOT_FOUND'; return; end if;
  if not public.secure_hash_equals(v_session.refresh_token_hash,p_refresh_token_hash) then return query select 'INVALID_REFRESH_TOKEN'; return; end if;
  update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now),last_used_at=p_now where id=v_session.id; return query select 'OK'; end; $$;

create or replace function public.change_admin_password(p_admin_id uuid,p_password_hash text,p_now timestamptz default now())
returns table (result_status text) language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.admins set password_hash=p_password_hash,requires_password_change=false,session_version=session_version+1,updated_at=p_now where id=p_admin_id and status='ACTIVE';
  if not found then return query select 'ACCOUNT_NOT_FOUND'; return; end if;
  update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now) where admin_id=p_admin_id and revoked_at is null;
  return query select 'OK';
end; $$;

create or replace function public.update_admin_status(p_admin_id uuid,p_status public.admin_status,p_now timestamptz default now())
returns table (result_status text) language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.admins set status=p_status,session_version=session_version+1,updated_at=p_now where id=p_admin_id;
  if not found then return query select 'NOT_FOUND'; return; end if;
  if p_status <> 'ACTIVE' then update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now) where admin_id=p_admin_id and revoked_at is null; end if;
  return query select 'OK';
end; $$;

revoke all on function public.create_admin_invitation(uuid,uuid,text,text,text,public.admin_department,public.admin_role,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.replace_admin_invitation(uuid,uuid,text,text,timestamptz,boolean,timestamptz) from public, anon, authenticated;
revoke all on function public.replace_admin_otp(uuid,public.otp_purpose,text,timestamptz,timestamptz,smallint,timestamptz) from public, anon, authenticated;
revoke all on function public.verify_admin_otp(uuid,public.otp_purpose,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.complete_admin_activation(text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.create_admin_session(uuid,uuid,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.rotate_admin_session(uuid,uuid,text,uuid,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_admin_session(uuid,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.change_admin_password(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.update_admin_status(uuid,public.admin_status,timestamptz) from public, anon, authenticated;
grant execute on function public.create_admin_invitation(uuid,uuid,text,text,text,public.admin_department,public.admin_role,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.replace_admin_invitation(uuid,uuid,text,text,timestamptz,boolean,timestamptz) to service_role;
grant execute on function public.replace_admin_otp(uuid,public.otp_purpose,text,timestamptz,timestamptz,smallint,timestamptz) to service_role;
grant execute on function public.verify_admin_otp(uuid,public.otp_purpose,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.complete_admin_activation(text,text,timestamptz) to service_role;
grant execute on function public.create_admin_session(uuid,uuid,text,timestamptz,timestamptz) to service_role;
grant execute on function public.rotate_admin_session(uuid,uuid,text,uuid,text,timestamptz,timestamptz) to service_role;
grant execute on function public.revoke_admin_session(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.change_admin_password(uuid,text,timestamptz) to service_role;
grant execute on function public.update_admin_status(uuid,public.admin_status,timestamptz) to service_role;
*/

revoke all on function public.create_admin_invitation(uuid,uuid,text,text,text,public.admin_department,public.admin_role,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.replace_admin_invitation(uuid,uuid,text,text,timestamptz,boolean,timestamptz) from public, anon, authenticated;
revoke all on function public.replace_admin_otp(uuid,public.otp_purpose,text,timestamptz,timestamptz,smallint,timestamptz) from public, anon, authenticated;
revoke all on function public.verify_admin_otp(uuid,public.otp_purpose,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.complete_admin_activation(text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.create_admin_invitation(uuid,uuid,text,text,text,public.admin_department,public.admin_role,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.replace_admin_invitation(uuid,uuid,text,text,timestamptz,boolean,timestamptz) to service_role;
grant execute on function public.replace_admin_otp(uuid,public.otp_purpose,text,timestamptz,timestamptz,smallint,timestamptz) to service_role;
grant execute on function public.verify_admin_otp(uuid,public.otp_purpose,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.complete_admin_activation(text,text,timestamptz) to service_role;

commit;
