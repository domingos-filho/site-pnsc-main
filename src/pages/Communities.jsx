import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Church } from 'lucide-react';
import { usePublicOrgUnitContent } from '@/hooks/usePublicOrgUnitContent';

const Communities = () => {
  const { communities, loading } = usePublicOrgUnitContent();

  if (loading) {
    return <div className="container mx-auto px-4 py-16 text-center text-gray-500">Carregando...</div>;
  }

  return (
    <>
      <Helmet>
        <title>Comunidades - Paróquia de Nossa Senhora da Conceição</title>
        <meta name="description" content="Conheça as comunidades que formam a nossa paróquia." />
      </Helmet>
      <div className="bg-gray-50 min-h-screen">
        <header className="bg-gradient-to-br from-blue-800 to-blue-600 py-20 text-center text-white">
          <motion.h1
            className="text-5xl font-extrabold"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Nossas Comunidades
          </motion.h1>
          <motion.p
            className="mx-auto mt-4 max-w-3xl text-lg text-blue-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Uma família de fé espalhada por diversos locais.
          </motion.p>
        </header>

        <main className="container mx-auto px-4 py-16">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {communities.map((community, index) => (
              <motion.div
                key={community.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link
                  to={`/comunidades/${community.slug || community.id}`}
                  className="flex h-full flex-col rounded-2xl bg-white p-8 shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                >
                  <div className="mb-4 flex items-center">
                    <div className="mr-4 rounded-full bg-blue-100 p-3">
                      <Church className="h-6 w-6 text-blue-800" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">{community.name}</h2>
                  </div>
                  <p className="flex-grow text-gray-600">
                    {community.description
                      ? `${community.description.substring(0, 100)}...`
                      : 'Sem descrição disponível.'}
                  </p>
                  <div className="mt-6 flex items-center justify-end font-semibold text-blue-700">
                    Ver mais <ArrowRight className="ml-2 h-5 w-5" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
};

export default Communities;
