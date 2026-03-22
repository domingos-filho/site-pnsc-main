import { normalizeGalleryImage } from '@/lib/gallery';
import { isSupabaseReady, supabase } from '@/lib/supabaseClient';

const GALLERY_COLLECTIONS_TABLE = 'gallery_collections';
const GALLERY_MEDIA_TABLE = 'gallery_media';
const REQUEST_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms, message) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const COLLECTION_SELECT_FIELDS = [
  'id',
  'slug',
  'title',
  'summary',
  'description',
  'event_date',
  'end_date',
  'display_year',
  'search_year',
  'community',
  'category',
  'tags',
  'linked_event_id',
  'cover_media_id',
  'photo_count',
  'is_published',
  'created_at',
  'updated_at',
].join(', ');

const MEDIA_SELECT_FIELDS = [
  'id',
  'collection_id',
  'path',
  'thumb_path',
  'medium_path',
  'src_url',
  'thumb_url',
  'alt_text',
  'caption',
  'sort_order',
  'is_featured',
  'created_at',
  'updated_at',
].join(', ');

const normalizeText = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const normalizeYear = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
    return null;
  }

  return parsed;
};

const normalizeCollectionInput = (input = {}) => ({
  title: String(input.title || '').trim(),
  community: normalizeText(input.community),
  display_year: normalizeYear(input.year ?? input.displayYear),
  summary: normalizeText(input.summary),
  description: normalizeText(input.description),
  category: normalizeText(input.category),
  event_date: normalizeText(input.eventDate),
  end_date: normalizeText(input.endDate),
  linked_event_id: normalizeText(input.linkedEventId),
  is_published: input.isPublished ?? true,
  tags: Array.isArray(input.tags)
    ? input.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : [],
});

const normalizeCollectionRow = (row) => {
  const derivedYear =
    row?.search_year || row?.display_year || (row?.event_date ? row.event_date.slice(0, 4) : '');

  return {
    id: row.id,
    slug: row.slug,
    title: row.title || 'Album',
    year: derivedYear ? String(derivedYear) : '',
    displayYear: row.display_year ? String(row.display_year) : '',
    searchYear: row.search_year ? String(row.search_year) : '',
    community: row.community || '',
    summary: row.summary || '',
    description: row.description || '',
    category: row.category || '',
    eventDate: row.event_date || '',
    endDate: row.end_date || '',
    linkedEventId: row.linked_event_id || null,
    coverMediaId: row.cover_media_id || null,
    photoCount: Number(row.photo_count || 0),
    isPublished: row.is_published !== false,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    images: [],
  };
};

const normalizeMediaRow = (row, albumTitle = 'Album', index = 0) => {
  const image = normalizeGalleryImage(
    {
      id: row.id,
      path: row.path,
      mediumPath: row.medium_path,
      thumbPath: row.thumb_path,
      src: row.src_url,
      thumbSrc: row.thumb_url,
      mediumSrc: row.src_url,
      alt: row.alt_text || row.caption,
    },
    albumTitle,
    index
  );

  if (!image) return null;

  return {
    ...image,
    mediumPath: row.medium_path || null,
    caption: row.caption || '',
    sortOrder: Number(row.sort_order || 0),
    isFeatured: Boolean(row.is_featured),
    collectionId: row.collection_id,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};

const sortCollections = (collections) =>
  [...collections].sort((left, right) => {
    const leftYear = Number(left.searchYear || left.year || 0);
    const rightYear = Number(right.searchYear || right.year || 0);
    if (leftYear !== rightYear) return rightYear - leftYear;

    const leftDate = left.eventDate || '';
    const rightDate = right.eventDate || '';
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);

    return (left.title || '').localeCompare(right.title || '', 'pt-BR', { sensitivity: 'base' });
  });

const ensureSupabase = () => {
  if (!isSupabaseReady || !supabase) {
    throw new Error('Supabase nao configurado para a galeria.');
  }
};

