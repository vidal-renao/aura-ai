import { NextResponse } from 'next/server';
import { createAuraServerClient } from '@/utils/supabase/server';
import { z } from 'zod';

const UUIDSchema = z.string().uuid();

export async function GET(
  _req: Request,
  { params }: { params: { jobId: string } }
) {
  const parseResult = UUIDSchema.safeParse(params.jobId);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'jobId inválido' }, { status: 400 });
  }

  const supabase = createAuraServerClient();

  const { data: job, error } = await supabase
    .from('agent_jobs')
    .select('id, status, progress, status_text, error_message, tenant_id, updated_at')
    .eq('id', parseResult.data)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, job });
}
