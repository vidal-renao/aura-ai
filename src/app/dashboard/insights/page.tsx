'use client';

import { useState, useEffect } from 'react';
import { createAuraClient } from '@/utils/supabase/client';
import Navigation from '@/components/Navigation';
import { dictionaries, Locale } from '@/utils/i18n/dictionaries';
import { getSessionContext } from '@/utils/auth/mockAuth';

const supabase = createAuraClient();
const DEMO_TENANT_ID = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

interface AIInsight {
  id: string;
  insight_type: string;
  status: string;
  headline: string;
  justification: string;
  proposed_data: {
    suggested_price: number | null;
    seo_title: string | null;
    seo_description: string | null;
  };
  created_at: string;
  products: {
    id: string;
    title: string;
    current_price: number;
    sku: string;
    stock_quantity: number;
  };
}

export default function InsightsPage() {
  const [locale, setLocale] = useState<Locale>('es');
  const [isAdmin, setIsAdmin] = useState<boolean>(() => getSessionContext().role === 'Admin');
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [restockModal, setRestockModal] = useState<{ insight: AIInsight; qty: string } | null>(null);

  useEffect(() => {
    const savedLocale = localStorage.getItem('aura_locale') as Locale;
    if (savedLocale) setLocale(savedLocale);

    const handleLocaleChange = () => {
      const newLocale = localStorage.getItem('aura_locale') as Locale;
      if (newLocale) setLocale(newLocale);
    };

    window.addEventListener('localeChange', handleLocaleChange);
    return () => window.removeEventListener('localeChange', handleLocaleChange);
  }, []);

  useEffect(() => {
    const handleRoleChange = () => {
      setIsAdmin(getSessionContext().role === 'Admin');
    };
    window.addEventListener('roleChange', handleRoleChange);
    return () => window.removeEventListener('roleChange', handleRoleChange);
  }, []);

  const fetchInsights = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ai_insights')
      .select(`
        id, insight_type, status, headline, justification, proposed_data, created_at,
        products ( id, title, current_price, sku, stock_quantity )
      `)
      .eq('tenant_id', DEMO_TENANT_ID)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) console.error('Error recuperando auditorías de IA:', error);
    else setInsights((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleRestockConfirm = async () => {
    if (!restockModal) return;
    const { insight, qty } = restockModal;
    const units = parseInt(qty, 10);
    if (isNaN(units) || units <= 0) return;

    setRestockModal(null);
    setActioningId(insight.id);
    try {
      const { error: stockErr } = await supabase
        .from('products')
        .update({ stock_quantity: insight.products.stock_quantity + units })
        .eq('id', insight.products.id);

      if (stockErr) throw new Error(`[products.update] ${stockErr.message} (${stockErr.code})`);

      const { error: insightErr } = await supabase
        .from('ai_insights')
        .update({ status: 'applied' })
        .eq('id', insight.id);

      if (insightErr) throw new Error(`[ai_insights.update] ${insightErr.message} (${insightErr.code})`);

      setInsights((prev) => prev.filter((item) => item.id !== insight.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      alert(`Error al reponer stock.\n\n${msg}`);
    } finally {
      setActioningId(null);
    }
  };

  const handleApprove = async (insight: AIInsight) => {
    if (insight.insight_type === 'stock_risk') {
      setRestockModal({ insight, qty: '' });
      return;
    }
    setActioningId(insight.id);
    try {
      if (insight.insight_type === 'dynamic_pricing' && insight.proposed_data.suggested_price) {
        const { error: updateProdErr } = await supabase
          .from('products')
          .update({ current_price: insight.proposed_data.suggested_price })
          .eq('id', insight.products.id);

        if (updateProdErr) {
          console.error('[Step 1] Product update failed:', updateProdErr.message, updateProdErr.code, updateProdErr.details);
          throw new Error(`[products.update] ${updateProdErr.message} (${updateProdErr.code})`);
        }

        const userSession = getSessionContext();
        const { error: logErr } = await supabase
          .from('pricing_logs')
          .insert({
            product_id: insight.products.id,
            old_price: insight.products.current_price,
            new_price: insight.proposed_data.suggested_price,
            reason: insight.headline,
            executed_by_email: userSession.email,
            executed_by_role: userSession.role,
          });

        if (logErr) {
          console.error('[Step 2] Pricing log insert failed:', logErr.message, logErr.code, logErr.details);
          throw new Error(`[pricing_logs.insert] ${logErr.message} (${logErr.code})`);
        }
      }

      const { error: updateInsightErr } = await supabase
        .from('ai_insights')
        .update({ status: 'applied' })
        .eq('id', insight.id);

      if (updateInsightErr) {
        console.error('[Step 3] Insight status update failed:', updateInsightErr.message, updateInsightErr.code, updateInsightErr.details);
        throw new Error(`[ai_insights.update] ${updateInsightErr.message} (${updateInsightErr.code})`);
      }

      setInsights((prev) => prev.filter((item) => item.id !== insight.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('Error al procesar la aprobación:', msg);
      alert(`Error de infraestructura al aplicar el cambio.\n\n${msg}`);
    } finally {
      setActioningId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    setActioningId(id);
    const { error } = await supabase
      .from('ai_insights')
      .update({ status: 'dismissed' })
      .eq('id', id);

    if (!error) setInsights((prev) => prev.filter((item) => item.id !== id));
    setActioningId(null);
  };

  const t = dictionaries[locale].insights;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#f5f5f5] flex items-center justify-center font-sans">
        <p className="text-[#deff9a] text-xl animate-pulse tracking-wide">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-[#f5f5f5] font-sans">
      <Navigation />

      <div className="max-w-5xl mx-auto p-8 space-y-8">
        <div className="border-b border-[#daffde]/20 pb-6">
          <h1 className="text-4xl font-black tracking-tight text-[#f5f5f5]">
            {t.title} <span className="text-[#deff9a]">{t.span}</span>
          </h1>
          <p className="text-[#daffde]/70 text-sm mt-1">{t.sub}</p>
        </div>

        <div className="space-y-6">
          {insights.length === 0 ? (
            <div className="border border-dashed border-[#daffde]/20 rounded-xl p-12 text-center bg-[#1a1a1a]/30">
              <p className="text-[#daffde]/60 text-lg">{t.noInsights}</p>
            </div>
          ) : (
            insights.map((insight) => (
              <div
                key={insight.id}
                className="bg-[#1a1a1a] rounded-xl border border-[#daffde]/10 p-6 flex flex-col gap-6 hover:border-[#daffde]/30 transition-all"
              >
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="space-y-2 max-w-3xl">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                        insight.insight_type === 'dynamic_pricing'
                          ? 'bg-[#deff9a]/10 text-[#deff9a] border border-[#deff9a]/20'
                          : insight.insight_type === 'stock_risk'
                          ? 'bg-red-950 text-red-400 border border-red-900'
                          : 'bg-blue-950 text-blue-400 border border-blue-900'
                      }`}
                    >
                      {insight.insight_type.replace(/_/g, ' ')}
                    </span>
                    <h3 className="text-xl font-bold text-[#f5f5f5]">{insight.headline}</h3>
                    <p className="text-[#f5f5f5]/70 text-sm leading-relaxed">
                      {insight.justification}
                    </p>
                  </div>

                  {insight.insight_type === 'dynamic_pricing' && (
                    <div className="text-right min-w-37.5 bg-[#0a0a0a] p-4 rounded-lg border border-[#daffde]/5 shrink-0">
                      <p className="text-[10px] font-mono text-[#daffde]/40 uppercase tracking-widest">
                        {t.suggested}
                      </p>
                      <p className="text-2xl font-mono font-bold text-[#deff9a] mt-1">
                        {insight.proposed_data.suggested_price?.toFixed(2)} CHF
                      </p>
                      <p className="text-xs line-through text-[#f5f5f5]/40 font-mono mt-1">
                        Act: {insight.products?.current_price?.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                {insight.insight_type === 'seo_optimization' && (
                  <div className="bg-[#0c0c0c] rounded-lg border border-blue-900/30 p-5 space-y-2">
                    <p className="text-[10px] font-mono text-blue-400/60 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                      {t.googlePreview}
                    </p>
                    <div className="font-sans space-y-1 max-w-xl">
                      <span className="text-xs text-[#bdc1c6] block truncate">
                        https://swissglow.ch › products › {insight.products?.sku?.toLowerCase()}
                      </span>
                      <h4 className="text-lg text-[#8ab4f8] hover:underline cursor-pointer font-medium leading-tight">
                        {insight.proposed_data.seo_title || insight.products?.title}
                      </h4>
                      <p className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-2 font-light">
                        {insight.proposed_data.seo_description || '—'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t border-[#daffde]/5 pt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4 text-xs font-mono text-[#daffde]/50 w-full sm:w-auto">
                    <span>
                      {t.product}:{' '}
                      <strong className="text-[#f5f5f5]">{insight.products?.title}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      SKU: <strong className="text-[#deff9a]">{insight.products?.sku}</strong>
                    </span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {!isAdmin ? (
                      <span className="text-xs font-mono text-amber-400 bg-amber-950/40 border border-amber-900/60 px-3 py-2 rounded font-bold uppercase tracking-wider">
                        🔒 {locale === 'de' ? 'Nur Lesezugriff — Admin erforderlich' : locale === 'en' ? 'Read Only — Admin Role Required' : 'Modo Lectura — Requiere Rol Admin'}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleDismiss(insight.id)}
                          disabled={actioningId !== null}
                          className="flex-1 sm:flex-none px-4 py-2 rounded bg-transparent border border-red-900 text-red-400 hover:bg-red-950/30 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t.dismiss}
                        </button>
                        <button
                          onClick={() => handleApprove(insight)}
                          disabled={actioningId !== null}
                          className="flex-1 sm:flex-none px-4 py-2 rounded bg-[#deff9a] text-[#000000] hover:bg-[#000000] hover:text-[#deff9a] border border-[#deff9a] text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {actioningId === insight.id ? t.applying : t.approve}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {restockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#daffde]/20 rounded-2xl p-8 w-full max-w-md shadow-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#f5f5f5]">Reponer Stock</h2>
              <p className="text-sm text-[#daffde]/60">
                <span className="text-[#deff9a] font-mono">{restockModal.insight.products.title}</span>
                {' · '}Stock actual:{' '}
                <span className="text-[#f5f5f5] font-mono">{restockModal.insight.products.stock_quantity} uds.</span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-[#daffde]/50 uppercase tracking-widest">
                Unidades a añadir
              </label>
              <input
                type="number"
                min="1"
                autoFocus
                value={restockModal.qty}
                onChange={(e) => setRestockModal((m) => m ? { ...m, qty: e.target.value } : null)}
                onKeyDown={(e) => e.key === 'Enter' && handleRestockConfirm()}
                className="w-full bg-[#0a0a0a] border border-[#daffde]/20 rounded-lg px-4 py-3 text-[#f5f5f5] font-mono text-xl focus:outline-none focus:border-[#deff9a]/60 transition-colors"
                placeholder="0"
              />
              {restockModal.qty && parseInt(restockModal.qty, 10) > 0 && (
                <p className="text-xs text-[#daffde]/40 font-mono">
                  Nuevo stock: {restockModal.insight.products.stock_quantity + parseInt(restockModal.qty, 10)} uds.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRestockModal(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#daffde]/20 text-[#daffde]/60 hover:bg-[#daffde]/5 text-xs font-bold uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestockConfirm}
                disabled={!restockModal.qty || parseInt(restockModal.qty, 10) <= 0}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#deff9a] text-black hover:bg-[#000] hover:text-[#deff9a] border border-[#deff9a] text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Confirmar Reposición
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
