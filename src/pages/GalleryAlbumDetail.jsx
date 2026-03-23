import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Image, MapPin, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';
import { normalizeGallery } from '@/lib/gallery';
import { loadGalleryCollectionBySlug } from '@/lib/galleryData';
import { isSupabaseReady } from '@/lib/supabaseClient';

const formatAlbumDate = (album) => {
  if (album?.eventDate) {
    const parsed = new Date(`${album.eventDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR');
    }
  }

  return album?.year || 'Data não informada';
};

const getAlbumPhotoCount = (album) => Number(album?.photoCount || album?.images?.length || 0);

const GalleryAlbumDetail = () => {
  const { slug } = useParams();
  const { siteData, loading } = useData();
  const [album, setAlbum] = useState(null);
  const [loadingAlbum, setLoadingAlbum] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const legacyAlbums = useMemo(() => normalizeGallery(siteData.gallery), [siteData.gallery]);

  useEffect(() => {
    let isMounted = true;

    const loadAlbum = async () => {
      if (loading) return;

      const legacyMatch = legacyAlbums.find((item) => item.slug === slug) || null;

      if (!isSupabaseReady) {
        if (isMounted) {
          setAlbum(legacyMatch);
          setLoadingAlbum(false);
        }
        return;
      }

      setLoadingAlbum(true);

      try {
        const remoteAlbum = await loadGalleryCollectionBySlug(slug, { publishedOnly: true });
        if (!isMounted) return;

        setAlbum(remoteAlbum || legacyMatch);
      } catch (error) {
        console.error('Falha ao carregar álbum da galeria', error);
        if (isMounted) {
          setAlbum(legacyMatch);
        }
      } finally {
        if (isMounted) {
          setLoadingAlbum(false);
        }
      }
    };

    void loadAlbum();

    return () => {
      isMounted = false;
    };
  }, [legacyAlbums, loading, slug]);

  if (loading || loadingAlbum) {
    return <div>Carregando...</div>;
  }

  if (!album) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Álbum não encontrado</h1>
          <p className="text-gray-600 mb-6">
            O evento que você tentou abrir não existe ou ainda não foi publicado.
          </p>
          <Link to="/galeria">
            <Button>Voltar para a galeria</Button>
          </Link>
        </div>
      </div>
    );
  }

  const photoCount = getAlbumPhotoCount(album);

  return (
    <>
      <Helmet>
        <title>{album.title} - Galeria</title>
        <meta
          name="description"
          content={album.summary || album.description || `Veja as fotos do evento ${album.title}.`}
        />
      </Helmet>

      <section className="bg-gradient-to-br from-blue-800 via-blue-700 to-sky-600 text-white py-14">
        <div className="container mx-auto px-4">
          <Link to="/galeria" className="inline-flex items-center gap-2 text-blue-100 hover:text-white mb-6">
            <ArrowLeft className="h-4 w-4" />
            Voltar para a galeria
          </Link>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              {album.year && (
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur-sm">
                  {album.year}
                </span>
              )}
              {album.category && (
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur-sm">
                  {album.category}
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">{album.title}</h1>

            {(album.summary || album.description) && (
              <p className="text-lg text-blue-100 max-w-3xl">{album.summary || album.description}</p>
            )}

            <div className="flex flex-wrap gap-5 mt-6 text-blue-50">
              <div className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>{formatAlbumDate(album)}</span>
              </div>
              {album.community && (
                <div className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{album.community}</span>
                </div>
              )}
              <div className="inline-flex items-center gap-2">
                <Image className="h-4 w-4" />
                <span>{photoCount} foto{photoCount === 1 ? '' : 's'}</span>
              </div>
            </div>

            {Array.isArray(album.tags) && album.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5">
                {album.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/galeria?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm backdrop-blur-sm hover:bg-white/20"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          {album.images.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {album.images.map((photo, index) => (
                <motion.button
                  key={photo.id || photo.path || photo.src}
                  type="button"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-lg transition-shadow text-left"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <div className="h-72 bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
                    <img
                      src={photo.thumbSrc || photo.src}
                      alt={photo.alt || album.title}
                      className="w-full h-full object-contain bg-white"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-600">
              Nenhuma foto publicada neste álbum.
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(selectedPhoto)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPhoto(null);
          }
        }}
      >
        <DialogContent className="max-w-[95vw] w-auto p-2 bg-transparent border-none shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Visualizar foto</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <img
              src={selectedPhoto.mediumSrc || selectedPhoto.src}
              alt={selectedPhoto.alt || album.title}
              className="max-h-[85vh] max-w-[95vw] object-contain rounded-md bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GalleryAlbumDetail;
