import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Boxes, Calendar, Image, Settings, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  AGENDA_MANAGER_ROLES,
  GALLERY_MANAGER_ROLES,
  getRoleLabel,
  hasRoleAccess,
  SITE_SETTINGS_ALLOWED_ROLES,
  USERS_MANAGER_ROLES,
} from '@/lib/accessControl';

const Dashboard = () => {
  const { user, hasModuleAccess } = useAuth();
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
      path: '/dashboard/events',
      icon: Calendar,
      description: 'Cadastre, edite e acompanhe eventos e ocupacao dos espacos.',
      roles: AGENDA_MANAGER_ROLES,
      color: 'text-blue-600',
    },
    {
      name: 'Gerenciar Galeria',
      path: '/dashboard/gallery',
      icon: Image,
      description: 'Adicione, edite ou remova fotos dos eventos.',
      roles: GALLERY_MANAGER_ROLES,
      color: 'text-purple-600',
    },
    {
      name: 'Inventario',
      path: '/dashboard/inventory',
      icon: Boxes,
      description: 'Gerencie listas de itens, quantidades e fotos por unidade.',
      isVisible: hasModuleAccess('inventory', 'read'),
      color: 'text-emerald-600',
    },
    {
      name: 'Gerenciar Usuarios',
      path: '/dashboard/users',
      icon: Users,
      description: 'Administre perfis, vinculos institucionais e permissoes de acesso.',
      roles: USERS_MANAGER_ROLES,
      color: 'text-pink-600',
    },
    {
      name: 'Configuracoes do Site',
      path: '/dashboard/settings',
      icon: Settings,
      description:
        user.role === 'secretary' || user.role === 'treasurer'
          ? 'Edite apenas as abas Adm. Paroquial e Contato/Sobre.'
          : user.role === 'member'
            ? 'Visualize todas as unidades e edite apenas as que estiverem vinculadas ao seu perfil.'
            : 'Edite informacoes do site e conteudos das paginas.',
      roles: SITE_SETTINGS_ALLOWED_ROLES,
      color: 'text-indigo-600',
    },
  ];

  const accessibleItems = dashboardItems.filter((item) => {
    if (Object.prototype.hasOwnProperty.call(item, 'isVisible')) {
      return Boolean(item.isVisible);
    }

    return hasRoleAccess(user.role, item.roles);
  });

  return (
    <>
      <Helmet>
        <title>Dashboard - Paroquia de Nossa Senhora da Conceicao</title>
        <meta
          name="description"
          content="Painel de controle para membros e administradores da paroquia."
        />
      </Helmet>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 py-16 text-white">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="mb-4 text-4xl font-bold md:text-5xl">Dashboard</h1>
            <p className="text-xl text-blue-100">
              Bem-vindo, {user.name}! ({getRoleLabel(user.role)})
            </p>
          </motion.div>
        </div>
      </div>

      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {accessibleItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col rounded-xl bg-white p-6 shadow-lg transition-all hover:shadow-xl"
                >
                  <Icon className={`mb-4 h-12 w-12 ${item.color}`} />
                  <h3 className="mb-2 text-xl font-bold text-gray-800">{item.name}</h3>
                  <p className="mb-4 flex-grow text-gray-600">{item.description}</p>
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
