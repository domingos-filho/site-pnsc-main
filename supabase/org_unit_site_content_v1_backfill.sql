-- Backfill inicial de conteudo institucional para org_unit_site_content
--
-- Pre-requisitos:
-- - public.site_data com id = 1
-- - public.org_units ja populada
-- - public.org_unit_site_content_v1_schema.sql ja aplicado
--
-- Observacao importante:
-- - este backfill foi desenhado para primeira populacao
-- - se voce ja tiver edicoes manuais em org_unit_site_content, o script preserva
--   valores ja preenchidos e usa site_data apenas para completar lacunas

with source_communities as (
  select
    'community'::text as unit_type,
    coalesce(
      nullif(btrim(item ->> 'id'), ''),
      public.operacoes_slugify(item ->> 'name')
    ) as legacy_key,
    coalesce(nullif(btrim(item ->> 'name'), ''), 'Comunidade sem nome') as unit_name,
    nullif(btrim(item ->> 'description'), '') as summary,
    nullif(btrim(item ->> 'description'), '') as description,
    null::text as objective,
    null::text as audience,
    nullif(btrim(item ->> 'coordinator'), '') as responsible,
    nullif(btrim(item ->> 'coordinator'), '') as contact_name,
    null::text as contact_phone,
    null::text as contact_whatsapp,
    null::text as contact_email,
    null::text as how_to_participate,
    null::text as meeting_info,
    null::text as location_text,
    nullif(btrim(item ->> 'address'), '') as address_text,
    nullif(btrim(item ->> 'massTimes'), '') as mass_times,
    coalesce(nullif(btrim(item ->> 'name'), ''), 'Comunidade sem nome') as agenda_query,
    null::text as cover_image_url,
    coalesce(item -> 'images', '[]'::jsonb) as gallery,
    true as is_public,
    false as is_featured,
    0 as sort_order,
    jsonb_build_object(
      'source', 'site_data.communities',
      'legacy_item', item
    ) as metadata
  from public.site_data sd
  cross join lateral jsonb_array_elements(coalesce(sd.data -> 'communities', '[]'::jsonb)) as community_items(item)
  where sd.id = 1
),
source_group_content as (
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
    nullif(btrim(item ->> 'description'), '') as description,
    nullif(btrim(item ->> 'objective'), '') as objective,
    nullif(btrim(item ->> 'audience'), '') as audience,
    coalesce(
      nullif(btrim(item ->> 'responsible'), ''),
      nullif(btrim(item ->> 'contactName'), '')
    ) as responsible,
    coalesce(
      nullif(btrim(item ->> 'contactName'), ''),
      nullif(btrim(item ->> 'responsible'), '')
    ) as contact_name,
    nullif(btrim(item ->> 'contactPhone'), '') as contact_phone,
    nullif(btrim(item ->> 'contactWhatsapp'), '') as contact_whatsapp,
    nullif(btrim(item ->> 'contactEmail'), '') as contact_email,
    nullif(btrim(item ->> 'howToParticipate'), '') as how_to_participate,
    nullif(btrim(item ->> 'meeting'), '') as meeting_info,
    nullif(btrim(item ->> 'location'), '') as location_text,
    null::text as address_text,
    null::text as mass_times,
    coalesce(
      nullif(btrim(item ->> 'agendaQuery'), ''),
      nullif(btrim(item ->> 'name'), ''),
      'Grupo'
    ) as agenda_query,
    nullif(btrim(item ->> 'image'), '') as cover_image_url,
    '[]'::jsonb as gallery,
    case
      when lower(coalesce(item ->> 'active', 'true')) in ('false', 'off', '0') then false
      else true
    end as is_public,
    case
      when lower(coalesce(item ->> 'featured', 'false')) in ('true', 'on', '1') then true
      else false
    end as is_featured,
    case
      when coalesce(item ->> 'sortOrder', '') ~ '^-?[0-9]+$' then greatest((item ->> 'sortOrder')::integer, 0)
      else 0
    end as sort_order,
    jsonb_build_object(
      'source', category.source_key,
      'legacy_item', item
    ) as metadata
  from public.site_data sd
  cross join lateral (
    values
      ('pastoral'::text, 'site_data.pastorals.pastorais'::text, sd.data -> 'pastorals' -> 'pastorais'),
      ('movement'::text, 'site_data.pastorals.movimentos'::text, sd.data -> 'pastorals' -> 'movimentos'),
      ('service'::text, 'site_data.pastorals.servicos'::text, sd.data -> 'pastorals' -> 'servicos')
  ) as category(unit_type, source_key, payload)
  cross join lateral jsonb_array_elements(coalesce(category.payload, '[]'::jsonb)) as category_items(item)
  where sd.id = 1
),
source_items as (
  select * from source_communities
  union all
  select * from source_group_content
),
matched_items as (
  select
    matched_org_unit.id as org_unit_id,
    source_items.*
  from source_items
  cross join lateral (
    select ou.id
    from public.org_units ou
    where ou.type = source_items.unit_type
      and (
        ou.legacy_key = source_items.legacy_key
        or lower(ou.name) = lower(source_items.unit_name)
      )
    order by case when ou.legacy_key = source_items.legacy_key then 0 else 1 end
    limit 1
  ) as matched_org_unit
)
insert into public.org_unit_site_content (
  org_unit_id,
  summary,
  description,
  objective,
  audience,
  responsible,
  contact_name,
  contact_phone,
  contact_whatsapp,
  contact_email,
  how_to_participate,
  meeting_info,
  location_text,
  address_text,
  mass_times,
  agenda_query,
  cover_image_url,
  gallery,
  is_public,
  is_featured,
  sort_order,
  metadata
)
select
  org_unit_id,
  summary,
  description,
  objective,
  audience,
  responsible,
  contact_name,
  contact_phone,
  contact_whatsapp,
  contact_email,
  how_to_participate,
  meeting_info,
  location_text,
  address_text,
  mass_times,
  agenda_query,
  cover_image_url,
  gallery,
  is_public,
  is_featured,
  sort_order,
  metadata
