import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, Send, Instagram, Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';

const ContactInfoCard = ({ icon, title, children }) => {
  const Icon = icon;
  return (
    <div className="flex items-start gap-4">
      <div className="p-3 bg-blue-100 rounded-full">
        <Icon className="h-6 w-6 text-blue-800" />
      </div>
      <div>
        <h3 className="font-bold text-lg text-gray-800">{title}</h3>
        <div className="text-gray-600 whitespace-pre-line">{children}</div>
      </div>
    </div>
  );
};

const Contact = () => {
  const { toast } = useToast();
  const { siteData, loading } = useData();

  if (loading) {
    return <div>Carregando...</div>;
  }

  const { address, phone, email, whatsapp, officeHours, social, mapLat, mapLng, mapImageUrl } = siteData.contact;
  const [mapError, setMapError] = useState(false);
  const defaultCoords = { lat: -5.881957586566276, lng: -35.19923210144043 };
  const parseCoord = (value, fallback) => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const resolvedLat = parseCoord(mapLat, defaultCoords.lat);
  const resolvedLng = parseCoord(mapLng, defaultCoords.lng);
  const fallbackMapImageUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${resolvedLat},${resolvedLng}&zoom=16&size=1200x400&maptype=mapnik&markers=${resolvedLat},${resolvedLng},red-pushpin`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${resolvedLat},${resolvedLng}`;
  const wazeUrl = `https://waze.com/ul?ll=${resolvedLat},${resolvedLng}&navigate=yes`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${resolvedLat}&mlon=${resolvedLng}#map=17/${resolvedLat}/${resolvedLng}`;
  const customMapImage = mapImageUrl?.trim() || '';
  const googleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const googleStaticMapUrl = googleMapsApiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${resolvedLat},${resolvedLng}&zoom=16&size=640x360&scale=2&maptype=roadmap&markers=color:red%7C${resolvedLat},${resolvedLng}&key=${encodeURIComponent(
        googleMapsApiKey
      )}`
    : '';
  const mapSources = [customMapImage, fallbackMapImageUrl, googleStaticMapUrl].filter(Boolean);
  const [mapSourceIndex, setMapSourceIndex] = useState(0);
  const mapSrc = mapSources[mapSourceIndex];

  useEffect(() => {
    setMapError(false);
    setMapSourceIndex(0);
  }, [customMapImage, googleStaticMapUrl, fallbackMapImageUrl]);

  const handleSubmit = (e) => {
    e.preventDefault();
    toast({
      title: 'Mensagem não enviada!',
      description:
        'Este formulário é apenas demonstrativo. A funcionalidade de envio será implementada em breve.',
    });
    e.target.reset();
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/${whatsapp}`, '_blank');
  };

  return (
    <>
      <Helmet>
        <title>Contato - Paróquia de Nossa Senhora da Conceição</title>
        <meta
          name="description"
          content="Entre em contato com a Paróquia de Nossa Senhora da Conceição. Encontre nosso endereço, telefone e horários."
        />
      </Helmet>

      <div className="bg-gray-50">
        <header className="bg-gradient-to-br from-blue-800 to-blue-600 text-white text-center py-20">
          <motion.h1
            className="text-5xl font-extrabold"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Fale Conosco
          </motion.h1>
          <motion.p
            className="mt-4 text-lg max-w-3xl mx-auto text-blue-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Estamos aqui para ajudar. Entre em contato ou faça-nos uma visita.
          </motion.p>
        </header>

        <main className="container mx-auto px-4 py-16">
          <div className="grid lg:grid-cols-12 gap-12">
            <motion.div
              className="lg:col-span-5 space-y-8"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <ContactInfoCard icon={MapPin} title="Nosso Endereço">
                {address}
              </ContactInfoCard>
              <ContactInfoCard icon={Phone} title="Telefone">
                <a href={`tel:${phone}`} className="hover:text-blue-700">
                  {phone}
                </a>
              </ContactInfoCard>
              <ContactInfoCard icon={Mail} title="Email">
                <a href={`mailto:${email}`} className="hover:text-blue-700">
                  {email}
                </a>
              </ContactInfoCard>
              <ContactInfoCard icon={Clock} title="Atendimento">
                {officeHours}
              </ContactInfoCard>
              <div className="space-y-4 pt-4">
                <Button onClick={openWhatsApp} className="w-full bg-green-500 hover:bg-green-600 text-white">
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 6.262.004 11.378-5.109 11.38-11.374.002-3.045-1.168-5.912-3.304-8.051-2.135-2.138-4.999-3.307-8.046-3.307-6.262.002-11.378 5.116-11.378 11.378.001 2.28.683 4.49 1.954 6.425l-1.579 5.824 5.926-1.559z" />
                  </svg>
                  Fale pelo WhatsApp
                </Button>
                <div className="flex justify-center gap-6">
                  <a
                    href={social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-pink-500"
                  >
                    <Instagram size={28} />
                  </a>
                  <a
                    href={social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-blue-600"
                  >
                    <Facebook size={28} />
                  </a>
                </div>
              </div>
            </motion.div>
            <motion.div
              className="lg:col-span-7 bg-white p-8 rounded-2xl shadow-lg"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Envie uma Mensagem</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">Seu Nome</Label>
                  <Input id="name" required />
                </div>
                <div>
                  <Label htmlFor="email">Seu Email</Label>
                  <Input type="email" id="email" required />
                </div>
                <div>
                  <Label htmlFor="subject">Assunto</Label>
                  <Input id="subject" required />
                </div>
                <div>
                  <Label htmlFor="message">Sua Mensagem</Label>
                  <Textarea id="message" rows={5} required />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  Enviar Mensagem <Send className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </motion.div>
          </div>
        </main>

        <div className="w-full h-80 bg-gray-100">
          {mapError ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 text-sm text-gray-500">
              <p>Mapa indisponível na rede atual.</p>
              <p className="mt-1">{address}</p>
            </div>
          ) : (
            <img
              src={mapSrc}
              alt="Mapa da Paróquia"
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => {
                const nextIndex = mapSourceIndex + 1;
                if (nextIndex < mapSources.length) {
                  setMapSourceIndex(nextIndex);
                  return;
                }
                setMapError(true);
              }}
            />
          )}
        </div>
        <div className="bg-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-wrap justify-end gap-4 text-sm">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                Abrir no Google Maps
              </a>
              <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                Abrir no Waze
              </a>
              <a href={osmUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                Abrir no OpenStreetMap
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Contact;
