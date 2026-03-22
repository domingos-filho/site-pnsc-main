import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Image, Settings, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) return null;

  const dashboardItems = [
    {
      name: 'Gerenciar Agenda',
      path: '/agenda',
      icon: Calendar,
      description: 'Cadastre e edite eventos da agenda paroquial.',
      roles: ['secretary', 'admin'],
      color: 'text-blue-600',
    },
    {
      name: 'Gerenciar Galeria',
      path: '/dashboard/gallery',
      icon: Image,
      description: 'Adicione, edite ou remova fotos dos eventos.',
      roles: ['member', 'secretary', 'admin'],
      color: 'text-purple-600',
    },
    {
      name: 'Gerenciar Usuários',
      path: '/dashboard/users',
      icon: Users,
      description: 'Administre membros e suas permissões de acesso.',
      roles: ['admin'],
      color: 'text-pink-600',
    },
    {
      name: 'Configurações do Site',
      path: '/dashboard/settings',
      icon: Settings,
      description: 'Edite informações do site e conteúdos das páginas.',
      roles: ['admin'],
      color: 'text-indigo-600',
    },
  ];

  const accessibleItems = dashboardItems.filter((item) => item.roles.includes(user.role));

  return (
    <>
      <Helmet>
        <title>Dashboard - Paróquia de Nossa Senhora da Conceição</title>
        <meta name="description" content="Painel de controle para membros e administradores da paróquia." />
      </Helmet>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Dashboard</h1>
            <p className="text-xl text-blue-100">
              Bem-vindo, {user.name}! (
              {user.role === 'admin' ? 'Administrador' : user.role === 'secretary' ? 'Secretario' : 'Membro'})
            </p>
          </motion.div>
        </div>
      </div>

      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accessibleItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all flex flex-col"
                >
                  <Icon className={`h-12 w-12 ${item.color} mb-4`} />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{item.name}</h3>
                  <p className="text-gray-600 mb-4 flex-grow">{item.description}</p>
                  <Link to={item.path}>
                    <Button className="w-full">Acessar</Button>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};

export default Dashboard;
