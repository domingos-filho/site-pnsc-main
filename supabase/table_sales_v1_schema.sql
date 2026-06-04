-- Table sales v1 schema
-- Goal: simple reservation and sale of whole tables by event and org unit.
-- Prerequisite: supabase/operacoes_v1_foundation_schema.sql already applied.

create table if not exists public.table_sales_events (
  id uuid primary key default gen_random_uuid(),
  org_unit_id uuid not null references public.org_units(id) on delete restrict,
  slug text not null,
  name text not null,
  description text,
  event_date date not null,
  sales_starts_at timestamptz,
  sales_ends_at timestamptz,
  default_table_price numeric(10,2) not null default 0,
  location_text text,
  contact_name text,
  contact_phone text,
  sales_status text not null default 'draft',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_unit_id, slug)
);

create table if not exists public.table_sales_tables (
  id uuid primary key default gen_random_uuid(),
  table_sales_event_id uuid not null references public.table_sales_events(id) on delete cascade,
  table_number text not null,
  display_name text,
  sector text,
  capacity integer not null default 4,
  base_price numeric(10,2),
  status text not null default 'available',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (table_sales_event_id, table_number)
);

create table if not exists public.table_sales_reservations (
  id uuid primary key default gen_random_uuid(),
  table_sales_event_id uuid not null references public.table_sales_events(id) on delete cascade,
  table_id uuid not null references public.table_sales_tables(id) on delete restrict,
  reservation_code text not null,
  status text not null default 'pending',
  customer_name text not null,
  customer_phone text,
  customer_email text,
  group_name text,
  payment_status text not null default 'pending',
  amount_due numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  payment_method text,
  expires_at timestamptz,
  confirmed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reservation_code)
);

create index if not exists table_sales_events_org_unit_idx
  on public.table_sales_events (org_unit_id, event_date desc);

create index if not exists table_sales_events_status_idx
  on public.table_sales_events (sales_status, is_active);

create index if not exists table_sales_tables_event_idx
  on public.table_sales_tables (table_sales_event_id, table_number);

create index if not exists table_sales_reservations_event_idx
  on public.table_sales_reservations (table_sales_event_id, created_at desc);

create index if not exists table_sales_reservations_table_idx
  on public.table_sales_reservations (table_id, created_at desc);

create unique index if not exists table_sales_reservations_active_table_key
  on public.table_sales_reservations (table_id)
  where status in ('pending', 'confirmed');

alter table public.table_sales_events drop constraint if exists table_sales_events_sales_status_check;
alter table public.table_sales_events
  add constraint table_sales_events_sales_status_check
  check (sales_status in ('draft', 'open', 'closed', 'archived'));

alter table public.table_sales_events drop constraint if exists table_sales_events_default_table_price_check;
alter table public.table_sales_events
  add constraint table_sales_events_default_table_price_check
  check (default_table_price >= 0);

alter table public.table_sales_events drop constraint if exists table_sales_events_sales_window_check;
alter table public.table_sales_events
  add constraint table_sales_events_sales_window_check
  check (sales_ends_at is null or sales_starts_at is null or sales_ends_at > sales_starts_at);

alter table public.table_sales_tables drop constraint if exists table_sales_tables_capacity_check;
alter table public.table_sales_tables
  add constraint table_sales_tables_capacity_check
  check (capacity > 0);

alter table public.table_sales_tables drop constraint if exists table_sales_tables_base_price_check;
alter table public.table_sales_tables
  add constraint table_sales_tables_base_price_check
  check (base_price is null or base_price >= 0);

alter table public.table_sales_tables drop constraint if exists table_sales_tables_status_check;
alter table public.table_sales_tables
  add constraint table_sales_tables_status_check
  check (status in ('available', 'blocked'));

alter table public.table_sales_reservations drop constraint if exists table_sales_reservations_status_check;
alter table public.table_sales_reservations
  add constraint table_sales_reservations_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'expired'));

alter table public.table_sales_reservations drop constraint if exists table_sales_reservations_payment_status_check;
alter table public.table_sales_reservations
  add constraint table_sales_reservations_payment_status_check
  check (payment_status in ('pending', 'partial', 'paid', 'refunded'));

alter table public.table_sales_reservations drop constraint if exists table_sales_reservations_amount_due_check;
alter table public.table_sales_reservations
  add constraint table_sales_reservations_amount_due_check
  check (amount_due >= 0);

