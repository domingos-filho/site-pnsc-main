# Operações v1

## Objetivo
Preparar o site para receber três aplicações internas, com controle de acesso por usuário e vínculo institucional:

- mini mercado
- inventário por pastoral, movimento, comunidade e serviço
- venda e reserva de mesas por evento

O ponto central da implantação é criar primeiro a fundação de perfis, vínculos e permissões. Sem isso, os três módulos tenderiam a duplicar regras de acesso e dados institucionais.

## Estado atual do projeto
Hoje o projeto já possui uma base útil:

- autenticação por Supabase Auth e perfis em `public.profiles`
- papéis base `member`, `secretary` e `admin`
- painel administrativo com controle de rotas em [src/App.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/App.jsx)
- agenda v2 relacional para eventos, espaços e reservas em [supabase/agenda_v2_schema.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/agenda_v2_schema.sql)
- galeria v2 relacional para conteúdos por evento em [supabase/gallery_v2_schema.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/gallery_v2_schema.sql)

Mas ainda faltam duas camadas estruturais:

- uma referência única para `pastorais`, `movimentos`, `comunidades` e `serviços`
- uma matriz de permissões por módulo e por usuário

## Estratégia recomendada
Implementar em quatro etapas:

### Etapa 0. Fundação de acessos e vínculos
- normalizar unidades organizacionais
- vincular usuários a unidades
- controlar acesso por módulo
- preparar criação de usuários por fluxo seguro

### Etapa 1. Inventário v1
- validar o modelo de vínculos institucionais
- controlar estoque e patrimônio por unidade

### Etapa 2. Mini mercado v1
- catálogo, vendas, estoque e caixa
- aproveitar a base de permissões da etapa 0

### Etapa 3. Mesas v1
- layout simples
- reserva/venda por evento
- integração com agenda v2

## Etapa 0. Fundação de acessos e vínculos

### Problema que essa etapa resolve
Hoje o site guarda `pastorais`, `movimentos`, `serviços` e `comunidades` em JSON dentro de `site_data`. Isso funciona para exibição pública, mas é fraco para:

- filtrar acessos por grupo
- liberar módulo por unidade
- saber a qual grupo um usuário pertence
- dar permissão operacional sem depender só de `role`

### Modelo proposto
Essa etapa cria quatro estruturas principais:

#### 1. `org_units`
Representa as unidades organizacionais do sistema.

Tipos previstos:

- `community`
- `pastoral`
- `movement`
- `service`

Exemplos:

- Matriz
- Nossa Senhora das Graças
- Liturgia
- Familiar
- PASCOM
- Dízimo

#### 2. `profile_org_units`
Liga um usuário às unidades a que ele pertence.

Exemplos:

- usuário X pertence à pastoral Liturgia
- usuário Y pertence à comunidade Matriz
- usuário Z pertence ao serviço PASCOM

#### 3. `app_modules`
Catálogo dos módulos internos do sistema.

Módulos previstos nesta fase:

- `market`
- `inventory`
- `table_sales`

#### 4. `profile_module_access`
Permissões por usuário e por módulo.

Capacidades base:

- `can_read`
- `can_write`
- `can_approve`
- `can_admin`

#### 5. `org_unit_module_settings`
Habilita ou desabilita cada módulo para cada unidade organizacional.

Exemplos:

- inventário habilitado para Liturgia
- inventário desabilitado para determinada comunidade
- mini mercado habilitado apenas para a secretaria

### Entregáveis da etapa 0
- schema base em [supabase/operacoes_v1_foundation_schema.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/operacoes_v1_foundation_schema.sql)
- backfill inicial em [supabase/operacoes_v1_foundation_backfill.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/operacoes_v1_foundation_backfill.sql)
- criação futura de usuário por Edge Function
- painel de usuários evoluído para:
  - criar conta
  - definir papel
  - vincular unidades
  - liberar módulos

### Regras de negócio da etapa 0
- `admin` pode gerenciar tudo
- `secretary` pode operar módulos habilitados, conforme permissão explícita
- `member` só acessa módulo se tiver vínculo e acesso concedido
- vínculo institucional e acesso de módulo são coisas separadas

Exemplo:

- o usuário pode pertencer à PASCOM e à Matriz
- mas ter acesso apenas ao `inventory`
- e não ter acesso ao `market`

### Fluxo de criação de usuário recomendado
O fluxo ideal é:

1. admin cria usuário no painel
2. backend seguro cria conta em `auth.users`
3. backend grava ou atualiza `public.profiles`
4. backend cria vínculos em `profile_org_units`
5. backend grava permissões em `profile_module_access`

Observação:
essa parte deve ser feita por Edge Function com credencial segura, não pelo frontend com `anon key`.

## Aplicação 1. Mini mercado

### Objetivo
Controlar catálogo, vendas, pagamentos, caixa, orçamento e estoque.

### Escopo funcional

#### Fase 1. Catálogo e estoque
- CRUD de produtos
- categorias
- preço de venda
- custo
- estoque inicial
- estoque mínimo

#### Fase 2. Operação de venda
- abertura de venda
- inclusão de itens
- desconto
- subtotal e total
- status da venda

#### Fase 3. Pagamentos
- pagamento integral
- pagamento parcial
- forma de pagamento
- baixa manual

#### Fase 4. Financeiro
- entradas e saídas
- fluxo de caixa
- fechamento por período
- orçamento mensal

