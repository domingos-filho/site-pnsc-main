import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';

const normalizeImages = (community) => {
  const images = Array.isArray(community?.images) ? community.images : [];
  return images
    .map((image, index) => {
      if (!image) return null;
      if (typeof image === 'string') {
        return {
          src: image,
          alt: `${community?.name || 'Comunidade'} - Foto ${index + 1}`,
        };
      }
      if (!image.src) return null;
      return {
        ...image,
        alt: image.alt || `${community?.name || 'Comunidade'} - Foto ${index + 1}`,
      };
    })
    .filter(Boolean);
};

const buildMassEntries = (community) => {
  if (Array.isArray(community?.masses)) {
    return community.masses.map((mass) => `${mass.day}: ${mass.time}`);
  }
  if (!community?.massTimes) return [];
  return community.massTimes
    .split(/\r?\n|;/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const CommunityDetail = () => {
  const { id } = useParams();
  const { siteData, loading } = useData();

  if (loading) {
    return <div>Carregando...</div>;
  }

  const community = siteData.communities.find((item) => item.id === id);

  if (!community) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Comunidade não encontrada</h2>
        <Link to="/comunidades">
          <Button>Voltar para Comunidades</Button>
        </Link>
      </div>
    );
  }

  const galleryImages = normalizeImages(community);
  const massEntries = buildMassEntries(community);

  return (
    <>
      <Helmet>
        <title>{community.name} - Paróquia de Nossa Senhora da Conceição</title>
        <meta name="description" content={community.description || 'Conheça nossa comunidade.'} />
      </Helmet>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-12">
        <div className="container mx-auto px-4">
          <Link to="/comunidades">
            <Button variant="ghost" className="text-white hover:text-blue-100 mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Comunidades
            </Button>
          </Link>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold"
          >
            {community.name}
          </motion.h1>
        </div>
      </div>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Sobre a Comunidade</h2>
                <p className="text-gray-600 leading-relaxed">{community.description}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Galeria de Fotos</h2>
                {galleryImages.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {galleryImages.map((image, index) => (
                      <div
                        key={image.path || image.src || index}
                        className="rounded-lg overflow-hidden shadow-lg"
                      >
                        <img
                          className="w-full h-48 object-cover"
                          alt={image.alt}
                          src={image.thumbSrc || image.src}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhuma foto cadastrada para esta comunidade.</p>
                )}
              </motion.div>
            </div>

            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-blue-50 rounded-xl p-6 sticky top-24"
              >
                <h3 className="text-xl font-bold text-gray-800 mb-4">Informações</h3>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-800">Endereço</p>
                      <p className="text-gray-600 text-sm">{community.address}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Clock className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-800 mb-2">Horário de Missas</p>
                      {massEntries.length > 0 ? (
                        massEntries.map((entry, index) => (
                          <p key={index} className="text-gray-600 text-sm">
                            {entry}
                          </p>
                        ))
                      ) : (
                        <p className="text-gray-600 text-sm">Horários não informados.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <User className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-800">Coordenador</p>
                      <p className="text-gray-600 text-sm">{community.coordinator}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-blue-200">
                  <Link to="/contato">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">Entre em Contato</Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default CommunityDetail;
