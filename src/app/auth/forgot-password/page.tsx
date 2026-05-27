'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !email.includes('@')) {
      setError('Introduce un correo corporativo válido.');
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsLoading(false);
    setIsSent(true);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#f5f5f5] font-sans flex flex-col items-center justify-center px-4">

      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(222,255,154,0.04)_0%,_transparent_60%)] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative">

        {/* Logo */}
        <div className="text-center space-y-3">
          <Link href="/login" className="inline-flex items-center gap-2 group">
            <span className="text-3xl font-black tracking-wider text-[#f5f5f5] group-hover:text-[#deff9a] transition-colors">
              AURA <span className="text-[#deff9a]">AI</span>
            </span>
          </Link>
          <p className="text-[#daffde]/50 text-sm">Recuperación de Acceso Corporativo</p>
        </div>

        <div className="bg-[#111111] border border-[#daffde]/10 rounded-2xl p-8 shadow-2xl">
          {isSent ? (
            /* Estado: Email enviado */
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#deff9a]/10 border border-[#deff9a]/20 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-[#deff9a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-[#f5f5f5]">Revisa tu correo</h2>
                <p className="text-sm text-[#daffde]/60 leading-relaxed">
                  Si <span className="text-[#deff9a] font-mono">{email}</span> está registrado en el sistema corporativo, recibirás un enlace de recuperación en los próximos minutos.
                </p>
              </div>
              <div className="bg-[#0a0a0a] border border-[#daffde]/8 rounded-lg px-4 py-3">
                <p className="text-[11px] font-mono text-[#daffde]/40">
                  El enlace caduca en 15 minutos por razones de seguridad.
                  Si no recibes el correo, revisa tu carpeta de spam o contacta con IT.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-block w-full py-3 rounded-lg border border-[#daffde]/20 text-[#daffde]/60 hover:border-[#deff9a]/40 hover:text-[#deff9a] text-sm font-bold uppercase tracking-wider transition-all text-center"
              >
                ← Volver al acceso
              </Link>
            </div>
          ) : (
            /* Formulario de recuperación */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-[#f5f5f5]">Restablecer contraseña</h2>
                <p className="text-sm text-[#daffde]/60 leading-relaxed">
                  Introduce tu correo corporativo y te enviaremos un enlace seguro para restablecer tu contraseña.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[#daffde]/50 uppercase tracking-widest block">
                  Correo Corporativo
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="usuario@empresa.ch"
                  className="w-full bg-[#0a0a0a] border border-[#daffde]/15 rounded-lg px-4 py-3 text-[#f5f5f5] text-sm font-mono placeholder-[#daffde]/20 focus:outline-none focus:border-[#deff9a]/50 focus:shadow-[0_0_0_2px_rgba(222,255,154,0.08)] transition-all"
                />
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-2.5 text-xs font-mono text-red-400">
                  {error}
                </div>
              )}

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
                    Enviando enlace...
                  </span>
                ) : (
                  'Enviar Enlace de Recuperación'
                )}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-xs font-mono text-[#daffde]/40 hover:text-[#deff9a] transition-colors"
                >
                  ← Volver al acceso
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] font-mono text-[#daffde]/20">
          AURA AI · SwissGlow Tech · Acceso seguro TLS 1.3 · Swiss DSG Compliant
        </p>
      </div>
    </div>
  );
}
