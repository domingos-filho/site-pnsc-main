-- Table sales v1 patch: reservation/payment consistency
-- Goal: prevent confirmed reservations with pending payment.
-- Apply on top of an existing table_sales_v1 installation.

update public.table_sales_reservations
set payment_status = case
  when status = 'confirmed' and coalesce(amount_due, 0) <= 0 then 'paid'
  when status = 'confirmed' and coalesce(amount_paid, 0) <= 0 then 'pending'
  when status = 'confirmed' and coalesce(amount_paid, 0) < coalesce(amount_due, 0) then 'partial'
  when status = 'confirmed' then 'paid'
  else payment_status
end;

update public.table_sales_reservations
set
  status = 'pending',
  confirmed_at = null
where status = 'confirmed'
  and payment_status = 'pending';

alter table public.table_sales_reservations drop constraint if exists table_sales_reservations_confirmed_payment_check;
alter table public.table_sales_reservations
  add constraint table_sales_reservations_confirmed_payment_check
  check (status <> 'confirmed' or payment_status in ('partial', 'paid'));

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

  if new.status = 'confirmed' then
    if new.amount_due <= 0 then
      new.payment_status := 'paid';
    elsif new.amount_paid <= 0 then
      raise exception 'reserva confirmada exige pagamento parcial ou pago';
    elsif new.amount_paid < new.amount_due then
      new.payment_status := 'partial';
    else
      new.payment_status := 'paid';
    end if;
  end if;

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
