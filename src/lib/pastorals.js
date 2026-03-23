const CATEGORY_CONFIG = {
  pastorais: {
    label: 'Pastorais',
    shortLabel: 'Pastoral',
    routePrefix: 'pastoral',
  },
  movimentos: {
    label: 'Movimentos',
    shortLabel: 'Movimento',
    routePrefix: 'movimento',
  },
  servicos: {
    label: 'Serviços',
    shortLabel: 'Serviço',
    routePrefix: 'servico',
  },
};

const sanitizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const coerceBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true' || value === 'on' || value === '1') return true;
    if (value === 'false' || value === 'off' || value === '0') return false;
  }
  return fallback;
};

const coerceNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const slugifyPastoralValue = (value) =>
  sanitizeText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

const buildBaseSlug = (category, name) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.pastorais;
  return `${config.routePrefix}-${slugifyPastoralValue(name || 'grupo') || 'grupo'}`;
};

export const getPastoralCategoryLabel = (category) =>
  CATEGORY_CONFIG[category]?.label || CATEGORY_CONFIG.pastorais.label;

export const getPastoralCategoryShortLabel = (category) =>
  CATEGORY_CONFIG[category]?.shortLabel || CATEGORY_CONFIG.pastorais.shortLabel;

export const normalizePastoralItem = (item = {}, category = 'pastorais', index = 0) => {
  const name = sanitizeText(item.name) || `Grupo ${index + 1}`;
  const id = sanitizeText(item.id) || buildBaseSlug(category, name);
  const slug = sanitizeText(item.slug) || buildBaseSlug(category, name);
  const responsible = sanitizeText(item.responsible);
  const objective = sanitizeText(item.objective);
  const summary = sanitizeText(item.summary) || objective;

  return {
    id,
    slug,
    category,
    name,
    summary,
    objective,
    audience: sanitizeText(item.audience),
    responsible,
    contactName: sanitizeText(item.contactName) || responsible,
    contactPhone: sanitizeText(item.contactPhone),
    contactWhatsapp: sanitizeText(item.contactWhatsapp),
    contactEmail: sanitizeText(item.contactEmail),
    howToParticipate: sanitizeText(item.howToParticipate),
    meeting: sanitizeText(item.meeting),
    location: sanitizeText(item.location),
    image: sanitizeText(item.image),
    agendaQuery: sanitizeText(item.agendaQuery) || name,
    active: coerceBoolean(item.active, true),
    featured: coerceBoolean(item.featured, false),
    sortOrder: coerceNumber(item.sortOrder, (index + 1) * 10),
  };
};

export const normalizePastoralCategoryItems = (items = [], category = 'pastorais') =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => normalizePastoralItem(item, category, index))
    .sort((left, right) => {
      if (left.featured !== right.featured) return left.featured ? -1 : 1;
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
      return left.name.localeCompare(right.name);
    });

export const normalizePastoralSections = (pastorals = {}) => ({
  pastorais: normalizePastoralCategoryItems(pastorals?.pastorais, 'pastorais'),
  movimentos: normalizePastoralCategoryItems(pastorals?.movimentos, 'movimentos'),
  servicos: normalizePastoralCategoryItems(pastorals?.servicos, 'servicos'),
});

export const getPastoralSections = (pastoralData = {}) => {
  const normalized = normalizePastoralSections(pastoralData);
  return [
    {
      key: 'pastorais',
      title: getPastoralCategoryLabel('pastorais'),
      items: normalized.pastorais,
    },
    {
      key: 'movimentos',
      title: getPastoralCategoryLabel('movimentos'),
      items: normalized.movimentos,
    },
    {
      key: 'servicos',
      title: getPastoralCategoryLabel('servicos'),
      items: normalized.servicos,
    },
  ];
};

export const getAllPastoralItems = (pastoralData = {}, { activeOnly = false } = {}) =>
  getPastoralSections(pastoralData)
    .flatMap((section) => section.items)
    .filter((item) => (activeOnly ? item.active : true));

export const findPastoralBySlug = (pastoralData = {}, slug) =>
  getAllPastoralItems(pastoralData).find((item) => item.slug === slug) || null;

export const buildPastoralWhatsAppHref = (value) => {
  const digits = sanitizeText(value).replace(/\D+/g, '');
  return digits ? `https://wa.me/${digits}` : '';
};

export const buildPastoralAgendaHref = (item) => {
  const query = sanitizeText(item?.agendaQuery);
  return query ? `/agenda?search=${encodeURIComponent(query)}` : '/agenda';
};

export const pastoralMatchesSearch = (item, searchTerm) => {
  const normalizedSearch = sanitizeText(searchTerm).toLowerCase();
  if (!normalizedSearch) return true;

  const haystack = [
    item.name,
    item.summary,
    item.objective,
    item.audience,
    item.contactName,
    item.howToParticipate,
    item.meeting,
    item.location,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedSearch);
};
