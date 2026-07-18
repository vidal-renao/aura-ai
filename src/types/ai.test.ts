import { describe, expect, it } from 'vitest';
import { AgentBatchResponseSchema } from './ai';

const validInsight = {
  insights: [{
    sku: 'SKU-1',
    insight_type: 'dynamic_pricing',
    headline: 'Ajuste de margen',
    justification: 'El precio actual no cubre el margen objetivo.',
    proposed_data: { suggested_price: 120, seo_title: null, seo_description: null },
  }],
};

describe('AgentBatchResponseSchema', () => {
  it('accepts a bounded structured response', () => {
    expect(AgentBatchResponseSchema.parse(validInsight)).toEqual(validInsight);
  });

  it('rejects negative prices', () => {
    const result = AgentBatchResponseSchema.safeParse({
      ...validInsight,
      insights: [{ ...validInsight.insights[0], proposed_data: { ...validInsight.insights[0].proposed_data, suggested_price: -1 } }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects oversized SEO metadata', () => {
    const result = AgentBatchResponseSchema.safeParse({
      ...validInsight,
      insights: [{ ...validInsight.insights[0], proposed_data: { ...validInsight.insights[0].proposed_data, seo_title: 'x'.repeat(71) } }],
    });
    expect(result.success).toBe(false);
  });
});
