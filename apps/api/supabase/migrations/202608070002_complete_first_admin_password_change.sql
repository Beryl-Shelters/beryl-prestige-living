begin;
create or replace function public.complete_first_admin_password_change(
  p_proof_hash text, p_password_hash text, p_now timestamptz default now()
) returns table (result_status text, result_admin_id uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_challenge public.otp_challenges%rowtype; v_admin public.admins%rowtype;
begin
  select * into v_challenge from public.otp_challenges where purpose='ADMIN_LOGIN' and verified_proof_hash is not null and public.secure_hash_equals(verified_proof_hash,p_proof_hash) order by created_at desc limit 1 for update;
  if not found then return query select 'INVALID_TOKEN',null::uuid; return; end if;
  if v_challenge.verified_proof_consumed_at is not null then return query select 'USED_TOKEN',v_challenge.admin_id; return; end if;
  if v_challenge.verified_proof_expires_at is null or v_challenge.verified_proof_expires_at<=p_now then return query select 'EXPIRED_TOKEN',v_challenge.admin_id; return; end if;
  select * into v_admin from public.admins where id=v_challenge.admin_id for update;
  if not found then return query select 'ACCOUNT_NOT_FOUND',null::uuid; return; end if;
  if v_admin.status <> 'ACTIVE' then return query select ('ACCOUNT_'||v_admin.status::text),v_admin.id; return; end if;
  if not v_admin.requires_password_change then return query select 'USED_TOKEN',v_admin.id; return; end if;
  update public.admins set password_hash=p_password_hash,requires_password_change=false,session_version=session_version+1,updated_at=p_now where id=v_admin.id;
  update public.admin_sessions set revoked_at=coalesce(revoked_at,p_now) where admin_id=v_admin.id and revoked_at is null;
  update public.otp_challenges set verified_proof_consumed_at=p_now where id=v_challenge.id;
  return query select 'OK',v_admin.id;
end; $$;
revoke all on function public.complete_first_admin_password_change(text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.complete_first_admin_password_change(text,text,timestamptz) to service_role;
commit;
