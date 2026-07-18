import { z } from 'zod';
import { createAuraClient } from '@/utils/supabase/client';

const ClientContextSchema = z.object({
  tenant_id: z.string().uuid(),
  role: z.enum(['Admin', 'Analyst']),
});

export async function getClientSessionContext() {
  const supabase = createAuraClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Authentication required');

  const metadata = ClientContextSchema.parse(user.app_metadata);
  return {
    id: user.id,
    email: user.email ?? 'unknown',
    tenantId: metadata.tenant_id,
    role: metadata.role,
  };
}