alter table public.table_sales_reservations drop constraint if exists table_sales_reservations_amount_paid_check;
alter table public.table_sales_reservations
  add constraint table_sales_reservations_amount_paid_check
  check (amount_paid >= 0);

comment on table public.table_sales_events is
  'Eventos operacionais de venda e reserva de mesas por unidade organizacional.';

comment on table public.table_sales_tables is
  'Mesas disponiveis para reserva em cada evento.';

comment on table public.table_sales_reservations is
  'Reservas e confirmacoes de mesas por evento.';

create or replace function public.table_sales_has_module_access(permission text default 'read')
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    case coalesce(permission, 'read')
      when 'read' then exists (
        select 1
        from public.profile_module_access pma
        where pma.profile_id = auth.uid()
          and pma.module_key = 'table_sales'
          and (pma.can_read or pma.can_write or pma.can_approve or pma.can_admin)
      )
      when 'write' then exists (
        select 1
        from public.profile_module_access pma
        where pma.profile_id = auth.uid()
          and pma.module_key = 'table_sales'
          and (pma.can_write or pma.can_approve or pma.can_admin)
      )
      when 'approve' then exists (
        select 1
        from public.profile_module_access pma
        where pma.profile_id = auth.uid()
          and pma.module_key = 'table_sales'
          and (pma.can_approve or pma.can_admin)
      )
      when 'admin' then exists (
        select 1
        from public.profile_module_access pma
        where pma.profile_id = auth.uid()
          and pma.module_key = 'table_sales'
          and pma.can_admin
      )
      else false
    end;
$$;

create or replace function public.table_sales_can_access_org_unit(target_org_unit_id uuid, permission text default 'read')
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    public.operacoes_is_admin()
    or exists (
      select 1
      from public.profile_org_units pou
      join public.org_unit_module_settings oums
        on oums.org_unit_id = pou.org_unit_id
       and oums.module_key = 'table_sales'
       and oums.is_enabled = true
      join public.profile_module_access pma
        on pma.profile_id = pou.profile_id
       and pma.module_key = 'table_sales'
      where pou.profile_id = auth.uid()
        and pou.org_unit_id = target_org_unit_id
        and case coalesce(permission, 'read')
          when 'read' then (pma.can_read or pma.can_write or pma.can_approve or pma.can_admin)
          when 'write' then (pma.can_write or pma.can_approve or pma.can_admin)
          when 'approve' then (pma.can_approve or pma.can_admin)
          when 'admin' then pma.can_admin
          else false
        end
    );
$$;

create or replace function public.table_sales_can_access_event(target_event_id uuid, permission text default 'read')
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.table_sales_events e
    where e.id = target_event_id
      and public.table_sales_can_access_org_unit(e.org_unit_id, permission)
  );
$$;

create or replace function public.table_sales_can_access_table(target_table_id uuid, permission text default 'read')
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.table_sales_tables t
    join public.table_sales_events e on e.id = t.table_sales_event_id
    where t.id = target_table_id
      and public.table_sales_can_access_org_unit(e.org_unit_id, permission)
  );
$$;

create or replace function public.table_sales_can_access_reservation(target_reservation_id uuid, permission text default 'read')
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.table_sales_reservations r
    join public.table_sales_events e on e.id = r.table_sales_event_id
    where r.id = target_reservation_id
      and public.table_sales_can_access_org_unit(e.org_unit_id, permission)
  );
$$;

