-- Inventory v1 schema
-- Prerequisite: supabase/operacoes_v1_foundation_schema.sql already applied.
-- Current UX focus: simple item catalog by group, with manual quantity and one primary photo.
-- Legacy movement and generic attachment structures are retained for compatibility.

create table if not exists public.inventories (
  id uuid primary key default gen_random_uuid(),
  org_unit_id uuid not null references public.org_units(id) on delete restrict,
  slug text not null,
  name text not null,
  description text,
  inventory_type text not null default 'mixed',
  manager_profile_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_unit_id, slug)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete restrict,
  sku text,
  name text not null,
  description text,
  item_type text not null default 'consumable',
  tracking_mode text not null default 'quantity',
  unit_label text not null default 'un',
  current_quantity numeric(14,3) not null default 0,
  minimum_quantity numeric(14,3) not null default 0,
  ideal_quantity numeric(14,3),
  location_text text,
  brand text,
  model text,
  serial_number text,
  condition_status text not null default 'good',
  acquisition_date date,
  acquisition_cost numeric(14,2),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null,
  quantity_delta numeric(14,3) not null,
  resulting_quantity numeric(14,3),
  reference_type text,
  reference_code text,
  notes text,
  occurred_at timestamptz not null default now(),
  transfer_group_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_item_attachments (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  bucket_id text not null default 'inventory-media',
  bucket_path text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  kind text not null default 'image',
  caption text,
  is_cover boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket_id, bucket_path)
);

create unique index if not exists inventory_items_inventory_sku_key
  on public.inventory_items (inventory_id, sku)
  where sku is not null;

create unique index if not exists inventory_items_inventory_serial_key
  on public.inventory_items (inventory_id, serial_number)
  where serial_number is not null;

create unique index if not exists inventory_item_attachments_cover_key
  on public.inventory_item_attachments (inventory_item_id)
  where is_cover = true;

create index if not exists inventories_org_unit_idx
  on public.inventories (org_unit_id);

create index if not exists inventories_manager_profile_idx
  on public.inventories (manager_profile_id);

create index if not exists inventory_items_inventory_idx
  on public.inventory_items (inventory_id);

create index if not exists inventory_items_active_idx
  on public.inventory_items (is_active);

create index if not exists inventory_movements_item_idx
  on public.inventory_movements (inventory_item_id, occurred_at desc);

create index if not exists inventory_movements_transfer_group_idx
  on public.inventory_movements (transfer_group_id);

create index if not exists inventory_item_attachments_item_idx
  on public.inventory_item_attachments (inventory_item_id);

alter table public.inventories drop constraint if exists inventories_inventory_type_check;
alter table public.inventories
  add constraint inventories_inventory_type_check
  check (inventory_type in ('mixed', 'consumables', 'assets', 'documents', 'other'));

alter table public.inventory_items drop constraint if exists inventory_items_item_type_check;
alter table public.inventory_items
  add constraint inventory_items_item_type_check
  check (item_type in ('consumable', 'asset', 'document', 'other'));

alter table public.inventory_items drop constraint if exists inventory_items_tracking_mode_check;
alter table public.inventory_items
  add constraint inventory_items_tracking_mode_check
  check (tracking_mode in ('quantity', 'serial'));

alter table public.inventory_items drop constraint if exists inventory_items_condition_status_check;
alter table public.inventory_items
  add constraint inventory_items_condition_status_check
  check (condition_status in ('new', 'good', 'fair', 'repair', 'retired'));

alter table public.inventory_items drop constraint if exists inventory_items_current_quantity_check;
alter table public.inventory_items
  add constraint inventory_items_current_quantity_check
  check (current_quantity >= 0);

alter table public.inventory_items drop constraint if exists inventory_items_minimum_quantity_check;
alter table public.inventory_items
  add constraint inventory_items_minimum_quantity_check
  check (minimum_quantity >= 0);

