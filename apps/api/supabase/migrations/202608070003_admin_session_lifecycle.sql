begin;

create or replace function public.rotate_admin_session(
  p_admin_id uuid, p_session_id uuid, p_refresh_token_hash text, p_replacement_session_id uuid,
  p_replacement_refresh_token_hash text, p_replacement_expires_at timestamptz, p_now timestamptz default now()
) returns table (result_status text, result_session_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_session public.admin_sessions%rowtype; v_admin public.admins%rowtype;
begin
  select * into v_session from public.admin_sessions where id=p_session_id and admin_id=p_admin_id for update;
  if not found then return query select 'SESSION_NOT_FOUND', null::integer; return; end if;
  if v_session.replaced_by_session_id is not null then
    update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now) where admin_id=p_admin_id and revoked_at is null;
    return query select 'REFRESH_TOKEN_REUSED', v_session.session_version; return;
  end if;
  if v_session.revoked_at is not null then return query select 'REFRESH_TOKEN_REVOKED', v_session.session_version; return; end if;
  if v_session.expires_at <= p_now then
    update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now) where id=v_session.id;
    return query select 'REFRESH_TOKEN_EXPIRED', v_session.session_version; return;
  end if;
  if not public.secure_hash_equals(v_session.refresh_token_hash,p_refresh_token_hash) then return query select 'INVALID_REFRESH_TOKEN', v_session.session_version; return; end if;
  select * into v_admin from public.admins where id=p_admin_id for update;
  if not found then return query select 'ACCOUNT_NOT_FOUND', null::integer; return; end if;
  if v_admin.status='SUSPENDED' then return query select 'ACCOUNT_SUSPENDED', v_admin.session_version; return; end if;
  if v_admin.status='LOCKED' then return query select 'ACCOUNT_LOCKED', v_admin.session_version; return; end if;
  if v_admin.status <> 'ACTIVE' then return query select 'ACCOUNT_NOT_FOUND', v_admin.session_version; return; end if;
  if v_admin.requires_password_change then return query select 'PASSWORD_CHANGE_REQUIRED', v_admin.session_version; return; end if;
  if v_session.session_version <> v_admin.session_version then
    update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now) where admin_id=p_admin_id and revoked_at is null;
    return query select 'REFRESH_TOKEN_REVOKED', v_admin.session_version; return;
  end if;
  insert into public.admin_sessions (id,admin_id,refresh_token_hash,session_version,expires_at,created_at)
  values (p_replacement_session_id,p_admin_id,p_replacement_refresh_token_hash,v_admin.session_version,p_replacement_expires_at,p_now);
  update public.admin_sessions set revoked_at=p_now,replaced_by_session_id=p_replacement_session_id,last_used_at=p_now where id=v_session.id;
  return query select 'OK',v_admin.session_version;
end; $$;

create or replace function public.revoke_admin_session(
  p_admin_id uuid, p_session_id uuid, p_refresh_token_hash text, p_now timestamptz default now()
) returns table (result_status text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_session public.admin_sessions%rowtype;
begin
  select * into v_session from public.admin_sessions where id=p_session_id and admin_id=p_admin_id for update;
  if not found then return query select 'SESSION_NOT_FOUND'; return; end if;
  if not public.secure_hash_equals(v_session.refresh_token_hash,p_refresh_token_hash) then return query select 'INVALID_REFRESH_TOKEN'; return; end if;
  update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now),last_used_at=p_now where id=v_session.id;
  return query select 'OK';
end; $$;

create or replace function public.change_admin_password(
  p_admin_id uuid, p_password_hash text, p_now timestamptz default now()
) returns table (result_status text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_admin public.admins%rowtype;
begin
  select * into v_admin from public.admins where id=p_admin_id for update;
  if not found then return query select 'ACCOUNT_NOT_FOUND'; return; end if;
  if v_admin.status='SUSPENDED' then return query select 'ACCOUNT_SUSPENDED'; return; end if;
  if v_admin.status='LOCKED' then return query select 'ACCOUNT_LOCKED'; return; end if;
  if v_admin.status <> 'ACTIVE' then return query select 'ACCOUNT_NOT_FOUND'; return; end if;
  update public.admins set password_hash=p_password_hash,requires_password_change=false,session_version=session_version+1,updated_at=p_now where id=p_admin_id;
  update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now) where admin_id=p_admin_id and revoked_at is null;
  return query select 'OK';
end; $$;

revoke all on function public.rotate_admin_session(uuid,uuid,text,uuid,text,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.revoke_admin_session(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.change_admin_password(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.rotate_admin_session(uuid,uuid,text,uuid,text,timestamptz,timestamptz) to service_role;
grant execute on function public.revoke_admin_session(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.change_admin_password(uuid,text,timestamptz) to service_role;
commit;
