'use client';

import { useState, useEffect, useRef } from 'react';
import { createAuraClient } from '@/utils/supabase/client';
import Navigation from '@/components/Navigation';
import { dictionaries, Locale } from '@/utils/i18n/dictionaries';
import { getSessionContext } from '@/utils/auth/mockAuth';

const supabase = createAuraClient();
const DEMO_TENANT_ID = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

type ChaosMode = 'timeout' | 'api_down' | 'corrupt';

interface Product {
  id: string;
  sku: string;
  title: string;
  cost_price: number;
  base_price: number;
  current_price: number;
  stock_quantity: number;
  min_stock_alert: number;
}

interface PriceLog {
  id: string;
  old_price: number;
  new_price: number;
  reason: string;
  created_at: string;
  product_id: string;
  executed_by_email?: string;
  executed_by_role?: string;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<PriceLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [locale, setLocale] = useState<Locale>('es');
  const [isAdmin, setIsAdmin] = useState<boolean>(true);

  const [isRunningAI, setIsRunningAI] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [aiStatusText, setAiStatusText] = useState<string>('');

  const [telemetryMessage, setTelemetryMessage] = useState<string>(
    'Red corporativa estable. Sin incidencias de pasarela.'
  );
  const [isEdgeHealthy, setIsEdgeHealthy] = useState<boolean>(true);

  const [activeChaosMode, setActiveChaosMode] = useState<ChaosMode | null>(null);

  const [flashingProductId, setFlashingProductId] = useState<string | null>(null);
  const [flashType, setFlashType] = useState<'up' | 'down'>('up');

  const productsRef = useRef<Product[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const fetchInventoryAndLogs = async () => {
    const { data: prodData } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', DEMO_TENANT_ID);

    if (prodData) setProducts(prodData);

    if (prodData && prodData.length > 0) {
      const productIds = prodData.map((p: Product) => p.id);
      const { data: logData } = await supabase
        .from('pricing_logs')
        .select('*')
        .in('product_id', productIds)
        .order('created_at', { ascending: false });

      if (logData) setLogs(logData);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await fetchInventoryAndLogs();
      setLocale((localStorage.getItem('aura_locale') as Locale) || 'es');
      setIsAdmin(getSessionContext().role === 'Admin');
      setLoading(false);
    };
    initData();

    const handleLocale = () =>
      setLocale((localStorage.getItem('aura_locale') as Locale) || 'es');
    const handleRole = () => setIsAdmin(getSessionContext().role === 'Admin');

    window.addEventListener('localeChange', handleLocale);
    window.addEventListener('roleChange', handleRole);

    return () => {
      window.removeEventListener('localeChange', handleLocale);
      window.removeEventListener('roleChange', handleRole);
    };
  }, []);

