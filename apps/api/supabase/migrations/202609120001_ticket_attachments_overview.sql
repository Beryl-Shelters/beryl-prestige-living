begin;

-- Upload intents survive failed/ambiguous provider or database responses.
create table public.customer_ticket_uploads (
  public_id text primary key check (public_id like 'beryl-v2/messages/%'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  claimed boolean not null default false
);
create index customer_ticket_uploads_cleanup on public.customer_ticket_uploads(user_id,created_at);
create table public.customer_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.customer_ticket_messages(id) on delete cascade,
  public_id text not null unique references public.customer_ticket_uploads(public_id) on delete cascade,
  filename text not null check (char_length(filename) between 1 and 160),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760)
);
alter table public.customer_ticket_messages drop constraint customer_ticket_messages_body_check;
alter table public.customer_ticket_messages add constraint customer_ticket_messages_body_check
  check (char_length(body)<=3000 and (body='' or body ~ '[^[:space:]]'));

-- Deferred until the transaction ends, so a file-only message and its file
-- can be inserted atomically, but a genuinely empty message cannot persist.
create function public.check_customer_ticket_message_content() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.customer_ticket_messages m where m.id=new.id and m.body=''
    and not exists(select 1 from public.customer_ticket_attachments a where a.message_id=m.id)) then
    raise exception using errcode='23514',message='A message or attachment is required';
  end if;
  return null;
end $$;
create constraint trigger customer_ticket_message_content after insert or update on public.customer_ticket_messages
  deferrable initially deferred for each row execute function public.check_customer_ticket_message_content();

create or replace function public.read_customer_ticket(p_owner uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  select jsonb_build_object('id',t.id,'ticketNumber',t.ticket_number::text,'subject',t.subject,
    'createdAt',t.created_at,'lastActivityAt',t.updated_at,
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'senderType',m.sender_type,'body',m.body,
      'createdAt',m.created_at,'readByCustomerAt',m.read_by_customer_at,
      'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'filename',a.filename,'mimeType',a.mime_type,'sizeBytes',a.size_bytes))
        from public.customer_ticket_attachments a where a.message_id=m.id),'[]'::jsonb)) order by m.created_at,m.id)
      from public.customer_ticket_messages m where m.ticket_id=t.id),'[]'::jsonb)) into v_result
    from public.customer_tickets t where t.id=p_id and t.user_id=p_owner;
  if v_result is null then raise exception using errcode='P0002',message='Ticket not found'; end if;
  return v_result;
end $$;

create or replace function public.list_customer_tickets(p_owner uuid,p_q text default '') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_search text; v_result jsonb;
begin
  if p_owner is null or p_q is null or char_length(p_q)>100 then raise exception using errcode='23514',message='Invalid ticket query'; end if;
  v_search := '%' || replace(replace(replace(btrim(p_q), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'ticketNumber',t.ticket_number::text,'subject',t.subject,
    'lastActivityAt',t.updated_at,
    'latestMessagePreview',(select coalesce(nullif(left(m.body,160),''),(select a.filename from public.customer_ticket_attachments a where a.message_id=m.id))
      from public.customer_ticket_messages m where m.ticket_id=t.id order by m.created_at desc,m.id desc limit 1),
    'unread',exists(select 1 from public.customer_ticket_messages m where m.ticket_id=t.id and m.sender_type='SUPPORT' and m.read_by_customer_at is null))
    order by t.updated_at desc,t.id desc),'[]'::jsonb) into v_result
    from public.customer_tickets t where t.user_id=p_owner and (t.subject ilike v_search or
      exists(select 1 from public.customer_ticket_messages m where m.ticket_id=t.id and m.body ilike v_search));
  return jsonb_build_object('items',v_result);
end $$;

create function public.reserve_customer_ticket_upload(p_owner uuid,p_public_id text) returns void
language sql security definer set search_path=public,pg_temp as $$
  insert into public.customer_ticket_uploads(user_id,public_id) values(p_owner,p_public_id);
$$;

