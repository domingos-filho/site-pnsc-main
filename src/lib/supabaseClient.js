import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseReady = Boolean(supabase);

export const getSupabaseBucket = () =>
  import.meta.env.VITE_SUPABASE_BUCKET || 'pnsc-media';

export const getPublicStorageUrl = (path, bucket = getSupabaseBucket()) => {
  if (!supabase || !path || !bucket) return null;

  const normalizedPath = String(path).trim().replace(/^\/+/, '');
  if (!normalizedPath) return null;

  const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
  return data?.publicUrl || null;
};
