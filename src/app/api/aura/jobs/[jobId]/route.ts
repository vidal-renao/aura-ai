import { NextResponse } from 'next/server';
import { createAuraServerClient } from '@/utils/supabase/server';
import { z } from 'zod';
import { authErrorResponse, requireUser } from '@/utils/auth/server';

const UUIDSchema = z.string().uuid();

export async function GET(
  _req: Request,
  context: RouteContext<'/api/aura/jobs/[jobId]'>
) {
  const { jobId } = await context.params;
  const parseResult = UUIDSchema.safeParse(jobId);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'jobId inválido' }, { status: 400 });
  }

  try {
    const user = await requireUser();
    const supabase = createAuraServerClient();

    const { data: job, error } = await supabase
      .from('agent_jobs')
      .select('id, status, progress, status_text, error_message, updated_at')
      .eq('id', parseResult.data)
      .eq('tenant_id', user.tenantId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });
  } catch (error: unknown) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Unable to read job' }, { status: 500 });
  }
}
