import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Calendar, Clock, Shield, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  COMMUNITY_RESOURCE_VALUE,
  createCalendarEvent,
  deleteCalendarEvent,
  loadAdminCalendarData,
  updateCalendarEvent,
} from '@/lib/calendarData';

const STATUS_OPTIONS = [
  { value: 'pending_approval', label: 'Pendente' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Publico' },
  { value: 'internal', label: 'Interno' },
];

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Sem recorrencia' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
];

const createEmptyForm = () => ({
  title: '',
  summary: '',
  description: '',
  isAllDay: false,
  startsAt: '',
  endsAt: '',
  startDate: '',
  endDate: '',
  status: 'pending_approval',
  visibility: 'public',
  eventTypeId: '',
  community: '',
  resourceId: '',
  organizerName: '',
  organizerPhone: '',
  organizerEmail: '',
  expectedAttendance: '',
  recurrenceRule: '',
});

const padNumber = (value) => String(value).padStart(2, '0');

const formatDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
};

const formatDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${formatDateInput(value)}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
};

const addDaysToDateInput = (value, days) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};

const buildFormFromEvent = (event) => {
  if (!event) return createEmptyForm();

  const endDateSource = event.endsAt
    ? new Date(new Date(event.endsAt).getTime() - 1)
    : new Date(event.startsAt);
  const usesCommunityResource =
    !event.resourceId &&
    Boolean(event.community) &&
    (event.locationText || '') === (event.community || '');

  return {
    title: event.title || '',
    summary: event.summary || '',
    description: event.description || '',
    isAllDay: Boolean(event.isAllDay),
    startsAt: event.isAllDay ? '' : formatDateTimeLocal(event.startsAt),
    endsAt: event.isAllDay ? '' : formatDateTimeLocal(event.endsAt),
    startDate: event.isAllDay ? formatDateInput(event.startsAt) : '',
    endDate: event.isAllDay ? formatDateInput(endDateSource) : '',
    status:
      event.status === 'draft'
        ? 'pending_approval'
        : event.status === 'completed'
          ? 'confirmed'
          : event.status || 'pending_approval',
    visibility: event.visibility === 'private' ? 'internal' : event.visibility || 'public',
    eventTypeId: event.eventTypeId || '',
    community: usesCommunityResource ? event.community || '' : '',
    resourceId: usesCommunityResource ? COMMUNITY_RESOURCE_VALUE : event.resourceId || '',
    organizerName: event.organizerName || '',
    organizerPhone: event.organizerPhone || '',
    organizerEmail: event.organizerEmail || '',
    expectedAttendance: event.expectedAttendance ? String(event.expectedAttendance) : '',
    recurrenceRule: event.recurrenceRule || '',
  };
};

const formatEventDateLabel = (event) => {
  if (!event?.startsAt) return 'Sem data';

  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);

  if (event.isAllDay) {
    return start.toLocaleDateString('pt-BR');
  }

  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${start.toLocaleDateString('pt-BR')} ${start.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })} - ${end.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  return `${start.toLocaleString('pt-BR')} ate ${end.toLocaleString('pt-BR')}`;
};

