import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, FilterX, Image, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useData } from '@/contexts/DataContext';
import { normalizeGallery } from '@/lib/gallery';
import { loadGalleryCollections } from '@/lib/galleryData';
import { isSupabaseReady } from '@/lib/supabaseClient';

const formatAlbumDate = (album) => {
  if (album?.eventDate) {
    const parsed = new Date(`${album.eventDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR');
    }
  }

  if (album?.year) {
    return String(album.year);
  }

  return 'Data nao informada';
};

const getAlbumCover = (album) => album?.images?.[0]?.thumbSrc || album?.images?.[0]?.src || null;

const getAlbumPhotoCount = (album) => Number(album?.photoCount || album?.images?.length || 0);

const normalizeFilterValue = (value) => String(value || '').trim().toLowerCase();

const Gallery = () => {
  const { siteData, loading } = useData();
  const [albums, setAlbums] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedCommunity, setSelectedCommunity] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const legacyAlbums = useMemo(() => normalizeGallery(siteData.gallery), [siteData.gallery]);

  useEffect(() => {
    let isMounted = true;

    const loadAlbums = async () => {
      if (loading) return;

      if (!isSupabaseReady) {
        if (isMounted) {
          setAlbums(legacyAlbums);
          setLoadingGallery(false);
        }
        return;
      }

      setLoadingGallery(true);

      try {
        const remoteAlbums = await loadGalleryCollections({ publishedOnly: true });
        if (!isMounted) return;

        if (remoteAlbums.length === 0 && legacyAlbums.length > 0) {
          setAlbums(legacyAlbums);
        } else {
          setAlbums(remoteAlbums);
        }
      } catch (error) {
        console.error('Falha ao carregar galeria publica', error);
        if (isMounted) {
          setAlbums(legacyAlbums);
        }
      } finally {
        if (isMounted) {
          setLoadingGallery(false);
        }
      }
    };

    void loadAlbums();

    return () => {
      isMounted = false;
    };
  }, [legacyAlbums, loading]);

  const years = useMemo(
    () =>
      [...new Set(albums.map((album) => album.year).filter(Boolean))].sort(
        (left, right) => Number(right) - Number(left)
      ),
    [albums]
  );

  const communities = useMemo(
    () =>
      [...new Set(albums.map((album) => album.community).filter(Boolean))].sort((left, right) =>
        left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
      ),
    [albums]
  );

  const categories = useMemo(
    () =>
      [...new Set(albums.map((album) => album.category).filter(Boolean))].sort((left, right) =>
        left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
      ),
    [albums]
  );

  const filteredAlbums = useMemo(() => {
    const normalizedSearch = normalizeFilterValue(deferredSearchTerm);

    return albums.filter((album) => {
      const matchesYear = selectedYear === 'all' || String(album.year) === selectedYear;
      const matchesCommunity = selectedCommunity === 'all' || album.community === selectedCommunity;
      const matchesCategory = selectedCategory === 'all' || album.category === selectedCategory;

      const searchableText = [
        album.title,
        album.community,
        album.category,
        album.summary,
        album.description,
        ...(Array.isArray(album.tags) ? album.tags : []),
      ]
        .filter(Boolean)
        .join(' ');

      const matchesSearch =
        !normalizedSearch || normalizeFilterValue(searchableText).includes(normalizedSearch);

      return matchesYear && matchesCommunity && matchesCategory && matchesSearch;
    });
  }, [albums, deferredSearchTerm, selectedCategory, selectedCommunity, selectedYear]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedYear('all');
    setSelectedCommunity('all');
    setSelectedCategory('all');
  };

  if (loading || loadingGallery) {
    return <div>Carregando...</div>;
  }

  return (
    <>
      <Helmet>
        <title>Galeria de Fotos - Paroquia de Nossa Senhora da Conceicao</title>
        <meta
          name="description"
          content="Pesquise eventos, comunidades e celebracoes na galeria da Paroquia de Nossa Senhora da Conceicao."
        />
      </Helmet>

      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 text-white py-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Galeria de Eventos</h1>
            <p className="text-lg md:text-xl text-blue-100 max-w-3xl mx-auto">
              Pesquise por festas, comunidades e celebracoes especificas para encontrar os momentos da paroquia.
            </p>
          </motion.div>
        </div>
      </div>

      <section className="bg-gray-50 py-10 border-b border-blue-100">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_repeat(3,1fr)_auto] gap-4 items-end">
              <div className="space-y-2">
                <label htmlFor="gallery-search" className="text-sm font-medium text-gray-700">
                  Buscar evento
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    id="gallery-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Ex.: Padroeira, Semana Santa, Matriz..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="gallery-year" className="text-sm font-medium text-gray-700">
                  Ano
                </label>
                <select
                  id="gallery-year"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">Todos</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="gallery-community" className="text-sm font-medium text-gray-700">
                  Comunidade
                </label>
                <select
                  id="gallery-community"
                  value={selectedCommunity}
                  onChange={(event) => setSelectedCommunity(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">Todas</option>
                  {communities.map((community) => (
                    <option key={community} value={community}>
                      {community}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="gallery-category" className="text-sm font-medium text-gray-700">
                  Categoria
                </label>
                <select
                  id="gallery-category"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">Todas</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <Button type="button" variant="outline" onClick={clearFilters}>
                <FilterX className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50 min-h-[40vh]">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-blue-700 font-semibold">Resultados</p>
              <h2 className="text-3xl font-bold text-gray-900">
                {filteredAlbums.length} evento{filteredAlbums.length === 1 ? '' : 's'} encontrado
                {filteredAlbums.length === 1 ? '' : 's'}
              </h2>
            </div>
          </div>

          {filteredAlbums.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredAlbums.map((album, index) => {
                const coverSrc = getAlbumCover(album);
                const photoCount = getAlbumPhotoCount(album);

                return (
                  <motion.article
                    key={album.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg transition-shadow"
                  >
                    <Link to={`/galeria/${album.slug}`} className="block">
                      <div className="h-64 bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center overflow-hidden">
                        {coverSrc ? (
                          <img
                            src={coverSrc}
                            alt={album.title}
                            className="w-full h-full object-contain bg-white"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-blue-800">
                            <Image className="h-10 w-10" />
                            <span className="text-sm font-medium">Sem capa</span>
                          </div>
                        )}
                      </div>

                      <div className="p-5 space-y-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2 text-xs">
                            {album.year && (
                              <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-1 font-semibold">
                                {album.year}
                              </span>
                            )}
                            {album.category && (
                              <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 font-semibold">
                                {album.category}
                              </span>
                            )}
                          </div>

                          <h3 className="text-2xl font-bold text-gray-900 leading-tight">{album.title}</h3>

                          {(album.summary || album.description) && (
                            <p className="text-gray-600 line-clamp-2">{album.summary || album.description}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-blue-700 shrink-0" />
                            <span>{formatAlbumDate(album)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Image className="h-4 w-4 text-blue-700 shrink-0" />
                            <span>{photoCount} foto{photoCount === 1 ? '' : 's'}</span>
                          </div>
                          {album.community && (
                            <div className="flex items-center gap-2 sm:col-span-2">
                              <MapPin className="h-4 w-4 text-blue-700 shrink-0" />
                              <span>{album.community}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 text-blue-700 font-semibold">
                          <span>Ver album</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </Link>
                  </motion.article>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Nenhum evento encontrado</h3>
              <p className="text-gray-600 mb-4">
                Tente buscar por outro nome de evento ou remova os filtros para ampliar os resultados.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default Gallery;
