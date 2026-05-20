import { supabase, isSupabaseReady } from '@/lib/supabaseClient';
import { normalizePastoralItem, normalizePastoralSections } from '@/lib/pastorals';

const REQUEST_TIMEOUT_MS = 15000;

export const ORG_UNIT_CONTENT_TYPES = ['community', 'pastoral', 'movement', 'service'];

export const ORG_UNIT_TYPE_LABELS = {
  community: 'Comunidades',
  pastoral: 'Pastorais',
  movement: 'Movimentos',
  service: 'Serviços',
};

export const ORG_UNIT_TYPE_SHORT_LABELS = {
  community: 'Comunidade',
  pastoral: 'Pastoral',
  movement: 'Movimento',
  service: 'Serviço',
};

const PASTORAL_CATEGORY_BY_TYPE = {
  pastoral: 'pastorais',
  movement: 'movimentos',
  service: 'servicos',
};

const ORG_UNIT_SITE_CONTENT_SELECT = `
  id,
  org_unit_id,
  summary,
  description,
  objective,
  audience,
  responsible,
  contact_name,
  contact_phone,
  contact_whatsapp,
  contact_email,
  how_to_participate,
  meeting_info,
  location_text,
  address_text,
  mass_times,
  agenda_query,
  cover_image_url,
  gallery,
  is_public,
  is_featured,
  sort_order,
  metadata,
  created_at,
  updated_at,
  org_units (
    id,
    type,
    slug,
    name,
    is_active
  )
`;

const withTimeout = (promise, ms, message) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const normalizeOrgUnit = (value) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
};

const ensureNormalizedOrgUnitSiteContentRow = (row) => {
  if (!row) return null;
  if (row.orgUnit && row.orgUnitId) return row;
  return normalizeOrgUnitSiteContentRow(row);
};

const sortRows = (rows) =>
  [...rows].sort((left, right) => {
    const typeCompare = (left.orgUnit?.type || '').localeCompare(right.orgUnit?.type || '');
    if (typeCompare !== 0) return typeCompare;

    const featuredCompare = Number(Boolean(right.isFeatured)) - Number(Boolean(left.isFeatured));
    if (featuredCompare !== 0) return featuredCompare;

    const orderCompare = (left.sortOrder || 0) - (right.sortOrder || 0);
    if (orderCompare !== 0) return orderCompare;

    return (left.orgUnit?.name || '').localeCompare(right.orgUnit?.name || '');
  });

const normalizeGalleryImages = (value, fallbackName) =>
  (Array.isArray(value) ? value : [])
    .map((image, index) => {
      if (!image) return null;
      if (typeof image === 'string') {
        return {
          src: image,
          alt: `${fallbackName || 'Unidade'} - Foto ${index + 1}`,
        };
      }

      const src = image.src || image.url || '';
      if (!src) return null;

      return {
        ...image,
        src,
        alt: image.alt || `${fallbackName || 'Unidade'} - Foto ${index + 1}`,
      };
    })
    .filter(Boolean);

