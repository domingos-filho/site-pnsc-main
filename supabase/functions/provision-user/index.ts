import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const ALLOWED_ROLES = new Set(['member', 'secretary', 'treasurer', 'articulator', 'admin']);
const DELIVERY_MODES = new Set(['temporary_password', 'invite']);

type OrgLinkInput = {
  orgUnitId?: string;
  membershipRole?: string;
  isPrimary?: boolean;
};

type ModuleAccessInput = {
  moduleKey?: string;
  canRead?: boolean;
  canWrite?: boolean;
  canApprove?: boolean;
  canAdmin?: boolean;
};

type ProvisionPayload = {
  name?: string;
  email?: string;
  role?: string;
  deliveryMode?: string;
  orgLinks?: OrgLinkInput[];
  moduleAccess?: ModuleAccessInput[];
};

const getEnv = (name: string) => {
  const value = Deno.env.get(name);
  return value ? value.trim() : '';
};

const createSupabaseClients = (authHeader: string) => {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('SUPABASE_PUBLIC_URL');
  const anonKey = getEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('As variáveis de ambiente da Edge Function não estão completas.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return { userClient, adminClient };
};

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const normalizeEmail = (value: unknown) => normalizeText(value).toLowerCase();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeRole = (value: unknown) => {
  const role = normalizeText(value);
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error('Perfil inválido para provisionamento.');
  }
  return role;
};

const normalizeDeliveryMode = (value: unknown) => {
  const mode = normalizeText(value) || 'temporary_password';
  if (!DELIVERY_MODES.has(mode)) {
    throw new Error('Modo de entrega inválido.');
  }
  return mode;
};

const normalizeOrgLinks = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized = value
    .map((item) => {
      const orgUnitId = normalizeText((item as OrgLinkInput)?.orgUnitId);
      if (!orgUnitId || seen.has(orgUnitId)) {
        return null;
      }

      seen.add(orgUnitId);

      return {
        orgUnitId,
        membershipRole: normalizeText((item as OrgLinkInput)?.membershipRole) || null,
        isPrimary: Boolean((item as OrgLinkInput)?.isPrimary),
      };
    })
    .filter(Boolean) as Array<{ orgUnitId: string; membershipRole: string | null; isPrimary: boolean }>;

  if (normalized.length > 0 && !normalized.some((item) => item.isPrimary)) {
    normalized[0].isPrimary = true;
  }

  return normalized.map((item) => ({
    ...item,
    isPrimary: normalized.length === 1 ? true : item.isPrimary,
  }));
};

const normalizePermissionAccess = (item: ModuleAccessInput) => {
  const canRead = Boolean(item.canRead);
  const canWrite = Boolean(item.canWrite);
  const canApprove = Boolean(item.canApprove);
  const canAdmin = Boolean(item.canAdmin);

  return {
    canRead: canRead || canWrite || canApprove || canAdmin,
    canWrite: canWrite || canApprove || canAdmin,
    canApprove: canApprove || canAdmin,
    canAdmin,
  };
};

const normalizeModuleAccess = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();

  return value
    .map((item) => {
      const moduleKey = normalizeText((item as ModuleAccessInput)?.moduleKey);
      if (!moduleKey || seen.has(moduleKey)) {
        return null;
      }

      seen.add(moduleKey);
      const access = normalizePermissionAccess(item as ModuleAccessInput);

      if (!access.canRead && !access.canWrite && !access.canApprove && !access.canAdmin) {
        return null;
      }

      return {
        moduleKey,
        ...access,
      };
    })
    .filter(Boolean) as Array<{
    moduleKey: string;
    canRead: boolean;
    canWrite: boolean;
    canApprove: boolean;
    canAdmin: boolean;
  }>;
};

const generateTemporaryPassword = (length = 18) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_';
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);

  return Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
};

