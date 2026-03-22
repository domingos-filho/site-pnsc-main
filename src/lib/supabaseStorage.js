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

const createThumbnailFile = async (file, { maxWidth = 800, maxHeight = 800, quality = 0.82 } = {}) => {
  const image = await loadImageFromFile(file);
  const width = image.width || image.naturalWidth || 0;
  const height = image.height || image.naturalHeight || 0;

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
    throw new Error('Nao foi possivel criar o canvas da miniatura.');
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const isPng = file.type === 'image/png';
  const outputType = isPng ? 'image/png' : 'image/jpeg';

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao gerar miniatura.'))),
      outputType,
      isPng ? undefined : quality
    );
  });

  const baseName = safeFileName(file.name || 'imagem').replace(/\.[^/.]+$/, '') || 'imagem';
  const extension = outputType === 'image/png' ? 'png' : 'jpg';
  return new File([blob], `${baseName}-thumb.${extension}`, { type: outputType });
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
  generateThumbnail = false,
  thumbnailMaxWidth = 800,
  thumbnailMaxHeight = 800,
  thumbnailQuality = 0.82,
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
  const path = `${folder}/${suffix}-${fileName}`;
  const contentType = file.type || 'application/octet-stream';

  const { error: uploadError } = await withTimeout(
    supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    }),
    20000,
    'Tempo limite no upload. Verifique as politicas do Storage e sua conexao.'
  );

  if (uploadError) {
    throw new Error(formatStorageError(uploadError, 'Falha ao enviar a imagem.'));
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  let thumbUrl = null;
  let thumbPath = null;

  if (generateThumbnail) {
    try {
      const thumbFile = await createThumbnailFile(file, {
        maxWidth: thumbnailMaxWidth,
        maxHeight: thumbnailMaxHeight,
        quality: thumbnailQuality,
      });

      const baseName = fileName.replace(/\.[^/.]+$/, '') || 'imagem';
      const thumbExtension = thumbFile.type === 'image/png' ? 'png' : 'jpg';
      thumbPath = `${folder}/thumbs/${suffix}-${baseName}.${thumbExtension}`;

      const { error: thumbError } = await withTimeout(
        supabase.storage.from(bucket).upload(thumbPath, thumbFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: thumbFile.type,
        }),
        20000,
        'Tempo limite no upload da miniatura.'
      );

      if (thumbError) {
        throw thumbError;
      }

      const { data: thumbData } = supabase.storage.from(bucket).getPublicUrl(thumbPath);
      thumbUrl = thumbData.publicUrl;
    } catch (error) {
      console.warn('Falha ao gerar/enviar miniatura', error);
      thumbUrl = null;
      thumbPath = null;
    }
  }

  return {
    publicUrl: data.publicUrl,
    path,
    thumbUrl,
    thumbPath,
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
