-- Agenda v2 backfill
-- Copia a tabela legacy public.events para public.calendar_events
-- e cria recursos basicos a partir do campo location.

insert into public.calendar_resources (
  slug,
  name,
  type,
  booking_mode,
  requires_approval,
  is_active,
  is_publicly_listed,
  metadata
)
select
  public.calendar_slugify(location_name),
  location_name,
  'other',
  'exclusive',
  true,
  true,
  true,
  jsonb_build_object(
    'source', 'public.events.location'
  )
from (
  select distinct btrim(location) as location_name
  from public.events
  where btrim(coalesce(location, '')) <> ''
) locations
on conflict (slug) do update
set
  name = excluded.name,
  is_active = true,
  updated_at = now();

with source_events as (
  select
    e.id as legacy_event_id,
    btrim(coalesce(e.title, '')) as title,
    nullif(btrim(coalesce(e.description, '')), '') as description,
    nullif(btrim(coalesce(e.community, '')), '') as community,
    nullif(btrim(coalesce(e.category, '')), '') as category,
    nullif(btrim(coalesce(e.location, '')), '') as location_text,
    nullif(btrim(coalesce(e.recurrence, '')), '') as recurrence_rule,
    case
      when nullif(btrim(coalesce(e.time, '')), '') is null
        then (e.date::timestamp at time zone 'America/Fortaleza')
      else ((e.date::text || ' ' || btrim(e.time))::timestamp at time zone 'America/Fortaleza')
    end as starts_at,
    case
      when nullif(btrim(coalesce(e.time, '')), '') is null
        then (e.date::timestamp at time zone 'America/Fortaleza') + interval '1 day'
      else ((e.date::text || ' ' || btrim(e.time))::timestamp at time zone 'America/Fortaleza') + interval '1 hour'
    end as ends_at,
    nullif(btrim(coalesce(e.time, '')), '') is null as is_all_day,
    jsonb_build_object(
      'source', 'public.events',
      'legacy_time', e.time,
      'legacy_recurrence', e.recurrence
    ) as metadata
  from public.events e
)
insert into public.calendar_events (
  legacy_event_id,
  title,
  slug,
  description,
  starts_at,
  ends_at,
  timezone,
  is_all_day,
  status,
  visibility,
  community,
  category,
  location_text,
  recurrence_rule,
  booking_origin,
  metadata
)
select
  legacy_event_id,
  title,
  public.ensure_unique_calendar_slug(
    'public.calendar_events'::regclass,
    concat_ws('-', title, to_char(starts_at, 'YYYY-MM-DD')),
    null
  ),
  description,
  starts_at,
  ends_at,
  'America/Fortaleza',
  is_all_day,
  'confirmed',
  'public',
  community,
  category,
  location_text,
  recurrence_rule,
  'legacy',
  metadata
from source_events
on conflict (legacy_event_id) do update
  set title = excluded.title,
      description = excluded.description,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      is_all_day = excluded.is_all_day,
      community = excluded.community,
      category = excluded.category,
      location_text = excluded.location_text,
      recurrence_rule = excluded.recurrence_rule,
      metadata = public.calendar_events.metadata || excluded.metadata,
      updated_at = now();

insert into public.calendar_event_resources (
  event_id,
  resource_id,
  starts_at,
  ends_at,
  notes
)
select
  ce.id,
  cr.id,
  ce.starts_at,
  ce.ends_at,
  'Vinculo inicial criado a partir de public.events.location'
from public.calendar_events ce
join public.events e on e.id = ce.legacy_event_id
join public.calendar_resources cr on cr.name = btrim(e.location)
where btrim(coalesce(e.location, '')) <> ''
on conflict (event_id, resource_id) do update
set
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  notes = excluded.notes,
  updated_at = now();
