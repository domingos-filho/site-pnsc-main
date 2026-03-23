import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  eventOccursOnDate,
  formatDateKey,
  formatMonthKey,
  formatMonthLabel,
  getMonthGrid,
  isSameDate,
  parseMonthKey,
} from '@/lib/calendarView';
import { loadPublicCalendarData } from '@/lib/calendarData';
import { loadEvents } from '@/lib/supabaseData';

const CALENDAR_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const mapLegacyEvent = (event) => {
  const startsAt = event.time
    ? new Date(`${event.date}T${event.time}`)
    : new Date(`${event.date}T00:00:00`);
  const endsAt = event.time
    ? new Date(startsAt.getTime() + 60 * 60 * 1000)
    : new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);

  return {
    id: `legacy-${event.id}`,
    slug: '',
    title: event.title || '',
    summary: '',
    description: event.description || '',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timezone: 'America/Fortaleza',
    isAllDay: !event.time,
    status: 'confirmed',
    visibility: 'public',
    eventTypeId: '',
    eventTypeName: event.category || '',
    eventTypeColor: '#1d4ed8',
    community: event.community || '',
    category: event.category || '',
    locationText: event.location || '',
    organizerName: '',
    organizerPhone: '',
    organizerEmail: '',
    expectedAttendance: null,
    recurrenceRule: event.recurrence || '',
    recurrenceUntil: '',
    bookingOrigin: 'legacy',
    publishedAt: null,
    resourceId: '',
    resourceName: event.location || '',
    resources: [],
    createdAt: null,
    updatedAt: null,
  };
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Confirmado';
  }
};

const getStatusClasses = (status) => {
  switch (status) {
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-blue-100 text-blue-700';
  }
};

const getVisibilityLabel = (visibility) => {
  switch (visibility) {
    case 'internal':
      return 'Interno';
    default:
      return 'Publico';
  }
};

const getVisibilityClasses = (visibility) => {
  switch (visibility) {
    case 'internal':
      return 'bg-violet-100 text-violet-700';
    default:
      return 'bg-emerald-100 text-emerald-700';
  }
};