const getStatusClasses = (status) => {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800';
    case 'pending_approval':
      return 'bg-amber-100 text-amber-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getVisibilityClasses = (visibility) => {
  switch (visibility) {
    case 'public':
      return 'bg-blue-100 text-blue-700';
    case 'internal':
      return 'bg-violet-100 text-violet-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const ManageEvents = () => {
  const { toast } = useToast();
  const { siteData } = useData();
  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [resources, setResources] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    visibility: 'all',
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [formState, setFormState] = useState(createEmptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const refreshData = async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }

    const result = await loadAdminCalendarData();

    if (result.error) {
      toast({
        title: 'Erro',
        description: result.error.message || 'Falha ao carregar a agenda v2.',
        variant: 'destructive',
      });
    }

    setEvents(result.events || []);
    setEventTypes(result.eventTypes || []);
    setResources(result.resources || []);
    setIsLoading(false);
  };

  useEffect(() => {
    void refreshData();
  }, []);

  const communityOptions = useMemo(() => {
    const fromSite = (siteData?.communities || []).map((community) => community.name).filter(Boolean);
    const fromEvents = events.map((event) => event.community).filter(Boolean);
    return Array.from(new Set([...fromSite, ...fromEvents])).sort((left, right) => left.localeCompare(right));
  }, [siteData, events]);

  const resourceOptions = useMemo(
    () => [
      { id: COMMUNITY_RESOURCE_VALUE, name: 'Comunidade' },
      ...resources.map((resource) => ({ id: resource.id, name: resource.name })),
    ],
    [resources]
  );

  const isCommunityResourceSelected = formState.resourceId === COMMUNITY_RESOURCE_VALUE;

  const filteredEvents = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return events.filter((event) => {
      if (filters.status !== 'all' && event.status !== filters.status) {
        return false;
      }

      if (filters.visibility !== 'all' && event.visibility !== filters.visibility) {
        return false;
      }

      if (!searchTerm) return true;

      const haystack = [
        event.title,
        event.summary,
        event.description,
        event.community,
        event.locationText,
        event.resourceName,
        event.eventTypeName,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchTerm);
    });
  }, [events, filters]);

  const stats = useMemo(
    () => ({
      total: events.length,
      pending: events.filter((event) => event.status === 'pending_approval').length,
      publicCount: events.filter((event) => event.visibility === 'public').length,
      internalCount: events.filter((event) => event.visibility === 'internal').length,
    }),
    [events]
  );

  const openDialog = (event = null) => {
    setCurrentEvent(event);
    setFormState(buildFormFromEvent(event));
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setCurrentEvent(null);
    setFormState(createEmptyForm());
    setIsDialogOpen(false);
  };

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleResourceChange = (value) => {
    setFormState((prev) => ({
      ...prev,
      resourceId: value,
      community: value === COMMUNITY_RESOURCE_VALUE ? prev.community : '',
    }));
  };

  const handleAllDayChange = (checked) => {
    setFormState((prev) => {
      if (checked) {
        return {
          ...prev,
          isAllDay: true,
          startDate: prev.startDate || (prev.startsAt ? prev.startsAt.slice(0, 10) : formatDateInput(new Date())),
          endDate:
            prev.endDate ||
            (prev.endsAt ? prev.endsAt.slice(0, 10) : prev.startDate || formatDateInput(new Date())),
          startsAt: '',
          endsAt: '',
        };
      }

      const startDate = prev.startDate || formatDateInput(new Date());
      const endDate = prev.endDate || startDate;

      return {
        ...prev,
        isAllDay: false,
        startsAt: `${startDate}T08:00`,
        endsAt: `${endDate}T09:00`,
      };
    });
  };

  const handleSaveEvent = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const allDayStartDate = formState.startDate || formatDateInput(new Date());
      const allDayEndDate = formState.endDate || formState.startDate || allDayStartDate;
      const startValue = formState.isAllDay
        ? `${allDayStartDate}T00:00`
        : formState.startsAt;
      const endValue = formState.isAllDay
        ? `${addDaysToDateInput(allDayEndDate, 1)}T00:00`
        : formState.endsAt;

      const payload = {
        ...formState,
        eventTypes,
        community: isCommunityResourceSelected ? formState.community : '',
        startsAt: startValue,
        endsAt: endValue,
      };

      if (currentEvent?.id) {
        await updateCalendarEvent(currentEvent.id, payload, resources);
      } else {
        await createCalendarEvent(payload, resources);
      }

      await refreshData({ silent: true });
      toast({
        title: 'Sucesso',
        description: currentEvent ? 'Evento atualizado com sucesso.' : 'Evento criado com sucesso.',
      });
      closeDialog();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao salvar o evento.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await deleteCalendarEvent(eventId);
      await refreshData({ silent: true });
      toast({
        title: 'Sucesso',
        description: 'Evento removido com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao remover o evento.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Gerenciar Agenda - Dashboard</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gerenciar Agenda</h1>
            <p className="text-gray-600 mt-2">
              Eventos publicos, reunioes internas e ocupacao dos espacos da paroquia.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => refreshData()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Evento
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pendentes</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Publicos</p>
                <p className="text-3xl font-bold text-blue-600">{stats.publicCount}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Internos</p>
                <p className="text-3xl font-bold text-slate-700">{stats.internalCount}</p>
              </div>
              <Shield className="h-8 w-8 text-slate-500" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 mb-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <Label htmlFor="events-search">Buscar</Label>
              <Input
                id="events-search"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Titulo, local, comunidade..."
              />
            </div>
            <div>
              <Label htmlFor="events-status-filter">Status</Label>
              <select
                id="events-status-filter"
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="events-visibility-filter">Visibilidade</Label>
              <select
                id="events-visibility-filter"
                value={filters.visibility}
                onChange={(event) => setFilters((prev) => ({ ...prev, visibility: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todas</option>
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Evento</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Espaco</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Visibilidade</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
                      Carregando agenda v2...
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
                      Nenhum evento encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-gray-900">{event.title}</div>
                        <div className="text-sm text-gray-500">
                          {[event.community, event.eventTypeName].filter(Boolean).join(' / ') || 'Sem classificacao'}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-600">{formatEventDateLabel(event)}</td>
                      <td className="px-6 py-4 align-top text-sm text-gray-600">
                        {event.resourceName || event.locationText || 'Sem espaco vinculado'}
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-600">{event.eventTypeName || 'Sem tipo'}</td>
                      <td className="px-6 py-4 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(event.status)}`}>
                          {STATUS_OPTIONS.find((option) => option.value === event.status)?.label || event.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getVisibilityClasses(event.visibility)}`}>
                          {VISIBILITY_OPTIONS.find((option) => option.value === event.visibility)?.label || event.visibility}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openDialog(event)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Essa acao removera o evento e seus vinculos de espaco da agenda v2.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => handleDeleteEvent(event.id)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
            return;
          }
          setIsDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentEvent ? 'Editar evento' : 'Novo evento'}</DialogTitle>
            <DialogDescription>
              Esta tela grava direto em <code>calendar_events</code> e <code>calendar_event_resources</code>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEvent} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="event-title">Titulo</Label>
                <Input
                  id="event-title"
                  value={formState.title}
                  onChange={(event) => handleFieldChange('title', event.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="event-summary">Resumo curto</Label>
                <Input
                  id="event-summary"
                  value={formState.summary}
                  onChange={(event) => handleFieldChange('summary', event.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div>
                <Label htmlFor="event-type">Tipo</Label>
                <select
                  id="event-type"
                  value={formState.eventTypeId}
                  onChange={(event) => handleFieldChange('eventTypeId', event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sem tipo</option>
                  {eventTypes.map((eventType) => (
                    <option key={eventType.id} value={eventType.id}>
                      {eventType.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="event-resource">Espaco vinculado</Label>
                <select
                  id="event-resource"
                  value={formState.resourceId}
                  onChange={(event) => handleResourceChange(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sem espaco</option>
                  {resourceOptions.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="event-status">Status</Label>
                <select
                  id="event-status"
                  value={formState.status}
                  onChange={(event) => handleFieldChange('status', event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="event-visibility">Visibilidade</Label>
                <select
                  id="event-visibility"
                  value={formState.visibility}
                  onChange={(event) => handleFieldChange('visibility', event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formState.isAllDay}
                    onChange={(event) => handleAllDayChange(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Evento de dia inteiro
                </label>
              </div>

              {formState.isAllDay ? (
                <>
                  <div>
                    <Label htmlFor="event-start-date">Data inicial</Label>
                    <Input
                      id="event-start-date"
                      type="date"
                      value={formState.startDate}
                      onChange={(event) => handleFieldChange('startDate', event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-end-date">Data final</Label>
                    <Input
                      id="event-end-date"
                      type="date"
                      value={formState.endDate}
                      onChange={(event) => handleFieldChange('endDate', event.target.value)}
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="event-starts-at">Inicio</Label>
                    <Input
                      id="event-starts-at"
                      type="datetime-local"
                      value={formState.startsAt}
                      onChange={(event) => handleFieldChange('startsAt', event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-ends-at">Fim</Label>
                    <Input
                      id="event-ends-at"
                      type="datetime-local"
                      value={formState.endsAt}
                      onChange={(event) => handleFieldChange('endsAt', event.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="event-community">Comunidade</Label>
                <select
                  id="event-community"
                  value={formState.community}
                  onChange={(event) => handleFieldChange('community', event.target.value)}
                  disabled={!isCommunityResourceSelected}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">Sem comunidade</option>
                  {communityOptions.map((community) => (
                    <option key={community} value={community}>
                      {community}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Selecione <strong>Comunidade</strong> em <strong>Espaco vinculado</strong> para habilitar este campo.
                </p>
              </div>

              <div>
                <Label htmlFor="event-organizer-name">Responsavel</Label>
                <Input
                  id="event-organizer-name"
                  value={formState.organizerName}
                  onChange={(event) => handleFieldChange('organizerName', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="event-organizer-phone">Telefone</Label>
                <Input
                  id="event-organizer-phone"
                  value={formState.organizerPhone}
                  onChange={(event) => handleFieldChange('organizerPhone', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="event-organizer-email">E-mail</Label>
                <Input
                  id="event-organizer-email"
                  type="email"
                  value={formState.organizerEmail}
                  onChange={(event) => handleFieldChange('organizerEmail', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="event-attendance">Capacidade esperada</Label>
                <Input
                  id="event-attendance"
                  type="number"
                  min="0"
                  value={formState.expectedAttendance}
                  onChange={(event) => handleFieldChange('expectedAttendance', event.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="event-recurrence">Recorrencia</Label>
                <select
                  id="event-recurrence"
                  value={formState.recurrenceRule}
                  onChange={(event) => handleFieldChange('recurrenceRule', event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {RECURRENCE_OPTIONS.map((option) => (
                    <option key={option.value || 'none'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="event-description">Descricao</Label>
                <Textarea
                  id="event-description"
                  value={formState.description}
                  onChange={(event) => handleFieldChange('description', event.target.value)}
                  rows={5}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManageEvents;