export const normalizeOrgUnitSiteContentRow = (row) => {
  const orgUnit = normalizeOrgUnit(row?.org_units);
  if (!orgUnit || !ORG_UNIT_CONTENT_TYPES.includes(orgUnit.type)) {
    return null;
  }

  return {
    id: row.id,
    orgUnitId: row.org_unit_id,
    orgUnit,
    summary: row.summary || '',
    description: row.description || '',
    objective: row.objective || '',
    audience: row.audience || '',
    responsible: row.responsible || '',
    contactName: row.contact_name || '',
    contactPhone: row.contact_phone || '',
    contactWhatsapp: row.contact_whatsapp || '',
    contactEmail: row.contact_email || '',
    howToParticipate: row.how_to_participate || '',
    meetingInfo: row.meeting_info || '',
    locationText: row.location_text || '',
    addressText: row.address_text || '',
    massTimes: row.mass_times || '',
    agendaQuery: row.agenda_query || '',
    coverImageUrl: row.cover_image_url || '',
    gallery: normalizeGalleryImages(row.gallery, orgUnit.name),
    isPublic: Boolean(row.is_public),
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};

const buildLegacyCommunities = (siteData) =>
  (siteData?.communities || []).map((community) => ({
    ...community,
    slug: community.slug || community.id,
    images: normalizeGalleryImages(community.images, community.name),
  }));

const buildLegacyPastoralsSections = (siteData) =>
  normalizePastoralSections(siteData?.pastorals || {});

export const buildFallbackPublicOrgUnitContent = (siteData) => {
  const communities = buildLegacyCommunities(siteData);
  const pastoralSections = buildLegacyPastoralsSections(siteData);

  return {
    communities,
    pastoralSections,
    pastoralItems: Object.values(pastoralSections).flatMap((items) => items),
  };
};

export const buildCommunityFromOrgUnitContent = (row) => ({
  id: row.orgUnit.slug || row.orgUnit.id,
  slug: row.orgUnit.slug || row.orgUnit.id,
  name: row.orgUnit.name,
  description: row.description || row.summary || 'Sem descrição disponível.',
  address: row.addressText || '',
  massTimes: row.massTimes || '',
  coordinator: row.contactName || row.responsible || 'A definir',
  images: row.gallery,
  summary: row.summary || row.description || '',
  isPublic: row.isPublic,
  sortOrder: row.sortOrder,
});

export const buildPastoralItemFromOrgUnitContent = (row) => {
  const category = PASTORAL_CATEGORY_BY_TYPE[row.orgUnit.type] || 'pastorais';

  return normalizePastoralItem(
    {
      id: row.orgUnit.slug || row.orgUnit.id,
      slug: row.orgUnit.slug || row.orgUnit.id,
      category,
      name: row.orgUnit.name,
      summary: row.summary || row.description || row.objective || '',
      objective: row.objective || row.description || row.summary || '',
      audience: row.audience || '',
      responsible: row.responsible || row.contactName || '',
      contactName: row.contactName || row.responsible || '',
      contactPhone: row.contactPhone || '',
      contactWhatsapp: row.contactWhatsapp || '',
      contactEmail: row.contactEmail || '',
      howToParticipate: row.howToParticipate || '',
      meeting: row.meetingInfo || '',
      location: row.locationText || '',
      image: row.coverImageUrl || '',
      agendaQuery: row.agendaQuery || row.orgUnit.name,
      active: row.isPublic,
      featured: row.isFeatured,
      sortOrder: row.sortOrder,
    },
    category,
    row.sortOrder || 0
  );
};

export const buildPublicOrgUnitContentFromRows = (rows) => {
  const normalizedRows = sortRows(rows.map(ensureNormalizedOrgUnitSiteContentRow).filter(Boolean)).filter(
    (row) => row.isPublic
  );

  const communities = normalizedRows
    .filter((row) => row.orgUnit.type === 'community')
    .map(buildCommunityFromOrgUnitContent);

  const pastoralSections = normalizePastoralSections({
    pastorais: normalizedRows
      .filter((row) => row.orgUnit.type === 'pastoral')
      .map(buildPastoralItemFromOrgUnitContent),
    movimentos: normalizedRows
      .filter((row) => row.orgUnit.type === 'movement')
      .map(buildPastoralItemFromOrgUnitContent),
    servicos: normalizedRows
      .filter((row) => row.orgUnit.type === 'service')
      .map(buildPastoralItemFromOrgUnitContent),
  });

  return {
    communities,
    pastoralSections,
    pastoralItems: Object.values(pastoralSections).flatMap((items) => items),
  };
};

export const fetchOrgUnitSiteContentRows = async ({ orgUnitIds = null } = {}) => {
  if (!isSupabaseReady) {
    return [];
  }

  if (Array.isArray(orgUnitIds) && orgUnitIds.length === 0) {
    return [];
  }

  let query = supabase.from('org_unit_site_content').select(ORG_UNIT_SITE_CONTENT_SELECT);

  if (Array.isArray(orgUnitIds) && orgUnitIds.length > 0) {
    query = query.in('org_unit_id', orgUnitIds);
  }

  const { data, error } = await withTimeout(
    query,
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar o conteúdo institucional.'
  );

  if (error) {
    throw error;
  }

  return sortRows((data || []).map(normalizeOrgUnitSiteContentRow).filter(Boolean));
};

export const fetchOrgUnits = async ({ orgUnitIds = null } = {}) => {
  if (!isSupabaseReady) {
    return [];
  }

  if (Array.isArray(orgUnitIds) && orgUnitIds.length === 0) {
    return [];
  }

  let query = supabase
    .from('org_units')
    .select('id, type, slug, name, is_active')
    .eq('is_active', true)
    .in('type', ORG_UNIT_CONTENT_TYPES)
    .order('type')
    .order('name');

  if (Array.isArray(orgUnitIds) && orgUnitIds.length > 0) {
    query = query.in('id', orgUnitIds);
  }

  const { data, error } = await withTimeout(
    query,
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar as unidades institucionais.'
  );

  if (error) {
    throw error;
  }

  return data || [];
};

export const upsertOrgUnitSiteContent = async (payload) => {
  if (!isSupabaseReady) {
    throw new Error('Supabase não configurado.');
  }

  const { data, error } = await withTimeout(
    supabase
      .from('org_unit_site_content')
      .upsert(payload, { onConflict: 'org_unit_id' })
      .select(ORG_UNIT_SITE_CONTENT_SELECT)
      .single(),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao salvar o conteúdo institucional.'
  );

  if (error) {
    throw error;
  }

  return normalizeOrgUnitSiteContentRow(data);
};