const formatEventDate = (event) => {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);

  if (event.isAllDay) {
    return start.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  if (isSameDate(start, end)) {
    return `${start.toLocaleDateString('pt-BR')} • ${start.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })} - ${end.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  return `${start.toLocaleString('pt-BR')} ate ${end.toLocaleString('pt-BR')}`;
};

const formatSelectedDayLabel = (dateKey) => {
  if (!dateKey) return 'Selecione um dia';

  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const EventCard = ({ event }) => (
  <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
        {event.summary ? <p className="text-sm text-gray-500 mt-1">{event.summary}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {event.visibility === 'internal' ? (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getVisibilityClasses(event.visibility)}`}
          >
            <Shield className="mr-1 h-3.5 w-3.5" />
            {getVisibilityLabel(event.visibility)}
          </span>
        ) : null}
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(event.status)}`}>
          {getStatusLabel(event.status)}
        </span>
      </div>
    </div>

    <div className="space-y-2 text-sm text-gray-600">
      <div className="flex items-start gap-2">
        <CalendarIcon className="h-4 w-4 mt-0.5 text-blue-600" />
        <span>{formatEventDate(event)}</span>
      </div>
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 mt-0.5 text-blue-600" />
        <span>{event.resourceName || event.locationText || 'Local a definir'}</span>
      </div>
      {event.organizerName ? (
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 mt-0.5 text-blue-600" />
          <span>Responsavel: {event.organizerName}</span>
        </div>
      ) : null}
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {event.community ? (
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{event.community}</span>
      ) : null}
      {event.eventTypeName ? (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{event.eventTypeName}</span>
      ) : null}
      {event.recurrenceRule ? (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">{event.recurrenceRule}</span>
      ) : null}
    </div>

    {event.description ? <p className="mt-4 text-sm leading-6 text-gray-600">{event.description}</p> : null}
  </article>
);

const CompactEventCard = ({ event }) => (
  <div className="rounded-xl border border-gray-100 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-gray-900">{event.title}</h3>
        <p className="mt-1 text-sm text-gray-500">{formatEventDate(event)}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {event.visibility === 'internal' ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${getVisibilityClasses(event.visibility)}`}
          >
            <Shield className="mr-1 h-3 w-3" />
            Interno
          </span>
        ) : null}
        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusClasses(event.status)}`}>
          {getStatusLabel(event.status)}
        </span>
      </div>
    </div>

    <div className="mt-3 space-y-2 text-sm text-gray-600">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 text-blue-600" />
        <span>{event.resourceName || event.locationText || 'Local a definir'}</span>
      </div>
      {event.description ? <p className="leading-6 text-gray-600">{event.description}</p> : null}
    </div>
  </div>
);

const Events = () => {
  const { user, isMember, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const today = new Date();
  const [events, setEvents] = useState([]);
  const [source, setSource] = useState('calendar');
  const [activeView, setActiveView] = useState('list');
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState(formatDateKey(today));
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    month: 'all',
    category: 'all',
    location: 'all',
  });

  const refreshEvents = async () => {
    setIsLoading(true);

    const result = await loadPublicCalendarData();

    if (result.error) {
      const fallback = await loadEvents({ useLocalFallback: true, syncPending: false });
      setEvents((fallback.events || []).map(mapLegacyEvent));
      setSource('legacy');
      toast({
        title: 'Aviso',
        description: 'A agenda publica entrou em modo legado por falha na leitura da agenda v2.',
      });
      setIsLoading(false);
      return;
    }

    setEvents(result.events || []);
    setSource('calendar');
    setIsLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    void refreshEvents();
  }, [authLoading, user?.id]);

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(events.map((event) => event.eventTypeName || event.category).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [events]
  );

  const locationOptions = useMemo(
    () =>
      Array.from(new Set(events.map((event) => event.resourceName || event.locationText).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [events]
  );

  const monthOptions = useMemo(() => {
    const unique = Array.from(new Set(events.map((event) => formatMonthKey(event.startsAt)).filter(Boolean)));
    const currentMonthKey = formatMonthKey(currentMonth);
    if (currentMonthKey && !unique.includes(currentMonthKey)) {
      unique.push(currentMonthKey);
    }
    return unique.sort();
  }, [currentMonth, events]);

  const filteredEvents = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return events.filter((event) => {
      if (filters.month !== 'all' && formatMonthKey(event.startsAt) !== filters.month) return false;
      if (filters.category !== 'all' && (event.eventTypeName || event.category) !== filters.category) return false;
      if (filters.location !== 'all' && (event.resourceName || event.locationText) !== filters.location) return false;

      if (!searchTerm) return true;

      const haystack = [
        event.title,
        event.summary,
        event.description,
        event.community,
        event.eventTypeName,
        event.category,
        event.locationText,
        event.resourceName,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchTerm);
    });
  }, [events, filters]);

  const todayEvents = useMemo(
    () => filteredEvents.filter((event) => isSameDate(new Date(event.startsAt), today)).slice(0, 5),
    [filteredEvents, today]
  );

  const upcomingEvents = useMemo(
    () => filteredEvents.filter((event) => new Date(event.endsAt) >= today).slice(0, 6),
    [filteredEvents, today]
  );

  const groupedEvents = useMemo(() => {
    return filteredEvents.reduce((accumulator, event) => {
      const monthKey = formatMonthKey(event.startsAt);
      if (!accumulator[monthKey]) {
        accumulator[monthKey] = [];
      }
      accumulator[monthKey].push(event);
      return accumulator;
    }, {});
  }, [filteredEvents]);

  const internalEventCount = useMemo(
    () => filteredEvents.filter((event) => event.visibility === 'internal').length,
    [filteredEvents]
  );

  const monthGrid = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);

  const eventsByDate = useMemo(() => {
    return monthGrid.reduce((accumulator, day) => {
      if (!day) return accumulator;

      const dateKey = formatDateKey(day);
      const dayEvents = filteredEvents
        .filter((event) => eventOccursOnDate(event, day))
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

      if (dayEvents.length > 0) {
        accumulator[dateKey] = dayEvents;
      }

      return accumulator;
    }, {});
  }, [filteredEvents, monthGrid]);

  const selectedDateEvents = useMemo(() => {
    return (eventsByDate[selectedDate] || []).slice().sort((left, right) => {
      return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
    });
  }, [eventsByDate, selectedDate]);

  const handleMonthShift = (delta) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(nextMonth);

    if (filters.month !== 'all') {
      setFilters((prev) => ({ ...prev, month: formatMonthKey(nextMonth) }));
    }

    if (formatMonthKey(selectedDate) !== formatMonthKey(nextMonth)) {
      setSelectedDate(formatDateKey(nextMonth));
    }
  };

  const handleMonthFilterChange = (value) => {
    setFilters((prev) => ({ ...prev, month: value }));

    if (value === 'all') return;

    const parsedMonth = parseMonthKey(value);
    if (!parsedMonth) return;

    setCurrentMonth(parsedMonth);
    setSelectedDate(formatDateKey(parsedMonth));
  };

  return (
    <>
      <Helmet>
        <title>Agenda - Paroquia de Nossa Senhora da Conceicao</title>
      </Helmet>

      <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
            <h1 className="text-4xl font-bold md:text-5xl">Agenda Paroquial</h1>
            <p className="mt-4 text-lg text-blue-100">
              Consulte missas, encontros, reunioes e demais compromissos da paroquia de forma simples e pratica.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-10 bg-gray-50">
        <div className="container mx-auto px-4 space-y-8">
          {source === 'legacy' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              A agenda publica esta exibindo o modo legado temporariamente.
            </div>
          ) : null}

          {source === 'calendar' && user && isMember && internalEventCount > 0 ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
              Voce esta vendo eventos internos porque esta autenticado. Esses compromissos nao aparecem para visitantes.
            </div>
          ) : null}

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Label htmlFor="agenda-search">Buscar evento</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="agenda-search"
                    value={filters.search}
                    onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                    placeholder="Titulo, descricao, local..."
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="agenda-month">Mes</Label>
                <select
                  id="agenda-month"
                  value={filters.month}
                  onChange={(event) => handleMonthFilterChange(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">Todos</option>
                  {monthOptions.map((monthKey) => (
                    <option key={monthKey} value={monthKey}>
                      {formatMonthLabel(monthKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="agenda-category">Tipo</Label>
                <select
                  id="agenda-category"
                  value={filters.category}
                  onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">Todos</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="agenda-location">Espaco</Label>
                <select
                  id="agenda-location"
                  value={filters.location}
                  onChange={(event) => setFilters((prev) => ({ ...prev, location: event.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">Todos</option>
                  {locationOptions.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => refreshEvents()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar agenda
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-2xl bg-white px-6 py-12 text-center text-gray-500 shadow-sm ring-1 ring-gray-100">
              Carregando agenda...
            </div>
          ) : (
            <Tabs value={activeView} onValueChange={setActiveView}>
              <TabsList className="w-full justify-start sm:w-auto">
                <TabsTrigger value="list">Lista</TabsTrigger>
                <TabsTrigger value="calendar">Calendario</TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="space-y-8">
                {todayEvents.length > 0 ? (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Hoje</h2>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {todayEvents.map((event) => (
                        <EventCard key={`today-${event.id}`} event={event} />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Proximos eventos</h2>
                  {upcomingEvents.length === 0 ? (
                    <div className="rounded-2xl bg-white px-6 py-10 text-center text-gray-500 shadow-sm ring-1 ring-gray-100">
                      Nenhum evento encontrado.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {upcomingEvents.map((event) => (
                        <EventCard key={`upcoming-${event.id}`} event={event} />
                      ))}
                    </div>
                  )}
                </div>

                {Object.keys(groupedEvents).length > 0 ? (
                  <div className="space-y-8">
                    {Object.entries(groupedEvents).map(([monthKey, monthEvents]) => (
                      <div key={monthKey}>
                        <h2 className="mb-4 text-2xl font-bold capitalize text-gray-900">{formatMonthLabel(monthKey)}</h2>
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          {monthEvents.map((event) => (
                            <EventCard key={event.id} event={event} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="calendar">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr,1fr]">
                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-bold capitalize text-gray-900">
                          {formatMonthLabel(formatMonthKey(currentMonth))}
                        </h2>
                        <p className="text-sm text-gray-500">Clique em um dia para ver os eventos desse periodo.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleMonthShift(-1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleMonthShift(1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {CALENDAR_WEEKDAYS.map((day) => (
                        <div key={day} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {day}
                        </div>
                      ))}

                      {monthGrid.map((day, index) => {
                        if (!day) {
                          return <div key={`empty-${index}`} className="aspect-square rounded-xl bg-transparent" />;
                        }

                        const dateKey = formatDateKey(day);
                        const dayEvents = eventsByDate[dateKey] || [];
                        const hasInternalEvent = dayEvents.some((event) => event.visibility === 'internal');
                        const isToday = isSameDate(day, today);
                        const isSelected = selectedDate === dateKey;

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => setSelectedDate(dateKey)}
                            className={`aspect-square rounded-xl border p-2 text-left transition ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                            }`}
                          >
                            <div className="flex h-full flex-col justify-between">
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-sm font-semibold ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                                  {day.getDate()}
                                </span>
                                {dayEvents.length > 0 ? (
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                    {dayEvents.length}
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-1">
                                {dayEvents.length > 0 ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                                {hasInternalEvent ? <span className="h-2 w-2 rounded-full bg-violet-500" /> : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                    <div className="mb-5">
                      <h2 className="text-xl font-bold text-gray-900">Eventos do dia</h2>
                      <p className="mt-1 text-sm capitalize text-gray-500">{formatSelectedDayLabel(selectedDate)}</p>
                    </div>

                    <div className="space-y-4">
                      {selectedDateEvents.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                          Nenhum evento encontrado para esse dia.
                        </div>
                      ) : (
                        selectedDateEvents.map((event) => <CompactEventCard key={`calendar-${event.id}`} event={event} />)
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </section>
    </>
  );
};

export default Events;
