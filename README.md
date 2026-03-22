# site-pnsc

Projeto Vite + React pronto para build com Docker e deploy via EasyPanel.

## Requisitos
- Node.js (veja `.nvmrc`)
- Docker + Docker Compose
- Git

## Rodar local (dev)
```bash
npm install
npm run dev
```

## Build com Docker (producao)
```bash
docker compose up --build
```
Abra `http://localhost:5000`.

## Variaveis de ambiente
- `APP_PORT`: porta local do host (padrao `5000`)
- `VITE_SUPABASE_URL`: URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY`: chave anon do Supabase
- `VITE_SUPABASE_BUCKET`: bucket do Storage (padrao `pnsc-media`)
- `VITE_GOOGLE_MAPS_API_KEY`: (opcional) chave da API do Google Static Maps

## Supabase Storage
1. Crie um projeto no Supabase.
2. Crie um bucket publico (ex: `pnsc-media`).
3. Copie as variaveis do `.env.example` para o `.env` e preencha os valores.
4. Se o upload retornar erro de RLS, aplique as politicas abaixo no SQL Editor:
```sql
-- deixa o bucket publico para leitura via getPublicUrl
update storage.buckets set public = true where id = 'pnsc-media';

-- leitura publica dos arquivos
create policy "Public read pnsc-media"
  on storage.objects for select
  using (bucket_id = 'pnsc-media');

-- permitir upload apenas para usuarios autenticados no dashboard
create policy "Authenticated insert pnsc-media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pnsc-media');

-- permitir remocao apenas para usuarios autenticados no dashboard
create policy "Authenticated delete pnsc-media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pnsc-media');
```
5. Se quiser restringir ainda mais por papel, use politicas com `public.is_admin()` / `public.is_manager()` depois de criar as funcoes do bloco abaixo.

## Supabase Banco de Dados (eventos/infos)
1. No Supabase, abra o SQL Editor e execute:
```sql
create extension if not exists "pgcrypto";

create table if not exists public.site_data (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  time text,
  location text,
  description text,
  community text,
  category text,
  recurrence text,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text,
  role text check (role in ('admin', 'secretary', 'member')) default 'member',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.site_data enable row level security;
alter table public.events enable row level security;
alter table public.profiles enable row level security;

-- helper functions (avoid RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'secretary')
  );
$$;

-- clean old policies (safe to re-run)
drop policy if exists "Public read site_data" on public.site_data;
drop policy if exists "Admins insert site_data" on public.site_data;
drop policy if exists "Admins update site_data" on public.site_data;
drop policy if exists "Admins delete site_data" on public.site_data;
drop policy if exists "Public read events" on public.events;
drop policy if exists "Managers insert events" on public.events;
drop policy if exists "Managers update events" on public.events;
drop policy if exists "Managers delete events" on public.events;
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Admins read profiles" on public.profiles;
drop policy if exists "Admins update profiles" on public.profiles;
drop policy if exists "Admins insert profiles" on public.profiles;

create policy "Public read site_data"
  on public.site_data for select
  using (true);

create policy "Admins insert site_data"
  on public.site_data for insert
  with check (public.is_admin());

create policy "Admins update site_data"
  on public.site_data for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete site_data"
  on public.site_data for delete
  using (public.is_admin());

create policy "Public read events"
  on public.events for select
  using (true);

create policy "Managers insert events"
  on public.events for insert
  with check (public.is_manager());

create policy "Managers update events"
  on public.events for update
  using (public.is_manager());

create policy "Managers delete events"
  on public.events for delete
  using (public.is_manager());

create policy "Profiles read"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "Profiles insert"
  on public.profiles for insert
  with check (auth.uid() = id or public.is_admin());

create policy "Profiles update"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());
```

Observacao: o login so funciona se o usuario tiver registro na tabela public.profiles. Crie o usuario no Auth junto com a linha correspondente em `public.profiles`, ou use um trigger de provisionamento.

2. Se preferir restringir ainda mais, ajuste as politicas conforme sua regra de negocio.

Sem Supabase configurado, o site continua usando armazenamento local do navegador para o `site_data` e fallback local para eventos pendentes.
Se voce vinha da versao antiga da galeria, os dados legados em `paroquia_gallery_*` sao migrados para `site_data.gallery` ao abrir o site.

## Publicar no GitHub
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

## Deploy no EasyPanel (Docker Compose)
1. Crie um projeto do tipo Compose.
2. Em Fonte > Git, informe a URL do repositorio e o ramo (ex: `main`).
3. Caminho de build: `/`
4. Arquivo docker compose: `docker-compose.yml`
5. Em Variaveis de ambiente, defina `APP_PORT=5000` e as `VITE_*` do Supabase (e opcional `VITE_GOOGLE_MAPS_API_KEY`).
6. Em Dominios, adicione `www.pnsc.domingos-automacoes.shop` e ative SSL.
7. Salve e clique em Implantar.

## Notas
- O container expoe a porta 80 internamente (Nginx).
