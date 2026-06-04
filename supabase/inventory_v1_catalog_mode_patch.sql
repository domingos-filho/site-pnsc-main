-- Inventory v1 catalog mode patch
-- Apply on top of an existing inventory_v1 installation.
-- Goal: align the database metadata and storage rules with the simplified UX
-- focused on manual quantity and one primary photo per item.

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

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'inventory-media';
