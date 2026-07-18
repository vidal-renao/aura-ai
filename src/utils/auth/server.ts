import { z } from 'zod';
import { createAuraAuthServerClient } from '@/utils/supabase/server';

const UserMetadataSchema = z.object({
  tenant_id: z.string().uuid(),
  role: z.enum(['Admin', 'Analyst']),
});

export type CorporateRole = z.infer<typeof UserMetadataSchema>['role'];

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403
  ) {
    super(message);
  }
}

export async function requireUser(requiredRole?: CorporateRole) {
  const supabase = await createAuraAuthServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) throw new AuthError('Authentication required', 401);

  const metadata = UserMetadataSchema.safeParse(user.app_metadata);
  if (!metadata.success) throw new AuthError('Account metadata is incomplete', 403);
  if (requiredRole && metadata.data.role !== requiredRole) {
    throw new AuthError(`${requiredRole} role required`, 403);
  }

  return {
    id: user.id,
    email: user.email ?? 'unknown',
    tenantId: metadata.data.tenant_id,
    role: metadata.data.role,
  };
}

export function authErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AuthError)) return null;
  return Response.json({ error: error.message }, { status: error.status });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new AuthError('Cross-origin request denied', 403);
  }
}