  // WebSocket Realtime
  useEffect(() => {
    const productChannel = supabase
      .channel('realtime-inventory')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'aura_core',
          table: 'products',
          filter: `tenant_id=eq.${DEMO_TENANT_ID}`,
        },
        (payload) => {
          const oldProd = productsRef.current.find((p) => p.id === payload.new.id);
          const newProd = payload.new as Product;

          if (oldProd) {
            setFlashType(newProd.current_price >= oldProd.current_price ? 'up' : 'down');
            setFlashingProductId(newProd.id);
            setTimeout(() => setFlashingProductId(null), 1500);
          }

          setProducts((prev) => prev.map((p) => (p.id === newProd.id ? newProd : p)));

          supabase
            .from('pricing_logs')
            .select('*')
            .in('product_id', productsRef.current.map((p) => p.id))
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) setLogs(data);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productChannel);
    };
  }, []);

  // Lógica de polling compartida entre IA normal y Chaos Engineering
  const startJobPolling = (jobId: string, chaosMode?: ChaosMode) => {
    pollIntervalRef.current = setInterval(async () => {
      const { data: job, error } = await supabase
        .from('agent_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setIsRunningAI(false);
        setActiveChaosMode(null);
        return;
      }

      setProgress(job.progress);
      setAiStatusText(job.status_text);

      if (job.status === 'completed') {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setIsRunningAI(false);
        setActiveChaosMode(null);
        setProgress(0);
        setTelemetryMessage(job.status_text);
        if (!chaosMode) fetchInventoryAndLogs();
      } else if (job.status === 'failed') {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setIsRunningAI(false);
        setActiveChaosMode(null);
        setProgress(0);
        setIsEdgeHealthy(false);
        setTelemetryMessage(
          job.error_message ||
            (chaosMode
              ? `[CHAOS:${chaosMode.toUpperCase()}] Fallo capturado en la canalización asíncrona.`
              : 'Excepción capturada en la canalización.')
        );
      }
    }, 800);
  };

  const handleTriggerAI = async () => {
    setIsRunningAI(true);
    setActiveChaosMode(null);
    setProgress(10);
    setAiStatusText('Creando tarea asíncrona en la red de borde...');
    setIsEdgeHealthy(true);

    try {
      const response = await fetch('/api/aura/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      startJobPolling(result.job_id);
    } catch (err: any) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsRunningAI(false);
      setProgress(0);
      setIsEdgeHealthy(false);
      setTelemetryMessage(`Fallo en Gateway: ${err.message}`);
    }
  };

  const handleTriggerChaos = async (mode: ChaosMode) => {
    setIsRunningAI(true);
    setActiveChaosMode(mode);
    setProgress(10);
    setAiStatusText(tChaos.running);
    setIsEdgeHealthy(true);

    try {
      const response = await fetch('/api/aura/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, chaos_mode: mode }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      startJobPolling(result.job_id, mode);
    } catch (err: any) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsRunningAI(false);
      setActiveChaosMode(null);
      setProgress(0);
      setIsEdgeHealthy(false);
      setTelemetryMessage(`[CHAOS:${mode.toUpperCase()}] Gateway fault: ${err.message}`);
    }
  };

  const t = dictionaries[locale].inventory;
  const tChaos = dictionaries[locale].chaos;

  const totalCost = products.reduce((acc, p) => acc + p.cost_price * Math.max(p.stock_quantity, 1), 0);
  const currentRevenue = products.reduce((acc, p) => acc + p.current_price * Math.max(p.stock_quantity, 1), 0);
  const currentProfit = currentRevenue - totalCost;

  const anomalousCount = products.filter(
    (p) => p.stock_quantity <= p.min_stock_alert || p.current_price <= p.cost_price
  ).length;
  const skippedCount = Math.max(0, products.length - anomalousCount);
  const tokensSaved = skippedCount * 450;
  const savingPct = products.length > 0 ? Math.round((skippedCount / products.length) * 100) : 0;

  const chaosModeConfig: Record<ChaosMode, { label: string; color: string; activeBg: string; activeBorder: string; activeText: string; icon: string }> = {
    timeout: {
      label: tChaos.timeout,
      color: 'amber',
      activeBg: 'bg-amber-950',
      activeBorder: 'border-amber-900',
      activeText: 'text-amber-400',
      icon: '⏱',
    },
    api_down: {
      label: tChaos.api_down,
      color: 'red',
      activeBg: 'bg-red-950',
      activeBorder: 'border-red-900',
      activeText: 'text-red-400',
      icon: '⚡',
    },
    corrupt: {
      label: tChaos.corrupt,
      color: 'orange',
      activeBg: 'bg-orange-950',
      activeBorder: 'border-orange-900',
      activeText: 'text-orange-400',
      icon: '☠',
    },
  };

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

      <div className="max-w-7xl mx-auto p-8 space-y-10">

        {/* Cabecera + disparador de IA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#daffde]/20 pb-6 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-[#f5f5f5]">
              {t.title} <span className="text-[#deff9a]">{t.span}</span>
            </h1>
            <p className="text-[#daffde]/70 text-sm mt-1">
              Tenant: SwissGlow Tech — Sector: Premium Health &amp; Ergonomics
            </p>
          </div>

          <div className="w-full md:w-auto flex flex-col items-end gap-2">
            {!isAdmin ? (
              <span className="w-full md:w-auto px-6 py-3 rounded-lg font-bold text-sm tracking-wider uppercase border border-amber-900/60 bg-amber-950/40 text-amber-400 font-mono flex items-center gap-2">
                🔒{' '}
                {locale === 'de'
                  ? 'Nur Lesezugriff — Admin erforderlich'
                  : locale === 'en'
                  ? 'Read Only — Admin Required'
                  : 'Modo Lectura — Requiere Rol Admin'}
              </span>
            ) : (
              <button
                onClick={handleTriggerAI}
                disabled={isRunningAI}
                className={`w-full md:w-auto px-6 py-3 rounded-lg font-bold text-sm tracking-wider uppercase transition-all duration-300 border ${
                  isRunningAI
                    ? 'bg-[#1a1a1a] text-[#daffde]/40 border-[#daffde]/10 cursor-not-allowed'
                    : 'bg-[#deff9a] text-[#000000] border-[#deff9a] hover:bg-[#000000] hover:text-[#deff9a] shadow-[0_0_15px_rgba(222,255,154,0.15)]'
                }`}
              >
                {isRunningAI && !activeChaosMode ? t.processing : t.trigger}
              </button>
            )}

            {isRunningAI && (
              <div className="w-full md:w-72 space-y-1.5">
                <div className="w-full bg-[#1a1a1a] h-2 rounded-full overflow-hidden border border-[#daffde]/10">
                  <div
                    className={`h-full transition-all duration-500 shadow-[0_0_10px] ${
                      activeChaosMode
                        ? 'bg-red-500 shadow-red-500/50'
                        : 'bg-[#deff9a] shadow-[#deff9a]'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[#daffde]/60">
                  <span className={`truncate max-w-[80%] ${activeChaosMode ? 'text-red-400/80' : ''}`}>
                    {aiStatusText}
                  </span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grid de Control Superior: Simulador + FinOps + Edge Monitoring */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Tarjeta 1: Simulador What-If */}
          <div className="bg-[#111111] p-6 rounded-xl border border-[#daffde]/10 flex flex-col justify-between shadow-xl">
            <div>
              <h3 className="text-base font-bold text-[#f5f5f5]">
                {t.simTitle} <span className="text-[#deff9a]">{t.simSpan}</span>
              </h3>
              <p className="text-[11px] text-[#daffde]/50 mt-1">{t.simSub}</p>
            </div>
            <div className="flex items-center justify-between font-mono text-xs pt-4 border-t border-[#daffde]/5 mt-4">
              <div>
                <p className="text-[9px] text-[#daffde]/40 uppercase tracking-wider mb-1">
                  {t.simCurrent}
                </p>
                <p className="font-bold text-[#f5f5f5]">
                  {currentProfit.toLocaleString('fr-CH', { minimumFractionDigits: 2 })} CHF
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-[#deff9a]/50 uppercase tracking-wider mb-1">
                  {t.simOptimized}
                </p>
                <p className="font-black text-[#deff9a]">
                  {(currentProfit * 1.085).toLocaleString('fr-CH', { minimumFractionDigits: 2 })} CHF
                </p>
                <p className="text-[9px] text-[#deff9a]/50 mt-0.5">+8.5% elasticidad</p>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: FinOps Compute Engine */}
          <div className="bg-[#111111] p-6 rounded-xl border border-emerald-900/20 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-[#f5f5f5]">FinOps Compute Engine</h3>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-1.5 py-0.5 rounded font-bold uppercase">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-[#daffde]/50 mt-1">
                {locale === 'de'
                  ? 'Filter schließt stabile SKUs aus, reduziert Claude-Kontext proaktiv.'
                  : locale === 'en'
                  ? 'Filter bypasses stable SKUs, reducing Claude context window proactively.'
                  : 'El filtrado descarta SKUs estables reduciendo la ventana de contexto de Claude.'}
              </p>
            </div>
            <div className="space-y-2 pt-4 border-t border-[#daffde]/5 mt-4">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#daffde]/40">
                  {locale === 'de' ? 'Kontext optimiert' : locale === 'en' ? 'Context Saved' : 'Contexto Optimizado'}:
                </span>
                <span className="text-emerald-400 font-bold">~{tokensSaved.toLocaleString()} tokens</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#daffde]/40">
                  {locale === 'de' ? 'SKUs analysiert' : locale === 'en' ? 'SKUs Focused' : 'SKUs analizados'}:
                </span>
                <span className="text-[#deff9a] font-bold">{anomalousCount}/{products.length}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#daffde]/40">
                  {locale === 'de' ? 'Filtereffizienz' : locale === 'en' ? 'Filter Efficiency' : 'Eficiencia API'}:
                </span>
                <span className="text-emerald-400 font-bold">{savingPct}%</span>
              </div>
              <div className="w-full bg-[#1a1a1a] h-1 rounded-full overflow-hidden border border-[#daffde]/10">
                <div
                  className="bg-emerald-500 h-full transition-all duration-700 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                  style={{ width: `${savingPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Edge Node Monitoring */}
          <div
            className={`p-6 rounded-xl border flex flex-col justify-between shadow-xl transition-all duration-500 ${
              isEdgeHealthy
                ? 'bg-[#111111] border-blue-900/20'
                : 'bg-[#1a0808] border-red-900/50 shadow-[0_0_30px_rgba(239,68,68,0.08)]'
            }`}
          >
            <div>
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-[#f5f5f5]">Edge Node Monitoring</h3>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1 transition-all duration-300 ${
                    isEdgeHealthy
                      ? 'bg-blue-950 text-blue-400 border border-blue-900'
                      : 'bg-red-950 text-red-400 border border-red-900'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isEdgeHealthy ? 'bg-blue-400 animate-pulse' : 'bg-red-400 animate-ping'
                    }`}
                  />
                  {isEdgeHealthy ? 'HEALTHY' : 'INCIDENT'}
                </span>
              </div>

              {!isEdgeHealthy && (
                <div className="mt-2 px-2 py-1 bg-red-950/40 border border-red-900/30 rounded text-[9px] font-mono text-red-400/70 uppercase tracking-wider">
                  {locale === 'de'
                    ? 'Pipeline-Fehler erfasst'
                    : locale === 'en'
                    ? 'Pipeline fault captured'
                    : 'Fallo de pipeline capturado'}
                </div>
              )}

              <p
                className={`text-[11px] font-mono mt-2 leading-normal line-clamp-4 transition-colors duration-300 ${
                  isEdgeHealthy ? 'text-[#daffde]/40' : 'text-red-400/80'
                }`}
              >
                {telemetryMessage}
              </p>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#daffde]/25 pt-3 border-t border-[#daffde]/5 mt-3">
              <span>{tChaos.edgeGateway}</span>
              <span>{tChaos.edgeRegion}</span>
            </div>
          </div>
        </div>

        {/* ☣️ Chaos Engineering Lab */}
        <div
          className={`rounded-xl border p-6 shadow-xl transition-all duration-300 ${
            activeChaosMode && isRunningAI
              ? 'bg-[#120808] border-red-900/60 shadow-[0_0_40px_rgba(239,68,68,0.06)]'
              : 'bg-[#0d0808] border-red-900/20'
          }`}
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  activeChaosMode && isRunningAI ? 'bg-red-500 animate-ping' : 'bg-red-800'
                }`}
              />
              <h3 className="text-base font-bold text-[#f5f5f5]">{tChaos.title}</h3>
              <span className="text-[9px] font-mono bg-red-950/60 text-red-400 border border-red-900/60 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                {tChaos.warning}
              </span>
            </div>
            <span className="text-[9px] font-mono text-[#daffde]/15 tracking-widest uppercase">
              chaos-monkey · v1.0 · aura-infra
            </span>
          </div>

          <p className="text-[11px] font-mono text-[#daffde]/30 mb-5 leading-relaxed max-w-2xl">
            {tChaos.subtitle}
          </p>

          {!isAdmin ? (
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400/60 border border-amber-900/30 bg-amber-950/20 px-4 py-3 rounded-lg">
              <span>🔒</span>
              <span>{tChaos.adminOnly}</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {(Object.keys(chaosModeConfig) as ChaosMode[]).map((mode) => {
                const cfg = chaosModeConfig[mode];
                const isThisActive = activeChaosMode === mode && isRunningAI;
                const isDisabled = isRunningAI;

                return (
                  <button
                    key={mode}
                    onClick={() => handleTriggerChaos(mode)}
                    disabled={isDisabled}
                    className={`px-4 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider border transition-all duration-200 flex items-center gap-2 ${
                      isThisActive
                        ? `${cfg.activeBg} ${cfg.activeText} ${cfg.activeBorder} animate-pulse`
                        : isDisabled
                        ? 'opacity-30 cursor-not-allowed bg-[#1a1a1a] border-[#daffde]/5 text-[#daffde]/20'
                        : cfg.color === 'amber'
                        ? 'border-amber-900/50 text-amber-400/80 bg-amber-950/20 hover:bg-amber-950/60 hover:border-amber-800 hover:text-amber-300'
                        : cfg.color === 'red'
                        ? 'border-red-900/50 text-red-400/80 bg-red-950/20 hover:bg-red-950/60 hover:border-red-800 hover:text-red-300'
                        : 'border-orange-900/50 text-orange-400/80 bg-orange-950/20 hover:bg-orange-950/60 hover:border-orange-800 hover:text-orange-300'
                    }`}
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Indicador de modo activo */}
          {activeChaosMode && isRunningAI && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-red-400/80">{tChaos.running}</span>
              </div>
              <span className="text-[10px] font-mono text-[#daffde]/20">
                {tChaos.modeLabel}:
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  chaosModeConfig[activeChaosMode].activeBg
                } ${chaosModeConfig[activeChaosMode].activeText} ${chaosModeConfig[activeChaosMode].activeBorder}`}
              >
                {activeChaosMode.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Tabla de Catálogo Reactivo */}
        <div className="bg-[#1a1a1a] rounded-xl border border-[#daffde]/10 overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0a0a0a] border-b border-[#daffde]/10 text-xs font-bold uppercase tracking-wider text-[#daffde]/60">
                <th className="p-4">{t.table.sku}</th>
                <th className="p-4">{t.table.product}</th>
                <th className="p-4 text-right">{t.table.cost}</th>
                <th className="p-4 text-right">{t.table.base}</th>
                <th className="p-4 text-right">{t.table.dynamic}</th>
                <th className="p-4 text-center">{t.table.stock}</th>
                <th className="p-4 text-right">{t.table.margin}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#daffde]/5 text-sm">
              {products.map((product) => {
                const grossMargin =
                  ((product.current_price - product.cost_price) / product.current_price) * 100;
                const isLowStock = product.stock_quantity <= product.min_stock_alert;
                const isFlashing = flashingProductId === product.id;

                return (
                  <tr key={product.id} className="hover:bg-[#222222]/50 transition-colors">
                    <td className="p-4 font-mono text-[#deff9a]">{product.sku}</td>
                    <td className="p-4 font-medium text-[#f5f5f5]">{product.title}</td>
                    <td className="p-4 text-right font-mono">{product.cost_price.toFixed(2)} CHF</td>
                    <td className="p-4 text-right font-mono text-[#f5f5f5]/60">
                      {product.base_price.toFixed(2)} CHF
                    </td>
                    <td
                      className={`p-4 text-right font-mono font-bold transition-all duration-300 ${
                        isFlashing
                          ? flashType === 'up'
                            ? 'bg-green-950/80 text-green-400 shadow-[inset_0_0_10px_rgba(34,197,94,0.2)]'
                            : 'bg-amber-950/80 text-amber-400 shadow-[inset_0_0_10px_rgba(245,158,11,0.2)]'
                          : 'text-[#f5f5f5]'
                      }`}
                    >
                      {product.current_price.toFixed(2)} CHF
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${
                          isLowStock
                            ? 'bg-red-950 text-red-400 border border-red-900'
                            : 'bg-green-950 text-green-400 border border-green-900'
                        }`}
                      >
                        {product.stock_quantity} u
                      </span>
                    </td>
                    <td
                      className={`p-4 text-right font-mono font-semibold transition-all duration-300 ${
                        isFlashing
                          ? flashType === 'up'
                            ? 'text-green-400'
                            : 'text-amber-400'
                          : 'text-[#deff9a]'
                      }`}
                    >
                      {grossMargin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Audit Trail */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#f5f5f5]">{t.historyTitle}</h2>
            <p className="text-xs text-[#daffde]/50">{t.historySub}</p>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl border border-[#daffde]/10 p-6">
            {logs.length === 0 ? (
              <p className="text-sm text-[#daffde]/40 text-center font-mono py-4">{t.noLogs}</p>
            ) : (
              <div className="relative border-l border-[#daffde]/10 ml-4 space-y-8">
                {logs.map((log) => {
                  const isUp = log.new_price >= log.old_price;
                  const deltaPercent = ((log.new_price - log.old_price) / log.old_price) * 100;

                  return (
                    <div key={log.id} className="relative pl-6">
                      <span
                        className={`absolute -left-[6px] top-1.5 w-3 h-3 rounded-full border-2 border-[#1a1a1a] ${
                          isUp
                            ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                            : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                        }`}
                      />

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                          <span className="text-[#daffde]/40">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                          {log.executed_by_role && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                log.executed_by_role === 'Admin'
                                  ? 'bg-green-950 text-green-400 border-green-900'
                                  : 'bg-[#111] text-[#daffde]/40 border-[#daffde]/10'
                              }`}
                            >
                              {log.executed_by_role}
                            </span>
                          )}
                          <span className={`font-bold ${isUp ? 'text-green-400' : 'text-amber-400'}`}>
                            {isUp ? '▲' : '▼'} {Math.abs(deltaPercent).toFixed(1)}%
                          </span>
                        </div>

                        {log.executed_by_email && (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#daffde]/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#deff9a]/40 inline-block shrink-0" />
                            {log.executed_by_email}
                          </div>
                        )}

                        <div className="text-sm font-mono">
                          <span className="text-red-400/70 line-through">
                            {log.old_price.toFixed(2)} CHF
                          </span>
                          <span className="text-[#daffde]/30 mx-2">→</span>
                          <span className={`font-black ${isUp ? 'text-green-400' : 'text-amber-400'}`}>
                            {log.new_price.toFixed(2)} CHF
                          </span>
                        </div>

                        <p className="text-xs text-[#f5f5f5]/60 font-sans leading-relaxed bg-[#0a0a0a]/50 px-3 py-2 rounded border border-[#daffde]/5">
                          {log.reason}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
