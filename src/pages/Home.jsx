import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Church,
  Image as ImageIcon,
  Phone,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useData } from '@/contexts/DataContext';

const HeroSection = () => {
  const { siteData } = useData();

  return (
    <section className="bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-1 gap-12 items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-5xl font-extrabold text-blue-900 leading-tight">
              Bem-vindo à sua casa de fé
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">{siteData.home.welcomeMessage}</p>
            <Link to="/quem-somos">
              <Button size="lg" className="mt-8">
                Conheça nossa história <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const CarouselSection = () => {
  const { siteData } = useData();
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    if (siteData.home.heroImages.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % siteData.home.heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [siteData.home.heroImages.length]);

  if (siteData.home.heroImages.length === 0) {
    return null;
  }

  const currentImage = siteData.home.heroImages[currentIndex];
  const currentImageSrc = currentImage?.thumbSrc || currentImage?.src;

  return (
    <section className="relative w-full h-[60vh] overflow-hidden bg-blue-900">
      <motion.div
        key={currentImage?.id}
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: 'easeInOut' }}
      >
        <img
          src={currentImageSrc}
          alt={currentImage?.alt}
          className="w-full h-full object-contain"
          loading="eager"
          decoding="async"
        />
      </motion.div>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center text-white p-4">
        <motion.h2
          className="text-3xl md:text-5xl font-bold tracking-tight drop-shadow-lg"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Momentos da nossa Comunidade
        </motion.h2>
      </div>
    </section>
  );
};

const PatronessSection = () => {
  const { siteData } = useData();
  const fallbackImage = '/assets/Imagem_da_Santa.png';
  const patronessSrc =
    siteData.home.patronessThumb || siteData.home.patronessImage || fallbackImage;

  return (
    <section className="bg-white py-20">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <img
              src={patronessSrc}
              alt="Imagem de Nossa Senhora da Conceição"
              className="max-h-96"
              onError={(event) => {
                event.currentTarget.src = fallbackImage;
              }}
              loading="lazy"
              decoding="async"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-4">
              Nossa Padroeira, Nossa Senhora da Conceição
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">{siteData.home.patronessText}</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Shortcuts = () => {
  const shortcuts = [
    { to: '/comunidades', icon: Church, label: 'Comunidades' },
    { to: '/agenda', icon: Calendar, label: 'Agenda' },
    { to: '/galeria', icon: ImageIcon, label: 'Galeria' },
    { to: '/pastorais', icon: Users, label: 'Pastorais' },
    { to: '/contato', icon: Phone, label: 'Contato' },
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 text-center">
          {shortcuts.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link to={item.to}>
                <Button
                  variant="outline"
                  className="w-full h-32 flex flex-col justify-center items-center gap-2 text-lg bg-white hover:bg-blue-50 hover:shadow-lg transition-all duration-300 group"
                >
                  <item.icon className="h-8 w-8 text-blue-800 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold">{item.label}</span>
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const NewsSection = () => {
  const { siteData } = useData();
  const [selectedNews, setSelectedNews] = useState(null);
  const scrollerRef = useRef(null);

  const now = new Date();
  const settings = siteData.home.newsSettings || { autoplay: true, intervalSeconds: 6 };
  const items = (siteData.home.news || [])
    .filter((item) => {
      const startAt = item.startAt ? new Date(item.startAt) : null;
      const endAt = item.endAt ? new Date(item.endAt) : null;
      if (startAt && now < startAt) return false;
      if (endAt && now > endAt) return false;
      return true;
    })
    .sort((a, b) => {
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pinDiff !== 0) return pinDiff;
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });

  if (items.length === 0) {
    return null;
  }

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-BR');
  };

  const scrollByAmount = useCallback((direction) => {
    if (!scrollerRef.current) return;
    const amount = scrollerRef.current.clientWidth * 0.9;
    scrollerRef.current.scrollBy({ left: amount * direction, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!settings.autoplay || items.length < 2) return;
    const intervalMs = Math.max(2000, Number(settings.intervalSeconds || 6) * 1000);
    const timer = setInterval(() => scrollByAmount(1), intervalMs);
    return () => clearInterval(timer);
  }, [items.length, scrollByAmount, settings.autoplay, settings.intervalSeconds]);

  return (
    <>
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-blue-900">Notícias e Divulgações</h2>
              <p className="text-gray-600 mt-2">Fique por dentro dos avisos e novidades da nossa paróquia.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => scrollByAmount(-1)}
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => scrollByAmount(1)}
                aria-label="Avançar"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            ref={scrollerRef}
            className="flex gap-6 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory"
          >
            {items.map((item) => (
              <article
                key={item.id}
                className="min-w-[280px] sm:min-w-[360px] lg:min-w-[420px] snap-start bg-white border border-blue-100 rounded-2xl shadow-sm hover:shadow-lg transition-shadow"
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => setSelectedNews(item)}
                >
                  <div className="h-48 bg-blue-50 rounded-t-2xl overflow-hidden flex items-center justify-center">
                    {item.thumb || item.image ? (
                      <img
                        src={item.thumb || item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="text-blue-700 font-semibold">Sem imagem</div>
                    )}
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-blue-700 font-semibold">
                      {item.category && (
                        <span className="px-2 py-1 bg-blue-100 rounded-full">{item.category}</span>
                      )}
                      {item.pinned && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">Destaque</span>
                      )}
                      {item.date && <span className="text-gray-500">{formatDate(item.date)}</span>}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-600">{item.summary}</p>
                  </div>
                </button>
                <div className="px-5 pb-5 flex justify-between items-center">
                  {item.ctaUrl ? (
                    <a
                      href={item.ctaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 font-semibold text-sm hover:underline"
                    >
                      {item.ctaLabel || 'Saiba mais'}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="text-blue-700 font-semibold text-sm hover:underline"
                      onClick={() => setSelectedNews(item)}
                    >
                      Saiba mais
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Dialog open={Boolean(selectedNews)} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className="max-w-2xl">
          {selectedNews && (
            <div className="space-y-4">
              <div className="h-52 rounded-xl overflow-hidden bg-blue-50 flex items-center justify-center">
                {selectedNews.image || selectedNews.thumb ? (
                  <img
                    src={selectedNews.image || selectedNews.thumb}
                    alt={selectedNews.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-blue-700 font-semibold">Sem imagem</div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 text-xs text-blue-700 font-semibold">
                  {selectedNews.category && (
                    <span className="px-2 py-1 bg-blue-100 rounded-full">{selectedNews.category}</span>
                  )}
                  {selectedNews.date && <span className="text-gray-500">{formatDate(selectedNews.date)}</span>}
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedNews.title}</h3>
                <p className="text-gray-600 whitespace-pre-line">
                  {selectedNews.content || selectedNews.summary}
                </p>
              </div>
              {selectedNews.ctaUrl && (
                <a
                  href={selectedNews.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-700 font-semibold hover:underline"
                >
                  {selectedNews.ctaLabel || 'Saiba mais'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const Home = () => {
  return (
    <>
      <Helmet>
        <title>Início - Paróquia de Nossa Senhora da Conceição</title>
        <meta
          name="description"
          content="Bem-vindo ao site da Paróquia de Nossa Senhora da Conceição em Nova Parnamirim. Conheça nossa comunidade, agenda de eventos, pastorais e muito mais."
        />
      </Helmet>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <HeroSection />
        <CarouselSection />
        <NewsSection />
        <PatronessSection />
        <Shortcuts />
      </motion.div>
    </>
  );
};

export default Home;