create or replace function public.table_sales_event_tables(target_event_id uuid default null)
returns table (
  table_id uuid,
  table_sales_event_id uuid,
  table_number text,
  display_name text,
  sector text,
  capacity integer,
  base_price numeric,
  effective_price numeric,
  manual_status text,
  availability_status text,
  notes text,
  active_reservation_id uuid,
  active_reservation_status text,
  reservation_code text,
  customer_name text,
  customer_phone text,
  payment_status text,
  amount_due numeric,
  amount_paid numeric,
  updated_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select
    t.id as table_id,
    t.table_sales_event_id,
    t.table_number,
    t.display_name,
    t.sector,
    t.capacity,
    t.base_price,
    coalesce(t.base_price, e.default_table_price, 0) as effective_price,
    t.status as manual_status,
    case
      when t.status = 'blocked' then 'blocked'
      when active_reservation.id is not null then 'reserved'
      else 'available'
    end as availability_status,
    t.notes,
    active_reservation.id as active_reservation_id,
    active_reservation.status as active_reservation_status,
    active_reservation.reservation_code,
    active_reservation.customer_name,
    active_reservation.customer_phone,
    active_reservation.payment_status,
    active_reservation.amount_due,
    active_reservation.amount_paid,
    t.updated_at
  from public.table_sales_tables t
  join public.table_sales_events e on e.id = t.table_sales_event_id
  left join lateral (
    select
      r.id,
      r.status,
      r.reservation_code,
      r.customer_name,
      r.customer_phone,
      r.payment_status,
      r.amount_due,
      r.amount_paid
    from public.table_sales_reservations r
    where r.table_id = t.id
      and r.status in ('pending', 'confirmed')
    order by r.created_at desc
    limit 1
  ) active_reservation on true
  where target_event_id is null or t.table_sales_event_id = target_event_id
  order by t.table_number;
$$;

comment on function public.table_sales_event_tables(uuid) is
  'Retorna mesas do evento com disponibilidade calculada e eventual reserva ativa.';

create or replace function public.prepare_table_sales_event()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(coalesce(new.name, ''));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.slug := nullif(public.operacoes_slugify(coalesce(new.slug, new.name)), '');
  new.location_text := nullif(btrim(coalesce(new.location_text, '')), '');
  new.contact_name := nullif(btrim(coalesce(new.contact_name, '')), '');
  new.contact_phone := nullif(btrim(coalesce(new.contact_phone, '')), '');
  new.sales_status := coalesce(nullif(btrim(coalesce(new.sales_status, '')), ''), 'draft');
  new.default_table_price := coalesce(new.default_table_price, 0);
  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  if new.slug is null then
    raise exception 'table_sales_events.slug nao pode ficar vazio';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  return new;
end;
$$;

create or replace function public.prepare_table_sales_table()
returns trigger
language plpgsql
as $$
begin
  new.table_number := btrim(coalesce(new.table_number, ''));
  new.display_name := nullif(btrim(coalesce(new.display_name, '')), '');
  new.sector := nullif(btrim(coalesce(new.sector, '')), '');
  new.status := coalesce(nullif(btrim(coalesce(new.status, '')), ''), 'available');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.capacity := coalesce(new.capacity, 4);

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  return new;
end;
$$;

create or replace function public.prepare_table_sales_reservation()
returns trigger
language plpgsql
as $$
declare
  selected_table record;
begin
  select
    t.id,
    t.table_sales_event_id,
    t.status,
    t.base_price,
    e.default_table_price
  into selected_table
  from public.table_sales_tables t
  join public.table_sales_events e on e.id = t.table_sales_event_id
  where t.id = new.table_id;

  if selected_table.id is null then
    raise exception 'mesa nao encontrada para a reserva';
  end if;

  if new.table_sales_event_id is null or new.table_sales_event_id <> selected_table.table_sales_event_id then
    new.table_sales_event_id := selected_table.table_sales_event_id;
  end if;

  if selected_table.status = 'blocked' and coalesce(new.status, 'pending') in ('pending', 'confirmed') then
    raise exception 'nao e permitido reservar uma mesa bloqueada';
  end if;

  new.customer_name := btrim(coalesce(new.customer_name, ''));
  new.customer_phone := nullif(btrim(coalesce(new.customer_phone, '')), '');
  new.customer_email := nullif(lower(btrim(coalesce(new.customer_email, ''))), '');
  new.group_name := nullif(btrim(coalesce(new.group_name, '')), '');
  new.payment_method := nullif(btrim(coalesce(new.payment_method, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.status := coalesce(nullif(btrim(coalesce(new.status, '')), ''), 'pending');
  new.payment_status := coalesce(nullif(btrim(coalesce(new.payment_status, '')), ''), 'pending');
  new.amount_due := coalesce(new.amount_due, selected_table.base_price, selected_table.default_table_price, 0);
  new.amount_paid := coalesce(new.amount_paid, 0);
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.reservation_code := coalesce(
    nullif(btrim(coalesce(new.reservation_code, '')), ''),
    upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );
  new.confirmed_at := case
    when new.status = 'confirmed' then coalesce(new.confirmed_at, now())
    else null
  end;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  return new;
end;
$$;

drop trigger if exists table_sales_events_prepare on public.table_sales_events;
create trigger table_sales_events_prepare
before insert or update on public.table_sales_events
for each row execute function public.prepare_table_sales_event();

drop trigger if exists table_sales_events_updated_at on public.table_sales_events;
create trigger table_sales_events_updated_at
before update on public.table_sales_events
for each row execute function public.set_operacoes_updated_at();

drop trigger if exists table_sales_tables_prepare on public.table_sales_tables;
create trigger table_sales_tables_prepare
before insert or update on public.table_sales_tables
for each row execute function public.prepare_table_sales_table();

drop trigger if exists table_sales_tables_updated_at on public.table_sales_tables;
create trigger table_sales_tables_updated_at
before update on public.table_sales_tables
for each row execute function public.set_operacoes_updated_at();

drop trigger if exists table_sales_reservations_prepare on public.table_sales_reservations;
create trigger table_sales_reservations_prepare
before insert or update on public.table_sales_reservations
for each row execute function public.prepare_table_sales_reservation();

drop trigger if exists table_sales_reservations_updated_at on public.table_sales_reservations;
create trigger table_sales_reservations_updated_at
before update on public.table_sales_reservations
for each row execute function public.set_operacoes_updated_at();

alter table public.table_sales_events enable row level security;
alter table public.table_sales_tables enable row level security;
alter table public.table_sales_reservations enable row level security;

drop policy if exists "Table sales read events" on public.table_sales_events;
drop policy if exists "Table sales insert events" on public.table_sales_events;
drop policy if exists "Table sales update events" on public.table_sales_events;
drop policy if exists "Table sales delete events" on public.table_sales_events;

drop policy if exists "Table sales read tables" on public.table_sales_tables;
drop policy if exists "Table sales insert tables" on public.table_sales_tables;
drop policy if exists "Table sales update tables" on public.table_sales_tables;
drop policy if exists "Table sales delete tables" on public.table_sales_tables;

drop policy if exists "Table sales read reservations" on public.table_sales_reservations;
drop policy if exists "Table sales insert reservations" on public.table_sales_reservations;
drop policy if exists "Table sales update reservations" on public.table_sales_reservations;
drop policy if exists "Table sales delete reservations" on public.table_sales_reservations;

create policy "Table sales read events"
  on public.table_sales_events for select
  to authenticated
  using (public.table_sales_can_access_org_unit(org_unit_id, 'read'));

create policy "Table sales insert events"
  on public.table_sales_events for insert
  to authenticated
  with check (public.table_sales_can_access_org_unit(org_unit_id, 'write'));

create policy "Table sales update events"
  on public.table_sales_events for update
  to authenticated
  using (public.table_sales_can_access_org_unit(org_unit_id, 'write'))
  with check (public.table_sales_can_access_org_unit(org_unit_id, 'write'));

create policy "Table sales delete events"
  on public.table_sales_events for delete
  to authenticated
  using (public.table_sales_can_access_org_unit(org_unit_id, 'admin'));

create policy "Table sales read tables"
  on public.table_sales_tables for select
  to authenticated
  using (public.table_sales_can_access_table(id, 'read'));

create policy "Table sales insert tables"
  on public.table_sales_tables for insert
  to authenticated
  with check (public.table_sales_can_access_event(table_sales_event_id, 'write'));

create policy "Table sales update tables"
  on public.table_sales_tables for update
  to authenticated
  using (public.table_sales_can_access_table(id, 'write'))
  with check (public.table_sales_can_access_event(table_sales_event_id, 'write'));

create policy "Table sales delete tables"
  on public.table_sales_tables for delete
  to authenticated
  using (public.table_sales_can_access_table(id, 'write'));

create policy "Table sales read reservations"
  on public.table_sales_reservations for select
  to authenticated
  using (public.table_sales_can_access_reservation(id, 'read'));

create policy "Table sales insert reservations"
  on public.table_sales_reservations for insert
  to authenticated
  with check (public.table_sales_can_access_event(table_sales_event_id, 'write'));

create policy "Table sales update reservations"
  on public.table_sales_reservations for update
  to authenticated
  using (public.table_sales_can_access_reservation(id, 'write'))
  with check (public.table_sales_can_access_event(table_sales_event_id, 'write'));

create policy "Table sales delete reservations"
  on public.table_sales_reservations for delete
  to authenticated
  using (public.table_sales_can_access_reservation(id, 'write'));