alter table public.inventory_items drop constraint if exists inventory_items_ideal_quantity_check;
alter table public.inventory_items
  add constraint inventory_items_ideal_quantity_check
  check (ideal_quantity is null or ideal_quantity >= 0);

alter table public.inventory_items drop constraint if exists inventory_items_acquisition_cost_check;
alter table public.inventory_items
  add constraint inventory_items_acquisition_cost_check
  check (acquisition_cost is null or acquisition_cost >= 0);

alter table public.inventory_movements drop constraint if exists inventory_movements_movement_type_check;
alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check
  check (movement_type in ('entry', 'exit', 'adjustment', 'transfer_in', 'transfer_out', 'stocktake', 'writeoff'));

alter table public.inventory_movements drop constraint if exists inventory_movements_quantity_delta_check;
alter table public.inventory_movements
  add constraint inventory_movements_quantity_delta_check
  check (quantity_delta <> 0);

alter table public.inventory_item_attachments drop constraint if exists inventory_item_attachments_kind_check;
alter table public.inventory_item_attachments
  add constraint inventory_item_attachments_kind_check
  check (kind in ('image', 'invoice', 'document', 'other'));

alter table public.inventory_item_attachments drop constraint if exists inventory_item_attachments_file_size_check;
alter table public.inventory_item_attachments
  add constraint inventory_item_attachments_file_size_check
  check (file_size_bytes is null or file_size_bytes >= 0);

comment on table public.inventories is
  'Inventarios por unidade organizacional. Na UX atual, funcionam como listas de itens do grupo.';

comment on table public.inventory_items is
  'Catalogo de itens por inventario. A UX atual usa quantidade manual e foto principal por item.';

comment on column public.inventory_items.current_quantity is
  'Quantidade manual do item no catalogo simplificado.';

comment on column public.inventory_items.tracking_mode is
  'Campo legado de compatibilidade. A UX atual opera sempre em modo quantity.';

comment on column public.inventory_items.minimum_quantity is
  'Campo legado/opcional. Nao e usado na UX simplificada atual.';

comment on column public.inventory_items.ideal_quantity is
  'Campo legado/opcional. Nao e usado na UX simplificada atual.';

comment on table public.inventory_movements is
  'Estrutura legada/opcional para historico de movimentacoes. A UX simplificada atual nao depende desta tabela.';

comment on table public.inventory_item_attachments is
  'Arquivos privados do item. A UX simplificada atual usa principalmente uma foto principal de identificacao.';

create or replace function public.inventory_has_module_access(permission text default 'read')
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
          and pma.module_key = 'inventory'
          and (pma.can_read or pma.can_write or pma.can_approve or pma.can_admin)
      )
      when 'write' then exists (
        select 1
        from public.profile_module_access pma
        where pma.profile_id = auth.uid()
          and pma.module_key = 'inventory'
          and (pma.can_write or pma.can_approve or pma.can_admin)
      )
      when 'approve' then exists (
        select 1
        from public.profile_module_access pma
        where pma.profile_id = auth.uid()
          and pma.module_key = 'inventory'
          and (pma.can_approve or pma.can_admin)
      )
      when 'admin' then exists (
        select 1
        from public.profile_module_access pma
        where pma.profile_id = auth.uid()
          and pma.module_key = 'inventory'
          and pma.can_admin
      )
      else false
    end;
$$;

create or replace function public.inventory_can_access_org_unit(target_org_unit_id uuid, permission text default 'read')
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
       and oums.module_key = 'inventory'
       and oums.is_enabled = true
      join public.profile_module_access pma
        on pma.profile_id = pou.profile_id
       and pma.module_key = 'inventory'
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

create or replace function public.inventory_can_access_inventory(target_inventory_id uuid, permission text default 'read')
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.inventories i
    where i.id = target_inventory_id
      and public.inventory_can_access_org_unit(i.org_unit_id, permission)
  );
$$;