create function public.save_customer_ticket_attachment(p_owner uuid,p_id uuid,p_subject text,p_message text,p_asset jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ticket jsonb; v_message uuid; v_claimed boolean;
begin
  if jsonb_typeof(p_asset) is distinct from 'object' then raise exception using errcode='23514',message='Invalid attachment'; end if;
  -- Lock the upload before attaching it. Cleanup claims the same row first,
  -- so a late database request cannot attach a file already being removed.
  select claimed into v_claimed from public.customer_ticket_uploads
    where public_id=p_asset->>'public_id' and user_id=p_owner for update;
  if not found or v_claimed then raise exception using errcode='23514',message='Upload is not available'; end if;
  if p_id is null then v_ticket:=public.create_customer_ticket(p_owner,p_subject,p_message);
  else v_ticket:=public.reply_customer_ticket(p_owner,p_id,p_message); end if;
  select id into v_message from public.customer_ticket_messages where ticket_id=(v_ticket->>'id')::uuid order by created_at desc,id desc limit 1;
  insert into public.customer_ticket_attachments(message_id,public_id,filename,mime_type,size_bytes)
    values(v_message,p_asset->>'public_id',p_asset->>'filename',p_asset->>'mime_type',(p_asset->>'size_bytes')::integer);
  return public.read_customer_ticket(p_owner,(v_ticket->>'id')::uuid);
end $$;

create function public.get_customer_ticket_attachment(p_owner uuid,p_id uuid,p_attachment uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  select jsonb_build_object('public_id',a.public_id,'resource_type','raw','delivery_type','authenticated','url','',
    'mime_type',a.mime_type,'size_bytes',a.size_bytes,'filename',a.filename) into v_result
    from public.customer_ticket_attachments a join public.customer_ticket_messages m on m.id=a.message_id
    join public.customer_tickets t on t.id=m.ticket_id where t.user_id=p_owner and t.id=p_id and a.id=p_attachment;
  if v_result is null then raise exception using errcode='P0002',message='Ticket not found'; end if;
  return v_result;
end $$;

create function public.claim_customer_ticket_upload_cleanup(p_owner uuid) returns setof text
language sql security definer set search_path=public,pg_temp as $$
  with candidates as (
    select u.public_id from public.customer_ticket_uploads u where u.user_id=p_owner
      and u.created_at<clock_timestamp()-interval '1 hour'
      and not exists(select 1 from public.customer_ticket_attachments a where a.public_id=u.public_id)
    order by u.created_at,u.public_id limit 20 for update skip locked
  ) update public.customer_ticket_uploads u set claimed=true from candidates c where u.public_id=c.public_id returning u.public_id;
$$;
create function public.forget_customer_ticket_upload(p_owner uuid,p_public_id text) returns void
language sql security definer set search_path=public,pg_temp as $$
  delete from public.customer_ticket_uploads u where u.user_id=p_owner and u.public_id=p_public_id and u.claimed
    and not exists(select 1 from public.customer_ticket_attachments a where a.public_id=u.public_id);
$$;

create function public.customer_ticket_overview(p_owner uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('unread',(select count(*) from public.customer_ticket_messages m
    join public.customer_tickets t on t.id=m.ticket_id where t.user_id=p_owner and m.sender_type='SUPPORT' and m.read_by_customer_at is null),
    'recent',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'subject',r.subject) order by r.updated_at desc,r.id desc)
      from (select id,subject,updated_at from public.customer_tickets where user_id=p_owner order by updated_at desc,id desc limit 5) r),'[]'::jsonb));
$$;

alter table public.customer_ticket_uploads enable row level security;
alter table public.customer_ticket_attachments enable row level security;
revoke all on public.customer_ticket_uploads,public.customer_ticket_attachments from public,anon,authenticated,service_role;
revoke all on function public.check_customer_ticket_message_content() from public,anon,authenticated,service_role;
revoke all on function public.reserve_customer_ticket_upload(uuid,text),public.save_customer_ticket_attachment(uuid,uuid,text,text,jsonb),
  public.get_customer_ticket_attachment(uuid,uuid,uuid),public.claim_customer_ticket_upload_cleanup(uuid),
  public.forget_customer_ticket_upload(uuid,text),public.customer_ticket_overview(uuid) from public,anon,authenticated;
grant execute on function public.reserve_customer_ticket_upload(uuid,text),public.save_customer_ticket_attachment(uuid,uuid,text,text,jsonb),
  public.get_customer_ticket_attachment(uuid,uuid,uuid),public.claim_customer_ticket_upload_cleanup(uuid),
  public.forget_customer_ticket_upload(uuid,text),public.customer_ticket_overview(uuid) to service_role;
commit;
