import { isSupabaseReady, supabase } from '@/lib/supabaseClient';

export const INVENTORY_BUCKET = 'inventory-media';
const SIGNED_URL_EXPIRES_IN = 60 * 60;

const safeFileName = (fileName) =>
  String(fileName || 'arquivo')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

const uniqueSuffix = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const isInventoryStorageReady = () => Boolean(isSupabaseReady && supabase);

export const formatInventoryError = (error, fallback = 'Não foi possível concluir a operação.') =>
  error?.message || fallback;

export const buildInventoryAttachmentPath = (inventoryItemId, fileName) =>
  `${inventoryItemId}/${uniqueSuffix()}-${safeFileName(fileName)}`;

export const uploadInventoryAttachmentFile = async ({ inventoryItemId, file }) => {
  if (!isInventoryStorageReady()) {
    throw new Error('Supabase não configurado para anexos do inventário.');
  }

  const path = buildInventoryAttachmentPath(inventoryItemId, file?.name);
  const { error } = await supabase.storage.from(INVENTORY_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file?.type || 'application/octet-stream',
  });

  if (error) {
    throw error;
  }

  return path;
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
