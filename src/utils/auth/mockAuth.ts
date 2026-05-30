export interface CorporateUser {
  id: string;
  email: string;
  role: 'Admin' | 'Analyst';
  // Mirrors Supabase JWT app_metadata — server-controlled, never user-editable.
  // Production assignment (service_role only):
  //   supabase.auth.admin.updateUserById(userId, { app_metadata: { tenant_id } })
  // RLS consumption:
  //   auth.jwt() -> 'app_metadata' ->> 'tenant_id'
  app_metadata: {
    tenant_id: string;
  };
  tenant_name: string;
  auth_method: 'SSO_SAML' | 'OAuth_Google' | 'Password';
}

const DEFAULT_USER: CorporateUser = {
  id: 'u7f8e9d0-c1b2-3a4b-5c6d-7e8f9a0b1c2d',
  email: 'vidal.renao@swissglow.ch',
  role: 'Admin',
  app_metadata: {
    tenant_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  },
  tenant_name: 'SwissGlow Tech',
  auth_method: 'SSO_SAML',
};

export const getSessionContext = (): CorporateUser => {
  if (typeof window !== 'undefined') {
    const savedRole = localStorage.getItem('aura_role') as 'Admin' | 'Analyst';
    return {
      ...DEFAULT_USER,
      role: savedRole || 'Admin',
    };
  }
  return DEFAULT_USER;
};

export const setSessionRole = (newRole: 'Admin' | 'Analyst') => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('aura_role', newRole);
  }
};
