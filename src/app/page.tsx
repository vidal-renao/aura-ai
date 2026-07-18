'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { dictionaries, type Locale } from '@/utils/i18n/dictionaries';

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>(() => typeof window === 'undefined' ? 'es' : (localStorage.getItem('aura_locale') as Locale) || 'es');

  useEffect(() => {
    const handleLocaleChange = () => setLocale((localStorage.getItem('aura_locale') as Locale) || 'es');
    window.addEventListener('localeChange', handleLocaleChange);
    return () => window.removeEventListener('localeChange', handleLocaleChange);
  }, []);

  const t = dictionaries[locale].hero;
  const copy = locale === 'de'
    ? { eyebrow: 'Entscheidungen, nicht Dashboards', title: 'Der Katalog denkt', accent: 'mit.', sectionLabel: 'Vom Katalog zur Entscheidung', sectionA: 'Die KI schlägt vor.', sectionB: 'Ihr Team behält das Urteil.', line: 'Eine klare Spur vom Signal bis zur Freigabe.', margin: 'Bruttomarge', pending: 'Entscheidung offen', action: 'Preisvorschlag prüfen' }
    : locale === 'en'
      ? { eyebrow: 'Decisions, not dashboards', title: 'The catalogue also', accent: 'thinks.', sectionLabel: 'From catalogue to decision', sectionA: 'AI makes the proposal.', sectionB: 'Your team keeps the judgement.', line: 'One clear trail from signal to approval.', margin: 'Gross margin', pending: 'Decision pending', action: 'Review price proposal' }
      : { eyebrow: 'Decisiones, no dashboards', title: 'El catálogo también', accent: 'piensa.', sectionLabel: 'Del catálogo a la decisión', sectionA: 'La IA propone.', sectionB: 'Tu equipo conserva el criterio.', line: 'Una ruta clara desde la señal hasta la aprobación.', margin: 'Margen bruto', pending: 'Decisión pendiente', action: 'Revisar propuesta de precio' };

  return (
    <div className="aura-page">
      <Navigation />
      <main>
        <section className="aura-wrap grid lg:grid-cols-[1.15fr_.85fr] gap-8 lg:gap-16 pt-16 md:pt-24 pb-20 items-center">
          <div className="aura-enter">
            <p className="aura-label text-[var(--cobalt)] mb-6">{copy.eyebrow}</p>
            <h1 className="aura-display text-[clamp(3.6rem,8vw,7.6rem)] max-w-[820px]">
              {copy.title} <em className="text-[var(--cobalt)]">{copy.accent}</em>
            </h1>
            <p className="mt-8 text-lg md:text-xl text-[var(--muted)] max-w-xl leading-relaxed">{t.subtitle}</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/dashboard/inventory" className="aura-button-primary">{t.button}<span aria-hidden="true">↗</span></Link>
              <span className="text-sm text-[var(--muted)] max-w-[210px]">{copy.line}</span>
            </div>
          </div>

          <div className="aura-panel aura-data-grid aura-enter-delay relative min-h-[500px] overflow-hidden p-6 md:p-8 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div><p className="aura-label text-[var(--muted)]">AURA / LIVE SIGNAL</p><p className="mt-2 font-bold">SwissGlow Tech</p></div>
              <span className="w-3 h-3 rounded-full bg-[var(--signal)] shadow-[0_0_0_6px_rgba(243,106,74,.12)]" />
            </div>

            <svg viewBox="0 0 560 260" className="w-[115%] -ml-[8%] my-2" role="img" aria-label="Curva ascendente de margen proyectado">
              <path d="M0 210 C95 205 120 95 205 145 S310 230 375 105 S475 80 560 22" fill="none" stroke="var(--fog)" strokeWidth="24" strokeLinecap="round" />
              <path className="aura-margin-line" d="M0 210 C95 205 120 95 205 145 S310 230 375 105 S475 80 560 22" fill="none" stroke="var(--cobalt)" strokeWidth="4" strokeLinecap="round" />
              <circle cx="375" cy="105" r="8" fill="var(--signal)" stroke="white" strokeWidth="4" />
            </svg>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-[var(--line)] rounded-xl p-4">
                <p className="aura-label text-[var(--muted)]">{copy.margin}</p>
                <p className="mt-3 font-serif text-3xl">68.4%</p>
                <p className="text-xs text-[var(--pine)] mt-1">↑ 4.2 pts potencial</p>
              </div>
              <div className="bg-[var(--ink)] text-white rounded-xl p-4">
                <p className="aura-label text-white/50">{copy.pending}</p>
                <p className="mt-3 font-bold leading-tight">{copy.action}</p>
                <p className="text-xs text-white/50 mt-2">SG-LUM-01 · CHF 132</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--line)] bg-[var(--paper)]">
          <div className="aura-wrap py-16 md:py-24">
            <div className="grid md:grid-cols-[.7fr_1.3fr] gap-10 mb-14">
              <p className="aura-label text-[var(--pine)]">{copy.sectionLabel}</p>
              <h2 className="aura-display text-4xl md:text-6xl">{copy.sectionA}<br />{copy.sectionB}</h2>
            </div>
            <div className="grid md:grid-cols-3 border-t border-[var(--ink)]">
              {[
                { verb: 'Detecta', title: t.card01Title, body: t.card01Desc },
                { verb: 'Propone', title: t.card02Title, body: t.card02Desc },
                { verb: 'Controla', title: t.card03Title, body: t.card03Desc },
              ].map((item, index) => (
                <article key={item.verb} className={`py-8 md:px-7 ${index > 0 ? 'border-t md:border-t-0 md:border-l border-[var(--line)]' : ''}`}>
                  <p className="aura-label text-[var(--signal)]">{item.verb}</p>
                  <h3 className="font-serif text-2xl mt-5">{item.title}</h3>
                  <p className="text-sm text-[var(--muted)] leading-relaxed mt-4">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="aura-wrap py-16 flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
          <div><p className="aura-label text-[var(--muted)]">Infraestructura verificable</p><p className="font-serif text-3xl mt-3">Next.js · Supabase · Anthropic</p></div>
          <p className="text-sm text-[var(--muted)] max-w-md">Aislamiento por tenant, aprobación humana y trazabilidad transaccional para decisiones que afectan ingresos.</p>
        </section>
      </main>
    </div>
  );
}
