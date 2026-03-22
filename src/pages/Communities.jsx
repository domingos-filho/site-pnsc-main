import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Church } from 'lucide-react';
import { useData } from '@/contexts/DataContext';

const Communities = () => {
  const { siteData, loading } = useData();

  if (loading) {
    return <div>Carregando...</div>;
  }

  const { communities } = siteData;

  return (
    <>
      <Helmet>
        <title>Comunidades - Paróquia de Nossa Senhora da Conceição</title>
        <meta name="description" content="Conheça as comunidades que formam a nossa paróquia." />
      </Helmet>
      <div className="bg-gray-50 min-h-screen">
        <header className="bg-gradient-to-br from-blue-800 to-blue-600 text-white text-center py-20">
          <motion.h1
            className="text-5xl font-extrabold"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Nossas Comunidades
          </motion.h1>
          <motion.p
            className="mt-4 text-lg max-w-3xl mx-auto text-blue-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Uma família de fé espalhada por diversos locais.
          </motion.p>
        </header>

        <main className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {communities.map((community, index) => (
              <motion.div
                key={community.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link
                  to={`/comunidades/${community.id}`}
                  className="block bg-white rounded-2xl shadow-md p-8 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 h-full flex flex-col"
                >
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-blue-100 rounded-full mr-4">
                      <Church className="h-6 w-6 text-blue-800" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">{community.name}</h2>
                  </div>
                  <p className="text-gray-600 flex-grow">
                    {community.description
                      ? `${community.description.substring(0, 100)}...`
                      : 'Sem descrição disponível.'}
                  </p>
                  <div className="mt-6 flex justify-end items-center text-blue-700 font-semibold">
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
