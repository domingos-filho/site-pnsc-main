-- Inventory v1 catalog legacy cleanup patch
-- Apply after inventory_v1_catalog_backend_simplification_patch.sql.
-- Goal: lock writes into catalog mode and normalize legacy item fields
-- without removing compatibility structures.

update public.app_modules
set
  description = 'Catalogo de itens por unidade, com quantidade manual e foto principal.',
  updated_at = now()
where key = 'inventory';

update public.inventory_items
set
  tracking_mode = 'quantity',
  minimum_quantity = 0,
  ideal_quantity = null
where tracking_mode is distinct from 'quantity'
   or minimum_quantity is distinct from 0
   or ideal_quantity is not null;

create or replace function public.prepare_inventory_item()
returns trigger
language plpgsql
as $$
begin
  new.sku := nullif(btrim(coalesce(new.sku, '')), '');
  new.name := btrim(coalesce(new.name, ''));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.item_type := coalesce(nullif(btrim(coalesce(new.item_type, '')), ''), 'consumable');
  new.tracking_mode := 'quantity';
  new.unit_label := coalesce(nullif(btrim(coalesce(new.unit_label, '')), ''), 'un');
  new.location_text := nullif(btrim(coalesce(new.location_text, '')), '');
  new.brand := nullif(btrim(coalesce(new.brand, '')), '');
  new.model := nullif(btrim(coalesce(new.model, '')), '');
  new.serial_number := nullif(btrim(coalesce(new.serial_number, '')), '');
  new.condition_status := coalesce(nullif(btrim(coalesce(new.condition_status, '')), ''), 'good');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.current_quantity := coalesce(new.current_quantity, 0);
  new.minimum_quantity := 0;
  new.ideal_quantity := null;
  new.acquisition_cost := case when new.acquisition_cost is null then null else new.acquisition_cost end;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  return new;
end;
$$;

comment on function public.prepare_inventory_item() is
  'Normaliza itens para o modo catalogo simplificado: quantidade manual, tracking_mode quantity e sem metas de estoque.';
