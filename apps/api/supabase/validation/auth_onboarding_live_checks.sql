-- Read-only checks to run in the Supabase SQL editor before applying the auth
-- migrations. These queries intentionally make no schema or data changes.

select table_schema, table_name
from information_schema.tables
where table_schema in ('public', 'auth', 'supabase_migrations')
  and table_name in (
    'profiles', 'user_personas', 'buyer_profiles', 'seller_profiles',
    'customer_records', 'otp_challenges', 'customer_sessions', 'admins',
    'admin_sessions', 'admin_invitations', 'users', 'schema_migrations'
  )
order by table_schema, table_name;

select table_schema, table_name, ordinal_position, column_name, data_type,
       udt_schema, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema in ('public', 'auth')
  and table_name in (
    'profiles', 'user_personas', 'buyer_profiles', 'seller_profiles',
    'customer_records', 'otp_challenges', 'customer_sessions', 'admins',
    'admin_sessions', 'admin_invitations', 'users'
  )
order by table_schema, table_name, ordinal_position;

select ns.nspname as enum_schema, typ.typname as enum_name, enum.enumlabel,
       enum.enumsortorder
from pg_type typ
join pg_namespace ns on ns.oid = typ.typnamespace
join pg_enum enum on enum.enumtypid = typ.oid
where ns.nspname = 'public'
order by typ.typname, enum.enumsortorder;

select ns.nspname as table_schema, rel.relname as table_name,
       con.conname as constraint_name, con.contype,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and rel.relname in (
    'profiles', 'user_personas', 'buyer_profiles', 'seller_profiles',
    'customer_records', 'otp_challenges', 'customer_sessions', 'admins',
    'admin_sessions', 'admin_invitations'
  )
order by rel.relname, con.conname;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'profiles', 'user_personas', 'buyer_profiles', 'seller_profiles',
    'customer_records', 'otp_challenges', 'customer_sessions', 'admins',
    'admin_sessions', 'admin_invitations'
  )
order by tablename, indexname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual,
       with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles', 'user_personas', 'buyer_profiles', 'seller_profiles',
    'customer_records', 'otp_challenges', 'customer_sessions', 'admins',
    'admin_sessions', 'admin_invitations'
  )
order by tablename, policyname;

select version, name, statements
from supabase_migrations.schema_migrations
order by version;

select ns.nspname as function_schema,
       proc.proname as function_name,
       pg_get_function_identity_arguments(proc.oid) as identity_arguments,
       proc.prosecdef as security_definer,
       has_function_privilege('service_role', proc.oid, 'EXECUTE') as service_role_execute,
       has_function_privilege('authenticated', proc.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', proc.oid, 'EXECUTE') as anon_execute
from pg_proc proc
join pg_namespace ns on ns.oid = proc.pronamespace
where ns.nspname = 'public'
  and proc.proname in (
    'complete_customer_buyer_onboarding',
    'complete_customer_seller_onboarding',
    'activate_customer_persona',
    'switch_customer_active_persona',
    'create_customer_session',
    'rotate_customer_session',
    'revoke_customer_session',
    'replace_customer_password_reset_otp',
    'verify_customer_password_reset_otp',
    'finalize_customer_password_reset',
    'change_customer_password',
    'consume_customer_password_reset_proof',
    'revoke_customer_sessions_for_password_change'
  )
order by proc.proname;

-- Bug #8 password-authority/recovery-clock preflight. The identity arguments
-- expose overload/signature collisions; the result/search-path/ACL columns
-- establish compatibility and SECURITY DEFINER posture without executing RPCs.
select proc.proname as function_name,
       pg_get_function_identity_arguments(proc.oid) as identity_arguments,
       pg_get_function_result(proc.oid) as result_type,
       proc.prosecdef as security_definer,
       proc.proconfig as function_config,
       proc.proacl as access_control_list,
       has_function_privilege('service_role', proc.oid, 'EXECUTE') as service_role_execute,
       has_function_privilege('authenticated', proc.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', proc.oid, 'EXECUTE') as anon_execute
from pg_proc proc
join pg_namespace ns on ns.oid = proc.pronamespace
where ns.nspname = 'public'
  and proc.proname in (
    'secure_hash_equals',
    'verify_customer_email_otp',
    'verify_customer_password_reset_otp',
    'finalize_customer_password_reset',
    'change_customer_password',
    'consume_customer_password_reset_proof',
    'revoke_customer_sessions_for_password_change'
  )
order by proc.proname, identity_arguments;

select version, name
from supabase_migrations.schema_migrations
where version >= '202608280001'
order by version;

select lower(trim(email)) as normalized_email, count(*)
from public.profiles
group by lower(trim(email))
having count(*) > 1;

with compacted as (
  select id,
         regexp_replace(trim(phone_number), '[\s().-]', '', 'g') as phone
  from public.profiles
  where phone_number is not null
), normalized as (
  select id,
         case
           when phone like '+%' then phone
           when phone like '00%' then '+' || substring(phone from 3)
           when phone like '234%' then '+' || phone
           when phone like '0%' then '+234' || substring(phone from 2)
           else '+234' || phone
         end as normalized_phone
  from compacted
)
select normalized_phone, count(*)
from normalized
group by normalized_phone
having count(*) > 1;

select lower(trim(email)) as normalized_email, count(*)
from auth.users
where email is not null
group by lower(trim(email))
having count(*) > 1;

select phone, count(*)
from auth.users
where phone is not null
group by phone
having count(*) > 1;
