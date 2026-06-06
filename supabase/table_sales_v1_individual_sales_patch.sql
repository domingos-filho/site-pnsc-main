-- Table sales v1 patch: optional individual sale per event
-- Apply on top of an existing table_sales_v1 installation.

alter table public.table_sales_events
  add column if not exists allow_individual_sales boolean not null default false;

alter table public.table_sales_reservations
  add column if not exists reservation_mode text not null default 'table';

alter table public.table_sales_reservations
  alter column table_id drop not null;

alter table public.table_sales_reservations drop constraint if exists table_sales_reservations_mode_check;
alter table public.table_sales_reservations
  add constraint table_sales_reservations_mode_check
  check (reservation_mode in ('table', 'individual'));

alter table public.table_sales_reservations drop constraint if exists table_sales_reservations_target_check;
alter table public.table_sales_reservations
  add constraint table_sales_reservations_target_check
  check (
    (reservation_mode = 'table' and table_id is not null)
    or (reservation_mode = 'individual' and table_id is null)
  );

comment on table public.table_sales_events is
  'Eventos operacionais de venda e reserva de mesas por unidade organizacional, com opcao de venda individual.';

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
  new.allow_individual_sales := coalesce(new.allow_individual_sales, false);
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

create or replace function public.prepare_table_sales_reservation()
returns trigger
language plpgsql
as $$
declare
  selected_table record;
  selected_event record;
  resolved_table_price numeric(10,2);
  resolved_default_price numeric(10,2);
begin
  new.reservation_mode := coalesce(nullif(btrim(coalesce(new.reservation_mode, '')), ''), 'table');

  if new.reservation_mode = 'table' then
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

    resolved_table_price := selected_table.base_price;
    resolved_default_price := selected_table.default_table_price;
  else
    select
      e.id,
      e.allow_individual_sales,
      e.default_table_price
    into selected_event
    from public.table_sales_events e
    where e.id = new.table_sales_event_id;

    if selected_event.id is null then
      raise exception 'evento nao encontrado para a reserva individual';
    end if;

    if not coalesce(selected_event.allow_individual_sales, false) then
      raise exception 'este evento nao permite venda individual';
    end if;

    new.table_id := null;
    resolved_default_price := selected_event.default_table_price;
  end if;

  new.customer_name := btrim(coalesce(new.customer_name, ''));
  new.customer_phone := nullif(btrim(coalesce(new.customer_phone, '')), '');
  new.customer_email := nullif(lower(btrim(coalesce(new.customer_email, ''))), '');
  new.group_name := nullif(btrim(coalesce(new.group_name, '')), '');
  new.payment_method := nullif(btrim(coalesce(new.payment_method, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.status := coalesce(nullif(btrim(coalesce(new.status, '')), ''), 'pending');
  new.payment_status := coalesce(nullif(btrim(coalesce(new.payment_status, '')), ''), 'pending');
  new.amount_due := coalesce(
    new.amount_due,
    resolved_table_price,
    resolved_default_price,
    0
  );
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
