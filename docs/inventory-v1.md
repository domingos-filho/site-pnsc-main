# Inventario v1

## Objetivo
Entregar o primeiro modulo operacional com controle por unidade organizacional, historico de movimentacoes e suporte a fotos/anexos por item.

O modulo deve funcionar para:

- comunidades
- pastorais
- movimentos
- servicos

sempre respeitando:

- vinculo do usuario com `org_units`
- permissao no modulo `inventory`
- chave `org_unit_module_settings.is_enabled`

## Escopo desta fase

### Incluido no v1
- inventarios por unidade
- itens com quantidade atual, minimo e localizacao
- historico de movimentacoes
- fotos e anexos por item
- bucket privado no Supabase Storage
- RLS por vinculo institucional e permissao de modulo

### Fora desta fase
- relatorios avancados
- auditoria separada por tabela propria
- importacao em lote
- transferencias com workflow visual completo

## Estrutura de dados

Arquivo principal:

- `supabase/inventory_v1_schema.sql`

Tabelas criadas:

### `public.inventories`
Representa um inventario vinculado a uma unidade.

Campos principais:

- `org_unit_id`
- `slug`
- `name`
- `inventory_type`
- `manager_profile_id`
- `is_active`

Regra:
- uma unidade pode ter mais de um inventario, mas o `slug` deve ser unico dentro da unidade

### `public.inventory_items`
Representa um item dentro de um inventario.

Campos principais:

- `inventory_id`
- `sku`
- `name`
- `item_type`
- `tracking_mode`
- `unit_label`
- `current_quantity`
- `minimum_quantity`
- `ideal_quantity`
- `location_text`
- `brand`
- `model`
- `serial_number`
- `condition_status`

### `public.inventory_movements`
Representa o historico operacional.

Campos principais:

- `inventory_item_id`
- `movement_type`
- `quantity_delta`
- `resulting_quantity`
- `reference_type`
- `reference_code`
- `notes`
- `occurred_at`

Regra:
- a movimentacao e imutavel
- o saldo do item e atualizado automaticamente por trigger

### `public.inventory_item_attachments`
Representa fotos e anexos vinculados ao item.

Campos principais:

- `inventory_item_id`
- `bucket_id`
- `bucket_path`
- `file_name`
- `mime_type`
- `file_size_bytes`
- `kind`
- `caption`
- `is_cover`

Regra:
- o v1 usa `inventory-media` como bucket padrao
- o bucket e privado
- cada item pode ter varios anexos
- apenas um anexo pode ficar marcado como capa

## Fotos e anexos

### Decisao arquitetural
As fotos nao ficam salvas diretamente na tabela do item.

O desenho correto e:

- arquivo binario no Supabase Storage
- referencia do arquivo em `inventory_item_attachments`

Isso evita:

- tabela inflada com binario
- perda de flexibilidade para multiplas fotos
- refatoracao futura quando entrar PDF, nota fiscal ou manual

### Convencao de path
O schema assume que o path no bucket comeca com o `inventory_item_id`.

Formato recomendado:

```text
<inventory_item_id>/<nome-do-arquivo>
```

Exemplos:

```text
9e0e29c3-84db-4b1b-a0c4-b5c4a6d78a12/foto-principal.webp
9e0e29c3-84db-4b1b-a0c4-b5c4a6d78a12/nota-fiscal.pdf
```

Se quiser subpastas, mantenha o primeiro segmento como o `inventory_item_id`:

```text
9e0e29c3-84db-4b1b-a0c4-b5c4a6d78a12/images/foto-1.jpg
```

Essa regra e importante porque as policies do Storage extraem o `inventory_item_id` do inicio do path.

### Bucket privado
O schema cria ou atualiza o bucket:

- `inventory-media`

Configuracao aplicada:

- `public = false`
- limite de 10 MB por arquivo
- mime types aceitos:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `application/pdf`

### Leitura dos arquivos
Como o bucket e privado, o frontend nao deve usar `getPublicUrl`.

O fluxo correto para o painel sera:

- listar anexos pela tabela `inventory_item_attachments`
- gerar URL assinada quando precisar renderizar a imagem

## Permissoes

Helpers principais:

- `public.inventory_can_access_org_unit(...)`
- `public.inventory_can_access_inventory(...)`
- `public.inventory_can_access_item(...)`
- `public.inventory_can_access_storage_object(...)`

Regra efetiva:

- `admin` ignora limitacoes institucionais
- qualquer outro usuario precisa:
  - estar vinculado a unidade em `profile_org_units`
  - ter acesso ao modulo `inventory` em `profile_module_access`
  - encontrar o modulo `inventory` habilitado na unidade em `org_unit_module_settings`

Permissoes operacionais:

- `read`: consulta inventarios, itens, anexos e historico
- `write`: cria/edita inventarios e itens, registra movimentacoes, sobe/remove anexos
- `approve`: reservado para evolucoes futuras, mas ja mapeado nos helpers
- `admin`: usado para operacoes mais sensiveis, como exclusao de inventario

## Regras importantes do v1

- item nao pode ficar com quantidade negativa
- item com historico de movimentacoes nao pode ser excluido
- movimentacao nao deve ser corrigida por update/delete; o caminho correto e nova movimentacao compensatoria
- inventario e item recebem `created_by` e `updated_by` automaticamente quando possivel

## Ordem de aplicacao

1. aplicar `supabase/operacoes_v1_foundation_schema.sql` se ainda nao estiver aplicado
2. aplicar `supabase/operacoes_v1_foundation_backfill.sql` se necessario
3. aplicar `supabase/inventory_v1_schema.sql`
4. habilitar o modulo `inventory` nas unidades desejadas em `org_unit_module_settings`
5. conceder acesso ao modulo nos perfis corretos em `profile_module_access`

## Consultas uteis de validacao

### Inventarios por unidade
```sql
select
  i.id,
  ou.type,
  ou.name as org_unit_name,
  i.slug,
  i.name,
  i.is_active
from public.inventories i
join public.org_units ou on ou.id = i.org_unit_id
order by ou.type, ou.name, i.name;
```

### Itens com saldo
```sql
select
  ii.id,
  i.name as inventory_name,
  ii.name,
  ii.current_quantity,
  ii.minimum_quantity,
  ii.location_text
from public.inventory_items ii
join public.inventories i on i.id = ii.inventory_id
order by i.name, ii.name;
```

### Anexos por item
```sql
select
  ia.id,
  ii.name as item_name,
  ia.kind,
  ia.bucket_path,
  ia.is_cover
from public.inventory_item_attachments ia
join public.inventory_items ii on ii.id = ia.inventory_item_id
order by ii.name, ia.created_at;
```

## Proximo passo apos o schema
Depois de aplicar o schema, a proxima entrega natural e o painel do modulo:

- `/dashboard/inventory`
- lista de inventarios
- lista de itens
- movimentacoes
- upload e preview de fotos/anexos
