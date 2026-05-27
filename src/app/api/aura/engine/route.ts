import { NextResponse } from 'next/server';
import { createAuraServerClient } from '@/utils/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getSessionContext } from '@/utils/auth/mockAuth';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const RequestSchema = z.object({
  locale: z.enum(['es', 'de', 'en']).optional().default('es'),
});

export async function POST(req: Request) {
  const supabase = createAuraServerClient();
  const startTime = Date.now();

  try {
    const userSession = getSessionContext();
    const tenant_id = userSession.tenant_id;

    const body = await req.json();
    const parseCheck = RequestSchema.safeParse(body);

    if (!parseCheck.success) {
      return NextResponse.json({ error: 'Parámetros i18n inválidos' }, { status: 400 });
    }

    const { locale } = parseCheck.data;

    const { data: job, error: jobErr } = await supabase
      .from('agent_jobs')
      .insert({
        tenant_id,
        status: 'processing',
        status_text: 'Iniciando pipeline asíncrono seguro en la red de borde...',
        progress: 10,
      })
      .select('*')
      .single();

    if (jobErr || !job) {
      console.error('Job queue error:', jobErr);
      return NextResponse.json({ error: 'Fallo crítico de inicialización DevOps' }, { status: 500 });
    }

    // Hilo analítico asíncrono con observabilidad LLM nativa
    (async () => {
      const jobId = job.id;
      try {
        // 🔍 FILTRO PRE-ALGORÍTMICO FINOPS: extrae todo el catálogo y filtra anomalías en memoria
        // PostgREST no soporta comparación cross-column en .or(), por lo que el filtro semántico
        // se aplica server-side tras el fetch completo — garantía de correctitud sin dependencias extra.
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

        const anomalousProducts = allProducts.filter(
          (p: any) => p.stock_quantity <= p.min_stock_alert || p.current_price <= p.cost_price
        );

        const totalSKUs = totalCount ?? allProducts.length;
        const analyzedSKUs = anomalousProducts.length;
        const skippedSKUs = totalSKUs - analyzedSKUs;
        const tokensSaved = skippedSKUs * 450;

        await supabase
          .from('agent_jobs')
          .update({
            status_text: `FinOps: Analizando ${analyzedSKUs}/${totalSKUs} SKUs. Ahorro: ~${tokensSaved.toLocaleString()} tokens.`,
            progress: 40,
          })
          .eq('id', jobId);

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

        const productIds = anomalousProducts.map((p: any) => p.id);
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
              content: `Catálogo crítico: ${JSON.stringify(anomalousProducts)}. Series temporales: ${JSON.stringify(salesHistory || [])}`,
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

        // 🛡️ TOLERANCIA A FALLOS: validar respuesta estructurada de Claude
        const toolBlock = response.content.find((block) => block.type === 'tool_use');
        if (!toolBlock || typeof toolBlock.input !== 'object') {
          throw new Error(
            'La IA retornó texto plano sin invocar la herramienta estructurada. Verificar prompt y tool_choice.'
          );
        }

        const rawInsights = (toolBlock.input as any).insights || [];

        const bulkPayload = rawInsights
          .map((insight: any) => {
            const match = anomalousProducts.find((p: any) => p.sku === insight.sku);
            if (!match) return null;
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
          .filter(Boolean);

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
      } catch (innerError: any) {
        console.error('⚠️ [OBSERVABILIDAD LLM] Error en segundo plano:', innerError.message);
        await supabase
          .from('agent_jobs')
          .update({
            status: 'failed',
            status_text: 'Fallo en la canalización analítica de la IA.',
            error_message: `Excepción capturada: ${innerError.message} | Latencia total: ${((Date.now() - startTime) / 1000).toFixed(2)}s`,
            progress: 100,
          })
          .eq('id', jobId);
      }
    })();

    return NextResponse.json({ success: true, job_id: job.id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
