import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Target,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { loadPublicCalendarData } from '@/lib/calendarData';
import {
  buildPastoralAgendaHref,
  buildPastoralWhatsAppHref,
  findPastoralBySlug,
  getPastoralCategoryLabel,
} from '@/lib/pastorals';

const formatEventDate = (event) => {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);

  if (event.isAllDay) {
    return start.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  if (start.toDateString() === end.toDateString()) {
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

const buildAgendaTerms = (pastoral) =>
  Array.from(
    new Set(
      [pastoral?.agendaQuery, pastoral?.name]
        .flatMap((value) => String(value || '').split(/[;,]/))
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );

const matchesPastoralEvent = (event, pastoral) => {
  const terms = buildAgendaTerms(pastoral);
  if (terms.length === 0) return false;

  const haystack = [
    event.title,
    event.summary,
    event.description,
    event.community,
    event.eventTypeName,
    event.locationText,
    event.resourceName,
  ]
    .join(' ')
    .toLowerCase();

  return terms.some((term) => haystack.includes(term));
};

const PastoralDetail = () => {
  const { slug } = useParams();
  const { siteData, loading } = useData();
  const { loading: authLoading } = useAuth();
  const [relatedEvents, setRelatedEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const pastoral = useMemo(() => findPastoralBySlug(siteData.pastorals, slug), [siteData.pastorals, slug]);

  useEffect(() => {
    let isMounted = true;

    const loadRelatedEvents = async () => {
      if (!pastoral || authLoading) return;

      setLoadingEvents(true);
      const result = await loadPublicCalendarData();

      if (!isMounted) return;

      if (result.error) {
        setRelatedEvents([]);
        setLoadingEvents(false);
        return;
      }

      setRelatedEvents((result.events || []).filter((event) => matchesPastoralEvent(event, pastoral)));
      setLoadingEvents(false);
    };

    void loadRelatedEvents();

    return () => {
      isMounted = false;
    };
  }, [authLoading, pastoral]);

  const whatsappHref = pastoral ? buildPastoralWhatsAppHref(pastoral.contactWhatsapp) : '';
  const agendaHref = pastoral ? buildPastoralAgendaHref(pastoral) : '/agenda';

  if (loading) {
    return <div className="container mx-auto px-4 py-16 text-center text-gray-500">Carregando...</div>;
  }

  if (!pastoral) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">Grupo nao encontrado</h1>
          <p className="mt-3 text-gray-600">A pastoral ou movimento que voce tentou abrir nao esta disponivel.</p>
          <Link to="/pastorais" className="mt-6 inline-flex">
            <Button>Voltar para pastorais</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pastoral.name} - Paroquia de Nossa Senhora da Conceicao</title>
        <meta
          name="description"
          content={pastoral.summary || pastoral.objective || `Conheca ${pastoral.name} e saiba como participar.`}
        />
      </Helmet>

      <section
        className="relative overflow-hidden bg-slate-950 py-16 text-white"
        style={
          pastoral.image
            ? {
                backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.78), rgba(30, 41, 59, 0.7)), url(${pastoral.image})`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
              }
            : undefined
        }
      >
        <div className="container mx-auto px-4">
          <Link to="/pastorais" className="inline-flex items-center gap-2 text-blue-100 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Voltar para pastorais
          </Link>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8 max-w-4xl">
            <span className="inline-flex rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">
              {getPastoralCategoryLabel(pastoral.category)}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">{pastoral.name}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">
              {pastoral.summary || pastoral.objective || 'Conheca este grupo da paroquia e descubra como participar.'}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={agendaHref}>
                <Button>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Ver agenda
                </Button>
              </Link>
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Falar no WhatsApp
                  </Button>
                </a>
              ) : null}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-gray-50 py-12">
        <div className="container mx-auto grid grid-cols-1 gap-8 px-4 xl:grid-cols-[1.6fr,1fr]">
          <div className="space-y-8">
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
              <h2 className="text-2xl font-bold text-slate-900">Sobre este grupo</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-blue-50 p-5">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Target className="h-5 w-5" />
                    <h3 className="font-semibold">Objetivo</h3>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {pastoral.objective || pastoral.summary || 'Objetivo ainda nao informado.'}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Users className="h-5 w-5" />
                    <h3 className="font-semibold">Como participar</h3>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {pastoral.howToParticipate || 'Entre em contato com a paroquia para saber como ingressar.'}
                  </p>
                </div>
              </div>

              {pastoral.audience ? (
                <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Para quem e</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{pastoral.audience}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Proximos eventos relacionados</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Encontros, celebracoes ou atividades que combinam com este grupo.
                  </p>
                </div>
                <Link to={agendaHref}>
                  <Button variant="outline">Abrir agenda</Button>
                </Link>
              </div>

              <div className="mt-6 space-y-4">
                {loadingEvents ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
                    Carregando eventos...
                  </div>
                ) : relatedEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
                    Nenhum evento relacionado encontrado no momento.
                  </div>
                ) : (
                  relatedEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
                          <p className="mt-1 text-sm text-slate-600">{formatEventDate(event)}</p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {event.eventTypeName || 'Evento'}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 text-blue-600" />
                          <span>{event.resourceName || event.locationText || 'Local a definir'}</span>
                        </div>
                        {event.description ? <p className="leading-7">{event.description}</p> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-100 xl:sticky xl:top-24">
              <h2 className="text-xl font-bold text-slate-900">Informacoes rapidas</h2>

              <div className="mt-6 space-y-5 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Responsavel</p>
                  <p className="mt-1 font-medium text-slate-900">{pastoral.contactName || pastoral.responsible || 'A definir'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Encontros</p>
                  <p className="mt-1">{pastoral.meeting || 'Conforme calendario'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Local</p>
                  <p className="mt-1">{pastoral.location || 'A definir'}</p>
                </div>
                {pastoral.contactPhone ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Telefone</p>
                    <a href={`tel:${pastoral.contactPhone}`} className="mt-1 inline-flex items-center gap-2 text-blue-700 hover:text-blue-800">
                      <Phone className="h-4 w-4" />
                      {pastoral.contactPhone}
                    </a>
                  </div>
                ) : null}
                {pastoral.contactEmail ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">E-mail</p>
                    <a href={`mailto:${pastoral.contactEmail}`} className="mt-1 inline-flex items-center gap-2 text-blue-700 hover:text-blue-800">
                      <Mail className="h-4 w-4" />
                      {pastoral.contactEmail}
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="mt-8 space-y-3">
                {whatsappHref ? (
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="block">
                    <Button className="w-full">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Conversar no WhatsApp
                    </Button>
                  </a>
                ) : null}
                <Link to={agendaHref} className="block">
                  <Button variant="outline" className="w-full">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Ver agenda relacionada
                  </Button>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
};

export default PastoralDetail;
