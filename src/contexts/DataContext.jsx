import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchSiteData, upsertSiteData } from '@/lib/supabaseData';
import { isSupabaseReady } from '@/lib/supabaseClient';
import {
  buildGalleryFromLegacyStorage,
  mergeGalleryCollections,
  normalizeGallery,
} from '@/lib/gallery';
import { normalizePastoralSections } from '@/lib/pastorals';

const DataContext = createContext();
const LOCAL_STORAGE_KEY = 'paroquia_site_data';
const LEGACY_GALLERY_ALBUMS_KEY = 'paroquia_gallery_albums';
const LEGACY_GALLERY_PHOTOS_KEY = 'paroquia_gallery_photos';
const LEGACY_DEMO_GALLERY = [
  {
    id: 1,
    title: 'Festa do Padroeiro 2025',
    year: 2025,
    community: 'Matriz',
    images: [
      {
        src: 'https://images.unsplash.com/photo-1546852493-34545a425b1b?q=80&w=2070&auto=format&fit=crop',
        alt: 'Imagem 1',
      },
      {
        src: 'https://images.unsplash.com/photo-1516981843848-d34bf4153912?q=80&w=2070&auto=format&fit=crop',
        alt: 'Imagem 2',
      },
    ],
  },
  {
    id: 2,
    title: 'Semana Santa 2024',
    year: 2024,
    community: 'Nossa Senhora das Graças',
    images: [
      {
        src: 'https://images.unsplash.com/photo-1508385932222-cd395c28a927?q=80&w=2070&auto=format&fit=crop',
        alt: 'Imagem 3',
      },
    ],
  },
];

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

const readLocalSiteData = () => {
  if (typeof window === 'undefined') return null;
  try {
    const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    return storedData ? JSON.parse(storedData) : null;
  } catch (error) {
    return null;
  }
};

const writeLocalSiteData = (data) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
};

const readStoredJson = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch (error) {
    return fallback;
  }
};

const readLegacyGallery = () =>
  buildGalleryFromLegacyStorage({
    albums: readStoredJson(LEGACY_GALLERY_ALBUMS_KEY, []),
    photos: readStoredJson(LEGACY_GALLERY_PHOTOS_KEY, []),
  });

const clearLegacyGallery = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LEGACY_GALLERY_ALBUMS_KEY);
  localStorage.removeItem(LEGACY_GALLERY_PHOTOS_KEY);
};

