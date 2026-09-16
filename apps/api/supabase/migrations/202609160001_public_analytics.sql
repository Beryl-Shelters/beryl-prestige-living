begin;

-- Deliberate public property-search submissions only; no query text or identity.
create table public.public_property_search_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp()
);
create index public_property_search_events_occurred_at_idx on public.public_property_search_events(occurred_at);
alter table public.public_property_search_events enable row level security;
revoke all on public.public_property_search_events from public, anon, authenticated;
-- GENERATED ALWAYS identity assignment uses the table INSERT grant; the API
-- never calls nextval/currval or reads this sequence directly.
revoke all on sequence public.public_property_search_events_id_seq from public, anon, authenticated, service_role;
grant select, insert on public.public_property_search_events to service_role;

-- The customer's listing RPC cannot set LISTED. This trigger only preserves
-- publication time when a separately authorized future Admin transition does.
-- Existing LISTED rows with unknown dates are deliberately not backfilled.
create function public.stamp_customer_listing_publication() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    new.listed_at := case when new.listing_status='LISTED' then clock_timestamp() else null end;
  elsif old.listing_status is distinct from 'LISTED' and new.listing_status='LISTED' then
    new.listed_at := clock_timestamp();
  else
    -- Ordinary edits and unpublication cannot rewrite publication history.
    new.listed_at := old.listed_at;
  end if;
  return new;
end $$;
create trigger customer_listing_publication before insert or update of listing_status,listed_at
  on public.customer_listings for each row execute function public.stamp_customer_listing_publication();
revoke all on function public.stamp_customer_listing_publication() from public,anon,authenticated;

-- Prices are CURRENT asking prices of CURRENTLY LISTED inventory grouped by
-- the most recent UTC publication month/year, not a historical price series.
create function public.read_public_property_analytics(p_period text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_now timestamptz := clock_timestamp(); v_total bigint; v_residential bigint; v_prices jsonb; v_searches jsonb;
begin
  if p_period not in ('monthly','annually') or p_period is null then
    raise exception using errcode='23514',message='Invalid analytics period';
  end if;
  select count(*),count(*) filter (where property_type='Residential') into v_total,v_residential
    from public.customer_listings where listing_status='LISTED';
  if p_period='monthly' then
    select coalesce(jsonb_agg(jsonb_build_object('label',upper(to_char(month_start,'MON')),
      'valueMinor',average_minor) order by month_start),'[]'::jsonb) into v_prices
    from (
      select month_start,round(avg(l.property_cost_minor))::bigint as average_minor
      from generate_series(date_trunc('year',v_now at time zone 'UTC'),
        date_trunc('year',v_now at time zone 'UTC')+interval '11 months',interval '1 month') month_start
      left join public.customer_listings l on l.listing_status='LISTED' and l.listed_at>=month_start at time zone 'UTC'
        and l.listed_at<(month_start+interval '1 month') at time zone 'UTC' and l.listed_at<=v_now
      group by month_start
    ) months;
  else
    select coalesce(jsonb_agg(jsonb_build_object('label',year::text,'valueMinor',average_minor) order by year),'[]'::jsonb) into v_prices
    from (
      select extract(year from listed_at at time zone 'UTC')::integer as year,
        round(avg(property_cost_minor))::bigint as average_minor
      from public.customer_listings where listing_status='LISTED' and listed_at is not null and listed_at<=v_now
      group by 1
    ) years;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('date',day_start::date,'count',search_count) order by day_start),'[]'::jsonb) into v_searches
  from (
    select day_start,count(e.id) as search_count
    from generate_series(date_trunc('day',v_now at time zone 'UTC')-interval '6 days',
      date_trunc('day',v_now at time zone 'UTC'),interval '1 day') day_start
    left join public.public_property_search_events e on e.occurred_at>=day_start at time zone 'UTC'
      and e.occurred_at<(day_start+interval '1 day') at time zone 'UTC' and e.occurred_at<=v_now
    group by day_start
  ) days;
  return jsonb_build_object('period',p_period,'priceSeries',v_prices,
    'propertyPercentage',jsonb_build_object('totalListedProperties',v_total,
      'residentialListedProperties',v_residential,'residentialPercentage',
      case when v_total=0 then 0 else round(v_residential::numeric*100/v_total,2) end),
    'searchesPerDay',v_searches);
end $$;

revoke all on function public.read_public_property_analytics(text) from public,anon,authenticated;
grant execute on function public.read_public_property_analytics(text) to service_role;
commit;
