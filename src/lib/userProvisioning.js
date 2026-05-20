import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/functions-js';
import { isSupabaseReady, supabase } from '@/lib/supabaseClient';

export const getProvisionUserFunctionName = () =>
  import.meta.env.VITE_SUPABASE_PROVISION_USER_FUNCTION || 'provision-user';

const parseFunctionError = async (error) => {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const payload = await error.context.json();
      return payload?.error || payload?.message || payload?.msg || payload?.details || error.message;
    } catch {
      try {
        const text = await error.context.text();
        return text || error.message;
      } catch {
        return error.message;
      }
    }
  }

  if (error instanceof FunctionsRelayError) {
    return 'O gateway do Supabase não conseguiu alcançar a Edge Function.';
  }

  if (error instanceof FunctionsFetchError) {
    return 'Falha de rede ao chamar a Edge Function de provisionamento.';
  }

  return error?.message || 'Falha ao provisionar o usuário.';
};

export const provisionUserFromDashboard = async (payload) => {
  if (!isSupabaseReady || !supabase) {
    throw new Error('Supabase não configurado.');
  }

  const { data, error } = await supabase.functions.invoke(getProvisionUserFunctionName(), {
    body: payload,
  });

  if (error) {
    throw new Error(await parseFunctionError(error));
  }

  if (!data || typeof data !== 'object') {
    throw new Error('A Edge Function retornou uma resposta inválida.');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
};
