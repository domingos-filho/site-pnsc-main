import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';
import { useData } from '@/contexts/DataContext';

const TeamMemberCard = ({ member, index }) => (
  <motion.div
    className="bg-white rounded-xl shadow-md text-center overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col"
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.15 }}
  >
    <div className="aspect-[4/4] bg-gray-200">
      <img
        src={member.imageThumb || member.image}
        alt={`Foto de ${member.name}`}
        className="w-full h-full object-cover object-center"
        loading="lazy"
        decoding="async"
      />
    </div>
    <div className="p-3 flex flex-col gap-1">
      <h3 className="text-lg font-bold text-gray-800">{member.name}</h3>
      <p className="text-blue-700 font-semibold text-sm">{member.role}</p>
      <div className="inline-flex items-center justify-center text-xs text-gray-500 mt-2">
        <Phone className="h-4 w-4 mr-2" />
        {member.contact}
      </div>
    </div>
  </motion.div>
);

const Team = () => {
  const { siteData, loading } = useData();

  if (loading) {
    return <div>Carregando...</div>;
  }

  const { team } = siteData;

  return (
    <>
      <Helmet>
        <title>Adm. Paroquial - Paróquia de Nossa Senhora da Conceição</title>
        <meta
          name="description"
          content="Conheça a administração paroquial e os membros que servem em nossa paróquia."
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
            Administração Paroquial
          </motion.h1>
          <motion.p
            className="mt-4 text-lg max-w-3xl mx-auto text-blue-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Pessoas dedicadas ao serviço de Deus e da comunidade.
          </motion.p>
        </header>

        <main className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {team.map((member, index) => (
              <TeamMemberCard key={member.id} member={member} index={index} />
            ))}
          </div>
        </main>
      </div>
    </>
  );
};

export default Team;
