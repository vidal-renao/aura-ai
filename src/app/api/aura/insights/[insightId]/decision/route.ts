import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authErrorResponse, requireSameOrigin, requireUser } from '@/utils/auth/server';
import { createAuraServerClient } from '@/utils/supabase/server';

const InsightIdSchema = z.string().uuid();
const DecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('apply'), restock_quantity: z.number().int().positive().max(1_000_000).optional() }),
  z.object({ action: z.literal('dismiss') }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ insightId: string }> }
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser('Admin');
    const { insightId } = await context.params;
    const id = InsightIdSchema.safeParse(insightId);
    const decision = DecisionSchema.safeParse(await request.json().catch(() => null));

    if (!id.success || !decision.success) {
      return NextResponse.json({ error: 'Invalid decision request' }, { status: 400 });
    }

    const supabase = createAuraServerClient();
    const { data, error } = await supabase.rpc('apply_ai_insight', {
      p_insight_id: id.data,
      p_tenant_id: user.tenantId,
      p_action: decision.data.action,
      p_restock_quantity: decision.data.action === 'apply'
        ? decision.data.restock_quantity ?? null
        : null,
      p_actor_email: user.email,
      p_actor_role: user.role,
    });

    if (error) {
      console.error('Insight transaction failed:', error.code, error.message);
      return NextResponse.json({ error: 'Unable to apply decision' }, { status: 409 });
    }

    return NextResponse.json({ success: true, result: data });
  } catch (error: unknown) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Unable to process decision' }, { status: 500 });
  }
}
