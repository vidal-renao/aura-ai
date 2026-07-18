import { after, NextResponse } from 'next/server';
import { createAuraServerClient } from '@/utils/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { authErrorResponse, requireSameOrigin, requireUser } from '@/utils/auth/server';
import { AgentBatchResponseSchema } from '@/types/ai';

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const RequestSchema = z.object({
  locale: z.enum(['es', 'de', 'en']).optional().default('es'),
  chaos_mode: z.enum(['timeout', 'api_down', 'corrupt']).optional(),
});

interface ProductRow {
  id: string;
  sku: string;
  title: string;
  description: string | null;
  cost_price: number;
  current_price: number;
  stock_quantity: number;
  min_stock_alert: number;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown processing error';

export async function POST(req: Request) {
  const supabase = createAuraServerClient();
  const startTime = Date.now();

  try {
    requireSameOrigin(req);
    const userSession = await requireUser('Admin');
    const tenant_id = userSession.tenantId;

    const body: unknown = await req.json().catch(() => null);
    const parseCheck = RequestSchema.safeParse(body);

    if (!parseCheck.success) {
      return NextResponse.json({ error: 'Parámetros i18n inválidos' }, { status: 400 });
    }

    const { locale, chaos_mode } = parseCheck.data;

    if (chaos_mode && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Chaos mode is disabled in production' }, { status: 403 });
    }

    const { data: rateLimitAllowed, error: rateLimitError } = await supabase.rpc(
      'consume_rate_limit',
      { p_key: `engine:${tenant_id}`, p_limit: 3, p_window_seconds: 60 }
    );

    if (rateLimitError) {
      console.error('Rate limiter unavailable:', rateLimitError.code);
      return NextResponse.json({ error: 'Rate limiter unavailable' }, { status: 503 });
    }
    if (!rateLimitAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in one minute.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const initStatusText = chaos_mode
      ? `[CHAOS:${chaos_mode.toUpperCase()}] Inicializando inyección de fallo controlado en pipeline...`
      : 'Iniciando pipeline asíncrono seguro en la red de borde...';

    const { data: job, error: jobErr } = await supabase
      .from('agent_jobs')
      .insert({
        tenant_id,
        status: 'processing',
        status_text: initStatusText,
        progress: 10,
      })
      .select('*')
      .single();

    if (jobErr || !job) {
      console.error('Job queue error:', jobErr);
      return NextResponse.json({ error: 'Fallo crítico de inicialización DevOps' }, { status: 500 });
    }

    // Hilo analítico asíncrono con observabilidad LLM nativa y soporte Chaos Engineering
    after(async () => {
      const jobId = job.id;
      try {
        // 🔍 FILTRO PRE-ALGORÍTMICO FINOPS
        const { data: allProducts, count: totalCount, error: prodErr } = await supabase
          .from('products')
          .select('*', { count: 'exact' })
          .eq('tenant_id', tenant_id);

        if (prodErr) throw new Error(`Error Postgres al extraer catálogo: ${prodErr.message}`);

        const { data: tenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', tenant_id)
          .single();

        if (!allProducts || !tenant) {
          throw new Error('Contexto corporativo incompleto: productos o tenant ausentes.');
        }

        const products = allProducts as ProductRow[];
        const anomalousProducts = products.filter(
          (product) => product.stock_quantity <= product.min_stock_alert || product.current_price <= product.cost_price
        );

        const totalSKUs = totalCount ?? allProducts.length;
        const analyzedSKUs = anomalousProducts.length;
        const skippedSKUs = totalSKUs - analyzedSKUs;
        const tokensSaved = skippedSKUs * 450;

        await supabase
          .from('agent_jobs')
          .update({
            status_text: chaos_mode
              ? `[CHAOS:${chaos_mode.toUpperCase()}] Catálogo cargado. Desviando pipeline hacia simulador de fallos...`
              : `FinOps: Analizando ${analyzedSKUs}/${totalSKUs} SKUs. Ahorro: ~${tokensSaved.toLocaleString()} tokens.`,
            progress: 40,
          })
          .eq('id', jobId);

        // ☣️ CHAOS ENGINEERING — Desvío controlado del pipeline LLM
        // Si chaos_mode está activo, se omite la llamada a Anthropic y se simula el fallo
        // a nivel de bytes/protocolo para validar resiliencia del sistema de observabilidad.
        if (chaos_mode) {
          await supabase
            .from('agent_jobs')
            .update({
              status_text: `[CHAOS:${chaos_mode.toUpperCase()}] Interceptando capa LLM — simulando fallo en canalización asíncrona...`,
              progress: 70,
            })
            .eq('id', jobId);

          if (chaos_mode === 'timeout') {
            // Bloquear el worker 20s para simular timeout de pasarela
            await new Promise((r) => setTimeout(r, 20_000));
            throw new Error(
              `[CHAOS:TIMEOUT] Límite de pasarela superado: 20,000ms sin respuesta de Anthropic. ` +
              `La solicitud fue abortada en el nodo de borde fra1. ` +
              `Latencia acumulada: ${((Date.now() - startTime) / 1000).toFixed(2)}s`
            );
          }

          if (chaos_mode === 'api_down') {
            throw new Error(
              `[CHAOS:API_DOWN] HTTP 503 Service Unavailable — Anthropic API no disponible. ` +
              `El nodo de borde recibió código de error PROVIDER_DOWN en la capa de transporte. ` +
              `Pipeline interrumpido en invocación LLM. Retry-After: 60s`
            );
          }

          if (chaos_mode === 'corrupt') {
            // SyntaxError intencional: JSON truncado simula respuesta corrupta del modelo
            const malformedPayload =
              `{"insights":[{"sku":"${anomalousProducts[0]?.sku ?? 'UNKNOWN'}","insight_type":"dynamic_pricing","proposed_data":{"suggested_price":`;
            JSON.parse(malformedPayload);
          }
        }

        if (anomalousProducts.length === 0) {
          await supabase
            .from('agent_jobs')
            .update({
              status: 'completed',
              status_text: 'Catálogo impecable. El filtro FinOps no detectó anomalías operativas.',
              progress: 100,
              processed_count: 0,
            })
            .eq('id', jobId);
          return;
        }

        const productIds = anomalousProducts.map((product) => product.id);
        const { data: salesHistory } = await supabase
          .from('sales_history')
          .select('*')
          .in('product_id', productIds);

        await supabase
          .from('agent_jobs')
          .update({
            status_text: `Invocando agente econométrico claude-sonnet-4-6... (${analyzedSKUs} SKUs críticos)`,
            progress: 60,
          })
          .eq('id', jobId);

        const systemPrompt = `
          Actúas como un Agente Avanzado de Revenue Growth Management (RGM) para el mercado SME Suizo (KMU).
          Tenant: ${tenant.name} | Sector: ${tenant.sector} | Divisa: ${tenant.currency}.
          Analizas el catálogo cruzando costos, márgenes e HISTORIAL DE VENTAS RECIENTE (Series Temporales).

          CRÍTICO — IDIOMA DE SALIDA: Genera headline y justification estrictamente en "${locale.toUpperCase()}".
          Si es DE: alemán de negocios suizo impecable. Si es EN: inglés corporativo. Si es ES: español financiero ejecutivo.

          Reglas de elasticidad:
          1. Si ventas estables con variaciones de precio → producto INELÁSTICO → sugiere +10-15% si stock crítico.
          2. Si ventas caen con cambios mínimos → producto ELÁSTICO → protege precio o aplica descuento si sobrestock.
          3. Genera stock_risk urgente si stock <= min_stock_alert.
          4. Genera seo_optimization con títulos y descripciones de alta conversión para buscadores suizos.
        `;

        const apiCallStart = Date.now();

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Catálogo crítico: ${JSON.stringify(anomalousProducts.map(({ id, sku, title, description, cost_price, current_price, stock_quantity, min_stock_alert }) => ({ id, sku, title, description, cost_price, current_price, stock_quantity, min_stock_alert })))}. Series temporales: ${JSON.stringify(salesHistory || [])}`,
            },
          ],
          tools: [
            {
              name: 'generate_revenue_insights',
              description: 'Estructura los insights analíticos de negocio para el catálogo procesado.',
              input_schema: {
                type: 'object' as const,
                properties: {
                  insights: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sku: { type: 'string' },
                        insight_type: {
                          type: 'string',
                          enum: ['dynamic_pricing', 'seo_optimization', 'stock_risk'],
                        },
                        headline: { type: 'string' },
                        justification: { type: 'string' },
                        proposed_data: {
                          type: 'object',
                          properties: {
                            suggested_price: { type: 'number' },
                            seo_title: { type: 'string' },
                            seo_description: { type: 'string' },
                          },
                          required: ['suggested_price', 'seo_title', 'seo_description'],
                        },
                      },
                      required: ['sku', 'insight_type', 'headline', 'justification', 'proposed_data'],
                    },
                  },
                },
                required: ['insights'],
              },
            },
          ],
          tool_choice: { type: 'tool', name: 'generate_revenue_insights' },
        });

        const latencyLLM = Date.now() - apiCallStart;

        const toolBlock = response.content.find((block) => block.type === 'tool_use');
        if (!toolBlock || typeof toolBlock.input !== 'object') {
          throw new Error(
            'La IA retornó texto plano sin invocar la herramienta estructurada. Verificar prompt y tool_choice.'
          );
        }

        const parsedInsights = AgentBatchResponseSchema.safeParse(toolBlock.input);
        if (!parsedInsights.success) {
          throw new Error(`Invalid structured AI response: ${parsedInsights.error.issues[0]?.message ?? 'schema mismatch'}`);
        }

        const bulkPayload = parsedInsights.data.insights
          .map((insight) => {
            const match = anomalousProducts.find((product) => product.sku === insight.sku);
            if (!match) return null;
            const suggestedPrice = insight.proposed_data.suggested_price;
            if (suggestedPrice !== null && (
              suggestedPrice < match.cost_price || suggestedPrice > match.current_price * 2
            )) return null;
            return {
              tenant_id,
              product_id: match.id,
              insight_type: insight.insight_type,
              headline: insight.headline,
              justification: insight.justification,
              proposed_data: insight.proposed_data,
              status: 'pending',
            };
          })
          .filter((payload): payload is NonNullable<typeof payload> => payload !== null);

        if (bulkPayload.length > 0) {
          const { error: insertErr } = await supabase.from('ai_insights').insert(bulkPayload);
          if (insertErr) throw new Error(`Error al persistir insights en Supabase: ${insertErr.message}`);
        }

        const totalDuration = Date.now() - startTime;

        await supabase
          .from('agent_jobs')
          .update({
            status: 'completed',
            status_text: `Consolidado exitoso. Latencia LLM: ${(latencyLLM / 1000).toFixed(2)}s | Total: ${(totalDuration / 1000).toFixed(2)}s | FinOps: ${tokensSaved.toLocaleString()} tokens optimizados.`,
            progress: 100,
            processed_count: bulkPayload.length,
          })
          .eq('id', jobId);
      } catch (innerError: unknown) {
        const message = errorMessage(innerError);
        const isChaos = message.startsWith('[CHAOS:');
        console.error(
          isChaos ? '☣️ [CHAOS ENGINEERING]' : '⚠️ [OBSERVABILIDAD LLM]',
          'Error en segundo plano:',
          message
        );
        await supabase
          .from('agent_jobs')
          .update({
            status: 'failed',
            status_text: isChaos
              ? `Fallo controlado inyectado. Resiliencia del pipeline validada.`
              : 'Fallo en la canalización analítica de la IA.',
            error_message: `${message} | Latencia total: ${((Date.now() - startTime) / 1000).toFixed(2)}s`,
            progress: 100,
          })
          .eq('id', jobId);
      }
    });

    return NextResponse.json({ success: true, job_id: job.id });
  } catch (error: unknown) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('Engine request failed:', errorMessage(error));
    return NextResponse.json({ success: false, error: 'Unable to start analytics job' }, { status: 500 });
  }
}