create or replace function public.inventory_can_access_item(target_item_id uuid, permission text default 'read')
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.inventory_items ii
    join public.inventories i on i.id = ii.inventory_id
    where ii.id = target_item_id
      and public.inventory_can_access_org_unit(i.org_unit_id, permission)
  );
$$;

create or replace function public.inventory_extract_item_id_from_path(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  first_segment text;
begin
  first_segment := split_part(coalesce(object_name, ''), '/', 1);

  if first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return first_segment::uuid;
  end if;

  return null;
end;
$$;

create or replace function public.inventory_can_access_storage_object(object_name text, permission text default 'read')
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    case
      when public.inventory_extract_item_id_from_path(object_name) is null then false
      else public.inventory_can_access_item(public.inventory_extract_item_id_from_path(object_name), permission)
    end;
$$;

create or replace function public.inventory_item_primary_photo(target_item_id uuid)
returns table (
  id uuid,
  inventory_item_id uuid,
  bucket_id text,
  bucket_path text,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  caption text,
  created_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select
    attachment.id,
    attachment.inventory_item_id,
    attachment.bucket_id,
    attachment.bucket_path,
    attachment.file_name,
    attachment.mime_type,
    attachment.file_size_bytes,
    attachment.caption,
    attachment.created_at
  from public.inventory_item_attachments attachment
  where attachment.inventory_item_id = target_item_id
    and attachment.kind = 'image'
  order by attachment.is_cover desc, attachment.created_at asc, attachment.id asc
  limit 1;
$$;

comment on function public.inventory_item_primary_photo(uuid) is
  'Retorna a foto principal do item no modelo simplificado de catalogo.';

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

create or replace function public.prepare_inventory()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(coalesce(new.name, ''));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.slug := nullif(public.operacoes_slugify(coalesce(new.slug, new.name)), '');
  new.inventory_type := coalesce(nullif(btrim(coalesce(new.inventory_type, '')), ''), 'mixed');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  if new.slug is null then
    raise exception 'inventories.slug nao pode ficar vazio';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  return new;
end;
$$;

create or replace function public.prepare_inventory_item()
returns trigger
language plpgsql
as $$
begin
  new.sku := nullif(btrim(coalesce(new.sku, '')), '');
  new.name := btrim(coalesce(new.name, ''));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.item_type := coalesce(nullif(btrim(coalesce(new.item_type, '')), ''), 'consumable');
  new.tracking_mode := coalesce(nullif(btrim(coalesce(new.tracking_mode, '')), ''), 'quantity');
  new.unit_label := coalesce(nullif(btrim(coalesce(new.unit_label, '')), ''), 'un');
  new.location_text := nullif(btrim(coalesce(new.location_text, '')), '');
  new.brand := nullif(btrim(coalesce(new.brand, '')), '');
  new.model := nullif(btrim(coalesce(new.model, '')), '');
  new.serial_number := nullif(btrim(coalesce(new.serial_number, '')), '');
  new.condition_status := coalesce(nullif(btrim(coalesce(new.condition_status, '')), ''), 'good');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.current_quantity := coalesce(new.current_quantity, 0);
  new.minimum_quantity := coalesce(new.minimum_quantity, 0);
  new.ideal_quantity := case when new.ideal_quantity is null then null else new.ideal_quantity end;
  new.acquisition_cost := case when new.acquisition_cost is null then null else new.acquisition_cost end;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  return new;
end;
$$;

create or replace function public.prepare_inventory_attachment()
returns trigger
language plpgsql
as $$
begin
  new.bucket_id := coalesce(nullif(btrim(coalesce(new.bucket_id, '')), ''), 'inventory-media');
  new.bucket_path := nullif(btrim(coalesce(new.bucket_path, '')), '');
  new.file_name := nullif(btrim(coalesce(new.file_name, '')), '');
  new.mime_type := nullif(btrim(coalesce(new.mime_type, '')), '');
  new.kind := coalesce(nullif(btrim(coalesce(new.kind, '')), ''), 'image');
  new.caption := nullif(btrim(coalesce(new.caption, '')), '');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  if new.bucket_path is null then
    raise exception 'inventory_item_attachments.bucket_path nao pode ficar vazio';
  end if;

  if new.file_name is null then
    raise exception 'inventory_item_attachments.file_name nao pode ficar vazio';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  return new;
end;
$$;

create or replace function public.prepare_inventory_movement()
returns trigger
language plpgsql
as $$
begin
  new.reference_type := nullif(btrim(coalesce(new.reference_type, '')), '');
  new.reference_code := nullif(btrim(coalesce(new.reference_code, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.movement_type := coalesce(nullif(btrim(coalesce(new.movement_type, '')), ''), new.movement_type);
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.occurred_at := coalesce(new.occurred_at, now());
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create or replace function public.inventory_apply_movement()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_qty numeric(14,3);
  next_qty numeric(14,3);
begin
  select ii.current_quantity
    into current_qty
  from public.inventory_items ii
  where ii.id = new.inventory_item_id
  for update;

  if current_qty is null then
    raise exception 'inventory item nao encontrado para movimentacao';
  end if;

  next_qty := coalesce(current_qty, 0) + new.quantity_delta;

  if next_qty < 0 then
    raise exception 'a movimentacao deixaria o item com quantidade negativa';
  end if;

  update public.inventory_items
  set
    current_quantity = next_qty,
    updated_at = now(),
    updated_by = coalesce(new.created_by, updated_by)
  where id = new.inventory_item_id;

  update public.inventory_movements
  set resulting_quantity = next_qty
  where id = new.id;

  return null;
end;
$$;

comment on function public.inventory_apply_movement() is
  'Funcao legada/opcional para quem ainda registra inventory_movements.';

create or replace function public.inventory_block_item_delete_with_history()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if exists (
    select 1
    from public.inventory_movements im
    where im.inventory_item_id = old.id
  ) then
    raise exception 'nao e permitido excluir item com historico de movimentacoes';
  end if;

  return old;
end;
$$;

comment on function public.inventory_block_item_delete_with_history() is
  'Funcao legada. O modo catalogo simplificado nao deve mais usa-la para bloquear exclusao.';

drop trigger if exists inventories_prepare on public.inventories;
create trigger inventories_prepare
before insert or update on public.inventories
for each row execute function public.prepare_inventory();

drop trigger if exists inventories_updated_at on public.inventories;
create trigger inventories_updated_at
before update on public.inventories
for each row execute function public.set_operacoes_updated_at();

drop trigger if exists inventory_items_prepare on public.inventory_items;
create trigger inventory_items_prepare
before insert or update on public.inventory_items
for each row execute function public.prepare_inventory_item();

drop trigger if exists inventory_items_updated_at on public.inventory_items;
create trigger inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_operacoes_updated_at();

drop trigger if exists inventory_items_delete_guard on public.inventory_items;

drop trigger if exists inventory_movements_prepare on public.inventory_movements;
create trigger inventory_movements_prepare
before insert on public.inventory_movements
for each row execute function public.prepare_inventory_movement();

drop trigger if exists inventory_movements_apply on public.inventory_movements;
create trigger inventory_movements_apply
after insert on public.inventory_movements
for each row execute function public.inventory_apply_movement();

drop trigger if exists inventory_item_attachments_prepare on public.inventory_item_attachments;
create trigger inventory_item_attachments_prepare
before insert or update on public.inventory_item_attachments
for each row execute function public.prepare_inventory_attachment();

alter table public.inventories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_item_attachments enable row level security;

drop policy if exists "Inventory read inventories" on public.inventories;
drop policy if exists "Inventory insert inventories" on public.inventories;
drop policy if exists "Inventory update inventories" on public.inventories;
drop policy if exists "Inventory delete inventories" on public.inventories;

drop policy if exists "Inventory read items" on public.inventory_items;
drop policy if exists "Inventory insert items" on public.inventory_items;
drop policy if exists "Inventory update items" on public.inventory_items;
drop policy if exists "Inventory delete items" on public.inventory_items;

drop policy if exists "Inventory read movements" on public.inventory_movements;
drop policy if exists "Inventory insert movements" on public.inventory_movements;

drop policy if exists "Inventory read attachments" on public.inventory_item_attachments;
drop policy if exists "Inventory insert attachments" on public.inventory_item_attachments;
drop policy if exists "Inventory update attachments" on public.inventory_item_attachments;
drop policy if exists "Inventory delete attachments" on public.inventory_item_attachments;

create policy "Inventory read inventories"
  on public.inventories for select
  to authenticated
  using (public.inventory_can_access_org_unit(org_unit_id, 'read'));

create policy "Inventory insert inventories"
  on public.inventories for insert
  to authenticated
  with check (public.inventory_can_access_org_unit(org_unit_id, 'write'));

create policy "Inventory update inventories"
  on public.inventories for update
  to authenticated
  using (public.inventory_can_access_org_unit(org_unit_id, 'write'))
  with check (public.inventory_can_access_org_unit(org_unit_id, 'write'));

create policy "Inventory delete inventories"
  on public.inventories for delete
  to authenticated
  using (public.inventory_can_access_org_unit(org_unit_id, 'admin'));

create policy "Inventory read items"
  on public.inventory_items for select
  to authenticated
  using (public.inventory_can_access_item(id, 'read'));

create policy "Inventory insert items"
  on public.inventory_items for insert
  to authenticated
  with check (public.inventory_can_access_inventory(inventory_id, 'write'));

create policy "Inventory update items"
  on public.inventory_items for update
  to authenticated
  using (public.inventory_can_access_item(id, 'write'))
  with check (public.inventory_can_access_inventory(inventory_id, 'write'));

create policy "Inventory delete items"
  on public.inventory_items for delete
  to authenticated
  using (public.inventory_can_access_item(id, 'write'));

create policy "Inventory read movements"
  on public.inventory_movements for select
  to authenticated
  using (public.inventory_can_access_item(inventory_item_id, 'read'));

create policy "Inventory insert movements"
  on public.inventory_movements for insert
  to authenticated
  with check (public.inventory_can_access_item(inventory_item_id, 'write'));

create policy "Inventory read attachments"
  on public.inventory_item_attachments for select
  to authenticated
  using (public.inventory_can_access_item(inventory_item_id, 'read'));

create policy "Inventory insert attachments"
  on public.inventory_item_attachments for insert
  to authenticated
  with check (
    public.inventory_can_access_item(inventory_item_id, 'write')
    and bucket_id = 'inventory-media'
  );

create policy "Inventory update attachments"
  on public.inventory_item_attachments for update
  to authenticated
  using (public.inventory_can_access_item(inventory_item_id, 'write'))
  with check (
    public.inventory_can_access_item(inventory_item_id, 'write')
    and bucket_id = 'inventory-media'
  );

create policy "Inventory delete attachments"
  on public.inventory_item_attachments for delete
  to authenticated
  using (public.inventory_can_access_item(inventory_item_id, 'write'));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'inventory-media',
  'inventory-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Inventory storage read" on storage.objects;
drop policy if exists "Inventory storage insert" on storage.objects;
drop policy if exists "Inventory storage update" on storage.objects;
drop policy if exists "Inventory storage delete" on storage.objects;

create policy "Inventory storage read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'inventory-media'
    and public.inventory_can_access_storage_object(name, 'read')
  );

create policy "Inventory storage insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'inventory-media'
    and public.inventory_can_access_storage_object(name, 'write')
  );

create policy "Inventory storage update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'inventory-media'
    and public.inventory_can_access_storage_object(name, 'write')
  )
  with check (
    bucket_id = 'inventory-media'
    and public.inventory_can_access_storage_object(name, 'write')
  );

create policy "Inventory storage delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'inventory-media'
    and public.inventory_can_access_storage_object(name, 'write')
  );
