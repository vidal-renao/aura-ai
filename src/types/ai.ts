import { z } from 'zod';

export const AIInsightSchema = z.object({
  sku: z.string().trim().min(1).max(100),
  insight_type: z.enum(['dynamic_pricing', 'seo_optimization', 'stock_risk']),
  headline: z.string().trim().min(1).max(255).describe('Un titular ejecutivo corto y directo.'),
  justification: z.string().trim().min(1).max(4000).describe('La justificación analítica basada en costos, márgenes y stock.'),
  proposed_data: z.object({
    suggested_price: z.number().finite().positive().max(1_000_000).nullable().describe('El nuevo precio de venta sugerido, si aplica.'),
    seo_title: z.string().trim().max(70).nullable().describe('Título optimizado para buscadores, si aplica.'),
    seo_description: z.string().trim().max(180).nullable().describe('Meta descripción persuasiva enfocada a conversión, si aplica.'),
  }),
});

export const AgentBatchResponseSchema = z.object({
  insights: z.array(AIInsightSchema),
});

export type AgentBatchResponse = z.infer<typeof AgentBatchResponseSchema>;
