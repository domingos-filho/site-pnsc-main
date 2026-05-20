-- Patch de acesso ao site_data
-- Objetivo:
-- - admin e articulator podem editar todo o JSON do site
-- - secretary e treasurer podem editar apenas team, contact e about
-- - leitura publica continua liberada

create or replace function public.site_data_is_full_manager()
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

create or replace function public.site_data_is_limited_manager()
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
      and role in ('admin', 'articulator', 'secretary', 'treasurer')
  );
$$;

create or replace function public.site_data_update_allowed(target_id bigint, next_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_data jsonb;
  is_secretary_or_treasurer boolean;
begin
  if target_id <> 1 then
    return false;
  end if;

  if public.site_data_is_full_manager() then
    return true;
  end if;

  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('secretary', 'treasurer')
  )
  into is_secretary_or_treasurer;

  if not is_secretary_or_treasurer then
    return false;
  end if;

  select data
  into current_data
  from public.site_data
  where id = target_id;

  if current_data is null then
    return false;
  end if;

  return (current_data - 'team' - 'contact' - 'about')
    = (coalesce(next_data, '{}'::jsonb) - 'team' - 'contact' - 'about');
end;
$$;

alter table public.site_data enable row level security;

drop policy if exists "Public read site data" on public.site_data;
drop policy if exists "Managers update site data" on public.site_data;
drop policy if exists "Managers insert site data" on public.site_data;
drop policy if exists "Full managers delete site data" on public.site_data;

create policy "Public read site data"
  on public.site_data for select
  using (true);

create policy "Managers insert site data"
  on public.site_data for insert
  with check (
    public.site_data_is_limited_manager()
    and public.site_data_update_allowed(id, data)
  );

create policy "Managers update site data"
  on public.site_data for update
  using (
    public.site_data_is_limited_manager()
    and id = 1
  )
  with check (
    public.site_data_is_limited_manager()
    and public.site_data_update_allowed(id, data)
  );

create policy "Full managers delete site data"
  on public.site_data for delete
  using (
    public.site_data_is_full_manager()
    and id = 1
  );
