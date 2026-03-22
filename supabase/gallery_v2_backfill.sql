-- Backfill current site_data.gallery JSON into gallery v2 tables.
-- Prerequisite:
-- 1. public.site_data already exists and contains the current gallery JSON.
-- 2. public.gallery_collections and public.gallery_media were created by gallery_v2_schema.sql.
--
-- This script is intentionally additive:
-- - it does not delete site_data.gallery
-- - it upserts collections by legacy_album_id
-- - it upserts media by (collection_id, legacy_image_id)

with source_albums as (
  select
    coalesce(nullif(album ->> 'id', ''), format('legacy-album-%s', album_position)) as legacy_album_id,
    coalesce(
      nullif(btrim(album ->> 'title'), ''),
      nullif(btrim(album ->> 'name'), ''),
      format('Album %s', album_position)
    ) as title,
    case
      when nullif(btrim(album ->> 'year'), '') ~ '^\d{4}$'
        then (album ->> 'year')::smallint
      else null
    end as display_year,
    nullif(btrim(album ->> 'community'), '') as community,
    album,
    album_position
  from public.site_data sd
  cross join lateral jsonb_array_elements(coalesce(sd.data -> 'gallery', '[]'::jsonb))
    with ordinality as gallery_album(album, album_position)
  where sd.id = 1
),
upsert_collections as (
  insert into public.gallery_collections (
    legacy_album_id,
    title,
    slug,
    community,
    display_year,
    is_published,
    metadata
  )
  select
    legacy_album_id,
    title,
    concat_ws('-', title, display_year::text, community),
    community,
    display_year,
    true,
    jsonb_build_object(
      'source', 'site_data.gallery',
      'legacy_album', album
    )
  from source_albums
  on conflict (legacy_album_id) do update
    set title = excluded.title,
        community = excluded.community,
        display_year = excluded.display_year,
        metadata = public.gallery_collections.metadata || excluded.metadata,
        updated_at = now()
  returning id, legacy_album_id
),
resolved_collections as (
  select
    gc.id as collection_id,
    sa.legacy_album_id,
    sa.title,
    sa.album
  from source_albums sa
  join public.gallery_collections gc
    on gc.legacy_album_id = sa.legacy_album_id
),
source_images as (
  select
    rc.collection_id,
    coalesce(
      nullif(image ->> 'id', ''),
      format('%s-image-%s', rc.legacy_album_id, image_position)
    ) as legacy_image_id,
    nullif(image ->> 'path', '') as path,
    nullif(image ->> 'thumbPath', '') as thumb_path,
    nullif(image ->> 'src', '') as src_url,
    nullif(image ->> 'url', '') as src_url_fallback,
    nullif(image ->> 'thumbSrc', '') as thumb_url,
    nullif(image ->> 'thumbUrl', '') as thumb_url_fallback,
    nullif(btrim(image ->> 'alt'), '') as alt_text,
    greatest(image_position - 1, 0) as sort_order,
    image
  from resolved_collections rc
  cross join lateral jsonb_array_elements(coalesce(rc.album -> 'images', '[]'::jsonb))
    with ordinality as gallery_image(image, image_position)
)
insert into public.gallery_media (
  collection_id,
  legacy_image_id,
  path,
  thumb_path,
  src_url,
  thumb_url,
  alt_text,
  sort_order,
  metadata
)
select
  collection_id,
  legacy_image_id,
  path,
  thumb_path,
  coalesce(src_url, src_url_fallback),
  coalesce(thumb_url, thumb_url_fallback),
  alt_text,
  sort_order,
  jsonb_build_object(
    'source', 'site_data.gallery',
    'legacy_image', image
  )
from source_images
where coalesce(path, src_url, src_url_fallback) is not null
on conflict (collection_id, legacy_image_id) do update
  set path = excluded.path,
      thumb_path = excluded.thumb_path,
      src_url = excluded.src_url,
      thumb_url = excluded.thumb_url,
      alt_text = excluded.alt_text,
      sort_order = excluded.sort_order,
      metadata = public.gallery_media.metadata || excluded.metadata,
      updated_at = now();

-- Optional verification queries after the insert:
-- select id, title, search_year, photo_count from public.gallery_collections order by search_year desc nulls last, created_at desc;
-- select collection_id, count(*) from public.gallery_media group by collection_id order by count(*) desc;
