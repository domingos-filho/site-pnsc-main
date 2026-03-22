import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isMember } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Início', path: '/', end: true },
    { name: 'Comunidades', path: '/comunidades' },
    { name: 'Pastorais', path: '/pastorais' },
    { name: 'Galeria', path: '/galeria' },
    { name: 'Agenda', path: '/agenda' },
    { name: 'Quem Somos', path: '/quem-somos' },
    { name: 'Adm. Paroquial', path: '/equipe' },
    { name: 'Contato', path: '/contato' },
  ];
  const getDesktopLinkClass = ({ isActive }) =>
    [
      'relative inline-flex items-center justify-center px-3 py-2 text-sm font-medium transition-all duration-200',
      isActive
        ? 'text-blue-700 font-semibold after:content-[\"\"] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-6 after:h-1 after:rounded-full after:bg-blue-600'
        : 'text-gray-700 hover:text-blue-600',
    ].join(' ');

  const getMobileLinkClass = ({ isActive }) =>
    [
      'block py-2 px-3 rounded-lg transition-colors',
      isActive
        ? 'text-blue-700 font-semibold bg-blue-50 border-l-4 border-blue-600'
        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50',
    ].join(' ');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <nav className="container mx-auto px-4">
        <div className="flex items-center justify-between h-24">
          <Link to="/" className="flex items-center space-x-3 h-full">
            <img
              src="/assets/BRASAO_DA_PAROQUIA.png"
              alt="Brasão da Paróquia"
              className="h-full py-2 object-contain"
            />
            <div className="flex flex-col -space-y-1">
              <span className="text-lg font-bold text-blue-800">Paróquia de Nossa Senhora da</span>
              <span className="text-4xl text-blue-600 font-priestacy font-bold">Conceição</span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center space-x-4">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={getDesktopLinkClass}
              >
                {item.name}
              </NavLink>
            ))}

            <div className="w-px h-6 bg-gray-200" />

            {user && isMember ? (
              <div className="flex items-center space-x-2">
                <Link to="/dashboard">
                  <Button variant="outline" size="sm">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Entrar
                </Button>
              </Link>
            )}
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden text-gray-700 hover:text-blue-600">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden mt-4 pb-4"
            >
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={getMobileLinkClass}
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </NavLink>
              ))}
              <div className="border-t my-2" />
              {user && isMember ? (
                <>
                  <Link
                    to="/dashboard"
                    className="block py-2 text-gray-700 hover:text-blue-600"
                    onClick={() => setIsOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsOpen(false);
                    }}
                    className="block py-2 text-gray-700 hover:text-blue-600 w-full text-left"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="block py-2 text-gray-700 hover:text-blue-600"
                  onClick={() => setIsOpen(false)}
                >
                  Entrar
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
};

export default Header;


