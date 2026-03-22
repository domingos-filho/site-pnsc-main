# Galeria v2

## Objetivo
Preparar a galeria para:

- milhares de fotos ao longo do tempo
- busca por evento especifico
- filtros por ano, comunidade, categoria e tags
- paginacao e lazy loading
- administracao sem regravar `site_data` inteiro

## Problema atual
Hoje a galeria ainda esta acoplada ao JSON `siteData.gallery`.

Impactos diretos no codigo atual:

- a pagina publica carrega toda a galeria em memoria e agrupa por ano em [src/pages/Gallery.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/Gallery.jsx)
- o admin salva a galeria inteira de volta dentro de `site_data` em [src/pages/admin/ManageGallery.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/admin/ManageGallery.jsx)
- o `DataContext` persiste tudo como um unico documento JSON em [src/contexts/DataContext.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/contexts/DataContext.jsx)

Esse modelo funciona com poucos albuns, mas degrada quando o volume cresce:

- download excessivo no carregamento da galeria
- ausencia de busca real
- pagina publica sem paginacao
- cada upload aumenta o `site_data`
- mais risco de conflito em sincronizacao

## Modelo proposto
Separar a galeria do `site_data` e usar duas tabelas principais:

### 1. `gallery_collections`
Representa o evento ou album.

Campos principais:

- `id`
- `slug`
- `title`
- `summary`
- `description`
- `event_date`
- `end_date`
- `display_year`
- `community`
- `category`
- `tags`
- `linked_event_id`
- `cover_media_id`
- `photo_count`
- `is_published`

Uso esperado:

- `Festa da Padroeira 2025`
- `Semana Santa 2026`
- `Crisma - Turma 1`
- `Visita Pastoral - Comunidade Sao Jose`

### 2. `gallery_media`
Representa cada foto do evento.

Campos principais:

- `id`
- `collection_id`
- `path`
- `thumb_path`
- `medium_path`
- `src_url`
- `thumb_url`
- `alt_text`
- `caption`
- `sort_order`
- `taken_at`
- `width`
- `height`
- `is_featured`

Uso esperado:

- original no Storage
- thumbnail para grid
- imagem media para modal/lightbox

## Busca recomendada
Na pagina publica da galeria, usar a busca no nivel do evento e nao no nivel da foto.

Filtros recomendados:

- texto livre: titulo, resumo, comunidade, categoria, tags
- ano
- comunidade
- categoria
- tags
- ordenacao por mais recentes / mais antigos / mais fotos

Estrategia SQL recomendada:

- `GIN` em `search_tokens`
- `GIN` em `tags`
- indices normais em `search_year`, `community`, `category`

Consulta base:

```sql
select *
from public.gallery_collections
where is_published = true
  and (
    coalesce(:search, '') = ''
    or search_tokens @@ websearch_to_tsquery('simple', unaccent(:search))
  )
  and (:year is null or search_year = :year)
  and (:community is null or community = :community)
  and (:category is null or category = :category)
order by event_date desc nulls last, created_at desc
limit :limit
offset :offset;
```

## Ligacao com a agenda
O projeto ja possui tabela propria de eventos em [src/lib/supabaseData.js](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/lib/supabaseData.js).

A ligacao recomendada e:

- `gallery_collections.linked_event_id -> public.events.id`

Beneficios:

- o admin pode criar o album a partir de um evento ja cadastrado
- o visitante consegue achar fotos da agenda passada
- no futuro, a pagina do evento pode mostrar o link `Ver fotos`

Observacao:
O vinculo com `events` deve ser opcional. Nem todo album nasce de um evento da agenda.

## UX publica recomendada

### Pagina `/galeria`
Substituir a listagem atual por uma pagina de descoberta.

Blocos:

- busca principal por evento
- filtros laterais ou em drawer no mobile
- cards de eventos/albuns
- paginacao ou botao `Carregar mais`

Card de evento:

- capa
- titulo
- comunidade
- data
- quantidade de fotos
- tags principais

### Pagina `/galeria/:slug`
Pagina dedicada a um album/evento.

Blocos:

