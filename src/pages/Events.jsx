import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  Repeat,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { createEvent, deleteEvent, loadEvents, updateEvent } from '@/lib/supabaseData';
import { isSupabaseReady } from '@/lib/supabaseClient';

const fallbackEvents = [
  {
    id: 1,
    title: 'Missa Dominical',
    date: '2025-10-26',
    time: '08:00',
    location: 'Igreja Matriz',
    description: 'Celebracao Eucaristica Dominical',
    community: 'Matriz',
    category: 'Missa',
    recurrence: 'weekly',
  },
  {
    id: 2,
    title: 'Catequese Infantil',
    date: '2025-10-25',
    time: '14:00',
    location: 'Salao Paroquial',
    description: 'Encontro de formacao para criancas',
    community: 'Matriz',
    category: 'Formacao',
    recurrence: 'weekly',
  },
  {
    id: 3,
    title: 'Grupo de Oracao',
    date: '2025-10-29',
    time: '20:00',
    location: 'Capela',
    description: 'Renovacao Carismatica Catolica',
    community: 'Capela',
    category: 'Encontro',
    recurrence: 'weekly',
  },
  {
    id: 4,
    title: 'Adoracao ao Santissimo',
    date: '2025-11-07',
    time: '19:00',
    location: 'Igreja Matriz',
    description: 'Primeira sexta-feira do mes',
    community: 'Matriz',
    category: 'Missa',
    recurrence: 'monthly',
  },
  {
    id: 5,
    title: 'Encontro de Casais',
    date: '2025-11-01',
    time: '19:00',
    location: 'Salao Paroquial',
    description: 'ECC - Encontro de Casais com Cristo',
    community: 'Matriz',
    category: 'Encontro',
    recurrence: 'yearly',
  },
];

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const recurrenceLabels = {
  none: 'Sem recorrencia',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const eventTypeOptions = [
  'Missa',
  'Formacao',
  'Pastoral',
  'Encontro',
  'Mutirao',
  'Festa',
  'Outro',
];

const recurrenceOptions = [
  { value: 'none', label: 'Sem recorrencia' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
];

const padNumber = (value) => String(value).padStart(2, '0');

const formatMonthKey = (date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;

const formatDateKey = (date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;

const parseMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

const Events = () => {
  const { toast } = useToast();
  const { isManager } = useAuth();
  const { siteData } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));
  const [currentEvent, setCurrentEvent] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar');
  const [filters, setFilters] = useState(() => ({
    month: formatMonthKey(new Date()),
    community: 'all',
    category: 'all',
  }));

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      const { events: loaded, error } = await loadEvents({ syncPending: isManager });
      const eventsToShow = !isSupabaseReady && loaded.length === 0 ? fallbackEvents : loaded;
      if (!isMounted) return;
      setEvents(eventsToShow);
      if (error) {
        toast({
          title: 'Aviso',
          description: 'Falha ao carregar eventos do Supabase. Usando dados locais.',
        });
      }
    };

    fetchEvents();
    return () => {
      isMounted = false;
    };
  }, [isManager, toast]);

  const today = new Date();
  const todayKey = formatDateKey(today);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const filteredEvents = useMemo(() => {
    if (!isManager) return events;
    return events.filter((event) => {
      if (filters.community !== 'all' && (event.community || '') !== filters.community) {
        return false;
      }
      if (filters.category !== 'all' && (event.category || '') !== filters.category) {
        return false;
      }
      if (filters.month !== 'all') {
        const eventMonthKey = formatMonthKey(new Date(`${event.date}T00:00:00`));
        if (eventMonthKey !== filters.month) return false;
      }
      return true;
    });
  }, [events, filters, isManager]);

  const calendarEvents = isManager ? filteredEvents : events;

  const selectedDateEvents = useMemo(() => {
    const list = calendarEvents
      .filter((event) => event.date === selectedDate)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return list;
  }, [calendarEvents, selectedDate]);

  const upcomingEvents = events
    .filter((event) => new Date(`${event.date}T00:00:00`) >= todayStart)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  const todayEvents = events
    .filter((event) => event.date === todayKey)
    .slice()
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i += 1) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i += 1) {
      days.push(i);
    }
    return days;
  };

  const handleMonthShift = (delta) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(nextMonth);
    setSelectedDate(formatDateKey(nextMonth));
    setFilters((prev) =>
      prev.month === 'all' ? prev : { ...prev, month: formatMonthKey(nextMonth) }
    );
  };

  const handleMonthFilterChange = (value) => {
    setFilters((prev) => ({ ...prev, month: value }));
    if (value !== 'all') {
      const parsed = parseMonthKey(value);
      setCurrentMonth(parsed);
      setSelectedDate(formatDateKey(parsed));
    }
  };

  const formatDateString = (day) => {
    if (!day) return null;
    return `${currentMonth.getFullYear()}-${padNumber(currentMonth.getMonth() + 1)}-${padNumber(day)}`;
  };

  const handleDayClick = (day) => {
    const dateStr = formatDateString(day);
    if (!dateStr) return;
    setSelectedDate(dateStr);
    if (isManager) {
      setCurrentEvent(null);
      setIsEditorOpen(true);
    } else {
      setActiveTab('list');
    }
  };

  const openEditor = (event = null) => {
    if (event?.date) {
      setSelectedDate(event.date);
    } else if (!selectedDate) {
      setSelectedDate(todayKey);
    }
    setCurrentEvent(event);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setCurrentEvent(null);
    setIsEditorOpen(false);
  };

  const handleSaveEvent = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    if (!payload.date) {
      payload.date = selectedDate || todayKey;
    }

    try {
      let result;
      if (currentEvent?.id) {
        result = await updateEvent(currentEvent.id, payload);
      } else {
        result = await createEvent(payload);
      }
      setEvents(result.events);
      toast({
        title: result.synced ? 'Sucesso!' : 'Aviso',
        description: result.synced
          ? 'Evento salvo com sucesso.'
          : 'Evento salvo localmente, mas nao foi possivel sincronizar com o Supabase.',
      });
      closeEditor();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao salvar o evento.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Deseja excluir este evento?')) return;
    const result = await deleteEvent(eventId);
    setEvents(result.events);
    toast({
      title: result.error ? 'Aviso' : 'Sucesso!',
      description: result.error
        ? 'Evento removido localmente, mas nao foi possivel atualizar o Supabase.'
        : 'Evento excluido com sucesso.',
    });
  };

  const communityOptions = useMemo(() => {
    const fromData = (siteData?.communities || []).map((item) => item.name).filter(Boolean);
    const fromEvents = events.map((event) => event.community).filter(Boolean);
    return Array.from(new Set([...fromData, ...fromEvents]));
  }, [siteData, events]);

  const categoryOptions = useMemo(() => {
    const fromEvents = events.map((event) => event.category).filter(Boolean);
    return Array.from(new Set([...eventTypeOptions, ...fromEvents]));
  }, [events]);

  const monthFilterOptions = useMemo(() => {
    const months = events
      .map((event) => formatMonthKey(new Date(`${event.date}T00:00:00`)))
      .filter(Boolean);
    const unique = Array.from(new Set(months));
    if (!unique.includes(formatMonthKey(currentMonth))) {
      unique.push(formatMonthKey(currentMonth));
    }
    unique.sort();
    return unique;
  }, [events, currentMonth]);

  const days = getDaysInMonth(currentMonth);
  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR')
    : 'Selecione um dia';

  const calendarCard = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <p className="text-sm text-gray-500">Clique em um dia para ver os eventos.</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button onClick={() => openEditor()} className="hidden sm:inline-flex">
              <Plus className="h-4 w-4 mr-2" />
              Novo evento
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => handleMonthShift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleMonthShift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => (
          <div
            key={day}
            className="text-center font-semibold text-gray-600 text-sm py-2"
          >
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          if (!day) {
            return <div key={index} className="aspect-square" />;
          }

          const dateStr = formatDateString(day);
          const dayEvents = calendarEvents.filter((event) => event.date === dateStr);
          const isEventDay = dayEvents.length > 0;
          const dayDate = new Date(`${dateStr}T00:00:00`);
          const isPastEventDay = isEventDay && dayDate < todayStart;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleDayClick(day)}
              className={`relative group aspect-square flex items-center justify-center rounded-lg text-sm transition ${
                isEventDay
                  ? 'bg-blue-100 text-blue-700 font-bold hover:bg-blue-200'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
            >
              {day}
              {isEventDay && (
                <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-blue-600" />
              )}
              {isPastEventDay && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900/95 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                  <div className="font-semibold mb-1">
                    {dayDate.toLocaleDateString('pt-BR')}
                  </div>
                  <ul className="space-y-1">
                    {dayEvents.map((event) => (
                      <li key={event.id} className="leading-snug">
                        <span className="font-medium">{event.title}</span>
                        {event.time ? ` - ${event.time}` : ''}
                        {event.location ? ` - ${event.location}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );

  const selectedDayCard = (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-xl shadow-lg p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-1 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-blue-600" />
            Eventos do dia
          </h3>
          <p className="text-sm text-gray-500">{selectedDateLabel}</p>
        </div>
        {isManager && (
          <Button variant="outline" size="sm" onClick={() => openEditor()}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        )}
      </div>
      <div className="mt-4 space-y-4">
        {selectedDateEvents.length > 0 ? (
          selectedDateEvents.map((event) => (
            <div key={event.id} className="border-l-4 border-blue-600 pl-4 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-gray-800">{event.title}</h4>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                    {event.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.time}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    )}
                    {event.recurrence && event.recurrence !== 'none' && (
                      <span className="flex items-center gap-1">
                        <Repeat className="h-3 w-3" />
                        {recurrenceLabels[event.recurrence] || event.recurrence}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {event.community && (
                      <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {event.community}
                      </span>
                    )}
                    {event.category && (
                      <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        {event.category}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-sm text-gray-500 mt-2">{event.description}</p>
                  )}
                </div>
                {isManager && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditor(event)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteEvent(event.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">
            Nenhum evento para este dia.
          </p>
        )}
      </div>
    </motion.div>
  );

  const todayCard = (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-xl shadow-lg p-6"
    >
      <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center">
        <CalendarIcon className="h-5 w-5 mr-2 text-blue-600" />
        Eventos de hoje
      </h3>
      <p className="text-sm text-gray-500 mb-4">{today.toLocaleDateString('pt-BR')}</p>
      <div className="space-y-4">
        {todayEvents.length > 0 ? (
          todayEvents.map((event) => (
            <div key={event.id} className="border-l-4 border-blue-600 pl-4 py-2">
              <h4 className="font-semibold text-gray-800">{event.title}</h4>
              {event.time && (
                <div className="flex items-center text-sm text-gray-600 mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{event.time}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center text-sm text-gray-600 mt-1">
                  <MapPin className="h-3 w-3 mr-1" />
                  <span>{event.location}</span>
                </div>
              )}
              {event.description && (
                <p className="text-sm text-gray-500 mt-2">{event.description}</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">Nenhum evento para hoje.</p>
        )}
      </div>
    </motion.div>
  );

  const upcomingCard = (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-xl shadow-lg p-6"
    >
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <CalendarIcon className="h-5 w-5 mr-2 text-blue-600" />
        Proximos eventos
      </h3>
      <div className="space-y-4">
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map((event) => (
            <div key={event.id} className="border-l-4 border-blue-600 pl-4 py-2">
              <h4 className="font-semibold text-gray-800">{event.title}</h4>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <CalendarIcon className="h-3 w-3 mr-1" />
                <span>
                  {new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR')}
                </span>
              </div>
              {event.time && (
                <div className="flex items-center text-sm text-gray-600 mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{event.time}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center text-sm text-gray-600 mt-1">
                  <MapPin className="h-3 w-3 mr-1" />
                  <span>{event.location}</span>
                </div>
              )}
              {event.description && (
                <p className="text-sm text-gray-500 mt-2">{event.description}</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">Nenhum evento futuro agendado.</p>
        )}
      </div>
    </motion.div>
  );

  const filtersCard = (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-xl shadow-lg p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <RefreshCw className="h-4 w-4 mr-2 text-blue-600" />
          Filtros rapidos
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ month: formatMonthKey(currentMonth), community: 'all', category: 'all' })}
        >
          Limpar
        </Button>
      </div>
      <div className="space-y-3">
        <div>
          <Label htmlFor="filter-month">Mes</Label>
          <select
            id="filter-month"
            value={filters.month}
            onChange={(event) => handleMonthFilterChange(event.target.value)}
            className="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">Todos os meses</option>
            {monthFilterOptions.map((monthKey) => {
              const [year, month] = monthKey.split('-');
              return (
                <option key={monthKey} value={monthKey}>
                  {monthNames[Number(month) - 1]} {year}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <Label htmlFor="filter-community">Comunidade</Label>
          <select
            id="filter-community"
            value={filters.community}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, community: event.target.value }))
            }
            className="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">Todas</option>
            {communityOptions.map((community) => (
              <option key={community} value={community}>
                {community}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filter-category">Tipo</Label>
          <select
            id="filter-category"
            value={filters.category}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, category: event.target.value }))
            }
            className="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">Todos</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <Helmet>
        <title>Agenda de Eventos - Paroquia de Nossa Senhora da Conceicao</title>
        <meta
          name="description"
          content="Confira a agenda de eventos, missas e atividades da Paroquia de Nossa Senhora da Conceicao."
        />
      </Helmet>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Agenda de Eventos</h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Fique por dentro de todas as atividades da nossa paroquia
            </p>
          </motion.div>
        </div>
      </div>

      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {calendarCard}
            </div>
            <div className="lg:col-span-1">
              <div className="space-y-6 sticky top-24">
                {isManager ? filtersCard : null}
                {selectedDayCard}
                {!isManager && (
                  <>
                    {todayCard}
                    {upcomingCard}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="calendar" className="flex-1">
                  Calendario
                </TabsTrigger>
                <TabsTrigger value="list" className="flex-1">
                  Lista
                </TabsTrigger>
                {isManager && (
                  <TabsTrigger value="new" className="flex-1">
                    Novo
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="calendar">{calendarCard}</TabsContent>
              <TabsContent value="list">
                <div className="space-y-6">
                  {isManager ? filtersCard : null}
                  {selectedDayCard}
                  {!isManager && (
                    <>
                      {todayCard}
                      {upcomingCard}
                    </>
                  )}
                </div>
              </TabsContent>
              {isManager && (
                <TabsContent value="new">
                  <div className="bg-white rounded-xl shadow-lg p-6 text-center space-y-4">
                    <p className="text-sm text-gray-600">
                      Cadastre um novo evento para a agenda da paroquia.
                    </p>
                    <Button onClick={() => openEditor()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo evento
                    </Button>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </section>

      {isManager && (
        <Button
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg md:hidden"
          onClick={() => openEditor()}
          aria-label="Novo evento"
        >
          <Plus className="h-5 w-5" />
        </Button>
      )}

      <Dialog open={isEditorOpen} onOpenChange={(open) => (!open ? closeEditor() : null)}>
        <DialogContent className="h-full max-h-screen w-full max-w-md sm:max-w-lg sm:right-0 sm:left-auto sm:top-0 sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border-l">
          <DialogHeader>
            <DialogTitle>{currentEvent ? 'Editar evento' : 'Novo evento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEvent} className="space-y-4">
            <div>
              <Label htmlFor="title">Titulo</Label>
              <Input id="title" name="title" defaultValue={currentEvent?.title || ''} required />
            </div>
            <div>
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={currentEvent?.date || selectedDate || todayKey}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="time">Hora</Label>
                <Input id="time" name="time" type="time" defaultValue={currentEvent?.time || ''} />
              </div>
              <div>
                <Label htmlFor="location">Local</Label>
                <Input id="location" name="location" defaultValue={currentEvent?.location || ''} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="community">Comunidade</Label>
                <select
                  id="community"
                  name="community"
                  defaultValue={currentEvent?.community || ''}
                  className="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Selecione</option>
                  {communityOptions.map((community) => (
                    <option key={community} value={community}>
                      {community}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="category">Tipo</Label>
                <select
                  id="category"
                  name="category"
                  defaultValue={currentEvent?.category || ''}
                  className="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Selecione</option>
                  {eventTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="recurrence">Recorrencia</Label>
              <select
                id="recurrence"
                name="recurrence"
                defaultValue={currentEvent?.recurrence || 'none'}
                className="mt-1 flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {recurrenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="description">Descricao</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={currentEvent?.description || ''}
              />
            </div>
            <DialogFooter className="sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary" onClick={closeEditor}>
                  Cancelar
                </Button>
              </DialogClose>
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

export default Events;
