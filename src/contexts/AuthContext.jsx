import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseReady } from '@/lib/supabaseClient';
import { ALL_AUTHENTICATED_ROLES } from '@/lib/accessControl';

const AuthContext = createContext();

const ROLE_LEVELS = {
  member: 1,
  secretary: 2,
  treasurer: 2,
  articulator: 2,
  admin: 3,
};

const REQUEST_TIMEOUT_MS = 15000;
const PROFILE_SELECT = `
  id,
  name,
  role,
  email,
  profile_org_units (
    org_unit_id,
    membership_role,
    is_primary,
    org_units (
      id,
      type,
      slug,
      name
    )
  ),
  profile_module_access (
    module_key,
    can_read,
    can_write,
    can_approve,
    can_admin
  )
`;

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
  if (!authUser) return 'Usuário';
  const metaName = authUser.user_metadata?.full_name || authUser.user_metadata?.name;
  if (metaName) return metaName;
  if (authUser.email) return authUser.email.split('@')[0];
  return 'Usuário';
};

const normalizeOrgUnits = (profile) =>
  (profile?.profile_org_units || []).map((link) => {
    const orgUnit = Array.isArray(link.org_units) ? link.org_units[0] : link.org_units;

    return {
      orgUnitId: link.org_unit_id,
      membershipRole: link.membership_role || '',
      isPrimary: Boolean(link.is_primary),
      orgUnit: orgUnit || null,
    };
  });

const normalizeModuleAccess = (profile) =>
  (profile?.profile_module_access || []).map((access) => ({
    moduleKey: access.module_key,
    canRead: Boolean(access.can_read),
    canWrite: Boolean(access.can_write),
    canApprove: Boolean(access.can_approve),
    canAdmin: Boolean(access.can_admin),
  }));

const mapUser = (authUser, profile) => {
  if (!authUser) return null;

  const orgUnits = normalizeOrgUnits(profile);
  const moduleAccess = normalizeModuleAccess(profile);

  return {
    id: authUser.id,
    email: authUser.email,
    name: profile?.name || getFallbackName(authUser),
    role: profile?.role || 'member',
    orgUnits,
    moduleAccess,
    accessibleModules: moduleAccess
      .filter((access) => access.canRead || access.canWrite || access.canApprove || access.canAdmin)
      .map((access) => access.moduleKey),
  };
};

const fetchProfile = async (authUser) => {
  if (!authUser || !isSupabaseReady) return { profile: null, error: null };

  try {
    const { data, error } = await withTimeout(
      supabase.from('profiles').select(PROFILE_SELECT).eq('id', authUser.id).maybeSingle(),
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
    let authStateTimerId = null;

    const syncUserFromSession = async (sessionUser) => {
      if (!isMounted) return;

      if (sessionUser) {
        const { profile, error } = await fetchProfile(sessionUser);
        if (!isMounted) return;

        if (!profile || error) {
          await supabase.auth.signOut({ scope: 'local' });
          if (isMounted) {
            setUser(null);
          }
        } else {
          setUser(mapUser(sessionUser, profile));
        }
      } else {
        setUser(null);
      }

      if (isMounted) {
        setLoading(false);
      }
    };

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
          'Tempo limite ao verificar sessão.'
        );
        sessionUser = data?.session?.user || null;
      } catch (error) {
        console.error('Falha ao carregar sessão', error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      if (!isMounted) return;
      await syncUserFromSession(sessionUser);
    };

    init();

    if (!isSupabaseReady) return () => {};

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (authStateTimerId) {
        clearTimeout(authStateTimerId);
      }

      // Supabase recommends deferring extra client calls here to avoid auth deadlocks.
      authStateTimerId = window.setTimeout(() => {
        authStateTimerId = null;
        void syncUserFromSession(session?.user || null);
      }, 0);
    });

    return () => {
      isMounted = false;
      if (authStateTimerId) {
        clearTimeout(authStateTimerId);
      }
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    if (!isSupabaseReady) {
      return { success: false, error: 'Supabase não configurado.' };
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
        'Tempo limite ao autenticar. Verifique sua conexão e o Supabase.'
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
            ? 'Não foi possível validar o perfil. Tente novamente.'
            : 'Usuário não autorizado. Contate a PASCOM.',
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

    const authUser = {
      id: user.id,
      email: user.email,
      user_metadata: {
        name: user.name,
      },
    };

    const { profile: data, error } = await fetchProfile(authUser);
    if (error) return null;

    if (data) {
      setUser(mapUser(authUser, data));
    }

    return data;
  };

  const hasModuleAccess = (moduleKey, permission = 'read') => {
    if (user?.role === 'admin') return true;

    const access = user?.moduleAccess?.find((item) => item.moduleKey === moduleKey);
    if (!access) return false;

    const permissionMap = {
      read: access.canRead,
      write: access.canWrite,
      approve: access.canApprove,
      admin: access.canAdmin,
    };

    return Boolean(permissionMap[permission]);
  };

  const roleLevel = ROLE_LEVELS[user?.role] || 0;

  const value = {
    user,
    loading,
    login,
    logout,
    refreshProfile,
    hasModuleAccess,
    isAdmin: user?.role === 'admin',
    isSecretary: user?.role === 'secretary',
    isManager: user?.role === 'admin' || user?.role === 'secretary',
    isMember: ALL_AUTHENTICATED_ROLES.includes(user?.role),
    roleLevel,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
