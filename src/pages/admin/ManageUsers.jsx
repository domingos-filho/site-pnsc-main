import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Copy, Edit, KeyRound, Mail, Plus, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_BADGE_CLASS, ROLE_LABELS } from '@/lib/accessControl';
import { supabase, isSupabaseReady } from '@/lib/supabaseClient';
import { provisionUserFromDashboard } from '@/lib/userProvisioning';

const orgUnitTypeLabels = {
  community: 'Comunidades',
  pastoral: 'Pastorais',
  movement: 'Movimentos',
  service: 'Serviços',
};

const orgUnitTypeOrder = ['community', 'pastoral', 'movement', 'service'];
const dialogModes = {
  create: 'create',
  edit: 'edit',
};

const inviteEmailEnabled =
  String(import.meta.env.VITE_SUPABASE_INVITE_EMAIL_ENABLED || 'false').toLowerCase() === 'true';

const emptyAccess = {
  can_read: false,
  can_write: false,
  can_approve: false,
  can_admin: false,
};

const modulePermissionFields = [
  { key: 'can_read', label: 'Ler' },
  { key: 'can_write', label: 'Escrever' },
  { key: 'can_approve', label: 'Aprovar' },
  { key: 'can_admin', label: 'Administrar' },
];

const createEmptyModuleAccess = (modules) =>
  Object.fromEntries(modules.map((module) => [module.key, { ...emptyAccess }]));

const createEmptyFormState = (modules) => ({
  name: '',
  email: '',
  role: 'member',
  deliveryMode: 'temporary_password',
  orgLinks: [],
  primaryOrgUnitId: '',
  moduleAccess: createEmptyModuleAccess(modules),
});

const hasAnyPermission = (access) =>
  Boolean(access?.can_read || access?.can_write || access?.can_approve || access?.can_admin);

const formatSupabaseError = (error, fallback) => error?.message || fallback;

const enrichProfiles = (profileRows, orgLinksRows, moduleAccessRows) => {
  const orgLinksByProfile = new Map();
  const moduleAccessByProfile = new Map();

  orgLinksRows.forEach((link) => {
    const list = orgLinksByProfile.get(link.profile_id) || [];
    list.push({
      id: link.id,
      orgUnitId: link.org_unit_id,
      membershipRole: link.membership_role || '',
      isPrimary: Boolean(link.is_primary),
      orgUnit: link.org_units || null,
    });
    orgLinksByProfile.set(link.profile_id, list);
  });

  moduleAccessRows.forEach((access) => {
    const list = moduleAccessByProfile.get(access.profile_id) || [];
    list.push({
      id: access.id,
      moduleKey: access.module_key,
      canRead: Boolean(access.can_read),
      canWrite: Boolean(access.can_write),
      canApprove: Boolean(access.can_approve),
      canAdmin: Boolean(access.can_admin),
    });
    moduleAccessByProfile.set(access.profile_id, list);
  });

  return (profileRows || []).map((profile) => ({
    ...profile,
    orgLinks: orgLinksByProfile.get(profile.id) || [],
    moduleAccess: moduleAccessByProfile.get(profile.id) || [],
  }));
};

const buildEditorState = (profile, modules) => {
  const moduleAccess = createEmptyModuleAccess(modules);

  (profile?.moduleAccess || []).forEach((access) => {
    moduleAccess[access.moduleKey] = {
      can_read: Boolean(access.canRead),
      can_write: Boolean(access.canWrite),
      can_approve: Boolean(access.canApprove),
      can_admin: Boolean(access.canAdmin),
    };
  });

  const orgLinks = (profile?.orgLinks || []).map((link) => ({
    orgUnitId: link.orgUnitId,
    membershipRole: link.membershipRole || '',
    isPrimary: Boolean(link.isPrimary),
  }));

  const primaryLink = orgLinks.find((link) => link.isPrimary);

  return {
    name: profile?.name || '',
    email: profile?.email || '',
    role: profile?.role || 'member',
    deliveryMode: 'temporary_password',
    orgLinks,
    primaryOrgUnitId: primaryLink?.orgUnitId || '',
    moduleAccess,
  };
};

