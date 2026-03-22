import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseReady } from '@/lib/supabaseClient';

const AuthContext = createContext();

const ROLE_LEVELS = {
  member: 1,
  secretary: 2,
  admin: 3,
};

const REQUEST_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms, message) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const getFallbackName = (authUser) => {
  if (!authUser) return 'Usuario';
  const metaName = authUser.user_metadata?.full_name || authUser.user_metadata?.name;
  if (metaName) return metaName;
  if (authUser.email) return authUser.email.split('@')[0];
  return 'Usuario';
};

const mapUser = (authUser, profile) => {
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile?.name || getFallbackName(authUser),
    role: profile?.role || 'member',
  };
};

const fetchProfile = async (authUser) => {
  if (!authUser || !isSupabaseReady) return { profile: null, error: null };

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('id, name, role, email')
        .eq('id', authUser.id)
        .maybeSingle(),
      REQUEST_TIMEOUT_MS,
      'Tempo limite ao carregar perfil.'
    );

    if (error) {
      console.error('Falha ao carregar perfil', error);
      return { profile: null, error };
    }

    return { profile: data, error: null };
  } catch (error) {
    console.error('Falha ao carregar perfil', error);
    return { profile: null, error };
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!isSupabaseReady) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      let sessionUser = null;
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          REQUEST_TIMEOUT_MS,
          'Tempo limite ao verificar sessao.'
        );
        sessionUser = data?.session?.user || null;
      } catch (error) {
        console.error('Falha ao carregar sessao', error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      if (!isMounted) return;

      if (sessionUser) {
        const { profile, error } = await fetchProfile(sessionUser);
        if (!isMounted) return;
        if (!profile || error) {
          await supabase.auth.signOut();
          setUser(null);
        } else {
          setUser(mapUser(sessionUser, profile));
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    init();

    if (!isSupabaseReady) return () => {};

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;
        const sessionUser = session?.user;
        if (sessionUser) {
          const { profile, error } = await fetchProfile(sessionUser);
          if (!isMounted) return;
          if (!profile || error) {
            await supabase.auth.signOut();
            setUser(null);
          } else {
            setUser(mapUser(sessionUser, profile));
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    if (!isSupabaseReady) {
      return { success: false, error: 'Supabase nao configurado.' };
    }

    let data;
    let error;
    try {
      const response = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        REQUEST_TIMEOUT_MS,
        'Tempo limite ao autenticar. Verifique sua conexao e o Supabase.'
      );
      data = response.data;
      error = response.error;
    } catch (err) {
      return { success: false, error: err?.message || 'Falha ao autenticar.' };
    }

    if (error) {
      return { success: false, error: error.message };
    }

    const sessionUser = data?.user;
    if (sessionUser) {
      const { profile, error: profileError } = await fetchProfile(sessionUser);
      if (!profile) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: profileError
            ? 'Nao foi possivel validar o perfil. Tente novamente.'
            : 'Usuario nao autorizado. Contate a PASCOM.',
        };
      }
      setUser(mapUser(sessionUser, profile));
    }

    return { success: true };
  };

  const logout = async () => {
    if (isSupabaseReady) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  const refreshProfile = async () => {
    if (!user || !isSupabaseReady) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, email')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return null;

    if (data) {
      setUser((prev) =>
        prev ? { ...prev, name: data.name || prev.name, role: data.role || prev.role } : prev
      );
    }

    return data;
  };

  const roleLevel = ROLE_LEVELS[user?.role] || 0;

  const value = {
    user,
    loading,
    login,
    logout,
    refreshProfile,
    isAdmin: user?.role === 'admin',
    isSecretary: user?.role === 'secretary',
    isManager: user?.role === 'admin' || user?.role === 'secretary',
    isMember: ['member', 'secretary', 'admin'].includes(user?.role),
    roleLevel,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