const initialSiteData = {
  home: {
    welcomeMessage:
      'Sejam bem-vindos à Paróquia de Nossa Senhora da Conceição! Um lugar de fé, comunidade e amor. Junte-se a nós em nossas celebrações e atividades.',
    heroImages: [
      {
        id: 1,
        src: 'https://images.unsplash.com/photo-1508385932222-cd395c28a927?q=80&w=2070&auto=format&fit=crop',
        thumbSrc: 'https://images.unsplash.com/photo-1508385932222-cd395c28a927?q=80&w=2070&auto=format&fit=crop',
        alt: 'Interior de uma igreja com vitrais coloridos',
      },
      {
        id: 2,
        src: 'https://images.unsplash.com/photo-1593941707874-ef25b8b4a9ae?q=80&w=2070&auto=format&fit=crop',
        thumbSrc: 'https://images.unsplash.com/photo-1593941707874-ef25b8b4a9ae?q=80&w=2070&auto=format&fit=crop',
        alt: 'Pessoas rezando em uma missa',
      },
      {
        id: 3,
        src: 'https://images.unsplash.com/photo-1513818693935-7523c2641d29?q=80&w=2070&auto=format&fit=crop',
        thumbSrc: 'https://images.unsplash.com/photo-1513818693935-7523c2641d29?q=80&w=2070&auto=format&fit=crop',
        alt: 'Altar de uma igreja decorado para uma celebração',
      },
    ],
    patronessText:
      'Sob a proteção de Nossa Senhora da Conceição, nossa comunidade se une em fé e devoção. Que seu exemplo de pureza e amor nos inspire a cada dia a sermos melhores servos de Deus e irmãos uns dos outros. Ela é nosso refúgio e fortaleza, guiando nossos passos no caminho da salvação.',
    patronessImage:
      'https://imagedelivery.net/LqiWLm-3MGbYHtFuUbcBtA/869c9b13-f939-4d64-a691-88f01b35b600/public',
    patronessThumb:
      'https://imagedelivery.net/LqiWLm-3MGbYHtFuUbcBtA/869c9b13-f939-4d64-a691-88f01b35b600/public',
    patronessImagePath: null,
    patronessThumbPath: null,
    newsSettings: {
      autoplay: true,
      intervalSeconds: 6,
    },
    news: [
      {
        id: 1,
        title: 'Aviso Importante',
        summary: 'Confira os comunicados e avisos da nossa paróquia.',
        content: '',
        date: '2026-02-01',
        category: 'Comunicado',
        ctaLabel: '',
        ctaUrl: '',
        pinned: true,
        startAt: '',
        endAt: '',
        image: '',
        imagePath: null,
        thumb: '',
        thumbPath: null,
      },
    ],
  },
  communities: [
    {
      id: 'nossa-senhora-das-gracas',
      name: 'Nossa Senhora das Graças',
      description: 'História da comunidade...',
      address: 'Endereço...',
      massTimes: 'Sábado às 19h',
      coordinator: 'Nome do Coordenador',
      images: [],
    },
    {
      id: 'nossa-senhora-auxiliadora',
      name: 'Nossa Senhora Auxiliadora',
      description: 'História da comunidade...',
      address: 'Endereço...',
      massTimes: 'Domingo às 8h',
      coordinator: 'Nome do Coordenador',
      images: [],
    },
    {
      id: 'santa-dulce-dos-pobres',
      name: 'Santa Dulce dos Pobres',
      description: 'História da comunidade...',
      address: 'Endereço...',
      massTimes: 'Domingo às 10h',
      coordinator: 'Nome do Coordenador',
      images: [],
    },
    {
      id: 'sao-joao-paulo-ii',
      name: 'São João Paulo II',
      description: 'História da comunidade...',
      address: 'Endereço...',
      massTimes: 'Sábado às 17h',
      coordinator: 'Nome do Coordenador',
      images: [],
    },
    {
      id: 'sagrado-coracao-de-jesus',
      name: 'Sagrado Coração de Jesus',
      description: 'História da comunidade...',
      address: 'Endereço...',
      massTimes: 'Domingo às 18h',
      coordinator: 'Nome do Coordenador',
      images: [],
    },
  ],
  pastorals: {
    pastorais: [
      {
        name: 'Litúrgica',
        objective: 'Organizar e enriquecer as celebrações.',
        responsible: 'Nome do Responsável',
        howToParticipate: 'Entrar em contato com a secretaria.',
        meeting: 'Toda primeira segunda-feira do mês, às 19h30.',
      },
      {
        name: 'Familiar',
        objective: 'Apoiar e fortalecer as famílias da comunidade.',
        responsible: 'Nome do Responsável',
        howToParticipate: 'Participar dos encontros abertos.',
        meeting: 'Quinzenalmente, aos sábados.',
      },
      {
        name: 'Catequese',
        objective: 'Educar crianças e jovens na fé cristã.',
        responsible: 'Nome do Responsável',
        howToParticipate: 'Inscrições no início do ano.',
        meeting: 'Aos sábados pela manhã.',
      },
    ],
    movimentos: [
      {
        name: 'Legião de Maria',
        objective: 'Oração e serviço em honra a Maria.',
        responsible: 'Nome do Responsável',
        howToParticipate: 'Participar de uma reunião.',
        meeting: 'Semanalmente, às terças.',
      },
      {
        name: 'RCC',
        objective: 'Renovação Carismática Católica.',
        responsible: 'Nome do Responsável',
        howToParticipate: 'Participar do grupo de oração.',
        meeting: 'Toda quinta-feira, às 19h.',
      },
    ],
    servicos: [
      {
        name: 'Despertar',
        objective: 'Apoio a pessoas em situação de vulnerabilidade.',
        responsible: 'Nome do Responsável',
        howToParticipate: 'Ser voluntário.',
        meeting: 'Reuniões mensais.',
      },
      {
        name: 'ECC',
        objective: 'Encontro de Casais com Cristo.',
        responsible: 'Nome do Responsável',
        howToParticipate: 'Inscrição para o encontro anual.',
        meeting: 'Conforme calendário.',
      },
    ],
  },
  about: {
    history:
      'A Paróquia de Nossa Senhora da Conceição de Nova Parnamirim foi fundada em [Ano], com a missão de servir a comunidade local e ser um farol de fé e esperança. Desde então, temos crescido em número e em espírito, sempre guiados pelos ensinamentos de Cristo e pelo exemplo de nossa padroeira.',
    mission:
      'Evangelizar, acolher e servir a todos, promovendo a dignidade humana e a construção do Reino de Deus.',
    vision:
      'Ser uma comunidade de comunidades, viva, missionária e misericordiosa, onde todos se sintam em casa.',
    values: 'Fé, Amor, Comunidade, Serviço, Oração.',
    youtubeVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  team: [
    {
      id: 1,
      name: 'Padre [Nome]',
      role: 'Pároco',
      bio: 'Mini biografia do pároco...',
      contact: 'email@paroquia.com',
      image: 'https://via.placeholder.com/150',
    },
    {
      id: 2,
      name: 'Diácono [Nome]',
      role: 'Diácono Permanente',
      bio: 'Mini biografia do diácono...',
      contact: 'email@paroquia.com',
      image: 'https://via.placeholder.com/150',
    },
    {
      id: 3,
      name: '[Nome]',
      role: 'Coordenador(a) Pastoral',
      bio: 'Mini biografia...',
      contact: 'email@paroquia.com',
      image: 'https://via.placeholder.com/150',
    },
  ],
  contact: {
    address: 'Rua: Capitão Luiz Gonzaga, 216, Nova Parnamirim, Parnamirim/RN',
    phone: '(84) 0000-0000',
    email: 'pnsc.arquivos@gmail.com',
    whatsapp: '5584000000000',
    officeHours: 'Segunda a Sexta: 8h às 17h\nSábado: 8h às 12h',
    massSchedule: 'Domingo: 7h, 9h e 18h\nQuarta-feira: 19h\nSábado: 7h',
    mapLat: '-5.8804699',
    mapLng: '-35.2098566',
    mapImageUrl: null,
    mapImagePath: null,
    social: {
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      youtube: 'https://youtube.com',
    },
  },
  events: [
    {
      id: 1,
      title: 'Festa da Padroeira 2025',
      date: '2025-12-08',
      description: 'Celebração da nossa padroeira, Nossa Senhora da Conceição.',
    },
    {
      id: 2,
      title: 'Semana Santa 2026',
      date: '2026-04-05',
      description: 'Programação especial para a Semana Santa.',
    },
  ],
  gallery: [
    ],
};

const serializeGallery = (gallery) => JSON.stringify(normalizeGallery(gallery));
const serializeDemoGallery = serializeGallery(LEGACY_DEMO_GALLERY);
const sanitizeGallery = (gallery) => {
  const normalizedGallery = normalizeGallery(gallery);
  return serializeGallery(normalizedGallery) === serializeDemoGallery ? [] : normalizedGallery;
};

const normalizeSiteData = (rawData = initialSiteData) => ({
  ...initialSiteData,
  ...rawData,
  home: {
    ...initialSiteData.home,
    ...rawData.home,
    newsSettings: {
      ...initialSiteData.home.newsSettings,
      ...rawData.home?.newsSettings,
    },
    news: Array.isArray(rawData.home?.news) ? rawData.home.news : initialSiteData.home.news,
    heroImages: Array.isArray(rawData.home?.heroImages)
      ? rawData.home.heroImages
      : initialSiteData.home.heroImages,
  },
  pastorals: {
    ...normalizePastoralSections({
      ...initialSiteData.pastorals,
      ...rawData.pastorals,
      pastorais: Array.isArray(rawData.pastorals?.pastorais)
        ? rawData.pastorals.pastorais
        : initialSiteData.pastorals.pastorais,
      movimentos: Array.isArray(rawData.pastorals?.movimentos)
        ? rawData.pastorals.movimentos
        : initialSiteData.pastorals.movimentos,
      servicos: Array.isArray(rawData.pastorals?.servicos)
        ? rawData.pastorals.servicos
        : initialSiteData.pastorals.servicos,
    }),
  },
  about: {
    ...initialSiteData.about,
    ...rawData.about,
  },
  contact: {
    ...initialSiteData.contact,
    ...rawData.contact,
    social: {
      ...initialSiteData.contact.social,
      ...rawData.contact?.social,
    },
  },
  communities: Array.isArray(rawData.communities) ? rawData.communities : initialSiteData.communities,
  team: Array.isArray(rawData.team) ? rawData.team : initialSiteData.team,
  events: Array.isArray(rawData.events) ? rawData.events : initialSiteData.events,
  gallery: sanitizeGallery(rawData.gallery ?? initialSiteData.gallery),
});

const hydrateSiteData = (rawData = initialSiteData) => {
  const normalizedData = normalizeSiteData(rawData);
  const legacyGallery = readLegacyGallery();

  if (legacyGallery.length === 0) {
    return { data: normalizedData, migratedLegacy: false, hadLegacyGallery: false };
  }

  const shouldReplaceWithLegacy =
    normalizedData.gallery.length === 0 ||
    serializeGallery(normalizedData.gallery) === serializeGallery(initialSiteData.gallery);

  const finalGallery = shouldReplaceWithLegacy
    ? legacyGallery
    : mergeGalleryCollections(normalizedData.gallery, legacyGallery);

  return {
    data: {
      ...normalizedData,
      gallery: finalGallery,
    },
    migratedLegacy: serializeGallery(finalGallery) !== serializeGallery(normalizedData.gallery),
    hadLegacyGallery: true,
  };
};

export const DataProvider = ({ children }) => {
  const [siteData, setSiteData] = useState(initialSiteData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const { data: localData, migratedLegacy: migratedLegacyLocal, hadLegacyGallery: hadLegacyLocal } = hydrateSiteData(
      readLocalSiteData() || initialSiteData
    );
    if (isMounted) {
      setSiteData(localData);
      setLoading(false);
    }
    if (migratedLegacyLocal || hadLegacyLocal) {
      writeLocalSiteData(localData);
      clearLegacyGallery();
    }

    const syncSupabase = async () => {
      if (!isSupabaseReady) return;
      try {
        const remoteData = await fetchSiteData();
        if (remoteData) {
          const {
            data: hydratedRemoteData,
            migratedLegacy,
            hadLegacyGallery,
          } = hydrateSiteData(remoteData);
          writeLocalSiteData(hydratedRemoteData);
          if (isMounted) {
            setSiteData(hydratedRemoteData);
          }
          if (migratedLegacy || hadLegacyGallery) {
            clearLegacyGallery();
          }
          if (migratedLegacy) {
            try {
              await upsertSiteData(hydratedRemoteData);
            } catch (error) {
              console.error('Failed to migrate legacy gallery data to Supabase', error);
            }
          }
          return;
        }

        try {
          await upsertSiteData(localData);
        } catch (error) {
          console.error('Failed to seed Supabase site data', error);
        }
      } catch (error) {
        console.error('Failed to load site data', error);
      }
    };

    syncSupabase();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateSiteData = async (newData) => {
    const normalizedData = normalizeSiteData(newData);

    setSiteData(normalizedData);
    writeLocalSiteData(normalizedData);

    if (!isSupabaseReady) {
      return { ok: true, synced: false };
    }

    try {
      await upsertSiteData(normalizedData);
      return { ok: true, synced: true };
    } catch (error) {
      console.error('Failed to persist site data', error);
      return { ok: false, synced: false, error };
    }
  };

  const value = {
    siteData,
    updateSiteData,
    loading,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
