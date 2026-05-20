export const ROLE_KEYS = ['member', 'secretary', 'treasurer', 'articulator', 'admin'];

export const ROLE_LABELS = {
  admin: 'Administrador',
  secretary: 'Secretário',
  treasurer: 'Tesoureira',
  articulator: 'Articulador',
  member: 'Coordenador',
};

export const ROLE_BADGE_CLASS = {
  admin: 'bg-red-100 text-red-800',
  secretary: 'bg-amber-100 text-amber-800',
  treasurer: 'bg-emerald-100 text-emerald-800',
  articulator: 'bg-violet-100 text-violet-800',
  member: 'bg-blue-100 text-blue-800',
};

export const ALL_AUTHENTICATED_ROLES = [...ROLE_KEYS];
export const AGENDA_MANAGER_ROLES = ['secretary', 'admin'];
export const GALLERY_MANAGER_ROLES = ['secretary', 'admin'];
export const USERS_MANAGER_ROLES = ['admin'];
export const SITE_SETTINGS_ALLOWED_ROLES = ['secretary', 'treasurer', 'articulator', 'admin'];

export const SITE_SETTINGS_TAB_ACCESS = {
  homepage: ['articulator', 'admin'],
  communities: ['articulator', 'admin'],
  pastorals: ['articulator', 'admin'],
  team: ['secretary', 'treasurer', 'articulator', 'admin'],
  contact: ['secretary', 'treasurer', 'articulator', 'admin'],
};

export const hasRoleAccess = (role, allowedRoles = []) => {
  if (!role) return false;
  if (role === 'admin') return true;
  return allowedRoles.includes(role);
};

export const getRoleLabel = (role) => ROLE_LABELS[role] || 'Coordenador';

export const getAllowedSiteSettingsTabs = (role) =>
  Object.entries(SITE_SETTINGS_TAB_ACCESS)
    .filter(([, allowedRoles]) => hasRoleAccess(role, allowedRoles))
    .map(([tabKey]) => tabKey);
