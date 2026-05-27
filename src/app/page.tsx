'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { dictionaries, Locale } from '@/utils/i18n/dictionaries';

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>('es');

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

  const t = dictionaries[locale].hero;

  return (
    <div className="min-h-screen bg-[#000000] text-[#f5f5f5] font-sans selection:bg-[#deff9a] selection:text-[#000000]">
      <Navigation />

      <header className="relative max-w-7xl mx-auto px-4 pt-20 pb-16 text-center space-y-6">
        <div className="inline-block px-3 py-1 border border-[#deff9a]/30 rounded-full bg-[#deff9a]/5 text-xs font-mono text-[#deff9a] uppercase tracking-widest animate-pulse">
          {t.badge}
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-none">
          {t.title} <span className="text-[#deff9a]">AI-Powered</span>
        </h1>
        <p className="text-[#daffde]/70 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
          {t.subtitle}
        </p>
        <div className="pt-4">
          <Link
            href="/dashboard/inventory"
            className="inline-block px-8 py-4 rounded-lg bg-[#deff9a] text-[#000000] font-black tracking-wider uppercase border border-[#deff9a] hover:bg-[#000000] hover:text-[#deff9a] transition-all duration-300 shadow-[0_0_30px_rgba(222,255,154,0.15)]"
          >
            {t.button}
          </Link>
        </div>
      </header>

      <hr className="border-[#daffde]/10 max-w-7xl mx-auto" />

      <main className="max-w-7xl mx-auto px-4 py-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-[#1a1a1a] p-8 rounded-xl border border-[#daffde]/10 hover:border-[#daffde]/30 transition-all group">
          <div className="w-12 h-12 rounded-lg bg-[#deff9a]/10 flex items-center justify-center text-[#deff9a] font-mono font-bold border border-[#deff9a]/20 group-hover:bg-[#deff9a] group-hover:text-[#000000] transition-colors mb-6">
            01
          </div>
          <h3 className="text-xl font-bold mb-3 text-[#f5f5f5]">{t.card01Title}</h3>
          <p className="text-[#daffde]/70 text-sm leading-relaxed">{t.card01Desc}</p>
        </div>

        <div className="bg-[#1a1a1a] p-8 rounded-xl border border-[#daffde]/10 hover:border-[#daffde]/30 transition-all group">
          <div className="w-12 h-12 rounded-lg bg-[#deff9a]/10 flex items-center justify-center text-[#deff9a] font-mono font-bold border border-[#deff9a]/20 group-hover:bg-[#deff9a] group-hover:text-[#000000] transition-colors mb-6">
            02
          </div>
          <h3 className="text-xl font-bold mb-3 text-[#f5f5f5]">{t.card02Title}</h3>
          <p className="text-[#daffde]/70 text-sm leading-relaxed">
            {t.card02Desc.split('claude-sonnet-4-6').map((part, i) =>
              i === 0 ? (
                <span key={i}>
                  {part}
                  <span className="font-mono text-[#deff9a]">claude-sonnet-4-6</span>
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        </div>

        <div className="bg-[#1a1a1a] p-8 rounded-xl border border-[#daffde]/10 hover:border-[#daffde]/30 transition-all group">
          <div className="w-12 h-12 rounded-lg bg-[#deff9a]/10 flex items-center justify-center text-[#deff9a] font-mono font-bold border border-[#deff9a]/20 group-hover:bg-[#deff9a] group-hover:text-[#000000] transition-colors mb-6">
            03
          </div>
          <h3 className="text-xl font-bold mb-3 text-[#f5f5f5]">{t.card03Title}</h3>
          <p className="text-[#daffde]/70 text-sm leading-relaxed">{t.card03Desc}</p>
        </div>
      </main>

      <section className="max-w-7xl mx-auto px-4 pb-20">
        <hr className="border-[#daffde]/10 mb-16" />
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black tracking-tight text-[#f5f5f5]">
            {t.archTitle} <span className="text-[#deff9a]">{t.archSpan}</span>
          </h2>
          <p className="text-[#daffde]/50 text-sm mt-2 font-mono">{t.archSub}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Next.js 16', sub: 'App Router + SSR' },
            { label: 'Supabase', sub: 'aura_core schema' },
            { label: 'Anthropic', sub: 'claude-sonnet-4-6' },
            { label: 'Tailwind v4', sub: 'Design System' },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-[#0a0a0a] border border-[#daffde]/10 rounded-xl p-6 text-center hover:border-[#deff9a]/30 transition-all"
            >
              <p className="text-[#deff9a] font-mono font-bold text-lg">{item.label}</p>
              <p className="text-[#daffde]/50 text-xs mt-1">{item.sub}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
