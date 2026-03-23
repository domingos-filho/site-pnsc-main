-- Agenda v2 schema
-- Modelo para eventos publicos, operacao interna e reserva de espacos.
-- Prerequisite: public.profiles and helper auth setup already exist.

create extension if not exists "pgcrypto";
create extension if not exists unaccent;

create table if not exists public.calendar_event_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  color text,
  default_duration_minutes integer not null default 60,
  default_visibility text not null default 'public',
  requires_approval boolean not null default false,
  requires_resource boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  type text not null default 'other',
  description text,
  capacity integer,
  booking_mode text not null default 'exclusive',
  default_setup_minutes integer not null default 0,
  default_teardown_minutes integer not null default 0,
  requires_approval boolean not null default true,
  is_active boolean not null default true,
  is_publicly_listed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  summary text,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Fortaleza',
  is_all_day boolean not null default false,
  status text not null default 'draft',
  visibility text not null default 'public',
  event_type_id uuid references public.calendar_event_types(id) on delete set null,
  community text,
  category text,
  location_text text,
  organizer_name text,
  organizer_phone text,
  organizer_email text,
  expected_attendance integer,
  recurrence_rule text,
  recurrence_until date,
  parent_event_id uuid references public.calendar_events(id) on delete set null,
  legacy_event_id uuid references public.events(id) on delete set null,
  booking_origin text not null default 'manual',
  requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  search_tokens tsvector not null default ''::tsvector,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_event_resources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  resource_id uuid not null references public.calendar_resources(id) on delete restrict,
  starts_at timestamptz,
  ends_at timestamptz,
  setup_minutes integer not null default 0,
  teardown_minutes integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, resource_id)
);

