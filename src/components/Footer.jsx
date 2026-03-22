import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { useData } from '@/contexts/DataContext';

const Footer = () => {
  const { siteData, loading } = useData();

  const quickLinks = [
    { name: 'Início', path: '/' },
    { name: 'Comunidades', path: '/comunidades' },
    { name: 'Pastorais', path: '/pastorais' },
    { name: 'Galeria', path: '/galeria' },
    { name: 'Agenda', path: '/agenda' },
    { name: 'Contato', path: '/contato' },
  ];

  if (loading) {
    return null;
  }

  const { contact } = siteData;

  return (
    <footer className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-full h-32 mb-4 flex items-center justify-center">
              <img
                src="/assets/BRASAO_DA_PAROQUIA_branco.png"
                alt="Igreja Matriz de Nossa Senhora da Conceição"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <span className="font-bold block">Paróquia de Nossa Senhora da Conceição</span>
            <p className="text-blue-100 text-sm mt-1">Nova Parnamirim - Parnamirim/RN</p>
          </div>

          <div>
            <span className="font-bold text-lg mb-4 block">Links Rápidos</span>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-blue-100 hover:text-white transition-colors text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="font-bold text-lg mb-4 block">Contato</span>
            <ul className="space-y-3">
              <li className="flex items-start space-x-2 text-sm">
                <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                <span className="text-blue-100">{contact.address}</span>
              </li>
              <li className="flex items-center space-x-2 text-sm">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span className="text-blue-100">{contact.phone}</span>
              </li>
              <li className="flex items-center space-x-2 text-sm">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="text-blue-100">{contact.email}</span>
              </li>
            </ul>
          </div>

          <div>
            <span className="font-bold text-lg mb-4 block">Redes Sociais</span>
            <div className="flex space-x-4 mb-4">
              {contact.social.facebook && (
                <a
                  href={contact.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-700 hover:bg-blue-600 p-2 rounded-full transition-colors"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {contact.social.instagram && (
                <a
                  href={contact.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-700 hover:bg-blue-600 p-2 rounded-full transition-colors"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {contact.social.youtube && (
                <a
                  href={contact.social.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-700 hover:bg-blue-600 p-2 rounded-full transition-colors"
                >
                  <Youtube className="h-5 w-5" />
                </a>
              )}
            </div>
            <div className="text-sm text-blue-100 whitespace-pre-line">
              <p className="font-semibold mb-1">Horário de Atendimento:</p>
              <p>{contact.officeHours}</p>
            </div>
            {contact.massSchedule && (
              <div className="text-sm text-blue-100 whitespace-pre-line mt-3">
                <p className="font-semibold mb-1">Horários de Missas:</p>
                <p>{contact.massSchedule}</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-blue-600 mt-8 pt-6 text-center text-sm text-blue-200">
          <p>© {new Date().getFullYear()} Paróquia de Nossa Senhora da Conceição. Todos os direitos reservados.</p>
          <p className="mt-1">Arquidiocese de Natal/RN</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

