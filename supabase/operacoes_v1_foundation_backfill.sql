with source_communities as (
  select
    'community'::text as unit_type,
    coalesce(nullif(btrim(item ->> 'id'), ''), public.operacoes_slugify(item ->> 'name')) as legacy_key,
    coalesce(nullif(btrim(item ->> 'name'), ''), 'Comunidade sem nome') as unit_name,
    nullif(btrim(item ->> 'description'), '') as summary,
    jsonb_build_object(
      'source', 'site_data.communities',
      'legacy_item', item
    ) as metadata
  from public.site_data sd
  cross join lateral jsonb_array_elements(coalesce(sd.data -> 'communities', '[]'::jsonb)) as community_items(item)
  where sd.id = 1
),
source_pastorals as (
  select
    category.unit_type,
    coalesce(
      nullif(btrim(item ->> 'id'), ''),
      nullif(btrim(item ->> 'slug'), ''),
      public.operacoes_slugify(item ->> 'name')
    ) as legacy_key,
    coalesce(nullif(btrim(item ->> 'name'), ''), 'Item sem nome') as unit_name,
    coalesce(
      nullif(btrim(item ->> 'summary'), ''),
      nullif(btrim(item ->> 'objective'), ''),
      nullif(btrim(item ->> 'description'), '')
    ) as summary,
    jsonb_build_object(
      'source', category.source_key,
      'legacy_item', item
    ) as metadata
  from public.site_data sd
  cross join lateral (
    values
      ('pastoral'::text, 'pastorais'::text, sd.data -> 'pastorals' -> 'pastorais'),
      ('movement'::text, 'movimentos'::text, sd.data -> 'pastorals' -> 'movimentos'),
      ('service'::text, 'servicos'::text, sd.data -> 'pastorals' -> 'servicos')
  ) as category(unit_type, source_key, payload)
  cross join lateral jsonb_array_elements(coalesce(category.payload, '[]'::jsonb)) as category_items(item)
  where sd.id = 1
),
source_units as (
  select * from source_communities
  union all
  select * from source_pastorals
)
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
select
  unit_type,
  concat_ws('-', unit_type, legacy_key),
  unit_name,
  summary,
  true,
  'site_data',
  legacy_key,
  metadata
from source_units
where unit_name is not null
on conflict (type, legacy_key) do update
set
  name = excluded.name,
  summary = excluded.summary,
  is_active = true,
  metadata = public.org_units.metadata || excluded.metadata,
  updated_at = now();

insert into public.profile_module_access (
  profile_id,
  module_key,
  can_read,
  can_write,
  can_approve,
  can_admin,
  metadata
)
select
  p.id,
  m.key,
  true,
  true,
  true,
  p.role = 'admin',
  jsonb_build_object(
    'source', 'operacoes_v1_foundation_backfill',
    'seeded_from_role', p.role
  )
from public.profiles p
cross join public.app_modules m
where p.role in ('admin', 'secretary')
on conflict (profile_id, module_key) do update
set
  can_read = excluded.can_read,
  can_write = excluded.can_write,
  can_approve = excluded.can_approve,
  can_admin = excluded.can_admin,
  metadata = public.profile_module_access.metadata || excluded.metadata,
  updated_at = now();
