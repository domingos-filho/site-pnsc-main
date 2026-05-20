import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicOrgUnitContent } from '@/hooks/usePublicOrgUnitContent';

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
  const { communities, loading } = usePublicOrgUnitContent();

  if (loading) {
    return <div className="container mx-auto px-4 py-16 text-center text-gray-500">Carregando...</div>;
  }

  const community = communities.find((item) => item.id === id || item.slug === id);

  if (!community) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold text-gray-800">Comunidade não encontrada</h2>
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

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 py-12 text-white">
        <div className="container mx-auto px-4">
          <Link to="/comunidades">
            <Button variant="ghost" className="mb-4 text-white hover:text-blue-100">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Comunidades
            </Button>
          </Link>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold md:text-5xl"
          >
            {community.name}
          </motion.h1>
        </div>
      </div>

      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h2 className="mb-4 text-2xl font-bold text-gray-800">Sobre a Comunidade</h2>
                <p className="leading-relaxed text-gray-600">{community.description}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <h2 className="mb-4 text-2xl font-bold text-gray-800">Galeria de Fotos</h2>
                {galleryImages.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {galleryImages.map((image, index) => (
                      <div key={image.path || image.src || index} className="overflow-hidden rounded-lg shadow-lg">
                        <img
                          className="h-48 w-full object-cover"
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
                className="sticky top-24 rounded-xl bg-blue-50 p-6"
              >
                <h3 className="mb-4 text-xl font-bold text-gray-800">Informações</h3>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <MapPin className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-800">Endereço</p>
                      <p className="text-sm text-gray-600">{community.address || 'Endereço não informado.'}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Clock className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                    <div>
                      <p className="mb-2 font-semibold text-gray-800">Horário de Missas</p>
                      {massEntries.length > 0 ? (
                        massEntries.map((entry, index) => (
                          <p key={index} className="text-sm text-gray-600">
                            {entry}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-gray-600">Horários não informados.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <User className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-800">Coordenador</p>
                      <p className="text-sm text-gray-600">{community.coordinator || 'A definir'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-blue-200 pt-6">
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
