begin;

create table public.customer_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_number bigint generated always as identity (start with 1) unique not null check (ticket_number > 0),
  subject text not null check (char_length(subject) between 1 and 160 and subject ~ '[^[:space:]]'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.customer_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.customer_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('CUSTOMER','SUPPORT')),
  body text not null check (char_length(body) between 1 and 3000 and body ~ '[^[:space:]]'),
  read_by_customer_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check (sender_type = 'SUPPORT' or read_by_customer_at is null),
  check (read_by_customer_at is null or read_by_customer_at >= created_at)
);
-- Owner-first lookup/order also bounds subject/content searches to own threads.
create index customer_tickets_owner_activity on public.customer_tickets(user_id, updated_at desc, id desc);
create index customer_ticket_messages_history on public.customer_ticket_messages(ticket_id, created_at, id);
create index customer_ticket_messages_unread on public.customer_ticket_messages(ticket_id, created_at, id)
  where sender_type='SUPPORT' and read_by_customer_at is null;

create function public.guard_customer_ticket() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (new.id,new.user_id,new.ticket_number,new.subject,new.created_at) is distinct from
     (old.id,old.user_id,old.ticket_number,old.subject,old.created_at) then
    raise exception using errcode='23514', message='Ticket identity is immutable';
  end if;
  if new.updated_at < old.updated_at then raise exception using errcode='23514', message='Invalid activity time'; end if;
  return new;
end $$;
create trigger customer_tickets_immutable before update on public.customer_tickets
for each row execute function public.guard_customer_ticket();

create function public.guard_customer_ticket_message() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_activity timestamptz;
begin
  if tg_op='INSERT' then
    -- Serialize all message inserts on their parent, including future SUPPORT
    -- writes. Timestamps/order and activity are authoritative and monotonic.
    select updated_at into v_activity from public.customer_tickets where id=new.ticket_id for update;
    if not found then raise exception using errcode='23503', message='Ticket not found'; end if;
    new.created_at := greatest(clock_timestamp(),v_activity + interval '1 microsecond');
    new.read_by_customer_at := null;
    update public.customer_tickets set updated_at=new.created_at where id=new.ticket_id;
  elsif (new.id,new.ticket_id,new.sender_type,new.body,new.created_at) is distinct from
        (old.id,old.ticket_id,old.sender_type,old.body,old.created_at)
     or (old.read_by_customer_at is not null and new.read_by_customer_at is distinct from old.read_by_customer_at) then
    raise exception using errcode='23514', message='Message is immutable';
  end if;
  return new;
end $$;
create trigger customer_ticket_message_guard before insert or update on public.customer_ticket_messages
for each row execute function public.guard_customer_ticket_message();

create function public.read_customer_ticket(p_owner uuid, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_result jsonb;
begin
  select jsonb_build_object('id',t.id,'ticketNumber',t.ticket_number::text,'subject',t.subject,
    'createdAt',t.created_at,'lastActivityAt',t.updated_at,
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'senderType',m.sender_type,'body',m.body,
      'createdAt',m.created_at,'readByCustomerAt',m.read_by_customer_at) order by m.created_at,m.id)
      from public.customer_ticket_messages m where m.ticket_id=t.id),'[]'::jsonb)) into v_result
    from public.customer_tickets t where t.id=p_id and t.user_id=p_owner;
  if v_result is null then raise exception using errcode='P0002', message='Ticket not found'; end if;
  return v_result;
end $$;

create function public.list_customer_tickets(p_owner uuid, p_q text default '') returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_search text; v_result jsonb;
begin
  if p_owner is null or p_q is null or char_length(p_q)>100 then
    raise exception using errcode='23514', message='Invalid ticket query';
  end if;
  -- Literal, case-insensitive substring matching, not user-supplied SQL/filter syntax.
  v_search := '%' || replace(replace(replace(btrim(p_q), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'ticketNumber',t.ticket_number::text,'subject',t.subject,
    'lastActivityAt',t.updated_at,
    'latestMessagePreview',(select left(m.body,160) from public.customer_ticket_messages m where m.ticket_id=t.id order by m.created_at desc,m.id desc limit 1),
    'unread',exists(select 1 from public.customer_ticket_messages m where m.ticket_id=t.id and m.sender_type='SUPPORT' and m.read_by_customer_at is null))
    order by t.updated_at desc,t.id desc),'[]'::jsonb) into v_result
  from public.customer_tickets t where t.user_id=p_owner and
    (t.subject ilike v_search or exists(select 1 from public.customer_ticket_messages m where m.ticket_id=t.id and m.body ilike v_search));
  return jsonb_build_object('items',v_result);
end $$;

create function public.create_customer_ticket(p_owner uuid, p_subject text, p_message text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if p_owner is null or p_subject is null or p_message is null then
    raise exception using errcode='23514', message='Subject and message are required';
  end if;
  insert into public.customer_tickets(user_id,subject) values(p_owner,btrim(p_subject)) returning id into v_id;
  insert into public.customer_ticket_messages(ticket_id,sender_type,body) values(v_id,'CUSTOMER',btrim(p_message));
  return public.read_customer_ticket(p_owner,v_id);
end $$;

create function public.reply_customer_ticket(p_owner uuid, p_id uuid, p_message text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from public.customer_tickets where id=p_id and user_id=p_owner for update;
  if not found then raise exception using errcode='P0002', message='Ticket not found'; end if;
  if p_message is null then raise exception using errcode='23514', message='Message is required'; end if;
  insert into public.customer_ticket_messages(ticket_id,sender_type,body) values(p_id,'CUSTOMER',btrim(p_message));
  return public.read_customer_ticket(p_owner,p_id);
end $$;

create function public.acknowledge_customer_ticket(p_owner uuid, p_id uuid, p_through uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_created timestamptz;
begin
  perform 1 from public.customer_tickets where id=p_id and user_id=p_owner for update;
  if not found then raise exception using errcode='P0002', message='Ticket not found'; end if;
  select created_at into v_created from public.customer_ticket_messages where id=p_through and ticket_id=p_id;
  if not found then raise exception using errcode='P0002', message='Message not found'; end if;
  -- Acknowledge only the opened snapshot, never a SUPPORT reply arriving later.
  update public.customer_ticket_messages set read_by_customer_at=greatest(clock_timestamp(),created_at)
    where ticket_id=p_id and sender_type='SUPPORT' and read_by_customer_at is null
      and (created_at,id)<=(v_created,p_through);
end $$;

alter table public.customer_tickets enable row level security;
alter table public.customer_ticket_messages enable row level security;
-- No browser policies or direct table grants. Even the API uses narrow RPCs.
revoke all on public.customer_tickets, public.customer_ticket_messages from public, anon, authenticated, service_role;
revoke all on sequence public.customer_tickets_ticket_number_seq from public, anon, authenticated, service_role;
revoke all on function public.guard_customer_ticket(),public.guard_customer_ticket_message() from public,anon,authenticated,service_role;
revoke all on function public.read_customer_ticket(uuid,uuid),public.list_customer_tickets(uuid,text),
  public.create_customer_ticket(uuid,text,text),public.reply_customer_ticket(uuid,uuid,text),public.acknowledge_customer_ticket(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.read_customer_ticket(uuid,uuid),public.list_customer_tickets(uuid,text),
  public.create_customer_ticket(uuid,text,text),public.reply_customer_ticket(uuid,uuid,text),public.acknowledge_customer_ticket(uuid,uuid,uuid)
  to service_role;
commit;
