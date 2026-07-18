'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { createAuraClient } from '@/utils/supabase/client';
import { getClientSessionContext } from '@/utils/auth/client';
import { dictionaries, type Locale } from '@/utils/i18n/dictionaries';

const supabase = createAuraClient();

interface AIInsight {
  id: string;
  insight_type: string;
  status: string;
  headline: string;
  justification: string;
  proposed_data: { suggested_price: number | null; seo_title: string | null; seo_description: string | null };
  created_at: string;
  products: { id: string; title: string; current_price: number; sku: string; stock_quantity: number };
}

type DecisionBody = { action: 'apply'; restock_quantity?: number } | { action: 'dismiss' };

async function submitDecision(insightId: string, body: DecisionBody) {
  const response = await fetch(`/api/aura/insights/${insightId}/decision`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload: { error?: string } = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'No se pudo procesar la decisión.');
}

const typeMeta: Record<string, { label: string; color: string; mark: string }> = {
  dynamic_pricing: { label: 'Precio', color: 'var(--cobalt)', mark: '↗' },
  stock_risk: { label: 'Stock', color: 'var(--signal)', mark: '!' },
  seo_optimization: { label: 'SEO', color: 'var(--pine)', mark: 'Aa' },
};

export default function InsightsPage() {
  const [locale, setLocale] = useState<Locale>(() => typeof window === 'undefined' ? 'es' : (localStorage.getItem('aura_locale') as Locale) || 'es');
  const [isAdmin, setIsAdmin] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [restockModal, setRestockModal] = useState<{ insight: AIInsight; qty: string } | null>(null);

  useEffect(() => {
    const change = () => setLocale((localStorage.getItem('aura_locale') as Locale) || 'es');
    window.addEventListener('localeChange', change);
    return () => window.removeEventListener('localeChange', change);
  }, []);

  useEffect(() => { getClientSessionContext().then((context) => setIsAdmin(context.role === 'Admin')); }, []);

  const fetchInsights = async () => {
    const { tenantId } = await getClientSessionContext();
    const { data, error } = await supabase.from('ai_insights').select(`
      id, insight_type, status, headline, justification, proposed_data, created_at,
      products ( id, title, current_price, sku, stock_quantity )
    `).eq('tenant_id', tenantId).eq('status', 'pending').order('created_at', { ascending: false });
    if (!error) setInsights((data as unknown as AIInsight[]) || []);
    setLoading(false);
  };

  useEffect(() => { queueMicrotask(() => void fetchInsights()); }, []);

  const decide = async (insight: AIInsight, action: 'apply' | 'dismiss') => {
    if (action === 'apply' && insight.insight_type === 'stock_risk') {
      setRestockModal({ insight, qty: '' });
      return;
    }
    setActioningId(insight.id);
    try {
      await submitDecision(insight.id, { action });
      setInsights((current) => current.filter((item) => item.id !== insight.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo procesar la decisión.');
    } finally { setActioningId(null); }
  };

  const confirmRestock = async () => {
    if (!restockModal) return;
    const units = Number.parseInt(restockModal.qty, 10);
    if (!Number.isInteger(units) || units <= 0) return;
    const insight = restockModal.insight;
    setRestockModal(null);
    setActioningId(insight.id);
    try {
      await submitDecision(insight.id, { action: 'apply', restock_quantity: units });
      setInsights((current) => current.filter((item) => item.id !== insight.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo actualizar el stock.');
    } finally { setActioningId(null); }
  };

  const t = dictionaries[locale].insights;

  return (
    <div className="aura-page">
      <Navigation />
      <main className="aura-wrap py-10 md:py-16">
        <header className="grid md:grid-cols-[1fr_auto] gap-8 items-end border-b border-[var(--ink)] pb-8 aura-enter">
          <div>
            <p className="aura-label text-[var(--cobalt)]">Decision inbox · {insights.length} pendientes</p>
            <h1 className="aura-display text-5xl md:text-7xl mt-4">Tu criterio,<br /><em>en el circuito.</em></h1>
          </div>
          <p className="text-sm text-[var(--muted)] max-w-sm leading-relaxed">{t.sub}</p>
        </header>

        {loading ? (
          <section className="py-24 text-center"><span className="aura-label text-[var(--cobalt)] animate-pulse">Leyendo propuestas…</span></section>
        ) : insights.length === 0 ? (
          <section className="aura-panel mt-10 p-10 md:p-16 text-center aura-data-grid">
            <div className="w-14 h-14 rounded-full border border-[var(--pine)] text-[var(--pine)] grid place-items-center mx-auto text-2xl">✓</div>
            <h2 className="font-serif text-3xl mt-6">No hay decisiones pendientes</h2>
            <p className="text-[var(--muted)] mt-3">Ejecuta un nuevo análisis desde Catálogo cuando cambien precios o existencias.</p>
          </section>
        ) : (
          <section className="mt-10 space-y-4">
            {insights.map((insight, index) => {
              const meta = typeMeta[insight.insight_type] ?? typeMeta.seo_optimization;
              return (
                <article key={insight.id} className="aura-panel overflow-hidden grid lg:grid-cols-[72px_1fr_280px] aura-enter" style={{ animationDelay: `${index * 60}ms` }}>
                  <div className="p-5 lg:p-0 lg:border-r border-[var(--line)] flex lg:flex-col items-center justify-between lg:justify-center gap-3" style={{ color: meta.color }}>
                    <span className="font-serif text-3xl">{meta.mark}</span><span className="aura-label">{meta.label}</span>
                  </div>
                  <div className="p-6 md:p-8">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)] mb-4">
                      <span className="font-mono font-bold text-[var(--ink)]">{insight.products.sku}</span><span>·</span><span>{insight.products.title}</span><span>·</span><time>{new Date(insight.created_at).toLocaleDateString()}</time>
                    </div>
                    <h2 className="font-serif text-2xl md:text-3xl leading-tight">{insight.headline}</h2>
                    <p className="text-sm text-[var(--muted)] leading-relaxed mt-4 max-w-2xl">{insight.justification}</p>

                    {insight.insight_type === 'dynamic_pricing' && (
                      <div className="mt-6 flex items-baseline gap-4"><span className="aura-label text-[var(--muted)]">Actual {insight.products.current_price.toFixed(2)}</span><span className="text-3xl font-serif text-[var(--cobalt)]">→ {insight.proposed_data.suggested_price?.toFixed(2)} CHF</span></div>
                    )}
                    {insight.insight_type === 'seo_optimization' && (
                      <div className="mt-6 border-l-2 border-[var(--pine)] pl-4"><p className="text-xs text-[var(--pine)]">swissglow.ch / {insight.products.sku.toLowerCase()}</p><p className="text-lg text-[#183e9a] mt-1">{insight.proposed_data.seo_title || insight.products.title}</p><p className="text-sm text-[var(--muted)] mt-1">{insight.proposed_data.seo_description || 'Sin descripción propuesta'}</p></div>
                    )}
                  </div>
                  <div className="border-t lg:border-t-0 lg:border-l border-[var(--line)] p-6 flex lg:flex-col justify-end gap-3 bg-[var(--paper)]">
                    {isAdmin ? <>
                      <button disabled={actioningId !== null} onClick={() => decide(insight, 'apply')} className="aura-button-primary flex-1 lg:flex-none">{actioningId === insight.id ? 'Aplicando…' : t.approve}</button>
                      <button disabled={actioningId !== null} onClick={() => decide(insight, 'dismiss')} className="aura-button-secondary flex-1 lg:flex-none">{t.dismiss}</button>
                    </> : <p className="text-sm text-[var(--muted)]">Solo un administrador puede decidir.</p>}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {restockModal && (
        <div className="fixed inset-0 z-[100] bg-[rgba(19,33,28,.55)] backdrop-blur-sm grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="restock-title">
          <div className="aura-panel w-full max-w-md p-7 md:p-9 aura-enter">
            <p className="aura-label text-[var(--signal)]">Reposición de stock</p>
            <h2 id="restock-title" className="font-serif text-3xl mt-3">¿Cuántas unidades entran?</h2>
            <p className="text-sm text-[var(--muted)] mt-3">{restockModal.insight.products.title} · actual {restockModal.insight.products.stock_quantity}</p>
            <input autoFocus type="number" min="1" value={restockModal.qty} onChange={(event) => setRestockModal({ ...restockModal, qty: event.target.value })} className="aura-input mt-6 text-2xl font-mono" placeholder="0" />
            <div className="flex gap-3 mt-6"><button onClick={() => setRestockModal(null)} className="aura-button-secondary flex-1">Cancelar</button><button onClick={confirmRestock} disabled={!restockModal.qty || Number(restockModal.qty) <= 0} className="aura-button-primary flex-1 disabled:opacity-40">Confirmar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
