'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createAuraClient } from '@/utils/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const supabase = createAuraClient();
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <main className="aura-page aura-data-grid min-h-screen flex items-center justify-center px-4">
      <section className="w-full max-w-md aura-panel p-8 md:p-10 space-y-6 aura-enter">
        <p className="aura-label text-[var(--cobalt)]">Acceso seguro</p>
        <h1 className="aura-display text-4xl">Restablecer contraseña</h1>
        {sent ? (
          <p className="text-sm text-[var(--muted)]">Si la cuenta existe, recibirás un enlace seguro por correo.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="aura-input" placeholder="usuario@empresa.ch" />
            <button disabled={loading} className="aura-button-primary w-full disabled:opacity-50">
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}
        <Link href="/login" className="text-sm font-bold text-[var(--cobalt)]">← Volver al acceso</Link>
      </section>
    </main>
  );
}
