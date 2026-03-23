-- Agenda v2 backfill
-- Copia a tabela legacy public.events para public.calendar_events
-- e cria recursos basicos a partir do campo location.

with source_resources as (
  select
    public.calendar_slugify(location_name) as slug,
    location_name as name,
    'other'::text as type,
    'exclusive'::text as booking_mode,
    true as requires_approval,
    true as is_active,
    true as is_publicly_listed,
    jsonb_build_object(
      'source', 'public.events.location'
    ) as metadata
  from (
    select distinct btrim(location) as location_name
    from public.events
    where btrim(coalesce(location, '')) <> ''
  ) locations
),
updated_resources as (
  update public.calendar_resources current_resource
  set
    name = source_resources.name,
    is_active = true,
    updated_at = now()
  from source_resources
  where current_resource.slug = source_resources.slug
  returning current_resource.slug
)
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
  source_resources.slug,
  source_resources.name,
  source_resources.type,
  source_resources.booking_mode,
  source_resources.requires_approval,
  source_resources.is_active,
  source_resources.is_publicly_listed,
  source_resources.metadata
from source_resources
where not exists (
  select 1
  from public.calendar_resources current_resource
  where current_resource.slug = source_resources.slug
);

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
),
updated_events as (
  update public.calendar_events current_event
  set
    title = source_events.title,
    description = source_events.description,
    starts_at = source_events.starts_at,
    ends_at = source_events.ends_at,
    is_all_day = source_events.is_all_day,
    community = source_events.community,
    category = source_events.category,
    location_text = source_events.location_text,
    recurrence_rule = source_events.recurrence_rule,
    metadata = current_event.metadata || source_events.metadata,
    updated_at = now()
  from source_events
  where current_event.legacy_event_id = source_events.legacy_event_id
  returning current_event.legacy_event_id
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
  source_events.legacy_event_id,
  source_events.title,
  public.ensure_unique_calendar_slug(
    'public.calendar_events'::regclass,
    concat_ws('-', source_events.title, to_char(source_events.starts_at, 'YYYY-MM-DD')),
    null
  ),
  source_events.description,
  source_events.starts_at,
  source_events.ends_at,
  'America/Fortaleza',
  source_events.is_all_day,
  'confirmed',
  'public',
  source_events.community,
  source_events.category,
  source_events.location_text,
  source_events.recurrence_rule,
  'legacy',
  source_events.metadata
from source_events
where not exists (
  select 1
  from public.calendar_events current_event
  where current_event.legacy_event_id = source_events.legacy_event_id
);

with source_event_resources as (
  select
    ce.id as event_id,
    cr.id as resource_id,
    ce.starts_at,
    ce.ends_at,
    'Vinculo inicial criado a partir de public.events.location' as notes
  from public.calendar_events ce
  join public.events e on e.id = ce.legacy_event_id
  join public.calendar_resources cr on cr.name = btrim(e.location)
  where btrim(coalesce(e.location, '')) <> ''
),
updated_links as (
  update public.calendar_event_resources current_link
  set
    starts_at = source_event_resources.starts_at,
    ends_at = source_event_resources.ends_at,
    notes = source_event_resources.notes,
    updated_at = now()
  from source_event_resources
  where current_link.event_id = source_event_resources.event_id
    and current_link.resource_id = source_event_resources.resource_id
  returning current_link.event_id, current_link.resource_id
)
insert into public.calendar_event_resources (
  event_id,
  resource_id,
  starts_at,
  ends_at,
  notes
)
select
  source_event_resources.event_id,
  source_event_resources.resource_id,
  source_event_resources.starts_at,
  source_event_resources.ends_at,
  source_event_resources.notes
from source_event_resources
where not exists (
  select 1
  from public.calendar_event_resources current_link
  where current_link.event_id = source_event_resources.event_id
    and current_link.resource_id = source_event_resources.resource_id
);
