-- Gallery v2 schema
-- Prerequisite: the base README database schema must already exist
-- (public.profiles, public.events, helper auth setup, storage bucket).

create extension if not exists "pgcrypto";
create extension if not exists unaccent;

create table if not exists public.gallery_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  summary text,
  description text,
  event_date date,
  end_date date,
  display_year smallint,
  search_year smallint generated always as (
    coalesce(
      display_year,
      case
        when event_date is not null then extract(year from event_date)::smallint
        else null
      end
    )
  ) stored,
  community text,
  category text,
  tags text[] not null default '{}'::text[],
  linked_event_id uuid references public.events(id) on delete set null,
  cover_media_id uuid,
  photo_count integer not null default 0,
  legacy_album_id text,
  is_published boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_tokens tsvector not null default ''::tsvector
);

create table if not exists public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.gallery_collections(id) on delete cascade,
  path text,
  thumb_path text,
  medium_path text,
  src_url text,
  thumb_url text,
  alt_text text,
  caption text,
  sort_order integer not null default 0,
  taken_at timestamptz,
  width integer,
  height integer,
  file_size bigint,
  is_featured boolean not null default false,
  legacy_image_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gallery_collections_slug_key
  on public.gallery_collections (slug);

create unique index if not exists gallery_collections_legacy_album_id_key
  on public.gallery_collections (legacy_album_id);

create unique index if not exists gallery_media_collection_legacy_image_id_key
  on public.gallery_media (collection_id, legacy_image_id);

create unique index if not exists gallery_media_one_featured_per_collection_key
  on public.gallery_media (collection_id)
  where is_featured;

create index if not exists gallery_collections_published_year_date_idx
  on public.gallery_collections (is_published, search_year desc, event_date desc nulls last);

create index if not exists gallery_collections_community_idx
  on public.gallery_collections (community);

create index if not exists gallery_collections_category_idx
  on public.gallery_collections (category);

create index if not exists gallery_collections_linked_event_idx
  on public.gallery_collections (linked_event_id);

create index if not exists gallery_collections_tags_gin_idx
  on public.gallery_collections using gin (tags);

create index if not exists gallery_collections_search_tokens_idx
  on public.gallery_collections using gin (search_tokens);

create index if not exists gallery_media_collection_sort_idx
  on public.gallery_media (collection_id, sort_order, created_at);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gallery_collections_cover_media_fkey'
  ) then
    alter table public.gallery_collections
      add constraint gallery_collections_cover_media_fkey
      foreign key (cover_media_id)
      references public.gallery_media(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gallery_collections_title_check'
  ) then
    alter table public.gallery_collections
      add constraint gallery_collections_title_check
      check (char_length(btrim(title)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gallery_collections_date_check'
  ) then
    alter table public.gallery_collections
      add constraint gallery_collections_date_check
      check (end_date is null or event_date is null or end_date >= event_date);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gallery_collections_display_year_check'
  ) then
    alter table public.gallery_collections
      add constraint gallery_collections_display_year_check
      check (display_year is null or display_year between 1900 and 2100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gallery_media_source_check'
  ) then
    alter table public.gallery_media
      add constraint gallery_media_source_check
      check (path is not null or src_url is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gallery_media_dimensions_check'
  ) then
    alter table public.gallery_media
      add constraint gallery_media_dimensions_check
      check (
        (width is null and height is null)
        or (width is not null and height is not null and width > 0 and height > 0)
      );
  end if;
end $$;

create or replace function public.gallery_is_manager()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'secretary')
  );
$$;

