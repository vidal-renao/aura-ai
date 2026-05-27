import { z } from 'zod';

export const AIInsightSchema = z.object({
  sku: z.string(),
  insight_type: z.enum(['dynamic_pricing', 'seo_optimization', 'stock_risk']),
  headline: z.string().describe('Un titular ejecutivo corto y directo en español.'),
  justification: z.string().describe('La justificación analítica basada en costos, márgenes y stock.'),
  proposed_data: z.object({
    suggested_price: z.number().nullable().describe('El nuevo precio de venta sugerido, si aplica.'),
    seo_title: z.string().nullable().describe('Título optimizado para buscadores, si aplica.'),
    seo_description: z.string().nullable().describe('Meta descripción persuasiva enfocada a conversión, si aplica.'),
  }),
});

export const AgentBatchResponseSchema = z.object({
  insights: z.array(AIInsightSchema),
});

export type AgentBatchResponse = z.infer<typeof AgentBatchResponseSchema>;
