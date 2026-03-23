# Agenda v2

## Objetivo
Evoluir a agenda atual para um modelo que atenda dois fluxos distintos:

- consulta publica simples e rapida dos eventos da paroquia
- operacao interna de reunioes, reservas de espacos e aprovacoes

O foco da v2 e sair de um "calendario informativo" para um "calendario operacional".

## Problema atual
Hoje a agenda funciona bem para listar eventos simples, mas ainda nao cobre a operacao real da igreja.

Pontos observados no projeto atual:

- o banco usa uma tabela curta `public.events` com `title`, `date`, `time`, `location`, `description`, `community`, `category` e `recurrence` em [README.md](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/README.md)
- a pagina publica e o fluxo administrativo estao misturados em [src/pages/Events.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/Events.jsx)
- existe uma tela separada de admin em [src/pages/admin/ManageEvents.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/admin/ManageEvents.jsx), mas o dashboard hoje redireciona `/dashboard/events` para `/agenda` em [src/App.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/App.jsx)
- `location` e texto livre, entao nao existe nocao de recurso reservado
- `recurrence` e apenas um campo simples em [src/lib/supabaseData.js](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/lib/supabaseData.js)
- o offline queue da agenda em [src/lib/supabaseData.js](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/lib/supabaseData.js) e aceitavel para informacao, mas insuficiente para conflitos reais de sala/espaco

Impactos diretos:

- nao existe conflito automatico de uso de espaco
- nao ha aprovacao formal de pedido
- nao existe duracao, apenas `date + time`
- nao existe status do evento
- nao existe separacao entre evento publico, reuniao interna e reserva privada
- nao existe responsavel operacional pelo evento

## Tendencias relevantes
Os produtos mais maduros do mercado hoje giram em torno de alguns padroes:

- disponibilidade baseada em horario real de inicio e fim
- buffers antes e depois da reserva
- formularios de triagem antes do agendamento
- roteamento do pedido para a pessoa ou fluxo certo
- confirmacoes e lembretes
- pagina publica simples para consulta
- backoffice separado para operacao

Referencias oficiais uteis:

- Google Calendar appointment schedules:
  https://support.google.com/calendar/answer/11608416?hl=en&ref_topic=10729441
  https://support.google.com/calendar/answer/10729749?hl=en-nz
- Microsoft Bookings:
  https://learn.microsoft.com/en-us/microsoft-365/bookings/define-service-offerings?view=o365-worldwide
- Calendly features:
  https://calendly.com/features/
- Cal.com routing:
  https://cal.com/routing

## Modelo proposto
Separar a agenda em cinco entidades:

### 1. `calendar_event_types`
Representa o tipo do compromisso.

Exemplos:

- Missa
- Reuniao
- Formacao
- Pastoral
- Festa
- Reserva de espaco

Uso:

- padrao de duracao
- cor
- se e publico ou interno por padrao
- se exige aprovacao
- se exige recurso

### 2. `calendar_resources`
Representa o espaco ou recurso reservavel.

Exemplos:

- Igreja Matriz
- Capela
- Salao Paroquial
- Sala de Catequese 1
- Auditorio
- Secretaria

Uso:

- capacidade
- modo de reserva
- se exige aprovacao
- buffers padrao
- se pode aparecer no publico

### 3. `calendar_events`
Representa o compromisso principal.

Exemplos:

- Missa Dominical das 18h
- Reuniao da Pascom
- Ensaio do Coral
- Formacao de Catequistas
- Assembleia Paroquial

Campos-chave:

- `starts_at`
- `ends_at`
- `status`
- `visibility`
- `community`
- `category`
- `location_text`
- `organizer_name`
- `organizer_phone`
- `recurrence_rule`
- `recurrence_until`

### 4. `calendar_event_resources`
Liga um evento aos recursos ocupados.

Exemplos:

- a missa usa `Igreja Matriz`
- a reuniao usa `Salao Paroquial`
- um encontro pode usar `Salao + Patio`

Campos-chave:

- `event_id`
- `resource_id`
- `starts_at`
- `ends_at`
- `setup_minutes`
- `teardown_minutes`

### 5. `calendar_booking_requests`
Representa a solicitacao antes da aprovacao.

Exemplos:

- pastoral pede o salao para uma reuniao
- grupo jovem pede o patio para uma dinamica
- coordenacao pede a matriz para uma celebracao especial

Campos-chave:

- `requested_start`
- `requested_end`
- `requested_resource_id`
- `requester_name`
- `requester_phone`
- `requester_ministry`
- `purpose`
- `status`

## Regras de negocio recomendadas

### Status do evento
Sugestao:

- `draft`
- `pending_approval`
- `confirmed`
- `cancelled`
- `completed`

Regra:

- o publico so ve `confirmed`, `completed` e opcionalmente `cancelled`
- `draft` e `pending_approval` ficam internos

### Visibilidade
Sugestao:

- `public`
- `internal`
- `private`

Regra:

- `public`: aparece no site
- `internal`: aparece so no painel
- `private`: bloqueia agenda/recurso, mas nao aparece na lista publica