### Modelo recomendado
- `market_product_categories`
- `market_products`
- `market_stock_movements`
- `market_sales`
- `market_sale_items`
- `market_payments`
- `cash_accounts`
- `cash_entries`
- `budget_periods`
- `budget_items`

### Permissões recomendadas
- `can_read`: consultar catálogo, vendas e relatórios simples
- `can_write`: cadastrar produto, lançar venda e estoque
- `can_approve`: confirmar baixa de pagamento e ajustes sensíveis
- `can_admin`: gerenciar parâmetros, categorias e fechamentos

### Rotas sugeridas
- `/dashboard/market`
- `/dashboard/market/products`
- `/dashboard/market/sales`
- `/dashboard/market/stock`
- `/dashboard/market/cash`
- `/dashboard/market/budget`

### Ordem de implementação
1. produtos
2. estoque
3. vendas
4. pagamentos
5. caixa
6. orçamento
7. relatórios

## Aplicação 2. Inventário por unidade

### Objetivo
Controlar itens, patrimônio e consumo por pastoral, movimento, comunidade e serviço.

### Escopo funcional

#### Fase 1. Estrutura do inventário
- criar inventário por unidade
- habilitar inventário por unidade
- CRUD completo de itens

#### Fase 2. Movimentação
- entrada
- saída
- ajuste
- transferência

#### Fase 3. Controle operacional
- estoque mínimo
- responsável
- localização
- fotos e anexos
- histórico por item

### Modelo recomendado
- `inventories`
- `inventory_items`
- `inventory_movements`
- `inventory_item_files`
- `inventory_audits`

### Regra principal
- o usuário só acessa inventários das unidades às quais está vinculado
- o módulo só aparece se estiver habilitado para a unidade
- `admin` ignora essa limitação

### Rotas sugeridas
- `/dashboard/inventory`
- `/dashboard/inventory/:inventoryId`

### Ordem de implementação
1. lista de inventários
2. CRUD de itens
3. movimentos
4. alertas
5. anexos e histórico

## Aplicação 3. Venda e reserva de mesas

### Objetivo
Controlar a planta de mesas de um evento, com status visual e pagamento.

### Estratégia recomendada
Essa aplicação deve nascer integrada à agenda v2.

Cada operação de mesas deve estar vinculada a um `calendar_event`.

### Escopo funcional

#### Fase 1. Configuração do evento
- selecionar evento
- definir quantidade de mesas
- definir valor base

#### Fase 2. Layout simples
- grade por linha e coluna
- rótulo da mesa
- posição básica editável

#### Fase 3. Operação comercial
- disponível
- reservada
- vendida
- bloqueada

#### Fase 4. Pagamento
- registrar responsável
- registrar valor
- status do pagamento
- baixa parcial ou total

### Modelo recomendado
- `table_sale_events`
- `table_layouts`
- `event_tables`
- `table_reservations`
- `table_reservation_payments`

### Regra de UX
Na primeira versão, evitar editor visual complexo com drag-and-drop livre.

Começar com:

- layout em grade
- edição simples de posição
- cores por status

Isso é mais rápido para entregar, mais estável e suficiente para a operação real da paróquia.

### Rotas sugeridas
- `/dashboard/table-sales`
- `/dashboard/table-sales/:eventId`

### Ordem de implementação
1. evento de mesas
2. geração de mesas
3. layout simples
4. reservas e vendas
5. pagamentos
6. mapa visual

## Roadmap de implantação

### Sprint 1. Fundação
- aplicar schema base
- executar backfill das unidades
- validar vínculos atuais
- evoluir a tela de usuários

### Sprint 2. Usuários e permissões
- criar Edge Function de provisionamento
- permitir vínculo com unidades
- permitir liberação de módulos

### Sprint 3. Inventário v1
- tabelas
- CRUD
- movimentos
- leitura por vínculo

### Sprint 4. Mini mercado v1
- catálogo
- estoque
- vendas
- pagamentos

### Sprint 5. Mini mercado financeiro
- caixa
- orçamento
- fechamento

### Sprint 6. Mesas v1
- evento
- layout
- reservas
- status visual

## Critérios de aceite por módulo

### Fundação
- usuários podem ser vinculados a múltiplas unidades
- módulos podem ser habilitados por usuário
- módulos podem ser habilitados por unidade

### Inventário
- cada unidade vê apenas seu inventário
- histórico de movimentação é auditável

### Mini mercado
- venda altera estoque
- pagamento altera status da venda
- caixa bate com movimentos financeiros

### Mesas
- mapa reflete disponibilidade real
- mesa não pode ser vendida duas vezes
- pagamento fica vinculado à reserva

## Próximo passo recomendado
Começar pela fundação.

Ordem imediata:

1. aplicar [supabase/operacoes_v1_foundation_schema.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/operacoes_v1_foundation_schema.sql)
2. executar [supabase/operacoes_v1_foundation_backfill.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/operacoes_v1_foundation_backfill.sql)
3. validar unidades organizacionais
4. evoluir a tela [src/pages/admin/ManageUsers.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/admin/ManageUsers.jsx)
5. só depois abrir o módulo de inventário

## Referências oficiais
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Segurança em Edge Functions: https://supabase.com/docs/guides/functions/auth
- Supabase Auth: https://supabase.com/docs/guides/auth/
- Supabase Users: https://supabase.com/docs/guides/auth/users
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
