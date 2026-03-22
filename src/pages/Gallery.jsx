import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useData } from '@/contexts/DataContext';
import { normalizeGallery } from '@/lib/gallery';
import { loadGalleryCollections } from '@/lib/galleryData';
import { isSupabaseReady } from '@/lib/supabaseClient';

const Gallery = () => {
  const { siteData, loading } = useData();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(true);

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

  const albumsByYear = useMemo(() => {
    return albums.reduce((acc, album) => {
      const year = album.year || 'Sem Ano';
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(album);
      return acc;
    }, {});
  }, [albums]);

  if (loading || loadingGallery) {
    return <div>Carregando...</div>;
  }

  const sortedYears = Object.keys(albumsByYear).sort((left, right) => {
    if (left === 'Sem Ano') return 1;
    if (right === 'Sem Ano') return -1;
    return Number(right) - Number(left);
  });

  return (
    <>
      <Helmet>
        <title>Galeria de Fotos - Paróquia de Nossa Senhora da Conceição</title>
        <meta
          name="description"
          content="Reveja os momentos especiais da nossa paróquia através da galeria de fotos."
        />
      </Helmet>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Galeria de Fotos</h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Recorde os momentos marcantes da nossa caminhada de fé.
            </p>
          </motion.div>
        </div>
      </div>

      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          {sortedYears.map((year) => (
            <div key={year} className="mb-16">
              <h2 className="text-4xl font-bold text-blue-800 mb-8 border-b-2 border-blue-200 pb-2">{year}</h2>
              {(albumsByYear[year] || []).map((album) => (
                <div key={album.id} className="mb-12">
                  <div className="mb-6">
                    <h3 className="text-2xl font-semibold text-gray-700">{album.title}</h3>
                    {album.community && <p className="text-sm text-gray-500 mt-1">{album.community}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {album.images.map((photo) => (
                      <motion.div
                        key={photo.id || photo.path || photo.src}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 bg-white"
                      >
                        <button
                          type="button"
                          className="block w-full h-full cursor-zoom-in"
                          onClick={() =>
                            setSelectedPhoto({
                              src: photo.src,
                              alt: photo.alt || `Foto do álbum ${album.title}`,
                            })
                          }
                          aria-label="Ampliar foto"
                        >
                          <img
                            src={photo.thumbSrc || photo.src}
                            alt={photo.alt || `Foto do álbum ${album.title}`}
                            className="w-full h-48 object-contain bg-white"
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  {album.images.length === 0 && (
                    <p className="text-gray-500">Nenhuma foto neste álbum ainda.</p>
                  )}
                </div>
              ))}
            </div>
          ))}
          {sortedYears.length === 0 && (
            <p className="text-center text-gray-500 text-lg">Nenhum álbum de fotos encontrado.</p>
          )}
        </div>
      </section>
      <Dialog
        open={Boolean(selectedPhoto)}
        onOpenChange={(open) => {
          if (!open) setSelectedPhoto(null);
        }}
      >
        <DialogContent className="max-w-[95vw] w-auto p-2 bg-transparent border-none shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Visualizar foto</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <img
              src={selectedPhoto.src}
              alt={selectedPhoto.alt}
              className="max-h-[85vh] max-w-[95vw] object-contain rounded-md bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Gallery;
