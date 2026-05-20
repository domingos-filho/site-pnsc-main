# Site Content por Unidade Organizacional v1

## Objetivo
Permitir que o conteudo institucional do site deixe de depender de um JSON unico em `site_data` para os blocos de:

- comunidades
- pastorais
- movimentos
- servicos

O objetivo pratico e liberar operacao segmentada por vinculo institucional. Exemplo:

- `admin` e `articulator` podem gerenciar tudo
- `member` com papel exibido como `Coordenador` pode editar apenas as unidades a que esta vinculado
- o vinculo deve valer para comunidades, pastorais, movimentos e servicos

## Problema atual
Hoje os dados publicos desses grupos vivem em `site_data`, principalmente no objeto `pastorals` e no array `communities`.

Isso funciona para exibicao e edicao global, mas falha em tres pontos:

1. nao existe posse forte por item
2. a policy de banco enxerga apenas o JSON inteiro
3. um coordenador nao pode receber permissao fina sem depender de validacao so no frontend

Se a edicao continuar baseada em blob JSON, qualquer regra do tipo "editar apenas sua pastoral" fica fraca e mais dificil de manter.

## Direcao arquitetural
Normalizar o conteudo institucional em tabela relacional ligada a `org_units`.

`org_units` ja existe e hoje e a referencia correta para:

- `community`
- `pastoral`
- `movement`
- `service`

Entao a proposta e:

- manter `org_units` como identidade institucional
- mover os campos editaveis de exibicao publica para uma tabela propria
- usar `profile_org_units` para controlar posse e escopo de edicao

## Modelo de dados proposto

### 1. `public.org_unit_site_content`
Uma linha por unidade organizacional.

Campos propostos:

