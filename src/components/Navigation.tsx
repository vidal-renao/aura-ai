'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { dictionaries, type Locale } from '@/utils/i18n/dictionaries';
import { createAuraClient } from '@/utils/supabase/client';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('es');
  const [role, setRole] = useState<'Admin' | 'Analyst' | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    createAuraClient().auth.getUser().then(({ data }) => {
      const nextRole = data.user?.app_metadata.role;
      if (nextRole === 'Admin' || nextRole === 'Analyst') setRole(nextRole);
    });
  }, []);

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    localStorage.setItem('aura_locale', nextLocale);
    window.dispatchEvent(new Event('localeChange'));
  };

  const handleLogout = async () => {
    await createAuraClient().auth.signOut();
    localStorage.removeItem('aura_locale');
    router.replace('/login');
    router.refresh();
  };

  const t = dictionaries[locale].nav;
  const inDashboard = pathname.startsWith('/dashboard');
  const links = [
    { href: '/', label: t.home },
    { href: '/dashboard/inventory', label: t.inventory },
    { href: '/dashboard/insights', label: t.insights },
    ...(inDashboard && role === 'Admin' ? [{ href: '/dashboard/users', label: locale === 'de' ? 'Team' : locale === 'en' ? 'Team' : 'Equipo' }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--mineral)_92%,transparent)] backdrop-blur-xl">
      <div className="aura-wrap min-h-[68px] flex items-center justify-between gap-5">
        <Link href="/" className="group flex items-center gap-3" aria-label="Aura AI, inicio">
          <span className="relative w-9 h-9 rounded-full border border-[var(--ink)] grid place-items-center overflow-hidden bg-white">
            <svg viewBox="0 0 36 36" aria-hidden="true" className="w-full h-full">
              <path d="M-2 25 C8 25 9 10 18 16 S26 26 39 8" fill="none" stroke="var(--cobalt)" strokeWidth="2.2" />
            </svg>
          </span>
          <span className="font-black tracking-[-.03em] text-lg">AURA<span className="text-[var(--cobalt)]">/AI</span></span>
        </Link>

        <button className="aura-mobile-menu aura-button-secondary !min-h-9 !px-3" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Abrir navegación">
          {open ? 'Cerrar' : 'Menú'}
        </button>

        <div className={`${open ? 'flex' : 'hidden'} absolute md:static top-[68px] left-0 right-0 md:flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 bg-[var(--mineral)] md:bg-transparent border-b md:border-0 border-[var(--line)] p-4 md:p-0 shadow-lg md:shadow-none`}>
          <div className="flex flex-col md:flex-row gap-1">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={`relative px-3 py-2 text-sm font-bold rounded-lg ${active ? 'text-[var(--ink)] bg-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                  {link.label}
                  {active && <span className="absolute left-3 right-3 -bottom-[1px] h-[2px] bg-[var(--cobalt)]" />}
                </Link>
              );
            })}
          </div>

          <div className="h-px md:h-6 md:w-px bg-[var(--line)]" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex rounded-full border border-[var(--line)] bg-white p-1">
              {(['es', 'de', 'en'] as Locale[]).map((language) => (
                <button key={language} onClick={() => changeLocale(language)} className={`w-8 h-7 rounded-full text-[10px] font-mono font-bold uppercase ${locale === language ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)]'}`}>
                  {language}
                </button>
              ))}
            </div>
            {role && <span className="aura-label text-[var(--pine)]">{role}</span>}
            {inDashboard && <button onClick={handleLogout} className="text-xs font-bold text-[var(--muted)] hover:text-[var(--signal)]">Salir</button>}
          </div>
        </div>
      </div>
    </nav>
  );
}
