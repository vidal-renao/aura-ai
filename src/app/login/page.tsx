'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const DEMO_EMAIL = 'vidal.renao@swissglow.ch';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Completa todos los campos para continuar.');
      return;
    }

    setIsLoading(true);

    // Simulación de latencia de autenticación enterprise
    await new Promise((r) => setTimeout(r, 900));

    // Demo: cualquier credencial con dominio corporativo es válida
    if (!email.includes('@')) {
      setError('Introduce un correo corporativo válido.');
      setIsLoading(false);
      return;
    }

    // Establecer sesión vía cookie accesible por middleware
    document.cookie = `aura_session=authenticated; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    localStorage.setItem('aura_role', 'Admin');

    router.push('/dashboard/inventory');
  };

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword('SwissGlow2026!');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#f5f5f5] font-sans flex flex-col items-center justify-center px-4">

      {/* Fondo decorativo */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(222,255,154,0.04)_0%,_transparent_60%)] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2">
            <span className="text-3xl font-black tracking-wider text-[#f5f5f5]">
              AURA <span className="text-[#deff9a]">AI</span>
            </span>
          </div>
          <div className="inline-block px-3 py-1 border border-[#deff9a]/20 rounded-full bg-[#deff9a]/5 text-[10px] font-mono text-[#deff9a] uppercase tracking-widest">
            Panel de Acceso Corporativo · fra1 DACH
          </div>
          <p className="text-[#daffde]/50 text-sm">
            Infraestructura de Ingresos — SwissGlow Tech
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-[#111111] border border-[#daffde]/10 rounded-2xl p-8 shadow-2xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#daffde]/50 uppercase tracking-widest block">
                Correo Corporativo
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="usuario@empresa.ch"
                className="w-full bg-[#0a0a0a] border border-[#daffde]/15 rounded-lg px-4 py-3 text-[#f5f5f5] text-sm font-mono placeholder-[#daffde]/20 focus:outline-none focus:border-[#deff9a]/50 focus:shadow-[0_0_0_2px_rgba(222,255,154,0.08)] transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#daffde]/50 uppercase tracking-widest block">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0a0a0a] border border-[#daffde]/15 rounded-lg px-4 py-3 pr-12 text-[#f5f5f5] text-sm font-mono placeholder-[#daffde]/20 focus:outline-none focus:border-[#deff9a]/50 focus:shadow-[0_0_0_2px_rgba(222,255,154,0.08)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#daffde]/30 hover:text-[#daffde]/70 transition-colors text-xs font-mono"
                >
                  {showPassword ? 'OCULTAR' : 'VER'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-2.5 text-xs font-mono text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-lg font-bold text-sm tracking-wider uppercase transition-all duration-300 border ${
                isLoading
                  ? 'bg-[#1a1a1a] text-[#daffde]/30 border-[#daffde]/10 cursor-not-allowed'
                  : 'bg-[#deff9a] text-[#000000] border-[#deff9a] hover:bg-[#000000] hover:text-[#deff9a] shadow-[0_0_20px_rgba(222,255,154,0.12)]'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#daffde]/30 border-t-[#daffde]/80 rounded-full animate-spin" />
                  Autenticando...
                </span>
              ) : (
                'Acceder al Sistema'
              )}
            </button>
          </form>

          {/* Forgot password */}
          <div className="text-center">
            <Link
              href="/auth/forgot-password"
              className="text-xs font-mono text-[#daffde]/40 hover:text-[#deff9a] transition-colors"
            >
              ¿Olvidaste tu contraseña? →
            </Link>
          </div>
        </div>

        {/* Demo credentials hint */}
        <div className="bg-[#0a0a0a] border border-[#daffde]/8 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-mono text-[#daffde]/30 uppercase tracking-widest text-center">
            Acceso Demo Corporativo
          </p>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#daffde]/40">{DEMO_EMAIL}</span>
            <button
              onClick={fillDemo}
              className="text-[10px] text-[#deff9a]/60 hover:text-[#deff9a] border border-[#deff9a]/20 hover:border-[#deff9a]/50 px-2 py-0.5 rounded transition-all"
            >
              Usar demo
            </button>
          </div>
          <p className="text-[10px] font-mono text-[#daffde]/20 text-center">
            Contraseña: cualquiera · Entorno: Simulación Enterprise
          </p>
        </div>

        <p className="text-center text-[10px] font-mono text-[#daffde]/20">
          AURA AI · SwissGlow Tech · Region fra1 · Swiss DSG Compliant
        </p>
      </div>
    </div>
  );
}
