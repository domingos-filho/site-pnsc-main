-- Site content por unidade organizacional v1
-- Objetivo:
-- - mover communities, pastorals, movements e services para uma fonte relacional
-- - manter org_units como identidade estrutural
-- - permitir edicao segmentada por vinculo em profile_org_units
--
-- Pre-requisitos:
-- - public.profiles
-- - public.org_units
-- - public.profile_org_units
-- - public.site_data

create table if not exists public.org_unit_site_content (
  id uuid primary key default gen_random_uuid(),
  org_unit_id uuid not null unique references public.org_units(id) on delete cascade,
  summary text,
  description text,
  objective text,
  audience text,
  responsible text,
  contact_name text,
  contact_phone text,
  contact_whatsapp text,
  contact_email text,
  how_to_participate text,
  meeting_info text,
  location_text text,
  address_text text,
  mass_times text,
  agenda_query text,
  cover_image_url text,
  gallery jsonb not null default '[]'::jsonb,
  is_public boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_unit_site_content_public_idx
  on public.org_unit_site_content (is_public, is_featured, sort_order);

create index if not exists org_unit_site_content_sort_idx
  on public.org_unit_site_content (sort_order);

alter table public.org_unit_site_content
  drop constraint if exists org_unit_site_content_gallery_check;

alter table public.org_unit_site_content
  add constraint org_unit_site_content_gallery_check
  check (jsonb_typeof(gallery) = 'array');

create or replace function public.org_unit_site_content_is_full_manager()
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
      and role in ('admin', 'articulator')
  );
$$;

create or replace function public.org_unit_site_content_is_linked_coordinator(target_org_unit_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    join public.profile_org_units pou on pou.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'member'
      and pou.org_unit_id = target_org_unit_id
  );
$$;

create or replace function public.prepare_org_unit_site_content()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  linked_name text;
begin
  if tg_op = 'UPDATE' and new.org_unit_id is distinct from old.org_unit_id then
    raise exception 'org_unit_site_content.org_unit_id nao pode ser alterado';
  end if;

  if tg_op = 'UPDATE'
    and not public.org_unit_site_content_is_full_manager()
    and public.org_unit_site_content_is_linked_coordinator(old.org_unit_id)
  then
    if new.is_public is distinct from old.is_public
      or new.is_featured is distinct from old.is_featured
      or new.sort_order is distinct from old.sort_order
      or new.metadata is distinct from old.metadata
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Coordenador nao pode alterar visibilidade, destaque, ordenacao ou metadados.';
    end if;
  end if;

  new.summary := nullif(btrim(coalesce(new.summary, '')), '');
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.objective := nullif(btrim(coalesce(new.objective, '')), '');
  new.audience := nullif(btrim(coalesce(new.audience, '')), '');
  new.responsible := nullif(btrim(coalesce(new.responsible, '')), '');
  new.contact_name := nullif(btrim(coalesce(new.contact_name, '')), '');
  new.contact_phone := nullif(btrim(coalesce(new.contact_phone, '')), '');
  new.contact_whatsapp := nullif(btrim(coalesce(new.contact_whatsapp, '')), '');
  new.contact_email := nullif(btrim(coalesce(new.contact_email, '')), '');
  new.how_to_participate := nullif(btrim(coalesce(new.how_to_participate, '')), '');
  new.meeting_info := nullif(btrim(coalesce(new.meeting_info, '')), '');
  new.location_text := nullif(btrim(coalesce(new.location_text, '')), '');
  new.address_text := nullif(btrim(coalesce(new.address_text, '')), '');
  new.mass_times := nullif(btrim(coalesce(new.mass_times, '')), '');
  new.agenda_query := nullif(btrim(coalesce(new.agenda_query, '')), '');
  new.cover_image_url := nullif(btrim(coalesce(new.cover_image_url, '')), '');
  new.gallery := case
    when new.gallery is null or jsonb_typeof(new.gallery) <> 'array' then '[]'::jsonb
    else new.gallery
  end;
  new.is_public := coalesce(new.is_public, true);
  new.is_featured := coalesce(new.is_featured, false);
  new.sort_order := greatest(coalesce(new.sort_order, 0), 0);
  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  if new.agenda_query is null then
    select name
    into linked_name
    from public.org_units
    where id = new.org_unit_id;

    new.agenda_query := nullif(btrim(coalesce(linked_name, '')), '');
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := coalesce(new.updated_by, auth.uid(), new.created_by);
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
    new.created_by := coalesce(new.created_by, old.created_by);
    new.created_at := old.created_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists org_unit_site_content_prepare on public.org_unit_site_content;
create trigger org_unit_site_content_prepare
before insert or update on public.org_unit_site_content
for each row execute function public.prepare_org_unit_site_content();

alter table public.org_unit_site_content enable row level security;

drop policy if exists "Public read published unit site content" on public.org_unit_site_content;
drop policy if exists "Full managers read unit site content" on public.org_unit_site_content;
drop policy if exists "Coordinators read linked unit site content" on public.org_unit_site_content;
drop policy if exists "Full managers insert unit site content" on public.org_unit_site_content;
drop policy if exists "Full managers update unit site content" on public.org_unit_site_content;
drop policy if exists "Coordinators update linked unit site content" on public.org_unit_site_content;
drop policy if exists "Full managers delete unit site content" on public.org_unit_site_content;

create policy "Public read published unit site content"
  on public.org_unit_site_content for select
  using (
    is_public = true
    and exists (
      select 1
      from public.org_units ou
      where ou.id = org_unit_id
        and ou.is_active = true
    )
  );

create policy "Full managers read unit site content"
  on public.org_unit_site_content for select
  using (public.org_unit_site_content_is_full_manager());

create policy "Coordinators read linked unit site content"
  on public.org_unit_site_content for select
  using (public.org_unit_site_content_is_linked_coordinator(org_unit_id));

create policy "Full managers insert unit site content"
  on public.org_unit_site_content for insert
  with check (public.org_unit_site_content_is_full_manager());

create policy "Full managers update unit site content"
  on public.org_unit_site_content for update
  using (public.org_unit_site_content_is_full_manager())
  with check (public.org_unit_site_content_is_full_manager());

create policy "Coordinators update linked unit site content"
  on public.org_unit_site_content for update
  using (public.org_unit_site_content_is_linked_coordinator(org_unit_id))
  with check (public.org_unit_site_content_is_linked_coordinator(org_unit_id));

create policy "Full managers delete unit site content"
  on public.org_unit_site_content for delete
  using (public.org_unit_site_content_is_full_manager());
