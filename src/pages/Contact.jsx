import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, Send, Instagram, Facebook, Youtube } from 'lucide-react';
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

const parseCoord = (value, fallback) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const LEGACY_DEFAULT_COORDS = {
  lat: -5.881957586566276,
  lng: -35.19923210144043,
};

const CONTACT_DEFAULT_COORDS = {
  lat: -5.8804699,
  lng: -35.2098566,
};

const coordsMatch = (left, right, tolerance = 0.0002) => Math.abs(left - right) <= tolerance;
const CONTACT_FORM_ENDPOINT = 'https://formsubmit.co/ajax/paroquiansconceicao2019@hotmail.com';

const normalizeMapCoords = (lat, lng) => {
  if (coordsMatch(lat, LEGACY_DEFAULT_COORDS.lat) && coordsMatch(lng, LEGACY_DEFAULT_COORDS.lng)) {
    return CONTACT_DEFAULT_COORDS;
  }

  return { lat, lng };
};

const Contact = () => {
  const { toast } = useToast();
  const { siteData, loading } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return <div>Carregando...</div>;
  }

  const { address, phone, email, whatsapp, officeHours, social, mapLat, mapLng } = siteData.contact;
  const parsedLat = parseCoord(mapLat, CONTACT_DEFAULT_COORDS.lat);
  const parsedLng = parseCoord(mapLng, CONTACT_DEFAULT_COORDS.lng);
  const { lat: resolvedLat, lng: resolvedLng } = normalizeMapCoords(parsedLat, parsedLng);
  const encodedAddress = encodeURIComponent(address || `${resolvedLat},${resolvedLng}`);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  const wazeUrl = `https://waze.com/ul?ll=${resolvedLat}%2C${resolvedLng}&navigate=yes&zoom=17`;
  const wazeEmbedUrl = `https://embed.waze.com/iframe?zoom=17&lat=${resolvedLat}&lon=${resolvedLng}&pin=1`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const honeypotValue = String(formData.get('_honey') || '').trim();

    if (honeypotValue) {
      return;
    }

    const senderName = String(formData.get('name') || '').trim();
    const senderEmail = String(formData.get('email') || '').trim();
    const subject = String(formData.get('subject') || '').trim();
    const message = String(formData.get('message') || '').trim();

    const payload = new FormData();
    payload.append('name', senderName);
    payload.append('email', senderEmail);
    payload.append('subject', subject);
    payload.append('message', message);
    payload.append('_subject', `[Site PNSC] ${subject}`);
    payload.append('_template', 'table');
    payload.append('_replyto', senderEmail);

    setIsSubmitting(true);

    try {
      const response = await fetch(CONTACT_FORM_ENDPOINT, {
        method: 'POST',
        body: payload,
        headers: {
          Accept: 'application/json',
        },
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || 'Falha ao enviar a mensagem.');
      }

      toast({
        title: 'Mensagem enviada!',
        description: 'Recebemos sua mensagem e entraremos em contato em breve.',
      });
      form.reset();
    } catch (error) {
      toast({
        title: 'Mensagem não enviada!',
        description: error?.message || 'Não foi possível enviar sua mensagem agora. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
              <ContactInfoCard icon={Mail} title="E-mail">
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
                  <a
                    href={social.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Youtube size={28} />
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
                <input type="text" name="_honey" className="hidden" tabIndex="-1" autoComplete="off" />
                <div>
                  <Label htmlFor="name">Seu Nome</Label>
                  <Input id="name" name="name" autoComplete="name" required />
                </div>
                <div>
                  <Label htmlFor="email">Seu E-mail</Label>
                  <Input type="email" id="email" name="email" autoComplete="email" required />
                </div>
                <div>
                  <Label htmlFor="subject">Assunto</Label>
                  <Input id="subject" name="subject" required />
                </div>
                <div>
                  <Label htmlFor="message">Sua Mensagem</Label>
                  <Textarea id="message" name="message" rows={5} required />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : 'Enviar Mensagem'}
                  <Send className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </motion.div>
          </div>
        </main>

        <div className="w-full h-80 bg-gray-100">
          <iframe
            title="Mapa da Paróquia"
            src={wazeEmbedUrl}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Contact;
