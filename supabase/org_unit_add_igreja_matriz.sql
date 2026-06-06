-- Add Igreja Matriz as an organizational unit for internal modules.
-- This keeps admin dropdowns sourced from public.org_units instead of hardcoded UI options.

insert into public.org_units (
  type,
  slug,
  name,
  summary,
  is_active,
  source,
  legacy_key,
  metadata
)
values (
  'community',
  'community-igreja-matriz',
  'Igreja Matriz',
  'Unidade organizacional da igreja matriz para operacao interna.',
  true,
  'manual',
  'igreja-matriz',
  jsonb_build_object(
    'source', 'org_unit_add_igreja_matriz_patch',
    'created_for', 'table_sales'
  )
)
on conflict (type, legacy_key) do update
set
  slug = excluded.slug,
  name = excluded.name,
  summary = excluded.summary,
  is_active = true,
  source = excluded.source,
  metadata = public.org_units.metadata || excluded.metadata,
  updated_at = now();

insert into public.org_unit_module_settings (
  org_unit_id,
  module_key,
  is_enabled,
  metadata
)
select
  ou.id,
  'table_sales',
  true,
  jsonb_build_object(
    'source', 'org_unit_add_igreja_matriz_patch'
  )
from public.org_units ou
where ou.type = 'community'
  and ou.legacy_key = 'igreja-matriz'
on conflict (org_unit_id, module_key) do update
set
  is_enabled = true,
  metadata = public.org_unit_module_settings.metadata || excluded.metadata,
  updated_at = now();