const fetchGalleryMedia = async (collections = []) => {
  const collectionIds = collections.map((collection) => collection.id).filter(Boolean);
  if (collectionIds.length === 0) {
    return [];
  }

  const { data: mediaRows, error: mediaError } = await withTimeout(
    supabase
      .from(GALLERY_MEDIA_TABLE)
      .select(MEDIA_SELECT_FIELDS)
      .in('collection_id', collectionIds)
      .order('collection_id', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar fotos da galeria.'
  );

  if (mediaError) {
    throw mediaError;
  }

  return mediaRows || [];
};

const attachMediaToCollections = (collections, mediaRows = []) => {
  const collectionIds = collections.map((collection) => collection.id);
  const titleByCollection = new Map(collections.map((collection) => [collection.id, collection.title]));
  const mediaByCollection = new Map(collectionIds.map((id) => [id, []]));

  mediaRows.forEach((row) => {
    const currentMedia = mediaByCollection.get(row.collection_id) || [];
    const image = normalizeMediaRow(row, titleByCollection.get(row.collection_id), currentMedia.length);

    if (image) {
      currentMedia.push(image);
      mediaByCollection.set(row.collection_id, currentMedia);
    }
  });

  return sortCollections(
    collections.map((collection) => {
      const images = mediaByCollection.get(collection.id) || [];
      const explicitCoverId =
        (collection.coverMediaId && images.some((image) => image.id === collection.coverMediaId))
          ? collection.coverMediaId
          : null;
      const featuredCoverId = images.find((image) => image.isFeatured)?.id || null;
      const fallbackCoverId = images[0]?.id || null;
      const resolvedCoverId = explicitCoverId || featuredCoverId || fallbackCoverId;
      const coverImage = images.find((image) => image.id === resolvedCoverId) || null;

      return {
        ...collection,
        coverMediaId: resolvedCoverId,
        coverImage,
        images: images.map((image) => ({
          ...image,
          isCover: image.id === resolvedCoverId,
        })),
      };
    })
  );
};

export const loadGalleryCollections = async ({ publishedOnly = false, includeMedia = true } = {}) => {
  ensureSupabase();

  let collectionsQuery = supabase
    .from(GALLERY_COLLECTIONS_TABLE)
    .select(COLLECTION_SELECT_FIELDS)
    .order('search_year', { ascending: false })
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (publishedOnly) {
    collectionsQuery = collectionsQuery.eq('is_published', true);
  }

  const { data: collectionRows, error: collectionsError } = await withTimeout(
    collectionsQuery,
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar albuns da galeria.'
  );

  if (collectionsError) {
    throw collectionsError;
  }

  const collections = sortCollections((collectionRows || []).map(normalizeCollectionRow));
  if (!includeMedia || collections.length === 0) {
    return collections;
  }

  const mediaRows = await fetchGalleryMedia(collections);
  return attachMediaToCollections(collections, mediaRows);
};

export const loadGalleryCollectionBySlug = async (slug, { publishedOnly = false } = {}) => {
  ensureSupabase();

  const normalizedSlug = String(slug || '').trim();
  if (!normalizedSlug) {
    return null;
  }

  let collectionQuery = supabase
    .from(GALLERY_COLLECTIONS_TABLE)
    .select(COLLECTION_SELECT_FIELDS)
    .eq('slug', normalizedSlug)
    .limit(1)
    .maybeSingle();

  if (publishedOnly) {
    collectionQuery = collectionQuery.eq('is_published', true);
  }

  const { data, error } = await withTimeout(
    collectionQuery,
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao carregar album da galeria.'
  );

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const collection = normalizeCollectionRow(data);
  const mediaRows = await fetchGalleryMedia([collection]);
  const [resolvedCollection] = attachMediaToCollections([collection], mediaRows);
  return resolvedCollection || null;
};

export const createGalleryCollection = async (input) => {
  ensureSupabase();

  const payload = normalizeCollectionInput(input);
  if (!payload.title) {
    throw new Error('Informe o nome do album.');
  }

  if (!payload.display_year) {
    throw new Error("O campo 'Ano' e obrigatorio.");
  }

  const { data, error } = await withTimeout(
    supabase
      .from(GALLERY_COLLECTIONS_TABLE)
      .insert(payload)
      .select(COLLECTION_SELECT_FIELDS)
      .single(),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao criar album.'
  );

  if (error) {
    throw error;
  }

  return normalizeCollectionRow(data);
};

export const updateGalleryCollection = async (id, input) => {
  ensureSupabase();

  if (!id) {
    throw new Error('Album invalido.');
  }

  const payload = normalizeCollectionInput(input);
  if (!payload.title) {
    throw new Error('Informe o nome do album.');
  }

  if (!payload.display_year) {
    throw new Error("O campo 'Ano' e obrigatorio.");
  }

  const { data, error } = await withTimeout(
    supabase
      .from(GALLERY_COLLECTIONS_TABLE)
      .update(payload)
      .eq('id', id)
      .select(COLLECTION_SELECT_FIELDS)
      .single(),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao atualizar album.'
  );

  if (error) {
    throw error;
  }

  return normalizeCollectionRow(data);
};

export const deleteGalleryCollection = async (id) => {
  ensureSupabase();

  if (!id) {
    throw new Error('Album invalido.');
  }

  const { error } = await withTimeout(
    supabase.from(GALLERY_COLLECTIONS_TABLE).delete().eq('id', id),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao excluir album.'
  );

  if (error) {
    throw error;
  }
};

const normalizeMediaInsertInput = (item = {}, index = 0) => ({
  collection_id: item.collectionId,
  path: normalizeText(item.path),
  thumb_path: normalizeText(item.thumbPath),
  medium_path: normalizeText(item.mediumPath),
  src_url: normalizeText(item.srcUrl),
  thumb_url: normalizeText(item.thumbUrl),
  alt_text: normalizeText(item.altText),
  caption: normalizeText(item.caption),
  sort_order: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
  is_featured: Boolean(item.isFeatured),
});

export const createGalleryMediaBatch = async (collectionId, mediaItems = []) => {
  ensureSupabase();

  if (!collectionId) {
    throw new Error('Album invalido.');
  }

  const payload = mediaItems
    .map((item, index) =>
      normalizeMediaInsertInput(
        {
          ...item,
          collectionId,
        },
        index
      )
    )
    .filter((item) => item.path || item.src_url);

  if (payload.length === 0) {
    return [];
  }

  const { data, error } = await withTimeout(
    supabase.from(GALLERY_MEDIA_TABLE).insert(payload).select(MEDIA_SELECT_FIELDS),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao salvar fotos da galeria.'
  );

  if (error) {
    throw error;
  }

  return (data || [])
    .map((row, index) => normalizeMediaRow(row, 'Album', index))
    .filter(Boolean);
};

export const deleteGalleryMedia = async (mediaId) => {
  ensureSupabase();

  if (!mediaId) {
    throw new Error('Foto invalida.');
  }

  const { error } = await withTimeout(
    supabase.from(GALLERY_MEDIA_TABLE).delete().eq('id', mediaId),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao excluir foto.'
  );

  if (error) {
    throw error;
  }
};

export const setGalleryCollectionCover = async (collectionId, mediaId) => {
  ensureSupabase();

  if (!collectionId || !mediaId) {
    throw new Error('Album ou foto invalida para definir capa.');
  }

  const { data, error } = await withTimeout(
    supabase
      .from(GALLERY_COLLECTIONS_TABLE)
      .update({ cover_media_id: mediaId })
      .eq('id', collectionId)
      .select(COLLECTION_SELECT_FIELDS)
      .single(),
    REQUEST_TIMEOUT_MS,
    'Tempo limite ao definir capa do album.'
  );

  if (error) {
    throw error;
  }

  return normalizeCollectionRow(data);
};

export const reorderGalleryMedia = async (collectionId, orderedMediaIds = []) => {
  ensureSupabase();

  if (!collectionId) {
    throw new Error('Album invalido.');
  }

  const normalizedIds = orderedMediaIds.map((id) => String(id || '').trim()).filter(Boolean);
  if (normalizedIds.length === 0) {
    return;
  }

  const updates = normalizedIds.map((mediaId, index) =>
    withTimeout(
      supabase
        .from(GALLERY_MEDIA_TABLE)
        .update({ sort_order: index })
        .eq('id', mediaId)
        .eq('collection_id', collectionId),
      REQUEST_TIMEOUT_MS,
      'Tempo limite ao reordenar fotos da galeria.'
    )
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw failed.error;
  }
};
