begin;

-- The first slice already owns generic Admin OTP replacement/verification.
-- This slice adds only persisted access-session creation after ADMIN_LOGIN OTP consumption.
create or replace function public.create_admin_session(
  p_admin_id uuid, p_session_id uuid, p_refresh_token_hash text,
  p_expires_at timestamptz, p_now timestamptz default now()
) returns table (result_status text, result_session_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin public.admins%rowtype;
begin
  select * into v_admin from public.admins where id=p_admin_id for update;
  if not found or v_admin.status <> 'ACTIVE' then return query select 'ACCOUNT_NOT_FOUND', null::integer; return; end if;
  insert into public.admin_sessions (id,admin_id,refresh_token_hash,session_version,expires_at,created_at)
  values (p_session_id,p_admin_id,p_refresh_token_hash,v_admin.session_version,p_expires_at,p_now);
  update public.admins set last_login_at=p_now,updated_at=p_now where id=p_admin_id;
  return query select 'OK',v_admin.session_version;
end; $$;

revoke all on function public.create_admin_session(uuid,uuid,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.create_admin_session(uuid,uuid,text,timestamptz,timestamptz) to service_role;
commit;
