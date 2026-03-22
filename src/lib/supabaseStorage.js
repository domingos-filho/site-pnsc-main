import { supabase, getSupabaseBucket, isSupabaseReady } from '@/lib/supabaseClient';

export { isSupabaseReady };

const withTimeout = (promise, ms, message) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const normalizeBucket = (bucket) => {
  if (!bucket) return '';
  return String(bucket).trim().replace(/^\/+|\/+$/g, '');
};

const safeFileName = (fileName) =>
  fileName
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

const uniqueSuffix = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const loadImageFromFile = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (error) {
      // fallback to Image element
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar a imagem para miniatura.'));
    };
    img.src = url;
  });
};

const createResizedImageFile = async (
  file,
  { maxWidth = 800, maxHeight = 800, quality = 0.82, label = 'resized' } = {},
  image = null
) => {
  const sourceImage = image || (await loadImageFromFile(file));
  const width = sourceImage.width || sourceImage.naturalWidth || 0;
  const height = sourceImage.height || sourceImage.naturalHeight || 0;

  if (!width || !height) {
    throw new Error('Nao foi possivel ler as dimensoes da imagem.');
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Nao foi possivel criar o canvas da imagem.');
  }

  ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

  const isPng = file.type === 'image/png';
  const outputType = isPng ? 'image/png' : 'image/jpeg';

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao gerar imagem redimensionada.'))),
      outputType,
      isPng ? undefined : quality
    );
  });

  const baseName = safeFileName(file.name || 'imagem').replace(/\.[^/.]+$/, '') || 'imagem';
  const extension = outputType === 'image/png' ? 'png' : 'jpg';
  return new File([blob], `${baseName}-${label}.${extension}`, { type: outputType });
};

const uploadStorageObject = async ({ bucket, path, file, timeoutMessage }) => {
  const { error } = await withTimeout(
    supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    }),
    20000,
    timeoutMessage
  );

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

const formatStorageError = (error, fallbackMessage) => {
  if (!error) return fallbackMessage;
  const message = error?.message || String(error);
  const status = error?.statusCode || error?.status;
  const normalized = message.toLowerCase();

  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Falha de conexao com o Supabase Storage. Verifique sua internet e o URL do projeto.';
  }
  if (message.includes('row-level security')) {
    return 'Permissao negada no Storage. Verifique as politicas de RLS do bucket.';
  }
  if (status === 404 || (normalized.includes('bucket') && normalized.includes('not found'))) {
    return 'Bucket do Storage nao encontrado. Verifique o nome configurado em VITE_SUPABASE_BUCKET.';
  }
  if (status === 403 || normalized.includes('permission denied')) {
    return 'Permissao negada no Storage. Verifique as politicas de acesso do bucket.';
  }
  if (message.includes('JWT')) {
    return 'Chave anon invalida ou expirada. Verifique as credenciais do Supabase.';
  }
  return message;
};

export const uploadImageFile = async ({
  file,
  folder,
  storeOriginal = true,
  generateThumbnail = false,
  thumbnailMaxWidth = 800,
  thumbnailMaxHeight = 800,
  thumbnailQuality = 0.82,
  generateMedium = false,
  mediumMaxWidth = 1600,
  mediumMaxHeight = 1600,
  mediumQuality = 0.86,
} = {}) => {
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }

  const bucket = normalizeBucket(getSupabaseBucket());
  if (!bucket) {
    throw new Error('Bucket do Storage nao configurado.');
  }

  const fileName = safeFileName(file.name || 'imagem');
  const suffix = uniqueSuffix();
  const baseName = fileName.replace(/\.[^/.]+$/, '') || 'imagem';
  const originalPath = storeOriginal ? `${folder}/${suffix}-${fileName}` : null;
  let originalUrl = null;
  let thumbUrl = null;
  let thumbPath = null;
  let mediumUrl = null;
  let mediumPath = null;
  let loadedImage = null;

  const ensureLoadedImage = async () => {
    if (!loadedImage) {
      loadedImage = await loadImageFromFile(file);
    }
    return loadedImage;
  };

  if (storeOriginal && originalPath) {
    try {
      originalUrl = await uploadStorageObject({
        bucket,
        path: originalPath,
        file,
        timeoutMessage: 'Tempo limite no upload. Verifique as politicas do Storage e sua conexao.',
      });
    } catch (error) {
      throw new Error(formatStorageError(error, 'Falha ao enviar a imagem.'));
    }
  }

  if (generateMedium) {
    try {
      const mediumFile = await createResizedImageFile(
        file,
        {
          maxWidth: mediumMaxWidth,
          maxHeight: mediumMaxHeight,
          quality: mediumQuality,
          label: 'medium',
        },
        await ensureLoadedImage()
      );

      const mediumExtension = mediumFile.type === 'image/png' ? 'png' : 'jpg';
      mediumPath = `${folder}/medium/${suffix}-${baseName}.${mediumExtension}`;
      mediumUrl = await uploadStorageObject({
        bucket,
        path: mediumPath,
        file: mediumFile,
        timeoutMessage: 'Tempo limite no upload da versao media.',
      });
    } catch (error) {
      console.warn('Falha ao gerar/enviar versao media', error);
      mediumUrl = null;
      mediumPath = null;
    }
  }

  if (generateThumbnail) {
    try {
      const thumbFile = await createResizedImageFile(
        file,
        {
          maxWidth: thumbnailMaxWidth,
          maxHeight: thumbnailMaxHeight,
          quality: thumbnailQuality,
          label: 'thumb',
        },
        await ensureLoadedImage()
      );

      const thumbExtension = thumbFile.type === 'image/png' ? 'png' : 'jpg';
      thumbPath = `${folder}/thumbs/${suffix}-${baseName}.${thumbExtension}`;

      thumbUrl = await uploadStorageObject({
        bucket,
        path: thumbPath,
        file: thumbFile,
        timeoutMessage: 'Tempo limite no upload da miniatura.',
      });
    } catch (error) {
      console.warn('Falha ao gerar/enviar miniatura', error);
      thumbUrl = null;
      thumbPath = null;
    }
  }

  if (loadedImage && typeof loadedImage.close === 'function') {
    loadedImage.close();
  }

  const primaryUrl = originalUrl || mediumUrl || thumbUrl;
  const primaryPath = originalPath || mediumPath || thumbPath;

  if (!primaryUrl || !primaryPath) {
    throw new Error('Falha ao gerar arquivos otimizados da imagem.');
  }

  return {
    publicUrl: primaryUrl,
    path: primaryPath,
    originalUrl,
    originalPath,
    thumbUrl,
    thumbPath,
    mediumUrl,
    mediumPath,
  };
};

export const deleteStoragePaths = async (paths) => {
  if (!supabase || !paths || paths.length === 0) {
    return;
  }

  const bucket = normalizeBucket(getSupabaseBucket());
  if (!bucket) {
    throw new Error('Bucket do Storage nao configurado.');
  }

  const { error } = await withTimeout(
    supabase.storage.from(bucket).remove(paths),
    15000,
    'Tempo limite ao remover arquivos do Storage.'
  );

  if (error) {
    throw new Error(formatStorageError(error, 'Falha ao remover arquivos do storage.'));
  }
};
