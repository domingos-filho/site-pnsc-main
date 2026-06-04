create extension if not exists "pgcrypto";
create extension if not exists unaccent;

create table if not exists public.org_units (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  slug text not null,
  name text not null,
  summary text,
  is_active boolean not null default true,
  source text,
  legacy_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_org_units (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  org_unit_id uuid not null references public.org_units(id) on delete cascade,
  membership_role text,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, org_unit_id)
);

create table if not exists public.app_modules (
  key text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_module_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  can_read boolean not null default false,
  can_write boolean not null default false,
  can_approve boolean not null default false,
  can_admin boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, module_key)
);

create table if not exists public.org_unit_module_settings (
  id uuid primary key default gen_random_uuid(),
  org_unit_id uuid not null references public.org_units(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  is_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_unit_id, module_key)
);

create unique index if not exists org_units_slug_key
  on public.org_units (slug);

create unique index if not exists org_units_type_legacy_key_key
  on public.org_units (type, legacy_key);

create index if not exists org_units_type_idx
  on public.org_units (type);

create index if not exists org_units_active_idx
  on public.org_units (is_active);

create index if not exists profile_org_units_profile_idx
  on public.profile_org_units (profile_id);

create index if not exists profile_org_units_org_unit_idx
  on public.profile_org_units (org_unit_id);

create index if not exists profile_module_access_profile_idx
  on public.profile_module_access (profile_id);

create index if not exists profile_module_access_module_idx
  on public.profile_module_access (module_key);

create index if not exists org_unit_module_settings_org_unit_idx
  on public.org_unit_module_settings (org_unit_id);

create index if not exists org_unit_module_settings_module_idx
  on public.org_unit_module_settings (module_key);

alter table public.org_units drop constraint if exists org_units_type_check;
alter table public.org_units
  add constraint org_units_type_check
  check (type in ('community', 'pastoral', 'movement', 'service'));

create or replace function public.operacoes_is_admin()
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
      and role = 'admin'
  );
$$;

create or replace function public.operacoes_is_manager()
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

create or replace function public.operacoes_slugify(input text)
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

create or replace function public.set_operacoes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prepare_org_unit()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(coalesce(new.name, ''));
  new.summary := nullif(btrim(coalesce(new.summary, '')), '');
  new.source := nullif(btrim(coalesce(new.source, '')), '');
  new.legacy_key := nullif(btrim(coalesce(new.legacy_key, '')), '');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.slug := nullif(public.operacoes_slugify(coalesce(new.slug, new.name)), '');

  if new.slug is null then
    raise exception 'org_units.slug nao pode ficar vazio';
  end if;

  return new;
end;
$$;

drop trigger if exists org_units_prepare on public.org_units;
create trigger org_units_prepare
before insert or update on public.org_units
for each row execute function public.prepare_org_unit();

drop trigger if exists org_units_updated_at on public.org_units;
create trigger org_units_updated_at
before update on public.org_units
for each row execute function public.set_operacoes_updated_at();

drop trigger if exists profile_org_units_updated_at on public.profile_org_units;
create trigger profile_org_units_updated_at
before update on public.profile_org_units
for each row execute function public.set_operacoes_updated_at();

drop trigger if exists app_modules_updated_at on public.app_modules;
create trigger app_modules_updated_at
before update on public.app_modules
for each row execute function public.set_operacoes_updated_at();

drop trigger if exists profile_module_access_updated_at on public.profile_module_access;
create trigger profile_module_access_updated_at
before update on public.profile_module_access
for each row execute function public.set_operacoes_updated_at();

drop trigger if exists org_unit_module_settings_updated_at on public.org_unit_module_settings;
create trigger org_unit_module_settings_updated_at
before update on public.org_unit_module_settings
for each row execute function public.set_operacoes_updated_at();

alter table public.org_units enable row level security;
alter table public.profile_org_units enable row level security;
alter table public.app_modules enable row level security;
alter table public.profile_module_access enable row level security;
alter table public.org_unit_module_settings enable row level security;

drop policy if exists "Public read org units" on public.org_units;
drop policy if exists "Admins manage org units" on public.org_units;
drop policy if exists "Users read own org links" on public.profile_org_units;
drop policy if exists "Admins manage org links" on public.profile_org_units;
drop policy if exists "Authenticated read app modules" on public.app_modules;
drop policy if exists "Admins manage app modules" on public.app_modules;
drop policy if exists "Users read own module access" on public.profile_module_access;
drop policy if exists "Admins manage module access" on public.profile_module_access;
drop policy if exists "Managers read org unit module settings" on public.org_unit_module_settings;
drop policy if exists "Admins manage org unit module settings" on public.org_unit_module_settings;

create policy "Public read org units"
  on public.org_units for select
  using (is_active = true);

create policy "Admins manage org units"
  on public.org_units for all
  using (public.operacoes_is_admin())
  with check (public.operacoes_is_admin());

create policy "Users read own org links"
  on public.profile_org_units for select
  using (profile_id = auth.uid() or public.operacoes_is_admin());

create policy "Admins manage org links"
  on public.profile_org_units for all
  using (public.operacoes_is_admin())
  with check (public.operacoes_is_admin());

create policy "Authenticated read app modules"
  on public.app_modules for select
  to authenticated
  using (is_active = true);

create policy "Admins manage app modules"
  on public.app_modules for all
  using (public.operacoes_is_admin())
  with check (public.operacoes_is_admin());

create policy "Users read own module access"
  on public.profile_module_access for select
  using (profile_id = auth.uid() or public.operacoes_is_admin());

create policy "Admins manage module access"
  on public.profile_module_access for all
  using (public.operacoes_is_admin())
  with check (public.operacoes_is_admin());

create policy "Managers read org unit module settings"
  on public.org_unit_module_settings for select
  using (public.operacoes_is_manager());

create policy "Admins manage org unit module settings"
  on public.org_unit_module_settings for all
  using (public.operacoes_is_admin())
  with check (public.operacoes_is_admin());

insert into public.app_modules (
  key,
  name,
  description,
  is_active,
  metadata
)
values
  ('market', 'Mini mercado', 'Controle de produtos, vendas, estoque, caixa e orçamento.', true, jsonb_build_object('source', 'operacoes_v1_foundation_schema')),
  ('inventory', 'Inventário', 'Catálogo de itens por unidade, com quantidade manual e foto principal.', true, jsonb_build_object('source', 'operacoes_v1_foundation_schema')),
  ('table_sales', 'Mesas', 'Venda e reserva de mesas por evento com layout simples.', true, jsonb_build_object('source', 'operacoes_v1_foundation_schema'))
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  metadata = public.app_modules.metadata || excluded.metadata,
  updated_at = now();
