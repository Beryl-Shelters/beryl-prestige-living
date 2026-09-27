begin;

-- Add only the customer-visible lifecycle needed to make resolved tickets
-- read-only. Existing rows receive the OPEN default and retain all content.
alter table public.customer_tickets
  add column status text not null default 'OPEN'
    check (status in ('OPEN','RESOLVED')),
  add column resolved_at timestamptz,
  add constraint customer_tickets_resolution_check check (
    (status='OPEN' and resolved_at is null)
    or
    (status='RESOLVED' and resolved_at is not null and resolved_at>=created_at)
  );

create or replace function public.read_customer_ticket(p_owner uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  select jsonb_build_object('id',t.id,'ticketNumber',t.ticket_number::text,'subject',t.subject,
    'status',t.status,'resolvedAt',t.resolved_at,
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
    'status',t.status,'resolvedAt',t.resolved_at,'lastActivityAt',t.updated_at,
    'latestMessagePreview',(select coalesce(nullif(left(m.body,160),''),(select a.filename from public.customer_ticket_attachments a where a.message_id=m.id))
      from public.customer_ticket_messages m where m.ticket_id=t.id order by m.created_at desc,m.id desc limit 1),
    'unread',exists(select 1 from public.customer_ticket_messages m where m.ticket_id=t.id and m.sender_type='SUPPORT' and m.read_by_customer_at is null))
    order by t.updated_at desc,t.id desc),'[]'::jsonb) into v_result
    from public.customer_tickets t where t.user_id=p_owner and (t.subject ilike v_search or
      exists(select 1 from public.customer_ticket_messages m where m.ticket_id=t.id and m.body ilike v_search));
  return jsonb_build_object('items',v_result);
end $$;

create or replace function public.reply_customer_ticket(p_owner uuid,p_id uuid,p_message text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text;
begin
  select status into v_status from public.customer_tickets where id=p_id and user_id=p_owner for update;
  if not found then raise exception using errcode='P0002',message='Ticket not found'; end if;
  if v_status='RESOLVED' then raise exception using errcode='PT409',message='Ticket is resolved'; end if;
  if p_message is null then raise exception using errcode='23514',message='Message is required'; end if;
  insert into public.customer_ticket_messages(ticket_id,sender_type,body) values(p_id,'CUSTOMER',btrim(p_message));
  return public.read_customer_ticket(p_owner,p_id);
end $$;

-- This existing attachment write delegates to the guarded reply function for
-- existing tickets, so a resolution racing an upload still cannot persist.
create or replace function public.save_customer_ticket_attachment(p_owner uuid,p_id uuid,p_subject text,p_message text,p_asset jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ticket jsonb; v_message uuid; v_claimed boolean;
begin
  if jsonb_typeof(p_asset) is distinct from 'object' then raise exception using errcode='23514',message='Invalid attachment'; end if;
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

commit;