- capa e titulo
- resumo
- metadados do evento
- grid de fotos com lazy loading
- lightbox/modal

Se o album tiver muitas fotos:

- pagina por lotes de 24 ou 48 fotos
- opcionalmente filtros internos por tag

## UX administrativa recomendada

### Tela 1. Lista de albuns
- busca por titulo
- filtros por ano, comunidade e status
- contador de fotos
- publicar/despublicar
- duplicar album

### Tela 2. Editor do album
- titulo
- resumo
- data
- comunidade
- categoria
- tags
- vinculo com evento da agenda
- capa

### Tela 3. Gerenciador de fotos
- upload em lote
- reordenacao
- definir foto de capa
- legenda
- alt text
- exclusao em lote

## Estrategia de rollout

### Etapa 1. Banco
- aplicar [supabase/gallery_v2_schema.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/gallery_v2_schema.sql)
- executar [supabase/gallery_v2_backfill.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/gallery_v2_backfill.sql)
- validar contagem de albuns e fotos

### Etapa 2. Admin em dual-write
Atualizar o admin para:

- gravar na nova estrutura da galeria
- manter leitura do legado somente enquanto a migracao nao termina
- bloquear novos uploads em `site_data.gallery`

### Etapa 3. Pagina publica v2
Trocar [src/pages/Gallery.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/Gallery.jsx) para:

- listar `gallery_collections`
- aplicar busca e filtros no banco
- abrir album por `slug`

### Etapa 4. Desligar o legado
Quando tudo estiver validado:

- remover a dependencia de `siteData.gallery`
- manter somente leitura da galeria relacional
- opcionalmente limpar `data.gallery` de `site_data`

## Plano de migracao

### Fase A. Backfill inicial
Objetivo: copiar o JSON atual para as novas tabelas sem interromper o site.

Passos:

1. aplicar schema v2
2. executar backfill
3. conferir amostras de albuns e fotos
4. nao apagar `site_data.gallery` ainda

### Fase B. Adaptacao do admin
Objetivo: parar de salvar a galeria inteira como JSON.

Passos:

1. criar `galleryData.js` ou similar para CRUD relacional
2. reescrever [src/pages/admin/ManageGallery.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/admin/ManageGallery.jsx)
3. armazenar metadados do album em `gallery_collections`
4. armazenar fotos em `gallery_media`

### Fase C. Adaptacao publica
Objetivo: visitante buscar e navegar por evento.

Passos:

1. trocar a pagina atual por consulta paginada
2. criar rota de detalhe por slug
3. adicionar filtros e busca
4. lazy load das fotos

### Fase D. Corte final
Objetivo: remover o legado do runtime principal.

Passos:

1. remover leitura de `siteData.gallery` do fluxo publico
2. manter script de importacao apenas como ferramenta de emergencia
3. opcionalmente limpar `site_data.gallery` apos backup

## Regras de busca e organizacao

### Categorias recomendadas
- Liturgia
- Sacramentos
- Formacao
- Festas
- Pastorais
- Comunidades
- Juventude
- Social

### Tags recomendadas
- padroeira
- semana-santa
- crisma
- matriz
- pascom
- juventude
- missa

### Convencao de Storage recomendada
Para uploads novos:

- `gallery/<collection-id>/original/<arquivo>`
- `gallery/<collection-id>/medium/<arquivo>`
- `gallery/<collection-id>/thumb/<arquivo>`

Isso facilita:

- exclusao em lote por album
- regeneracao de derivados
- auditoria por evento

## Mudancas de codigo sugeridas

Arquivos que devem mudar na implementacao:

- [src/pages/Gallery.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/Gallery.jsx)
- [src/pages/admin/ManageGallery.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/admin/ManageGallery.jsx)
- [src/contexts/DataContext.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/contexts/DataContext.jsx)
- criar um novo modulo, por exemplo `src/lib/galleryData.js`

## Recomendacao final
Implementar em ordem:

1. schema + backfill
2. CRUD administrativo da nova galeria
3. pagina publica com busca e filtros
4. remocao do legado

Essa ordem reduz risco, evita quebra de conteudo ja publicado e prepara a galeria para crescimento real.