const rollbackUser = async (adminClient: ReturnType<typeof createClient>, userId: string | null) => {
  if (!userId) return;
  await adminClient.auth.admin.deleteUser(userId);
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método não suportado.' }, { status: 405 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Cabeçalho de autorização ausente.' }, { status: 401 });
  }

  let payload: ProvisionPayload;
  try {
    payload = (await request.json()) as ProvisionPayload;
  } catch {
    return jsonResponse({ error: 'Corpo JSON inválido.' }, { status: 400 });
  }

  try {
    const { userClient, adminClient } = createSupabaseClients(authHeader);

    const {
      data: { user: callerUser },
      error: callerAuthError,
    } = await userClient.auth.getUser();

    if (callerAuthError || !callerUser) {
      return jsonResponse({ error: 'Sessão inválida para provisionamento.' }, { status: 401 });
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile || callerProfile.role !== 'admin') {
      return jsonResponse({ error: 'Apenas administradores podem criar usuários pelo painel.' }, { status: 403 });
    }

    const name = normalizeText(payload.name);
    const email = normalizeEmail(payload.email);
    const role = normalizeRole(payload.role);
    const deliveryMode = normalizeDeliveryMode(payload.deliveryMode);
    const orgLinks = normalizeOrgLinks(payload.orgLinks);
    const moduleAccess = normalizeModuleAccess(payload.moduleAccess);

    if (!email) {
      return jsonResponse({ error: 'E-mail é obrigatório.' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return jsonResponse({ error: 'E-mail inválido para provisionamento.' }, { status: 400 });
    }

    const displayName = name || email.split('@')[0] || 'Usuário';

    const { data: duplicateProfiles, error: duplicateProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .limit(1);

    if (duplicateProfileError) {
      throw duplicateProfileError;
    }

    if ((duplicateProfiles || []).length > 0) {
      return jsonResponse({ error: 'Já existe um perfil cadastrado com este e-mail.' }, { status: 409 });
    }

    if (orgLinks.length > 0) {
      const orgUnitIds = orgLinks.map((item) => item.orgUnitId);
      const { data: validOrgUnits, error: orgUnitsError } = await adminClient
        .from('org_units')
        .select('id')
        .in('id', orgUnitIds)
        .eq('is_active', true);

      if (orgUnitsError) {
        throw orgUnitsError;
      }

      const validIds = new Set((validOrgUnits || []).map((item) => item.id));
      const invalidIds = orgUnitIds.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return jsonResponse({ error: 'Há vínculos institucionais inválidos ou inativos no formulário.' }, { status: 400 });
      }
    }

    if (moduleAccess.length > 0) {
      const moduleKeys = moduleAccess.map((item) => item.moduleKey);
      const { data: validModules, error: modulesError } = await adminClient
        .from('app_modules')
        .select('key')
        .in('key', moduleKeys)
        .eq('is_active', true);

      if (modulesError) {
        throw modulesError;
      }

      const validKeys = new Set((validModules || []).map((item) => item.key));
      const invalidKeys = moduleKeys.filter((key) => !validKeys.has(key));

      if (invalidKeys.length > 0) {
        return jsonResponse({ error: 'Há permissões de módulo inválidas ou inativas no formulário.' }, { status: 400 });
      }
    }

    const redirectTo = deliveryMode === 'invite' ? normalizeText(getEnv('SITE_URL')) : '';
    const temporaryPassword = deliveryMode === 'temporary_password' ? generateTemporaryPassword() : null;

    let createdUserId: string | null = null;

    try {
      const authResult =
        deliveryMode === 'invite'
          ? await adminClient.auth.admin.inviteUserByEmail(email, {
              data: { name: displayName },
              ...(redirectTo ? { redirectTo } : {}),
            })
          : await adminClient.auth.admin.createUser({
              email,
              password: temporaryPassword!,
              email_confirm: true,
              user_metadata: { name: displayName },
            });

      if (authResult.error || !authResult.data.user?.id) {
        const message = authResult.error?.message || 'Não foi possível criar o usuário no Auth.';
        const status = /already|registered|exists/i.test(message) ? 409 : 400;
        return jsonResponse({ error: message }, { status });
      }

      createdUserId = authResult.data.user.id;

      const { error: profileError } = await adminClient.from('profiles').insert({
        id: createdUserId,
        email,
        name: displayName,
        role,
      });

      if (profileError) {
        throw profileError;
      }

      if (orgLinks.length > 0) {
        const { error: orgLinksError } = await adminClient.from('profile_org_units').insert(
          orgLinks.map((link, index) => ({
            profile_id: createdUserId,
            org_unit_id: link.orgUnitId,
            membership_role: link.membershipRole,
            is_primary: orgLinks.length === 1 ? true : link.isPrimary || index === 0,
            metadata: {
              source: 'edge_function_provision_user',
              created_by: callerUser.id,
            },
          }))
        );

        if (orgLinksError) {
          throw orgLinksError;
        }
      }

      if (moduleAccess.length > 0) {
        const { error: moduleAccessError } = await adminClient.from('profile_module_access').insert(
          moduleAccess.map((access) => ({
            profile_id: createdUserId,
            module_key: access.moduleKey,
            can_read: access.canRead,
            can_write: access.canWrite,
            can_approve: access.canApprove,
            can_admin: access.canAdmin,
            metadata: {
              source: 'edge_function_provision_user',
              created_by: callerUser.id,
            },
          }))
        );

        if (moduleAccessError) {
          throw moduleAccessError;
        }
      }

      return jsonResponse({
        userId: createdUserId,
        email,
        name: displayName,
        role,
        deliveryMode,
        temporaryPassword,
        message:
          deliveryMode === 'invite'
            ? 'Usuário provisionado e convite enviado por e-mail.'
            : 'Usuário provisionado com senha provisória.',
      });
    } catch (error) {
      await rollbackUser(adminClient, createdUserId);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao provisionar usuário', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha inesperada ao provisionar o usuário.',
      },
      { status: 500 }
    );
  }
});