const applyPermissionCascade = (currentAccess, field, checked) => {
  const nextAccess = {
    ...currentAccess,
    [field]: checked,
  };

  if (field === 'can_admin') {
    if (checked) {
      nextAccess.can_read = true;
      nextAccess.can_write = true;
      nextAccess.can_approve = true;
    }
    return nextAccess;
  }

  if (field === 'can_approve') {
    if (checked) {
      nextAccess.can_read = true;
      nextAccess.can_write = true;
    } else {
      nextAccess.can_admin = false;
    }
    return nextAccess;
  }

  if (field === 'can_write') {
    if (checked) {
      nextAccess.can_read = true;
    } else {
      nextAccess.can_approve = false;
      nextAccess.can_admin = false;
    }
    return nextAccess;
  }

  if (field === 'can_read' && !checked) {
    nextAccess.can_write = false;
    nextAccess.can_approve = false;
    nextAccess.can_admin = false;
  }

  return nextAccess;
};

const normalizeOrgLinksForSave = (profileId, formState) =>
  formState.orgLinks.map((link, index) => ({
    profile_id: profileId,
    org_unit_id: link.orgUnitId,
    membership_role: link.membershipRole.trim() || null,
    is_primary: formState.primaryOrgUnitId ? link.orgUnitId === formState.primaryOrgUnitId : index === 0,
    metadata: {
      source: 'dashboard_manage_users',
    },
  }));

const normalizeModuleAccessForSave = (profileId, formState, modules) =>
  modules
    .map((module) => ({
      profile_id: profileId,
      module_key: module.key,
      ...formState.moduleAccess[module.key],
      metadata: {
        source: 'dashboard_manage_users',
      },
    }))
    .filter((access) => hasAnyPermission(access));

