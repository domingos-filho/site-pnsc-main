import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { BookOpen, Users, HeartHandshake as Handshake } from 'lucide-react';
import { useData } from '@/contexts/DataContext';

const GroupCard = ({ group }) => (
  <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col h-full hover:shadow-lg transition-shadow duration-300">
    <h3 className="text-xl font-bold text-gray-800 mb-3">{group.name}</h3>
    <p className="text-gray-600 mb-2 flex-grow">
      <strong className="text-gray-700">Objetivo:</strong> {group.objective}
    </p>
    <p className="text-gray-600 mb-2">
      <strong className="text-gray-700">Responsáveis:</strong> {group.responsible}
    </p>
    <p className="text-gray-600 mb-2">
      <strong className="text-gray-700">Contato:</strong> {group.howToParticipate}
    </p>
    <p className="text-gray-600">
      <strong className="text-gray-700">Reuniões:</strong> {group.meeting}
    </p>
  </div>
);

const Pastorals = () => {
  const { siteData, loading } = useData();

  if (loading) {
    return <div>Carregando...</div>;
  }

  const { pastorais, movimentos, servicos } = siteData.pastorals;

  const sections = [
    { title: 'Pastorais', icon: BookOpen, data: pastorais },
    { title: 'Movimentos', icon: Users, data: movimentos },
    { title: 'Serviços', icon: Handshake, data: servicos },
  ];

  return (
    <>
      <Helmet>
        <title>Pastorais, Movimentos e Serviços - Paróquia de Nossa Senhora da Conceição</title>
        <meta
          name="description"
          content="Conheça os grupos, pastorais, movimentos e serviços de nossa paróquia. Participe!"
        />
      </Helmet>
      <div className="bg-gray-50 min-h-screen">
        <header className="bg-gradient-to-br from-blue-800 to-blue-600 text-white text-center py-20">
          <motion.h1
            className="text-5xl font-extrabold"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Nossos Grupos
          </motion.h1>
          <motion.p
            className="mt-4 text-lg max-w-3xl mx-auto text-blue-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Engaje-se na vida da comunidade e coloque seus dons a serviço.
          </motion.p>
        </header>

        <main className="container mx-auto px-4 py-16 space-y-16">
          {sections.map((section, sectionIndex) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: sectionIndex * 0.2 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center mb-8">
                <div className="p-3 bg-blue-100 rounded-full mr-4">
                  <section.icon className="h-7 w-7 text-blue-800" />
                </div>
                <h2 className="text-4xl font-bold text-gray-800">{section.title}</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(section.data || []).map((group) => (
                  <GroupCard key={group.name} group={group} />
                ))}
              </div>
            </motion.section>
          ))}
        </main>
      </div>
    </>
  );
};

export default Pastorals;
