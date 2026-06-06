-- Table sales v1 patch: private event image / layout media
-- Apply on top of an existing table_sales_v1 installation.

create or replace function public.table_sales_extract_event_id_from_path(object_name text)
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

create or replace function public.table_sales_can_access_storage_object(object_name text, permission text default 'read')
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    case
      when public.table_sales_extract_event_id_from_path(object_name) is null then false
      else public.table_sales_can_access_event(public.table_sales_extract_event_id_from_path(object_name), permission)
    end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'table-sales-media',
  'table-sales-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Table sales storage read" on storage.objects;
drop policy if exists "Table sales storage insert" on storage.objects;
drop policy if exists "Table sales storage update" on storage.objects;
drop policy if exists "Table sales storage delete" on storage.objects;

create policy "Table sales storage read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'table-sales-media'
    and public.table_sales_can_access_storage_object(name, 'read')
  );

create policy "Table sales storage insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'table-sales-media'
    and public.table_sales_can_access_storage_object(name, 'write')
  );

create policy "Table sales storage update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'table-sales-media'
    and public.table_sales_can_access_storage_object(name, 'write')
  )
  with check (
    bucket_id = 'table-sales-media'
    and public.table_sales_can_access_storage_object(name, 'write')
  );

create policy "Table sales storage delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'table-sales-media'
    and public.table_sales_can_access_storage_object(name, 'write')
  );