from matched_items
on conflict (org_unit_id) do update
set
  summary = coalesce(public.org_unit_site_content.summary, excluded.summary),
  description = coalesce(public.org_unit_site_content.description, excluded.description),
  objective = coalesce(public.org_unit_site_content.objective, excluded.objective),
  audience = coalesce(public.org_unit_site_content.audience, excluded.audience),
  responsible = coalesce(public.org_unit_site_content.responsible, excluded.responsible),
  contact_name = coalesce(public.org_unit_site_content.contact_name, excluded.contact_name),
  contact_phone = coalesce(public.org_unit_site_content.contact_phone, excluded.contact_phone),
  contact_whatsapp = coalesce(public.org_unit_site_content.contact_whatsapp, excluded.contact_whatsapp),
  contact_email = coalesce(public.org_unit_site_content.contact_email, excluded.contact_email),
  how_to_participate = coalesce(public.org_unit_site_content.how_to_participate, excluded.how_to_participate),
  meeting_info = coalesce(public.org_unit_site_content.meeting_info, excluded.meeting_info),
  location_text = coalesce(public.org_unit_site_content.location_text, excluded.location_text),
  address_text = coalesce(public.org_unit_site_content.address_text, excluded.address_text),
  mass_times = coalesce(public.org_unit_site_content.mass_times, excluded.mass_times),
  agenda_query = coalesce(public.org_unit_site_content.agenda_query, excluded.agenda_query),
  cover_image_url = coalesce(public.org_unit_site_content.cover_image_url, excluded.cover_image_url),
  gallery = case
    when jsonb_array_length(public.org_unit_site_content.gallery) > 0 then public.org_unit_site_content.gallery
    else excluded.gallery
  end,
  metadata = public.org_unit_site_content.metadata || excluded.metadata,
  updated_at = now();

-- Diagnostico 1: itens do site_data sem correspondencia em org_units
with source_communities as (
  select
    'community'::text as unit_type,
    coalesce(
      nullif(btrim(item ->> 'id'), ''),
      public.operacoes_slugify(item ->> 'name')
    ) as legacy_key,
    coalesce(nullif(btrim(item ->> 'name'), ''), 'Comunidade sem nome') as unit_name
  from public.site_data sd
  cross join lateral jsonb_array_elements(coalesce(sd.data -> 'communities', '[]'::jsonb)) as community_items(item)
  where sd.id = 1
),
source_group_content as (
  select
    category.unit_type,
    coalesce(
      nullif(btrim(item ->> 'id'), ''),
      nullif(btrim(item ->> 'slug'), ''),
      public.operacoes_slugify(item ->> 'name')
    ) as legacy_key,
    coalesce(nullif(btrim(item ->> 'name'), ''), 'Item sem nome') as unit_name
  from public.site_data sd
  cross join lateral (
    values
      ('pastoral'::text, sd.data -> 'pastorals' -> 'pastorais'),
      ('movement'::text, sd.data -> 'pastorals' -> 'movimentos'),
      ('service'::text, sd.data -> 'pastorals' -> 'servicos')
  ) as category(unit_type, payload)
  cross join lateral jsonb_array_elements(coalesce(category.payload, '[]'::jsonb)) as category_items(item)
  where sd.id = 1
),
source_items as (
  select * from source_communities
  union all
  select * from source_group_content
)
select
  source_items.unit_type,
  source_items.unit_name,
  source_items.legacy_key
from source_items
left join public.org_units ou
  on ou.type = source_items.unit_type
 and (
   ou.legacy_key = source_items.legacy_key
   or lower(ou.name) = lower(source_items.unit_name)
 )
where ou.id is null
order by source_items.unit_type, source_items.unit_name;

-- Diagnostico 2: org_units elegiveis ainda sem conteudo associado
select
  ou.type,
  ou.name,
  ou.legacy_key,
  ou.slug
from public.org_units ou
left join public.org_unit_site_content ousc on ousc.org_unit_id = ou.id
where ou.type in ('community', 'pastoral', 'movement', 'service')
  and ou.is_active = true
  and ousc.id is null
order by ou.type, ou.name;
