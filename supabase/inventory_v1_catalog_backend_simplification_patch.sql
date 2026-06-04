-- Inventory v1 catalog backend simplification patch
-- Apply after inventory_v1_catalog_mode_patch.sql.
-- Goal: reduce the operational importance of inventory_movements
-- in the simplified catalog model.

alter table public.inventory_movements
  drop constraint if exists inventory_movements_inventory_item_id_fkey;

alter table public.inventory_movements
  add constraint inventory_movements_inventory_item_id_fkey
  foreign key (inventory_item_id)
  references public.inventory_items(id)
  on delete cascade;

drop trigger if exists inventory_items_delete_guard on public.inventory_items;

create or replace function public.inventory_catalog_items(target_inventory_id uuid default null)
returns table (
  item_id uuid,
  inventory_id uuid,
  inventory_name text,
  inventory_slug text,
  org_unit_id uuid,
  sku text,
  name text,
  description text,
  item_type text,
  unit_label text,
  current_quantity numeric,
  location_text text,
  brand text,
  model text,
  serial_number text,
  condition_status text,
  acquisition_date date,
  acquisition_cost numeric,
  is_active boolean,
  photo_bucket_path text,
  photo_file_name text,
  photo_mime_type text,
  photo_file_size_bytes bigint
)
language sql
security invoker
set search_path = public
as $$
  select
    item.id as item_id,
    item.inventory_id,
    inventory.name as inventory_name,
    inventory.slug as inventory_slug,
    inventory.org_unit_id,
    item.sku,
    item.name,
    item.description,
    item.item_type,
    item.unit_label,
    item.current_quantity,
    item.location_text,
    item.brand,
    item.model,
    item.serial_number,
    item.condition_status,
    item.acquisition_date,
    item.acquisition_cost,
    item.is_active,
    photo.bucket_path as photo_bucket_path,
    photo.file_name as photo_file_name,
    photo.mime_type as photo_mime_type,
    photo.file_size_bytes as photo_file_size_bytes
  from public.inventory_items item
  join public.inventories inventory on inventory.id = item.inventory_id
  left join lateral public.inventory_item_primary_photo(item.id) photo on true
  where target_inventory_id is null or item.inventory_id = target_inventory_id
  order by inventory.name, item.name;
$$;

comment on function public.inventory_catalog_items(uuid) is
  'Leitura simplificada de itens do catalogo com foto principal, sem depender de inventory_movements.';

comment on function public.inventory_apply_movement() is
  'Funcao legada/opcional para quem ainda registra inventory_movements.';

comment on function public.inventory_block_item_delete_with_history() is
  'Funcao legada. O modo catalogo simplificado nao deve mais usa-la para bloquear exclusao.';
