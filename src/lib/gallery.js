import { getPublicStorageUrl } from '@/lib/supabaseClient';

export const slugify = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/[-\s]+/g, '-')
    .toLowerCase();

const normalizeText = (value) => String(value || '').trim();

const normalizeAlbumTitle = (album, fallbackIndex = 0) =>
  normalizeText(album?.title || album?.name) || `Album ${fallbackIndex + 1}`;

const buildAlbumFallbackId = (album, fallbackIndex = 0) => {
  const title = normalizeAlbumTitle(album, fallbackIndex);
  const year = normalizeText(album?.year);
  const community = normalizeText(album?.community);
  const slug = slugify([title, year, community].filter(Boolean).join('-'));

  return slug ? `album-${slug}` : `album-${fallbackIndex + 1}`;
};

export const normalizeGalleryImage = (image, albumTitle = 'Album', index = 0) => {
  if (!image) return null;

  if (typeof image === 'string') {
    return {
      id: `${slugify(albumTitle) || 'album'}-image-${index + 1}`,
      src: image,
      mediumSrc: image,
      thumbSrc: image,
      alt: `${albumTitle} - Foto ${index + 1}`,
      path: null,
      mediumPath: null,
      thumbPath: null,
    };
  }

  const mediumSrc =
    getPublicStorageUrl(image.mediumPath) ||
    image.mediumSrc ||
    image.mediumUrl ||
    getPublicStorageUrl(image.path) ||
    image.src ||
    image.url ||
    '';
  const src = mediumSrc;
  if (!src) return null;

  const thumbSrc =
    getPublicStorageUrl(image.thumbPath) || image.thumbSrc || image.thumbUrl || src;

  return {
    id: image.id || image.mediumPath || image.path || image.thumbPath || src,
    src,
    mediumSrc,
    thumbSrc,
    alt: image.alt || `${albumTitle} - Foto ${index + 1}`,
    path: image.path || null,
    mediumPath: image.mediumPath || null,
    thumbPath: image.thumbPath || null,
  };
};

export const normalizeGalleryAlbum = (album, fallbackIndex = 0) => {
  const title = normalizeAlbumTitle(album, fallbackIndex);
  const coverMediaId = normalizeText(album?.coverMediaId || album?.cover_media_id) || null;
  const rawImages = (Array.isArray(album?.images) ? album.images : [])
    .map((image, index) => normalizeGalleryImage(image, title, index))
    .filter(Boolean);
  const resolvedCoverId =
    (coverMediaId && rawImages.some((image) => image.id === coverMediaId))
      ? coverMediaId
      : rawImages[0]?.id || null;
  const images = rawImages.map((image) => ({
    ...image,
    isCover: image.id === resolvedCoverId,
  }));
  const coverImage = images.find((image) => image.id === resolvedCoverId) || null;

  const year = album?.year ?? '';
  const community = normalizeText(album?.community);

  return {
    id: album?.id || buildAlbumFallbackId(album, fallbackIndex),
    slug: normalizeText(album?.slug) || slugify([title, year, community].filter(Boolean).join('-')),
    title,
    year,
    community,
    summary: normalizeText(album?.summary),
    description: normalizeText(album?.description),
    category: normalizeText(album?.category),
    tags: Array.isArray(album?.tags) ? album.tags.map((tag) => normalizeText(tag)).filter(Boolean) : [],
    eventDate: normalizeText(album?.eventDate || album?.event_date),
    endDate: normalizeText(album?.endDate || album?.end_date),
    photoCount: Number(album?.photoCount || images.length || 0),
    isPublished: album?.isPublished !== false,
    coverMediaId: resolvedCoverId,
    coverImage,
    images,
  };
};

const buildAlbumKey = (album) => {
  const normalizedAlbum = normalizeGalleryAlbum(album);
  return [
    slugify(normalizedAlbum.title),
    normalizeText(normalizedAlbum.year),
    slugify(normalizedAlbum.community),
  ].join('::');
};

const buildImageKey = (image) => {
  const normalizedImage = normalizeGalleryImage(image);
  if (!normalizedImage) return '';

  return [
    normalizedImage.path,
    normalizedImage.mediumPath,
    normalizedImage.thumbPath,
    normalizedImage.src,
    normalizedImage.id,
  ]
    .filter(Boolean)
    .join('::');
};

export const normalizeGallery = (gallery = []) =>
  (Array.isArray(gallery) ? gallery : [])
    .map((album, index) => normalizeGalleryAlbum(album, index))
    .filter((album) => album.title);

export const mergeGalleryCollections = (primary = [], secondary = []) => {
  const galleryMap = new Map();

  normalizeGallery(primary).forEach((album) => {
    galleryMap.set(buildAlbumKey(album), { ...album, images: [...album.images] });
  });

  normalizeGallery(secondary).forEach((album) => {
    const albumKey = buildAlbumKey(album);
    const existingAlbum = galleryMap.get(albumKey);

    if (!existingAlbum) {
      galleryMap.set(albumKey, { ...album, images: [...album.images] });
      return;
    }

    const imageMap = new Map();
    existingAlbum.images.forEach((image) => {
      imageMap.set(buildImageKey(image), image);
    });
    album.images.forEach((image) => {
      const imageKey = buildImageKey(image);
      if (!imageMap.has(imageKey)) {
        imageMap.set(imageKey, image);
      }
    });

    galleryMap.set(albumKey, {
      ...existingAlbum,
      year: existingAlbum.year || album.year,
      community: existingAlbum.community || album.community,
      coverMediaId: existingAlbum.coverMediaId || album.coverMediaId,
      coverImage: existingAlbum.coverImage || album.coverImage,
      images: [...imageMap.values()],
    });
  });

  return [...galleryMap.values()];
};

export const buildGalleryFromLegacyStorage = ({ albums = [], photos = [] } = {}) =>
  (Array.isArray(albums) ? albums : [])
    .map((album, albumIndex) =>
      normalizeGalleryAlbum(
        {
          id: album?.id,
          title: album?.title || album?.name,
          year: album?.year || '',
          community: album?.community || '',
          images: (Array.isArray(photos) ? photos : [])
            .filter((photo) => String(photo?.albumId) === String(album?.id))
            .map((photo) => ({
              id: photo?.id,
              src: photo?.url || photo?.src,
              mediumSrc: photo?.mediumUrl || photo?.mediumSrc,
              thumbSrc: photo?.thumbUrl || photo?.thumbSrc,
              alt: photo?.alt,
              path: photo?.path || null,
              mediumPath: photo?.mediumPath || null,
              thumbPath: photo?.thumbPath || null,
            })),
        },
        albumIndex
      )
    )
    .filter((album) => album.images.length > 0 || album.title || album.community || album.year);
