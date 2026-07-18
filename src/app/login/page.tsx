'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createAuraClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    const { error: signInError } = await createAuraClient().auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError('No reconocemos esas credenciales. Revisa el correo y la contraseña.');
      setIsLoading(false);
      return;
    }
    router.replace('/dashboard/inventory');
    router.refresh();
  };

  return (
    <main className="aura-page min-h-screen grid lg:grid-cols-[.9fr_1.1fr]">
      <section className="p-6 md:p-12 lg:p-16 flex flex-col justify-between min-h-[420px] lg:min-h-screen bg-[var(--ink)] text-white relative overflow-hidden">
        <Link href="/" className="font-black tracking-[-.03em] text-xl">AURA<span className="text-[#8da8ff]">/AI</span></Link>
        <svg viewBox="0 0 700 400" className="absolute inset-x-[-10%] top-[22%] w-[120%] opacity-90" aria-hidden="true">
          <path className="aura-margin-line" d="M0 330 C125 310 145 80 270 180 S430 350 510 135 S620 100 700 30" fill="none" stroke="#6688ff" strokeWidth="5" />
        </svg>
        <div className="relative z-10 max-w-lg">
          <p className="aura-label text-white/50 mb-4">Revenue intelligence</p>
          <h1 className="aura-display text-5xl md:text-7xl">Decide con el margen a la vista.</h1>
        </div>
        <p className="relative z-10 text-sm text-white/45 max-w-sm">Acceso restringido por organización, rol y políticas de aislamiento de datos.</p>
      </section>

      <section className="p-6 md:p-12 flex items-center justify-center aura-data-grid">
        <form onSubmit={handleSubmit} className="w-full max-w-md aura-panel p-7 md:p-10 aura-enter">
          <p className="aura-label text-[var(--cobalt)]">Acceso corporativo</p>
          <h2 className="font-serif text-4xl mt-4">Bienvenido de nuevo</h2>
          <p className="text-sm text-[var(--muted)] mt-3 mb-8">Entra con la cuenta asignada a tu organización.</p>

          <div className="space-y-5">
            <label className="block"><span className="aura-label text-[var(--muted)] block mb-2">Correo</span><input className="aura-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.ch" /></label>
            <label className="block"><span className="aura-label text-[var(--muted)] block mb-2">Contraseña</span><input className="aura-input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          </div>

          {error && <p role="alert" className="mt-4 text-sm text-[#a43d27] bg-[#fff1ed] border border-[#f2b9aa] rounded-lg p-3">{error}</p>}
          <button type="submit" disabled={isLoading} className="aura-button-primary w-full mt-6 disabled:opacity-50">{isLoading ? 'Verificando acceso…' : 'Entrar a Aura'}<span aria-hidden="true">→</span></button>
          <Link href="/auth/forgot-password" className="block text-center text-sm font-bold text-[var(--muted)] hover:text-[var(--cobalt)] mt-5">Recuperar contraseña</Link>
        </form>
      </section>
    </main>
  );
}
