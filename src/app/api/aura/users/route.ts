import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authErrorResponse, requireSameOrigin, requireUser } from '@/utils/auth/server';
import { createAuraServerClient } from '@/utils/supabase/server';

const InviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(['Admin', 'Analyst']),
});
const UpdateSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['Admin', 'Analyst']),
});

async function requireAdmin() {
  const actor = await requireUser('Admin');
  return { actor, supabase: createAuraServerClient() };
}

export async function GET() {
  try {
    const { actor, supabase } = await requireAdmin();
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;

    const users = data.users
      .filter((user) => user.app_metadata.tenant_id === actor.tenantId)
      .map((user) => ({
        id: user.id,
        email: user.email ?? 'unknown',
        role: user.app_metadata.role === 'Admin' ? 'Admin' : 'Analyst',
        status: user.banned_until ? 'inactive' : user.confirmed_at ? 'active' : 'pending',
        last_sign_in_at: user.last_sign_in_at,
      }));

    return NextResponse.json({ users });
  } catch (error: unknown) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Unable to list users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { actor, supabase } = await requireAdmin();
    const input = InviteSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(input.data.email, {
      redirectTo: process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/update-password`
        : undefined,
    });
    if (error) return NextResponse.json({ error: 'Unable to send invitation' }, { status: 409 });

    const { error: metadataError } = await supabase.auth.admin.updateUserById(data.user.id, {
      app_metadata: { tenant_id: actor.tenantId, role: input.data.role },
    });
    if (metadataError) throw metadataError;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Unable to invite user' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { actor, supabase } = await requireAdmin();
    const input = UpdateSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: 'Invalid user update' }, { status: 400 });

    const { data: target, error: targetError } = await supabase.auth.admin.getUserById(input.data.user_id);
    if (targetError || target.user.app_metadata.tenant_id !== actor.tenantId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (target.user.id === actor.id && input.data.role !== 'Admin') {
      return NextResponse.json({ error: 'You cannot remove your own admin role' }, { status: 409 });
    }

    const { error } = await supabase.auth.admin.updateUserById(input.data.user_id, {
      app_metadata: { ...target.user.app_metadata, tenant_id: actor.tenantId, role: input.data.role },
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Unable to update user' }, { status: 500 });
  }
}
