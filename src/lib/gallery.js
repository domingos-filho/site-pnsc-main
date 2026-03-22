import { getPublicStorageUrl } from '@/lib/supabaseClient';

const slugify = (value) =>
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
      thumbSrc: image,
      alt: `${albumTitle} - Foto ${index + 1}`,
      path: null,
      thumbPath: null,
    };
  }

  const src = getPublicStorageUrl(image.path) || image.src || image.url || '';
  if (!src) return null;

  const thumbSrc =
    getPublicStorageUrl(image.thumbPath) || image.thumbSrc || image.thumbUrl || src;

  return {
    id: image.id || image.path || image.thumbPath || src,
    src,
    thumbSrc,
    alt: image.alt || `${albumTitle} - Foto ${index + 1}`,
    path: image.path || null,
    thumbPath: image.thumbPath || null,
  };
};

export const normalizeGalleryAlbum = (album, fallbackIndex = 0) => {
  const title = normalizeAlbumTitle(album, fallbackIndex);
  const images = (Array.isArray(album?.images) ? album.images : [])
    .map((image, index) => normalizeGalleryImage(image, title, index))
    .filter(Boolean);

  return {
    id: album?.id || buildAlbumFallbackId(album, fallbackIndex),
    title,
    year: album?.year ?? '',
    community: normalizeText(album?.community),
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
              thumbSrc: photo?.thumbUrl || photo?.thumbSrc,
              alt: photo?.alt,
              path: photo?.path || null,
              thumbPath: photo?.thumbPath || null,
            })),
        },
        albumIndex
      )
    )
    .filter((album) => album.images.length > 0 || album.title || album.community || album.year);