const UserEditorTabs = ({
  mode,
  formState,
  currentProfile,
  groupedOrgUnits,
  modules,
  selectedOrgUnitIds,
  handleFieldChange,
  handleOrgUnitToggle,
  handleOrgUnitRoleChange,
  handlePrimaryOrgUnitChange,
  handleModuleAccessChange,
}) => (
  <Tabs defaultValue="perfil">
    <TabsList className="grid w-full grid-cols-3">
      <TabsTrigger value="perfil">Perfil</TabsTrigger>
      <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
      <TabsTrigger value="modulos">Módulos</TabsTrigger>
    </TabsList>

    <div className="max-h-[65vh] overflow-y-auto pr-2">
      <TabsContent value="perfil" className="space-y-4 pt-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              value={formState.name}
              onChange={(event) => handleFieldChange('name', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formState.email}
              onChange={(event) => handleFieldChange('email', event.target.value)}
              disabled={mode === dialogModes.edit}
              required={mode === dialogModes.create}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Perfil</Label>
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              id="role"
              name="role"
              value={formState.role}
              onChange={(event) => handleFieldChange('role', event.target.value)}
              required
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="member">Coordenador</option>
              <option value="secretary">Secretário</option>
              <option value="treasurer">Tesoureira</option>
              <option value="articulator">Articulador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>

        {mode === dialogModes.create ? (
          <div className="space-y-2">
            <Label htmlFor="delivery-mode">Acesso inicial</Label>
            <select
              id="delivery-mode"
              name="delivery-mode"
              value={formState.deliveryMode}
              onChange={(event) => handleFieldChange('deliveryMode', event.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="temporary_password">Senha provisória</option>
              {inviteEmailEnabled ? <option value="invite">Convite por e-mail</option> : null}
            </select>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              {formState.deliveryMode === 'invite'
                ? 'Convite por e-mail depende do SMTP do Supabase e do fluxo de definição de senha no link recebido.'
                : 'Senha provisória é o fluxo mais compatível com o login atual do site. A senha será gerada com segurança no servidor, exibida uma única vez após a criação e exigida para troca no primeiro acesso.'}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          {mode === dialogModes.create
            ? 'O usuário será criado no Supabase Auth e o perfil operacional será provisionado junto com vínculos e módulos.'
            : 'O papel continua sendo a camada base de acesso. Os vínculos e módulos abaixo refinam a operação interna e preparam os próximos sistemas.'}
        </div>
      </TabsContent>

      <TabsContent value="vinculos" className="space-y-4 pt-4">
        {Object.values(groupedOrgUnits).every((items) => items.length === 0) ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            Nenhuma unidade organizacional encontrada.
          </div>
        ) : (
          orgUnitTypeOrder.map((type) => (
            <div key={type} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{orgUnitTypeLabels[type]}</h3>
                <p className="text-xs text-gray-500">
                  Vincule o usuário às unidades que ele pode representar ou operar.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(groupedOrgUnits[type] || []).map((orgUnit) => {
                  const currentLink = formState.orgLinks.find((link) => link.orgUnitId === orgUnit.id);

                  return (
                    <label
                      key={orgUnit.id}
                      className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-200 hover:bg-blue-50"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedOrgUnitIds.has(orgUnit.id)}
                          onChange={(event) => handleOrgUnitToggle(orgUnit.id, event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900">{orgUnit.name}</div>
                          <div className="text-xs text-gray-500">{orgUnit.slug}</div>

                          {selectedOrgUnitIds.has(orgUnit.id) ? (
                            <div className="mt-3 space-y-3">
                              <div className="space-y-1">
                                <Label htmlFor={`membership-role-${orgUnit.id}`}>Função no vínculo</Label>
                                <Input
                                  id={`membership-role-${orgUnit.id}`}
                                  value={currentLink?.membershipRole || ''}
                                  onChange={(event) =>
                                    handleOrgUnitRoleChange(orgUnit.id, event.target.value)
                                  }
                                  placeholder="Ex.: coordenador, membro, apoio"
                                />
                              </div>
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="radio"
                                  name="primary-org-unit"
                                  checked={formState.primaryOrgUnitId === orgUnit.id}
                                  onChange={() => handlePrimaryOrgUnitChange(orgUnit.id)}
                                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                Definir como vínculo principal
                              </label>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </TabsContent>

      <TabsContent value="modulos" className="space-y-4 pt-4">
        <div className="rounded-lg border border-gray-200">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Libere apenas os módulos necessários para o usuário. As permissões são cumulativas por coluna.
          </div>

          {modules.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">Nenhum módulo cadastrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Módulo</th>
                    {modulePermissionFields.map((field) => (
                      <th key={field.key} className="px-4 py-3 text-center">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module) => {
                    const access = formState.moduleAccess[module.key] || { ...emptyAccess };

                    return (
                      <tr key={module.key} className="border-t">
                        <td className="px-4 py-4 align-top">
                          <div className="font-medium text-gray-900">{module.name}</div>
                          <div className="mt-1 text-xs text-gray-500">{module.description}</div>
                        </td>
                        {modulePermissionFields.map((field) => (
                          <td key={field.key} className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(access[field.key])}
                              onChange={(event) =>
                                handleModuleAccessChange(module.key, field.key, event.target.checked)
                              }
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>
    </div>
  </Tabs>
);

const ManageUsers = () => {
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [modules, setModules] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState(dialogModes.edit);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [formState, setFormState] = useState(createEmptyFormState([]));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [provisionResult, setProvisionResult] = useState(null);

  const groupedOrgUnits = useMemo(() => {
    const groups = Object.fromEntries(orgUnitTypeOrder.map((type) => [type, []]));

    orgUnits.forEach((orgUnit) => {
      if (!groups[orgUnit.type]) {
        groups[orgUnit.type] = [];
      }
      groups[orgUnit.type].push(orgUnit);
    });

    return groups;
  }, [orgUnits]);

  const selectedOrgUnitIds = useMemo(
    () => new Set(formState.orgLinks.map((link) => link.orgUnitId)),
    [formState.orgLinks]
  );

  const currentProfile = profiles.find((profile) => profile.id === editingProfileId) || null;
  const isCreateMode = dialogMode === dialogModes.create;

  const fetchProfiles = async () => {
    if (!isSupabaseReady) {
      toast({
        title: 'Supabase não configurado',
        description: 'Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const [
      profilesResponse,
      orgUnitsResponse,
      modulesResponse,
      profileOrgUnitsResponse,
      profileModuleAccessResponse,
    ] = await Promise.all([
      supabase.from('profiles').select('id, name, role, email').order('name'),
      supabase
        .from('org_units')
        .select('id, type, name, slug, is_active')
        .eq('is_active', true)
        .order('type')
        .order('name'),
      supabase.from('app_modules').select('key, name, description, is_active').eq('is_active', true).order('name'),
      supabase
        .from('profile_org_units')
        .select('id, profile_id, org_unit_id, membership_role, is_primary, org_units ( id, type, name, slug )')
        .order('created_at'),
      supabase
        .from('profile_module_access')
        .select('id, profile_id, module_key, can_read, can_write, can_approve, can_admin')
        .order('created_at'),
    ]);

    const firstError = [
      profilesResponse.error,
      orgUnitsResponse.error,
      modulesResponse.error,
      profileOrgUnitsResponse.error,
      profileModuleAccessResponse.error,
    ].find(Boolean);

    if (firstError) {
      toast({
        title: 'Erro',
        description:
          'Não foi possível carregar vínculos e permissões. Confirme se a fundação Operações v1 foi aplicada no Supabase.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    setProfiles(
      enrichProfiles(
        profilesResponse.data || [],
        profileOrgUnitsResponse.data || [],
        profileModuleAccessResponse.data || []
      )
    );
    setOrgUnits(orgUnitsResponse.data || []);
    setModules(modulesResponse.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    void fetchProfiles();
  }, []);

  const closeDialog = () => {
    setEditingProfileId(null);
    setDialogMode(dialogModes.edit);
    setFormState(createEmptyFormState(modules));
    setIsDialogOpen(false);
  };

  const openCreateDialog = () => {
    setDialogMode(dialogModes.create);
    setEditingProfileId(null);
    setFormState(createEmptyFormState(modules));
    setIsDialogOpen(true);
  };

  const openEditDialog = (profile) => {
    setDialogMode(dialogModes.edit);
    setEditingProfileId(profile.id);
    setFormState(buildEditorState(profile, modules));
    setIsDialogOpen(true);
  };

  const handleDialogChange = (open) => {
    if (!open) {
      closeDialog();
      return;
    }

    setIsDialogOpen(true);
  };

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOrgUnitToggle = (orgUnitId, checked) => {
    setFormState((prev) => {
      if (checked) {
        const nextOrgLinks = [
          ...prev.orgLinks,
          {
            orgUnitId,
            membershipRole: '',
            isPrimary: prev.orgLinks.length === 0,
          },
        ];

        return {
          ...prev,
          orgLinks: nextOrgLinks,
          primaryOrgUnitId: prev.primaryOrgUnitId || orgUnitId,
        };
      }

      const nextOrgLinks = prev.orgLinks.filter((link) => link.orgUnitId !== orgUnitId);
      const nextPrimaryOrgUnitId =
        prev.primaryOrgUnitId === orgUnitId ? nextOrgLinks[0]?.orgUnitId || '' : prev.primaryOrgUnitId;

      return {
        ...prev,
        orgLinks: nextOrgLinks,
        primaryOrgUnitId: nextPrimaryOrgUnitId,
      };
    });
  };

  const handleOrgUnitRoleChange = (orgUnitId, membershipRole) => {
    setFormState((prev) => ({
      ...prev,
      orgLinks: prev.orgLinks.map((link) =>
        link.orgUnitId === orgUnitId ? { ...link, membershipRole } : link
      ),
    }));
  };

  const handlePrimaryOrgUnitChange = (orgUnitId) => {
    setFormState((prev) => ({
      ...prev,
      primaryOrgUnitId: orgUnitId,
      orgLinks: prev.orgLinks.map((link) => ({
        ...link,
        isPrimary: link.orgUnitId === orgUnitId,
      })),
    }));
  };

  const handleModuleAccessChange = (moduleKey, field, checked) => {
    setFormState((prev) => ({
      ...prev,
      moduleAccess: {
        ...prev.moduleAccess,
        [moduleKey]: applyPermissionCascade(
          prev.moduleAccess[moduleKey] || { ...emptyAccess },
          field,
          checked
        ),
      },
    }));
  };

  const persistOperationalAssignments = async (profileId) => {
    const normalizedOrgLinks = normalizeOrgLinksForSave(profileId, formState);
    const normalizedModuleAccess = normalizeModuleAccessForSave(profileId, formState, modules);

    const { error: deleteOrgLinksError } = await supabase
      .from('profile_org_units')
      .delete()
      .eq('profile_id', profileId);

    if (deleteOrgLinksError) {
      throw new Error('O perfil foi atualizado, mas houve falha ao substituir os vínculos institucionais.');
    }

    if (normalizedOrgLinks.length > 0) {
      const { error: insertOrgLinksError } = await supabase.from('profile_org_units').insert(normalizedOrgLinks);

      if (insertOrgLinksError) {
        throw new Error('O perfil foi atualizado, mas houve falha ao gravar os vínculos institucionais.');
      }
    }

    const { error: deleteModuleAccessError } = await supabase
      .from('profile_module_access')
      .delete()
      .eq('profile_id', profileId);

    if (deleteModuleAccessError) {
      throw new Error('O perfil foi atualizado, mas houve falha ao substituir as permissões de módulo.');
    }

    if (normalizedModuleAccess.length > 0) {
      const { error: insertModuleAccessError } = await supabase
        .from('profile_module_access')
        .insert(normalizedModuleAccess);

      if (insertModuleAccessError) {
        throw new Error('O perfil foi atualizado, mas houve falha ao gravar as permissões de módulo.');
      }
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (!isSupabaseReady) {
      toast({
        title: 'Supabase não configurado',
        description: 'Não é possível salvar usuários sem conexão com o Supabase.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      if (isCreateMode) {
        const normalizedOrgLinks = formState.orgLinks.map((link, index) => ({
          orgUnitId: link.orgUnitId,
          membershipRole: link.membershipRole.trim() || null,
          isPrimary: formState.primaryOrgUnitId ? link.orgUnitId === formState.primaryOrgUnitId : index === 0,
        }));

        const normalizedModuleAccess = modules
          .map((module) => {
            const access = formState.moduleAccess[module.key] || { ...emptyAccess };
            return {
              moduleKey: module.key,
              canRead: Boolean(access.can_read),
              canWrite: Boolean(access.can_write),
              canApprove: Boolean(access.can_approve),
              canAdmin: Boolean(access.can_admin),
            };
          })
          .filter((access) => access.canRead || access.canWrite || access.canApprove || access.canAdmin);

        const result = await provisionUserFromDashboard({
          name: formState.name.trim() || null,
          email: formState.email.trim(),
          role: formState.role,
          deliveryMode: formState.deliveryMode,
          orgLinks: normalizedOrgLinks,
          moduleAccess: normalizedModuleAccess,
        });

        await fetchProfiles();
        setProvisionResult(result);
        toast({
          title: 'Sucesso!',
          description: result.message || 'Usuário provisionado com sucesso.',
        });
        closeDialog();
        return;
      }

      if (!editingProfileId) {
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formState.name.trim() || null,
          role: formState.role,
        })
        .eq('id', editingProfileId);

      if (profileError) {
        throw new Error(
          formatSupabaseError(profileError, 'Não foi possível atualizar os dados básicos do perfil.')
        );
      }

      await persistOperationalAssignments(editingProfileId);
      await fetchProfiles();

      if (editingProfileId === user?.id) {
        await refreshProfile();
      }

      toast({
        title: 'Sucesso!',
        description: 'Perfil, vínculos e permissões atualizados.',
      });

      closeDialog();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível concluir a operação.',
        variant: 'destructive',
      });

      if (!isCreateMode) {
        await fetchProfiles();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyTemporaryPassword = async () => {
    if (!provisionResult?.temporaryPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(provisionResult.temporaryPassword);
      toast({
        title: 'Senha copiada',
        description: 'A senha provisória foi copiada para a área de transferência.',
      });
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Copie a senha manualmente antes de fechar este aviso.',
        variant: 'destructive',
      });
    }
  };

  const hasOperationalFoundation = orgUnits.length > 0 || modules.length > 0;

  return (
    <>
      <Helmet>
        <title>Gerenciar Perfis - Dashboard</title>
      </Helmet>
      <div className="container mx-auto p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Gerenciar Perfis</h1>
            <p className="text-sm text-gray-500">
              Crie usuários no Supabase Auth e ajuste papel, vínculo com unidades e acesso aos módulos internos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openCreateDialog} disabled={!isSupabaseReady || isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              Novo usuário
            </Button>
            <Button variant="outline" onClick={fetchProfiles} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {isLoading ? 'Atualizando...' : 'Atualizar lista'}
            </Button>
          </div>
        </div>

        {provisionResult ? (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="font-semibold">Usuário provisionado com sucesso</div>
                <div className="flex items-center gap-2">
                  {provisionResult.deliveryMode === 'invite' ? (
                    <Mail className="h-4 w-4" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  <span>{provisionResult.email}</span>
                </div>
                <p>{provisionResult.message}</p>
              </div>
              <Button variant="outline" onClick={() => setProvisionResult(null)}>
                Fechar aviso
              </Button>
            </div>

            {provisionResult.deliveryMode === 'temporary_password' && provisionResult.temporaryPassword ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-4">
                <Label htmlFor="temporary-password">Senha provisória</Label>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                  <Input
                    id="temporary-password"
                    readOnly
                    value={provisionResult.temporaryPassword}
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" onClick={handleCopyTemporaryPassword}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar senha
                  </Button>
                </div>
                <p className="mt-2 text-xs text-emerald-900">
                  Entregue essa senha ao usuário por um canal seguro. Ela aparece aqui uma única vez e será trocada no primeiro acesso.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {!hasOperationalFoundation && !isLoading ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            A fundação de Operações v1 ainda não apareceu no painel. Verifique se os arquivos
            `operacoes_v1_foundation_schema.sql` e `operacoes_v1_foundation_backfill.sql` foram aplicados no Supabase.
          </div>
        ) : null}

        <motion.div
          className="overflow-hidden rounded-xl bg-white shadow-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500">
              <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3">
                    Nome
                  </th>
                  <th scope="col" className="px-6 py-3">
                    E-mail
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Perfil
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Vínculos
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Módulos
                  </th>
                  <th scope="col" className="px-6 py-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.length > 0 ? (
                  profiles.map((profile) => {
                    const enabledModuleCount = profile.moduleAccess.filter((access) =>
                      hasAnyPermission({
                        can_read: access.canRead,
                        can_write: access.canWrite,
                        can_approve: access.canApprove,
                        can_admin: access.canAdmin,
                      })
                    ).length;

                    return (
                      <tr key={profile.id} className="border-b bg-white hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                          {profile.name || 'Sem nome'}
                        </td>
                        <td className="px-6 py-4">{profile.email}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              ROLE_BADGE_CLASS[profile.role] || ROLE_BADGE_CLASS.member
                            }`}
                          >
                            {ROLE_LABELS[profile.role] || ROLE_LABELS.member}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-700">
                              {profile.orgLinks.length} {profile.orgLinks.length === 1 ? 'unidade' : 'unidades'}
                            </span>
                            {profile.orgLinks.find((link) => link.isPrimary)?.orgUnit?.name ? (
                              <span className="text-xs text-gray-500">
                                Principal: {profile.orgLinks.find((link) => link.isPrimary)?.orgUnit?.name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Sem unidade principal</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-700">
                              {enabledModuleCount} {enabledModuleCount === 1 ? 'módulo' : 'módulos'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {profile.moduleAccess
                                .filter((access) =>
                                  hasAnyPermission({
                                    can_read: access.canRead,
                                    can_write: access.canWrite,
                                    can_approve: access.canApprove,
                                    can_admin: access.canAdmin,
                                  })
                                )
                                .map((access) => {
                                  const module = modules.find((item) => item.key === access.moduleKey);
                                  return module?.name || access.moduleKey;
                                })
                                .join(', ') || 'Sem acesso liberado'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(profile)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-gray-500">
                      {isLoading ? 'Carregando perfis...' : 'Nenhum perfil encontrado.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {isCreateMode ? 'Criar usuário operacional' : 'Editar perfil operacional'}
            </DialogTitle>
            <DialogDescription>
              {isCreateMode
                ? 'Crie a conta no Supabase Auth e já configure papel, vínculos e módulos.'
                : 'Ajuste papel, vínculos institucionais e permissões de módulo do usuário selecionado.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <UserEditorTabs
              mode={dialogMode}
              formState={formState}
              currentProfile={currentProfile}
              groupedOrgUnits={groupedOrgUnits}
              modules={modules}
              selectedOrgUnitIds={selectedOrgUnitIds}
              handleFieldChange={handleFieldChange}
              handleOrgUnitToggle={handleOrgUnitToggle}
              handleOrgUnitRoleChange={handleOrgUnitRoleChange}
              handlePrimaryOrgUnitChange={handlePrimaryOrgUnitChange}
              handleModuleAccessChange={handleModuleAccessChange}
            />

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (isCreateMode ? 'Criando...' : 'Salvando...') : isCreateMode ? 'Criar usuário' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManageUsers;
