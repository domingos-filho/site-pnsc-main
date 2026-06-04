import { isSupabaseReady, supabase } from '@/lib/supabaseClient';
import { uploadImageFile } from '@/lib/supabaseStorage';

export const INVENTORY_BUCKET = 'inventory-media';
const SIGNED_URL_EXPIRES_IN = 60 * 60;
const INVENTORY_IMAGE_UPLOAD_OPTIONS = {
  storeOriginal: false,
  generateThumbnail: false,
  generateMedium: true,
  mediumMaxWidth: 1600,
  mediumMaxHeight: 1600,
  mediumQuality: 0.86,
};

export const isInventoryStorageReady = () => Boolean(isSupabaseReady && supabase);

export const formatInventoryError = (error, fallback = 'Não foi possível concluir a operação.') =>
  error?.message || fallback;

export const uploadInventoryAttachmentFile = async ({ inventoryItemId, file }) => {
  if (!isInventoryStorageReady()) {
    throw new Error('Supabase não configurado para anexos do inventário.');
  }

  const upload = await uploadImageFile({
    file,
    folder: String(inventoryItemId),
    bucket: INVENTORY_BUCKET,
    ...INVENTORY_IMAGE_UPLOAD_OPTIONS,
  });

  return {
    path: upload.mediumPath || upload.path || upload.originalPath,
    fileName: upload.primaryFileName || file?.name || null,
    mimeType: upload.primaryMimeType || file?.type || null,
    fileSizeBytes: upload.primaryFileSize || file?.size || null,
  };
};

export const removeInventoryStorageObject = async (path) => {
  if (!isInventoryStorageReady() || !path) return;

  const { error } = await supabase.storage.from(INVENTORY_BUCKET).remove([path]);
  if (error) {
    throw error;
  }
};

export const getInventorySignedUrl = async (path) => {
  if (!isInventoryStorageReady() || !path) return null;

  const { data, error } = await supabase.storage
    .from(INVENTORY_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN);

  if (error) {
    throw error;
  }

  return data?.signedUrl || null;
};
