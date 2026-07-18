'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createAuraClient } from '@/utils/supabase/client';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const supabase = createAuraClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) return setError(updateError.message);
    router.replace('/dashboard/inventory');
  };

  return (
    <main className="aura-page aura-data-grid min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md aura-panel p-8 md:p-10 space-y-5 aura-enter">
        <p className="aura-label text-[var(--cobalt)]">Último paso</p>
        <h1 className="aura-display text-4xl">Nueva contraseña</h1>
        <p className="text-sm text-[var(--muted)]">Usa al menos 12 caracteres y evita contraseñas de otros servicios.</p>
        <input type="password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="aura-input" autoComplete="new-password" />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button className="aura-button-primary w-full">Guardar contraseña</button>
      </form>
    </main>
  );
}
