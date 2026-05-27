'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { dictionaries, Locale } from '@/utils/i18n/dictionaries';
import { getSessionContext, setSessionRole } from '@/utils/auth/mockAuth';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('es');
  const [role, setRole] = useState<'Admin' | 'Analyst'>('Admin');

  useEffect(() => {
    const savedLocale = localStorage.getItem('aura_locale') as Locale;
    if (savedLocale) setLocale(savedLocale);
    setRole(getSessionContext().role);
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('aura_locale', newLocale);
    window.dispatchEvent(new Event('localeChange'));
  };

  const changeRole = (newRole: 'Admin' | 'Analyst') => {
    setRole(newRole);
    setSessionRole(newRole);
    window.dispatchEvent(new Event('roleChange'));
  };

  const handleLogout = () => {
    document.cookie = 'aura_session=; path=/; max-age=0; SameSite=Lax';
    localStorage.removeItem('aura_role');
    localStorage.removeItem('aura_locale');
    router.push('/login');
  };

  const t = dictionaries[locale].nav;

  const isDashboard = pathname.startsWith('/dashboard');

  const navLinks = [
    { href: '/', label: t.home },
    { href: '/dashboard/inventory', label: t.inventory },
    { href: '/dashboard/insights', label: t.insights },
    ...(isDashboard
      ? [{ href: '/dashboard/users', label: locale === 'de' ? 'Benutzer' : locale === 'en' ? 'Users' : 'Usuarios' }]
      : []),
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[#daffde]/20 bg-[#000000]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-black tracking-wider text-[#f5f5f5] hover:text-[#deff9a] transition-colors">
              AURA <span className="text-[#deff9a]">AI</span>
            </Link>
          </div>

          {/* Links + controls */}
          <div className="flex items-center gap-4 flex-wrap justify-end">

            {/* Nav links */}
            <div className="flex space-x-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-md text-sm font-bold tracking-wide uppercase transition-all duration-200 ${
                      isActive
                        ? 'text-[#deff9a] bg-[#daffde]/10 border-b-2 border-[#deff9a]'
                        : 'text-[#f5f5f5]/60 hover:text-[#f5f5f5] hover:bg-[#1a1a1a]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Role switcher */}
            <div className="flex items-center gap-1.5 bg-[#111] px-2 py-1 rounded border border-amber-900/30 text-[10px] font-mono">
              <span className="text-amber-500/60 font-bold uppercase tracking-wider mr-1">Rol:</span>
              <button
                onClick={() => changeRole('Admin')}
                className={`px-1.5 py-0.5 rounded font-bold uppercase transition-all ${
                  role === 'Admin'
                    ? 'bg-green-950 text-green-400 border border-green-900'
                    : 'text-[#f5f5f5]/30 hover:text-[#f5f5f5]'
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => changeRole('Analyst')}
                className={`px-1.5 py-0.5 rounded font-bold uppercase transition-all ${
                  role === 'Analyst'
                    ? 'bg-amber-950 text-amber-400 border border-amber-900'
                    : 'text-[#f5f5f5]/30 hover:text-[#f5f5f5]'
                }`}
              >
                Analyst
              </button>
            </div>

            {/* Locale switcher */}
            <div className="flex items-center gap-1.5 bg-[#1a1a1a] px-2 py-1 rounded border border-[#daffde]/10 text-xs font-mono">
              {(['es', 'de', 'en'] as Locale[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLocale(lang)}
                  className={`px-1.5 py-0.5 rounded uppercase font-bold transition-all ${
                    locale === lang
                      ? 'bg-[#deff9a] text-[#000000]'
                      : 'text-[#f5f5f5]/40 hover:text-[#f5f5f5]'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Logout — solo en dashboard */}
            {isDashboard && (
              <button
                onClick={handleLogout}
                className="text-[10px] font-mono font-bold uppercase text-[#daffde]/30 hover:text-red-400 border border-[#daffde]/10 hover:border-red-900/50 px-2.5 py-1 rounded transition-all"
                title="Cerrar sesión"
              >
                Salir
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
