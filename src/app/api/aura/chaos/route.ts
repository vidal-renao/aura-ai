import { NextResponse } from 'next/server';
import { z } from 'zod';

const ChaosSchema = z.object({
  mode: z.enum(['timeout', 'api_down', 'corrupt']),
  role: z.string().optional().default('Admin'),
});

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parse = ChaosSchema.safeParse(body);

  if (!parse.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parse.error.issues },
      { status: 400 }
    );
  }

  const { mode, role } = parse.data;

  if (role !== 'Admin') {
    return NextResponse.json(
      { error: 'CHAOS:DENIED — Admin role required for fault injection.' },
      { status: 403 }
    );
  }

  if (mode === 'timeout') {
    // Force 20s delay — intentionally exceeds Vercel gateway limit (10s hobby / 60s pro)
    // Gateway will return HTTP 504 before this resolves on restricted plans
    await new Promise((r) => setTimeout(r, 20_000));
    return NextResponse.json({
      ok: true,
      mode,
      chaos: true,
      message: 'CHAOS:TIMEOUT — 20,000ms forced latency resolved. If you see this, gateway did not time out.',
      timestamp: new Date().toISOString(),
    });
  }

  if (mode === 'api_down') {
    return new NextResponse(
      JSON.stringify({
        ok: false,
        chaos: true,
        mode,
        error: 'CHAOS:API_DOWN — Anthropic API simulated outage.',
        code: 'PROVIDER_503_SIMULATED',
        hint: 'This 503 is intentional. The LLM provider is unreachable in this scenario.',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-Chaos-Mode': 'api_down',
          'X-Chaos-Injected': 'true',
        },
      }
    );
  }

  if (mode === 'corrupt') {
    // Deliberately truncated JSON — tests parser resilience at byte level
    return new NextResponse(
      '{"chaos":true,"mode":"corrupt","insights":[{"sku":"SGT-001","insight_type":"dynamic_pricing","proposed_data":{"suggested_price":',
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Chaos-Mode': 'corrupt',
          'X-Chaos-Injected': 'true',
        },
      }
    );
  }

  return NextResponse.json({ error: 'Unknown chaos mode' }, { status: 400 });
}