create or replace function public.gallery_slugify(input text)
returns text
language sql
immutable
as $$
  select trim(
    both '-'
    from regexp_replace(
      lower(unaccent(coalesce(input, ''))),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
$$;

create or replace function public.ensure_unique_gallery_collection_slug(base_slug text, current_id uuid default null)
returns text
language plpgsql
as $$
declare
  normalized_base text;
  candidate text;
  suffix integer := 0;
begin
  normalized_base := nullif(public.gallery_slugify(base_slug), '');
  if normalized_base is null then
    normalized_base := 'evento-galeria';
  end if;

  candidate := normalized_base;

  loop
    exit when not exists (
      select 1
      from public.gallery_collections
      where slug = candidate
        and (current_id is null or id <> current_id)
    );

    suffix := suffix + 1;
    candidate := normalized_base || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

create or replace function public.prepare_gallery_collection()
returns trigger
language plpgsql
as $$
declare
  normalized_tags text[];
  slug_seed text;
  seed_year text;
begin
  new.title := btrim(coalesce(new.title, ''));
  new.summary := nullif(btrim(coalesce(new.summary, '')), '');
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.community := nullif(btrim(coalesce(new.community, '')), '');
  new.category := nullif(btrim(coalesce(new.category, '')), '');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  select coalesce(array_agg(distinct cleaned_tag order by cleaned_tag), '{}'::text[])
  into normalized_tags
  from (
    select nullif(lower(btrim(tag)), '') as cleaned_tag
    from unnest(coalesce(new.tags, '{}'::text[])) as tag
  ) normalized
  where cleaned_tag is not null;

  new.tags := normalized_tags;

  seed_year := coalesce(
    new.display_year::text,
    case
      when new.event_date is not null then extract(year from new.event_date)::int::text
      else null
    end
  );

  slug_seed := coalesce(
    nullif(btrim(coalesce(new.slug, '')), ''),
    concat_ws('-', new.title, seed_year, new.community)
  );

  new.slug := public.ensure_unique_gallery_collection_slug(slug_seed, new.id);

  new.search_tokens :=
    setweight(to_tsvector('simple', unaccent(coalesce(new.title, ''))), 'A')
    || setweight(to_tsvector('simple', unaccent(coalesce(new.summary, ''))), 'B')
    || setweight(to_tsvector('simple', unaccent(coalesce(new.description, ''))), 'C')
    || setweight(to_tsvector('simple', unaccent(coalesce(new.community, ''))), 'B')
    || setweight(to_tsvector('simple', unaccent(coalesce(new.category, ''))), 'B')
    || setweight(to_tsvector('simple', unaccent(array_to_string(coalesce(new.tags, '{}'::text[]), ' '))), 'B');

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prepare_gallery_media()
returns trigger
language plpgsql
as $$
begin
  new.path := nullif(btrim(coalesce(new.path, '')), '');
  new.thumb_path := nullif(btrim(coalesce(new.thumb_path, '')), '');
  new.medium_path := nullif(btrim(coalesce(new.medium_path, '')), '');
  new.src_url := nullif(btrim(coalesce(new.src_url, '')), '');
  new.thumb_url := nullif(btrim(coalesce(new.thumb_url, '')), '');
  new.alt_text := nullif(btrim(coalesce(new.alt_text, '')), '');
  new.caption := nullif(btrim(coalesce(new.caption, '')), '');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.refresh_gallery_collection_stats(target_collection_id uuid)
returns void
language plpgsql
as $$
declare
  next_cover_media_id uuid;
  media_count integer;
begin
  if target_collection_id is null then
    return;
  end if;

  select count(*)::int
  into media_count
  from public.gallery_media
  where collection_id = target_collection_id;

  select id
  into next_cover_media_id
  from public.gallery_media
  where collection_id = target_collection_id
  order by is_featured desc, sort_order asc, created_at asc
  limit 1;

  update public.gallery_collections
  set photo_count = media_count,
      cover_media_id = case
        when cover_media_id is null then next_cover_media_id
        when exists (
          select 1
          from public.gallery_media
          where id = public.gallery_collections.cover_media_id
            and collection_id = target_collection_id
        ) then cover_media_id
        else next_cover_media_id
      end,
      updated_at = now()
  where id = target_collection_id;
end;
$$;

create or replace function public.sync_gallery_collection_stats()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_gallery_collection_stats(old.collection_id);
    return old;
  end if;

  perform public.refresh_gallery_collection_stats(new.collection_id);

  if tg_op = 'UPDATE' and old.collection_id is distinct from new.collection_id then
    perform public.refresh_gallery_collection_stats(old.collection_id);
  end if;

  return new;
end;
$$;

create or replace function public.gallery_can_read_collection(target_collection_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.gallery_collections
    where id = target_collection_id
      and (is_published = true or public.gallery_is_manager())
  );
$$;

drop trigger if exists trg_prepare_gallery_collection on public.gallery_collections;
create trigger trg_prepare_gallery_collection
before insert or update on public.gallery_collections
for each row
execute function public.prepare_gallery_collection();

drop trigger if exists trg_prepare_gallery_media on public.gallery_media;
create trigger trg_prepare_gallery_media
before insert or update on public.gallery_media
for each row
execute function public.prepare_gallery_media();

drop trigger if exists trg_sync_gallery_collection_stats on public.gallery_media;
create trigger trg_sync_gallery_collection_stats
after insert or update or delete on public.gallery_media
for each row
execute function public.sync_gallery_collection_stats();

alter table public.gallery_collections enable row level security;
alter table public.gallery_media enable row level security;

grant select on public.gallery_collections to anon, authenticated;
grant select on public.gallery_media to anon, authenticated;
grant insert, update, delete on public.gallery_collections to authenticated;
grant insert, update, delete on public.gallery_media to authenticated;

drop policy if exists "Public read gallery collections" on public.gallery_collections;
drop policy if exists "Managers insert gallery collections" on public.gallery_collections;
drop policy if exists "Managers update gallery collections" on public.gallery_collections;
drop policy if exists "Managers delete gallery collections" on public.gallery_collections;

drop policy if exists "Public read gallery media" on public.gallery_media;
drop policy if exists "Managers insert gallery media" on public.gallery_media;
drop policy if exists "Managers update gallery media" on public.gallery_media;
drop policy if exists "Managers delete gallery media" on public.gallery_media;

create policy "Public read gallery collections"
  on public.gallery_collections
  for select
  using (is_published = true or public.gallery_is_manager());

create policy "Managers insert gallery collections"
  on public.gallery_collections
  for insert
  to authenticated
  with check (public.gallery_is_manager());

create policy "Managers update gallery collections"
  on public.gallery_collections
  for update
  to authenticated
  using (public.gallery_is_manager())
  with check (public.gallery_is_manager());

create policy "Managers delete gallery collections"
  on public.gallery_collections
  for delete
  to authenticated
  using (public.gallery_is_manager());

create policy "Public read gallery media"
  on public.gallery_media
  for select
  using (public.gallery_can_read_collection(collection_id));

create policy "Managers insert gallery media"
  on public.gallery_media
  for insert
  to authenticated
  with check (public.gallery_is_manager());

create policy "Managers update gallery media"
  on public.gallery_media
  for update
  to authenticated
  using (public.gallery_is_manager())
  with check (public.gallery_is_manager());

create policy "Managers delete gallery media"
  on public.gallery_media
  for delete
  to authenticated
  using (public.gallery_is_manager());