create table if not exists public.calendar_booking_requests (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid references public.calendar_event_types(id) on delete set null,
  requested_resource_id uuid references public.calendar_resources(id) on delete set null,
  title text not null,
  requested_start timestamptz not null,
  requested_end timestamptz not null,
  timezone text not null default 'America/Fortaleza',
  requester_name text not null,
  requester_email text,
  requester_phone text,
  requester_ministry text,
  expected_attendance integer,
  purpose text,
  notes text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_event_id uuid references public.calendar_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists calendar_event_types_slug_key
  on public.calendar_event_types (slug);

create unique index if not exists calendar_resources_slug_key
  on public.calendar_resources (slug);

create unique index if not exists calendar_events_slug_key
  on public.calendar_events (slug);

create unique index if not exists calendar_events_legacy_event_id_key
  on public.calendar_events (legacy_event_id)
  where legacy_event_id is not null;

create index if not exists calendar_events_public_feed_idx
  on public.calendar_events (visibility, status, starts_at);

create index if not exists calendar_events_type_idx
  on public.calendar_events (event_type_id);

create index if not exists calendar_events_community_idx
  on public.calendar_events (community);

create index if not exists calendar_events_category_idx
  on public.calendar_events (category);

create index if not exists calendar_events_parent_idx
  on public.calendar_events (parent_event_id);

create index if not exists calendar_events_search_tokens_idx
  on public.calendar_events using gin (search_tokens);

create index if not exists calendar_event_resources_resource_window_idx
  on public.calendar_event_resources (resource_id, starts_at, ends_at);

create index if not exists calendar_booking_requests_status_window_idx
  on public.calendar_booking_requests (status, requested_start, requested_end);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_event_types_visibility_check'
  ) then
    alter table public.calendar_event_types
      add constraint calendar_event_types_visibility_check
      check (default_visibility in ('public', 'internal', 'private'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_resources_type_check'
  ) then
    alter table public.calendar_resources
      add constraint calendar_resources_type_check
      check (type in ('church', 'chapel', 'hall', 'room', 'office', 'outdoor', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_resources_booking_mode_check'
  ) then
    alter table public.calendar_resources
      add constraint calendar_resources_booking_mode_check
      check (booking_mode in ('exclusive', 'shared'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_events_status_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_status_check
      check (status in ('draft', 'pending_approval', 'confirmed', 'cancelled', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_events_visibility_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_visibility_check
      check (visibility in ('public', 'internal', 'private'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_events_booking_origin_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_booking_origin_check
      check (booking_origin in ('manual', 'request', 'import', 'legacy'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_events_time_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_time_check
      check (ends_at > starts_at);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_event_resources_time_check'
  ) then
    alter table public.calendar_event_resources
      add constraint calendar_event_resources_time_check
      check (ends_at is null or starts_at is null or ends_at > starts_at);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_booking_requests_status_check'
  ) then
    alter table public.calendar_booking_requests
      add constraint calendar_booking_requests_status_check
      check (status in ('pending', 'approved', 'rejected', 'cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_booking_requests_time_check'
  ) then
    alter table public.calendar_booking_requests
      add constraint calendar_booking_requests_time_check
      check (requested_end > requested_start);
  end if;
end $$;

create or replace function public.calendar_is_manager()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'secretary')
  );
$$;

create or replace function public.calendar_slugify(input text)
returns text
language sql
immutable
as $$
  select trim(
    both '-'
    from regexp_replace(
      lower(unaccent(coalesce(input, ''))),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
$$;

create or replace function public.ensure_unique_calendar_slug(target_table regclass, base_slug text, current_id uuid default null)
returns text
language plpgsql
as $$
declare
  normalized_base text;
  candidate text;
  suffix integer := 0;
  slug_exists boolean;
begin
  normalized_base := nullif(public.calendar_slugify(base_slug), '');
  if normalized_base is null then
    normalized_base := 'item';
  end if;

  candidate := normalized_base;

  loop
    execute format(
      'select exists (select 1 from %s where slug = $1 and ($2 is null or id <> $2))',
      target_table
    )
    into slug_exists
    using candidate, current_id;

    exit when not slug_exists;

    suffix := suffix + 1;
    candidate := normalized_base || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prepare_calendar_event_type()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(coalesce(new.name, ''));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.color := nullif(btrim(coalesce(new.color, '')), '');
  new.default_duration_minutes := greatest(coalesce(new.default_duration_minutes, 60), 1);
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.slug := public.ensure_unique_calendar_slug(
    'public.calendar_event_types'::regclass,
    coalesce(nullif(btrim(coalesce(new.slug, '')), ''), new.name),
    new.id
  );
  return new;
end;
$$;

create or replace function public.prepare_calendar_resource()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(coalesce(new.name, ''));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.capacity := case when new.capacity is not null and new.capacity < 0 then null else new.capacity end;
  new.default_setup_minutes := greatest(coalesce(new.default_setup_minutes, 0), 0);
  new.default_teardown_minutes := greatest(coalesce(new.default_teardown_minutes, 0), 0);
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.slug := public.ensure_unique_calendar_slug(
    'public.calendar_resources'::regclass,
    coalesce(nullif(btrim(coalesce(new.slug, '')), ''), new.name),
    new.id
  );
  return new;
end;
$$;

create or replace function public.prepare_calendar_event()
returns trigger
language plpgsql
as $$
declare
  search_text text;
begin
  new.title := btrim(coalesce(new.title, ''));
  new.summary := nullif(btrim(coalesce(new.summary, '')), '');
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.community := nullif(btrim(coalesce(new.community, '')), '');
  new.category := nullif(btrim(coalesce(new.category, '')), '');
  new.location_text := nullif(btrim(coalesce(new.location_text, '')), '');
  new.organizer_name := nullif(btrim(coalesce(new.organizer_name, '')), '');
  new.organizer_phone := nullif(btrim(coalesce(new.organizer_phone, '')), '');
  new.organizer_email := nullif(btrim(coalesce(new.organizer_email, '')), '');
  new.expected_attendance := case
    when new.expected_attendance is not null and new.expected_attendance < 0 then null
    else new.expected_attendance
  end;
  new.recurrence_rule := nullif(btrim(coalesce(new.recurrence_rule, '')), '');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.slug := public.ensure_unique_calendar_slug(
    'public.calendar_events'::regclass,
    coalesce(nullif(btrim(coalesce(new.slug, '')), ''), new.title),
    new.id
  );

  if new.ends_at <= new.starts_at then
    raise exception 'calendar_events.ends_at deve ser maior que starts_at';
  end if;

  search_text := concat_ws(
    ' ',
    new.title,
    new.summary,
    new.description,
    new.community,
    new.category,
    new.location_text,
    new.organizer_name
  );

  new.search_tokens := to_tsvector('simple', unaccent(coalesce(search_text, '')));
  return new;
end;
$$;

create or replace function public.prepare_calendar_booking_request()
returns trigger
language plpgsql
as $$
begin
  new.title := btrim(coalesce(new.title, ''));
  new.requester_name := btrim(coalesce(new.requester_name, ''));
  new.requester_email := nullif(btrim(coalesce(new.requester_email, '')), '');
  new.requester_phone := nullif(btrim(coalesce(new.requester_phone, '')), '');
  new.requester_ministry := nullif(btrim(coalesce(new.requester_ministry, '')), '');
  new.purpose := nullif(btrim(coalesce(new.purpose, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.expected_attendance := case
    when new.expected_attendance is not null and new.expected_attendance < 0 then null
    else new.expected_attendance
  end;
  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  if new.requested_end <= new.requested_start then
    raise exception 'calendar_booking_requests.requested_end deve ser maior que requested_start';
  end if;

  return new;
end;
$$;

create or replace function public.prepare_calendar_event_resource()
returns trigger
language plpgsql
as $$
declare
  base_event record;
begin
  select id, starts_at, ends_at, status
  into base_event
  from public.calendar_events
  where id = new.event_id;

  if base_event.id is null then
    raise exception 'Evento nao encontrado para o recurso vinculado';
  end if;

  new.starts_at := coalesce(new.starts_at, base_event.starts_at);
  new.ends_at := coalesce(new.ends_at, base_event.ends_at);
  new.setup_minutes := greatest(coalesce(new.setup_minutes, 0), 0);
  new.teardown_minutes := greatest(coalesce(new.teardown_minutes, 0), 0);
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');

  if new.ends_at <= new.starts_at then
    raise exception 'calendar_event_resources.ends_at deve ser maior que starts_at';
  end if;

  if base_event.status in ('pending_approval', 'confirmed') and exists (
    select 1
    from public.calendar_event_resources current_link
    join public.calendar_events current_event on current_event.id = current_link.event_id
    where current_link.resource_id = new.resource_id
      and (new.id is null or current_link.id <> new.id)
      and current_event.status in ('pending_approval', 'confirmed')
      and tstzrange(
        current_link.starts_at - make_interval(mins => current_link.setup_minutes),
        current_link.ends_at + make_interval(mins => current_link.teardown_minutes),
        '[)'
      ) && tstzrange(
        new.starts_at - make_interval(mins => new.setup_minutes),
        new.ends_at + make_interval(mins => new.teardown_minutes),
        '[)'
      )
  ) then
    raise exception 'Conflito de agenda para o recurso selecionado.';
  end if;

  return new;
end;
$$;

create or replace function public.sync_calendar_event_resource_times()
returns trigger
language plpgsql
as $$
begin
  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    update public.calendar_event_resources
    set starts_at = new.starts_at,
        ends_at = new.ends_at,
        updated_at = now()
    where event_id = new.id
      and starts_at = old.starts_at
      and ends_at = old.ends_at;
  end if;

  return new;
end;
$$;

drop trigger if exists calendar_event_types_prepare on public.calendar_event_types;
create trigger calendar_event_types_prepare
before insert or update on public.calendar_event_types
for each row execute function public.prepare_calendar_event_type();

drop trigger if exists calendar_resources_prepare on public.calendar_resources;
create trigger calendar_resources_prepare
before insert or update on public.calendar_resources
for each row execute function public.prepare_calendar_resource();

drop trigger if exists calendar_events_prepare on public.calendar_events;
create trigger calendar_events_prepare
before insert or update on public.calendar_events
for each row execute function public.prepare_calendar_event();

drop trigger if exists calendar_booking_requests_prepare on public.calendar_booking_requests;
create trigger calendar_booking_requests_prepare
before insert or update on public.calendar_booking_requests
for each row execute function public.prepare_calendar_booking_request();

drop trigger if exists calendar_event_resources_prepare on public.calendar_event_resources;
create trigger calendar_event_resources_prepare
before insert or update on public.calendar_event_resources
for each row execute function public.prepare_calendar_event_resource();

drop trigger if exists calendar_event_types_updated_at on public.calendar_event_types;
create trigger calendar_event_types_updated_at
before update on public.calendar_event_types
for each row execute function public.set_row_updated_at();

drop trigger if exists calendar_resources_updated_at on public.calendar_resources;
create trigger calendar_resources_updated_at
before update on public.calendar_resources
for each row execute function public.set_row_updated_at();

drop trigger if exists calendar_events_updated_at on public.calendar_events;
create trigger calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_row_updated_at();

drop trigger if exists calendar_booking_requests_updated_at on public.calendar_booking_requests;
create trigger calendar_booking_requests_updated_at
before update on public.calendar_booking_requests
for each row execute function public.set_row_updated_at();

drop trigger if exists calendar_event_resources_updated_at on public.calendar_event_resources;
create trigger calendar_event_resources_updated_at
before update on public.calendar_event_resources
for each row execute function public.set_row_updated_at();

drop trigger if exists calendar_events_sync_resources on public.calendar_events;
create trigger calendar_events_sync_resources
after update of starts_at, ends_at on public.calendar_events
for each row execute function public.sync_calendar_event_resource_times();

alter table public.calendar_event_types enable row level security;
alter table public.calendar_resources enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_event_resources enable row level security;
alter table public.calendar_booking_requests enable row level security;

drop policy if exists "Public read calendar event types" on public.calendar_event_types;
drop policy if exists "Managers manage calendar event types" on public.calendar_event_types;
drop policy if exists "Public read calendar resources" on public.calendar_resources;
drop policy if exists "Managers manage calendar resources" on public.calendar_resources;
drop policy if exists "Public read calendar events" on public.calendar_events;
drop policy if exists "Managers manage calendar events" on public.calendar_events;
drop policy if exists "Managers read calendar event resources" on public.calendar_event_resources;
drop policy if exists "Managers manage calendar event resources" on public.calendar_event_resources;
drop policy if exists "Managers read calendar booking requests" on public.calendar_booking_requests;
drop policy if exists "Managers manage calendar booking requests" on public.calendar_booking_requests;

create policy "Public read calendar event types"
  on public.calendar_event_types for select
  using (is_active = true);

create policy "Managers manage calendar event types"
  on public.calendar_event_types for all
  using (public.calendar_is_manager())
  with check (public.calendar_is_manager());

create policy "Public read calendar resources"
  on public.calendar_resources for select
  using (is_active = true and is_publicly_listed = true);

create policy "Managers manage calendar resources"
  on public.calendar_resources for all
  using (public.calendar_is_manager())
  with check (public.calendar_is_manager());

create policy "Public read calendar events"
  on public.calendar_events for select
  using (
    visibility = 'public'
    and status in ('confirmed', 'completed', 'cancelled')
  );

create policy "Managers manage calendar events"
  on public.calendar_events for all
  using (public.calendar_is_manager())
  with check (public.calendar_is_manager());

create policy "Managers read calendar event resources"
  on public.calendar_event_resources for select
  using (public.calendar_is_manager());

create policy "Managers manage calendar event resources"
  on public.calendar_event_resources for all
  using (public.calendar_is_manager())
  with check (public.calendar_is_manager());

create policy "Managers read calendar booking requests"
  on public.calendar_booking_requests for select
  using (public.calendar_is_manager());

create policy "Managers manage calendar booking requests"
  on public.calendar_booking_requests for all
  using (public.calendar_is_manager())
  with check (public.calendar_is_manager());

insert into public.calendar_event_types (
  slug,
  name,
  description,
  color,
  default_duration_minutes,
  default_visibility,
  requires_approval,
  requires_resource
)
values
  ('missa', 'Missa', 'Celebracoes liturgicas da paroquia.', '#1d4ed8', 60, 'public', false, true),
  ('reuniao', 'Reuniao', 'Reunioes internas de grupos, pastorais e coordenacoes.', '#475569', 60, 'internal', true, true),
  ('formacao', 'Formacao', 'Formacoes, catequeses e encontros de estudo.', '#0f766e', 90, 'public', false, true),
  ('pastoral', 'Pastoral', 'Atividades organizadas pelas pastorais e ministerios.', '#7c3aed', 90, 'public', true, true),
  ('festa', 'Festa', 'Eventos festivos e grandes celebracoes da paroquia.', '#ea580c', 180, 'public', true, true),
  ('ensaio', 'Ensaio', 'Ensaios de musica, liturgia e preparacoes.', '#ca8a04', 90, 'internal', false, true),
  ('reserva-de-espaco', 'Reserva de espaco', 'Uso administrativo ou interno de ambientes da paroquia.', '#64748b', 60, 'private', true, true)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  default_duration_minutes = excluded.default_duration_minutes,
  default_visibility = excluded.default_visibility,
  requires_approval = excluded.requires_approval,
  requires_resource = excluded.requires_resource,
  is_active = true,
  updated_at = now();
