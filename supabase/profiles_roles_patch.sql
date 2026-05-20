-- Patch de papéis de acesso
-- Ajusta a constraint de public.profiles.role para os novos perfis operacionais.
-- Mantém "member" como chave interna e exibe "Coordenador" apenas no frontend.

update public.profiles
set role = 'member'
where role = 'coordinator';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'secretary', 'treasurer', 'articulator', 'member'));

create or replace function public.calendar_is_member()
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
      and role in ('member', 'secretary', 'treasurer', 'articulator', 'admin')
  );
$$;