- `id uuid primary key default gen_random_uuid()`
- `org_unit_id uuid not null unique references public.org_units(id) on delete cascade`
- `summary text`
- `objective text`
- `audience text`
- `responsible text`
- `contact_name text`
- `contact_phone text`
- `contact_whatsapp text`
- `contact_email text`
- `how_to_participate text`
- `meeting text`
- `location text`
- `address text`
- `mass_times text`
- `agenda_query text`
- `image_url text`
- `is_public boolean not null default true`
- `is_featured boolean not null default false`
- `sort_order integer not null default 0`
- `metadata jsonb not null default '{}'::jsonb`
- `created_by uuid references public.profiles(id) on delete set null`
- `updated_by uuid references public.profiles(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Observacao:
- `address` e `mass_times` sao mais importantes para `community`
- `objective`, `audience`, `how_to_participate` e `meeting` sao mais importantes para `pastoral`, `movement` e `service`
- ainda assim, usar uma tabela unica simplifica a operacao e evita quatro modelos paralelos

### 2. Identidade continua em `org_units`
`org_units` continua sendo a origem de:

- `type`
- `slug`
- `name`
- `is_active`

Ou seja:
- o coordenador edita conteudo publico
- a identidade estrutural da unidade continua separada

## Regra de permissao proposta

### Perfis
- `admin`: acesso total
- `articulator`: acesso total ao conteudo institucional
- `secretary`: sem mudanca nesta fase, continua sem gerenciar esses grupos de forma ampla
- `treasurer`: sem mudanca nesta fase
- `member` exibido como `Coordenador`: acesso limitado as unidades vinculadas

### Regra de escopo para `Coordenador`
O `Coordenador` pode:

- acessar `Configuracoes do Site`
- visualizar apenas a aba `Unidades`
- editar apenas registros em `org_unit_site_content` cujo `org_unit_id` esteja vinculado ao usuario em `profile_org_units`

Restricoes:

- nao pode editar unidade sem vinculo
- nao pode criar nova `org_unit`
- nao pode excluir `org_unit`
- nao pode alterar o `type`
- nao pode trocar a posse da unidade

### Regra adicional recomendada
So liberar essa edicao quando houver pelo menos um vinculo em `profile_org_units` com:

- `membership_role = 'coordinator'`

Se isso ainda nao estiver preenchido de forma consistente, a fase 1 pode usar qualquer vinculo ativo da unidade. Depois, endurecemos a regra para `membership_role`.

## Politicas de banco recomendadas

### Funcoes auxiliares
Criar helpers como:

- `public.org_unit_site_content_is_full_manager()`
- `public.org_unit_site_content_is_coordinator()`
- `public.org_unit_site_content_can_access(target_org_unit_id uuid)`

### RLS em `org_unit_site_content`

#### Select
- `admin` e `articulator`: leem tudo
- `member`: le apenas conteudos das unidades vinculadas

#### Insert
- `admin` e `articulator`: podem criar
- `member`: nao cria nesta fase

#### Update
- `admin` e `articulator`: podem atualizar tudo
- `member`: atualiza apenas linhas cujo `org_unit_id` esteja vinculado ao proprio usuario

#### Delete
- apenas `admin` e `articulator`

## Estrategia de migracao

### Fonte atual
Os dados atuais estao em:

- `site_data.communities`
- `site_data.pastorals.pastorais`
- `site_data.pastorals.movimentos`
- `site_data.pastorals.servicos`

### Destino
Cada item deve ser associado a uma linha correspondente em `org_units`.

### Regra de matching
Prioridade:

1. `slug`
2. `name`
3. fallback manual para conflitos

### Backfill
Criar script de backfill que:

1. busca `site_data.id = 1`
2. extrai os blocos atuais
3. tenta encontrar a `org_unit` correspondente por `type + slug`
4. grava ou atualiza `org_unit_site_content`
5. gera relatorio das unidades sem correspondencia

### Politica de rollout
Nao apagar `site_data` nessa fase.

Fazer rollout em duas etapas:

1. escrever na tabela nova e manter leitura antiga como fallback
2. migrar frontend para leitura nova
3. validar
4. depois congelar a escrita antiga

## Ajustes no frontend

### 1. Nova fonte para a pagina publica
Substituir a leitura de:

- `siteData.communities`
- `siteData.pastorals`

por consultas a:

- `org_units`
- `org_unit_site_content`

### 2. Novo painel administrativo
Criar um painel unificado por unidade, em vez de tratar `communities` e `pastorals` como estruturas separadas dentro de `site_data`.

Sugestao de rota interna:

- manter em `/dashboard/settings`
- trocar a aba `Pastorais` por algo como `Unidades`

Mas com filtros por tipo:

- comunidades
- pastorais
- movimentos
- servicos

### 3. Comportamento por perfil

#### `admin` e `articulator`
- veem todas as unidades
- podem filtrar por tipo
- CRUD completo do conteudo

#### `Coordenador`
- ve apenas unidades vinculadas
- nao ve botao de exclusao
- nao ve acoes estruturais
- edita somente conteudo publico

### 4. ManageUsers
A tela de usuarios ja permite vincular `profile_org_units`.

Precisamos apenas reforcar dois pontos:

- deixar claro o uso de `membership_role`
- permitir marcar rapidamente o vinculo como `coordinator`

## Fases de implementacao

### Fase 1. Estrutura de banco
Entregaveis:

- `supabase/org_unit_site_content_v1_schema.sql`
- funcoes helper
- triggers de `updated_at`
- policies RLS

Objetivo:
- preparar a modelagem e a seguranca

### Fase 2. Backfill
Entregaveis:

- `supabase/org_unit_site_content_v1_backfill.sql`

Objetivo:
- popular a nova tabela a partir de `site_data`
- mapear conflitos

### Fase 3. Adaptacao do frontend administrativo
Entregaveis:

- novo data access layer para `org_units + org_unit_site_content`
- nova aba/tela unificada de unidades
- filtragem por perfil e vinculo

Objetivo:
- tirar a edicao de comunidades/pastorais do blob `site_data`

### Fase 4. Migracao do frontend publico
Entregaveis:

- `Communities`
- `CommunityDetail`
- `Pastorals`
- `PastoralDetail`

passando a ler da tabela relacional nova

Objetivo:
- unificar leitura publica e administrativa

### Fase 5. Desativacao do fluxo antigo
Entregaveis:

- remover escrita dessas areas em `site_data`
- manter em `site_data` apenas o que continuar global

Objetivo:
- eliminar duplicidade

## Ordem recomendada de execucao

1. criar schema da tabela nova
2. aplicar RLS
3. criar backfill
4. validar dados migrados
5. adaptar tela administrativa
6. liberar `Coordenador` na aba nova
7. migrar paginas publicas
8. apos estabilidade, parar de editar essas areas via `site_data`

## Criterios de aceite

### Banco
- toda `org_unit` relevante tem no maximo uma linha em `org_unit_site_content`
- `member` nao consegue atualizar conteudo de unidade sem vinculo
- `admin` e `articulator` conseguem operar todas as unidades

### Painel
- `Coordenador` ve apenas suas unidades
- `Coordenador` nao ve acoes destrutivas
- `admin` e `articulator` veem todas as unidades com filtros por tipo

### Site publico
- comunidades, pastorais, movimentos e servicos continuam aparecendo corretamente
- nenhum item some na migracao
- ordenacao e destaque continuam funcionando

## Riscos e mitigacoes

### Risco 1. Matching imperfeito no backfill
Mitigacao:
- usar `slug` e `name`
- gerar relatorio de nao correspondidos
- revisar manualmente antes de virar a chave

### Risco 2. Duplicidade entre `site_data` e tabela nova
Mitigacao:
- manter fase de transicao curta
- centralizar leitura nova o quanto antes

### Risco 3. Coordenador editar unidade errada
Mitigacao:
- validar no banco por `profile_org_units`
- nao confiar so na interface

## Proximo passo recomendado
Implementar a Fase 1.

Entregaveis imediatos do proximo passo:

- `supabase/org_unit_site_content_v1_schema.sql`
- patch de acesso para liberar `member` na aba nova com escopo restrito
- primeiro componente administrativo lendo da nova tabela
