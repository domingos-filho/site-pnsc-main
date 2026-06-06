import { isSupabaseReady, supabase } from '@/lib/supabaseClient';
import { uploadImageFile } from '@/lib/supabaseStorage';

export const TABLE_SALES_BUCKET = 'table-sales-media';
const SIGNED_URL_EXPIRES_IN = 60 * 60;
const TABLE_SALES_EVENT_IMAGE_UPLOAD_OPTIONS = {
  storeOriginal: false,
  generateThumbnail: false,
  generateMedium: true,
  mediumMaxWidth: 2000,
  mediumMaxHeight: 2000,
  mediumQuality: 0.86,
};

export const isTableSalesStorageReady = () => Boolean(isSupabaseReady && supabase);

export const uploadTableSalesEventImage = async ({ tableSalesEventId, file }) => {
  if (!isTableSalesStorageReady()) {
    throw new Error('Supabase nao configurado para imagens do evento de mesas.');
  }

  const upload = await uploadImageFile({
    file,
    folder: String(tableSalesEventId),
    bucket: TABLE_SALES_BUCKET,
    ...TABLE_SALES_EVENT_IMAGE_UPLOAD_OPTIONS,
  });

  return {
    path: upload.mediumPath || upload.path || upload.originalPath,
    fileName: upload.primaryFileName || file?.name || null,
    mimeType: upload.primaryMimeType || file?.type || null,
    fileSizeBytes: upload.primaryFileSize || file?.size || null,
  };
};

export const removeTableSalesStorageObject = async (path) => {
  if (!isTableSalesStorageReady() || !path) return;

  const { error } = await supabase.storage.from(TABLE_SALES_BUCKET).remove([path]);
  if (error) {
    throw error;
  }
};

export const getTableSalesSignedUrl = async (path) => {
  if (!isTableSalesStorageReady() || !path) return null;

  const { data, error } = await supabase.storage
    .from(TABLE_SALES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN);

  if (error) {
    throw error;
  }

  return data?.signedUrl || null;
};