### Conflito de espaco
Regra:

- recursos `exclusive` nao podem ser reservados em horarios sobrepostos
- a verificacao deve considerar `setup_minutes` e `teardown_minutes`
- conflitos devem bloquear insert/update quando o evento estiver `pending_approval` ou `confirmed`

### Aprovacao
Regra:

- pedidos de uso de espaco entram como `pending`
- secretaria/admin aprova ou rejeita
- ao aprovar, a solicitacao pode gerar um `calendar_event`
- a aprovacao precisa registrar `reviewed_by` e `reviewed_at`

## Fluxo publico recomendado

### Pagina `/agenda`
Objetivo: consulta rapida.

Blocos recomendados:

- proximos eventos
- hoje
- esta semana
- calendario mensal
- filtros por tipo, comunidade e espaco
- busca por titulo

Cada card deve mostrar:

- titulo
- data e hora
- local
- comunidade
- tipo
- status quando aplicavel

### Pagina `/agenda/:slug`
Objetivo: detalhe do evento.

Blocos recomendados:

- titulo
- data completa
- horario
- local
- comunidade
- descricao
- responsavel ou contato
- botao "Adicionar ao calendario"
- link para galeria quando houver `linked_event_id`

## Fluxo administrativo recomendado

### Tela 1. Visao operacional
Objetivo: o que vai acontecer e o que precisa de aprovacao.

Blocos:

- agenda do dia
- pedidos pendentes
- conflitos
- proximos 7 dias

### Tela 2. Calendario de eventos
Objetivo: edicao completa do evento.

Campos:

- tipo
- titulo
- inicio
- fim
- dia inteiro
- visibilidade
- status
- comunidade
- descricao
- responsavel
- recursos
- recorrencia

### Tela 3. Recursos
Objetivo: cadastrar espacos.

Campos:

- nome
- capacidade
- tipo
- exige aprovacao
- buffer padrao antes/depois
- ativo/inativo

### Tela 4. Solicitacoes
Objetivo: aprovar ou rejeitar pedidos.

Acoes:

- aprovar
- rejeitar
- sugerir novo horario
- transformar em evento confirmado

## Melhorias de UX recomendadas

### Publico
- filtro de "Hoje / Esta semana / Este mes"
- botao `Adicionar ao Google Calendar / ICS`
- indicadores simples de status
- cards compactos no mobile
- destaque para eventos especiais

### Admin
- separar agenda publica de reserva interna
- wizard de nova reserva
- conflitos visiveis antes de salvar
- templates por tipo de evento
- confirmacao por toasts e historico de alteracoes

## Estrategia de rollout

### Etapa 1. Banco v2
- aplicar [supabase/agenda_v2_schema.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/agenda_v2_schema.sql)
- executar [supabase/agenda_v2_backfill.sql](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/supabase/agenda_v2_backfill.sql)
- validar contagem de eventos migrados

### Etapa 2. Leitura publica v2
- criar `calendarData.js`
- trocar a leitura publica de [src/pages/Events.jsx](c:/Users/franc/Desktop/Projetos/sites/site-pnsc-main/src/pages/Events.jsx) para `calendar_events`
- manter fallback legado temporario

### Etapa 3. Admin v2
- parar de misturar a tela publica com o editor
- ligar `/dashboard/events` para uma tela administrativa real
- usar `starts_at`, `ends_at`, `status` e `visibility`

### Etapa 4. Recursos e conflitos
- cadastrar recursos
- ativar `calendar_event_resources`
- usar verificacao de conflito no banco

### Etapa 5. Solicitacoes
- abrir fluxo de pedido
- aprovar/rejeitar
- opcionalmente permitir formulario publico de solicitacao

### Etapa 6. Automacoes
- exportacao ICS
- lembretes
- notificacao de aprovacao
- relatorios de uso dos espacos

## Backfill recomendado
O sistema atual usa `public.events`.

O backfill proposto:

1. cria `calendar_resources` a partir dos `location` distintos
2. copia `public.events` para `calendar_events`
3. cria vinculacoes iniciais em `calendar_event_resources`

Observacao:

- como o modelo antigo nao guarda `ends_at`, o backfill precisa assumir uma duracao padrao
- o script desta pasta usa 60 minutos como fallback para eventos com hora
- eventos sem hora entram como `all_day = true`

## Consultas de validacao

```sql
select count(*) from public.calendar_events;
select count(*) from public.calendar_resources;
select count(*) from public.calendar_event_resources;
```

```sql
select title, starts_at, ends_at, status, visibility
from public.calendar_events
order by starts_at asc
limit 20;
```

```sql
select r.name, count(*)
from public.calendar_event_resources er
join public.calendar_resources r on r.id = er.resource_id
group by r.name
order by count(*) desc;
```

## Recomendacao final
Para a paroquia, eu recomendo esta divisao:

- agenda publica: simples, limpa e focada em consulta
- agenda interna: operacao, espacos, reunioes e aprovacao

Isso evita que a pagina publica fique inchada e, ao mesmo tempo, da controle real para secretaria e administradores.
