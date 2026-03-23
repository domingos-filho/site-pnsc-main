import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  HeartHandshake as Handshake,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/contexts/DataContext';
import {
  buildPastoralAgendaHref,
  buildPastoralWhatsAppHref,
  getAllPastoralItems,
  getPastoralCategoryLabel,
  getPastoralSections,
  pastoralMatchesSearch,
} from '@/lib/pastorals';

const SECTION_META = {
  pastorais: {
    icon: BookOpen,
    accent: 'from-blue-700 to-sky-500',
    chip: 'bg-blue-100 text-blue-700',
  },
  movimentos: {
    icon: Users,
    accent: 'from-emerald-700 to-teal-500',
    chip: 'bg-emerald-100 text-emerald-700',
  },
  servicos: {
    icon: Handshake,
    accent: 'from-amber-600 to-orange-500',
    chip: 'bg-amber-100 text-amber-700',
  },
};

const PastoralCard = ({ item }) => {
  const whatsappHref = buildPastoralWhatsAppHref(item.contactWhatsapp);
  const categoryLabel = getPastoralCategoryLabel(item.category);
  const sectionMeta = SECTION_META[item.category] || SECTION_META.pastorais;

  return (
    <article className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div
        className={`relative h-48 bg-gradient-to-br ${sectionMeta.accent}`}
        style={
          item.image
            ? {
                backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.2)), url(${item.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="absolute inset-0 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              {categoryLabel}
            </span>
            {item.featured ? (
              <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Destaque
              </span>
            ) : null}
          </div>

          <div className="mt-10">
            <h3 className="text-2xl font-bold leading-tight">{item.name}</h3>
            <p className="mt-2 max-w-xl text-sm text-white/90">
              {item.summary || item.objective || 'Conheca esse grupo e participe da vida pastoral da paroquia.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Responsavel</p>
            <p className="mt-1 font-medium text-gray-800">{item.contactName || item.responsible || 'A definir'}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Encontros</p>
            <p className="mt-1 font-medium text-gray-800">{item.meeting || 'Conforme calendario'}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          {item.location ? (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-blue-600" />
              <span>{item.location}</span>
            </div>
          ) : null}
          {item.howToParticipate ? (
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-blue-600" />
              <span>{item.howToParticipate}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link to={`/pastorais/${item.slug}`}>
            <Button>
              Saiba mais
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>

          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </a>
          ) : null}

          <Link to={buildPastoralAgendaHref(item)}>
            <Button variant="ghost" className="text-blue-700 hover:text-blue-800">
              <CalendarDays className="mr-2 h-4 w-4" />
              Ver agenda
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
};

const Pastorals = () => {
  const { siteData, loading } = useData();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const sections = useMemo(() => getPastoralSections(siteData.pastorals), [siteData.pastorals]);
  const allItems = useMemo(() => getAllPastoralItems(siteData.pastorals, { activeOnly: true }), [siteData.pastorals]);

  const featuredItems = useMemo(() => {
    const highlighted = allItems.filter((item) => item.featured);
    return (highlighted.length > 0 ? highlighted : allItems).slice(0, 3);
  }, [allItems]);

  const filteredSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.active &&
            (categoryFilter === 'all' || section.key === categoryFilter) &&
            pastoralMatchesSearch(item, search)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [categoryFilter, sections, search]);

  const filteredCount = useMemo(
    () => filteredSections.reduce((total, section) => total + section.items.length, 0),
    [filteredSections]
  );

  if (loading) {
    return <div className="container mx-auto px-4 py-16 text-center text-gray-500">Carregando...</div>;
  }

  return (
    <>
      <Helmet>
        <title>Pastorais, Movimentos e Servicos - Paroquia de Nossa Senhora da Conceicao</title>
        <meta
          name="description"
          content="Conheca os grupos, movimentos e servicos da paroquia, descubra como participar e encontre o caminho ideal para servir."
        />
      </Helmet>

      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%)]">
        <section className="overflow-hidden bg-slate-950 text-white">
          <div className="container mx-auto px-4 py-16">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
              <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-blue-100 backdrop-blur-sm">
                Vida pastoral da comunidade
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
                Encontre onde servir, caminhar e crescer na fe.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-200">
                Conheca as pastorais, movimentos e servicos da paroquia, veja como participar e encontre o grupo que
                melhor combina com seu momento e seus dons.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3"
            >
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-wide text-blue-100">Grupos ativos</p>
                <p className="mt-3 text-4xl font-bold">{allItems.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-wide text-blue-100">Pastorais e movimentos</p>
                <p className="mt-3 text-4xl font-bold">{sections[0].items.length + sections[1].items.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="text-sm uppercase tracking-wide text-blue-100">Servicos de apoio</p>
                <p className="mt-3 text-4xl font-bold">{sections[2].items.length}</p>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-10">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur-sm">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr,1fr]">
              <div>
                <Label htmlFor="pastoral-search">Buscar grupo</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="pastoral-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Nome, objetivo, encontros, participacao..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="pastoral-category">Categoria</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button
                    type="button"
                    variant={categoryFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setCategoryFilter('all')}
                    className="justify-center"
                  >
                    Todos
                  </Button>
                  {sections.map((section) => (
                    <Button
                      key={section.key}
                      type="button"
                      variant={categoryFilter === section.key ? 'default' : 'outline'}
                      onClick={() => setCategoryFilter(section.key)}
                      className="justify-center"
                    >
                      {section.title}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {featuredItems.length > 0 ? (
          <section className="container mx-auto px-4 pb-4">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-3 text-blue-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Destaques para participar</h2>
                <p className="text-sm text-slate-600">Alguns caminhos para comecar sua caminhada pastoral.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              {featuredItems.map((item) => (
                <PastoralCard key={`featured-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        <main className="container mx-auto px-4 py-10">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Todos os grupos</h2>
              <p className="text-sm text-slate-600">
                {filteredCount} grupo{filteredCount === 1 ? '' : 's'} encontrado{filteredCount === 1 ? '' : 's'}.
              </p>
            </div>
          </div>

          {filteredSections.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
              <p className="text-lg font-semibold text-slate-900">Nenhum grupo encontrado.</p>
              <p className="mt-2 text-sm text-slate-600">Ajuste a busca ou troque a categoria para ampliar o resultado.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {filteredSections.map((section, sectionIndex) => {
                const Icon = SECTION_META[section.key]?.icon || BookOpen;
                const chipClass = SECTION_META[section.key]?.chip || 'bg-blue-100 text-blue-700';

                return (
                  <motion.section
                    key={section.key}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: sectionIndex * 0.05 }}
                  >
                    <div className="mb-6 flex items-center gap-4">
                      <div className={`rounded-full p-3 ${chipClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{section.title}</h3>
                        <p className="text-sm text-slate-600">
                          {section.items.length} item{section.items.length === 1 ? '' : 'ns'} nesta categoria.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                      {section.items.map((item) => (
                        <PastoralCard key={item.id} item={item} />
                      ))}
                    </div>
                  </motion.section>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default Pastorals;
