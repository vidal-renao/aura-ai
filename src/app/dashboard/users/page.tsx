'use client';

import { useCallback, useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';

interface TenantUser {
  id: string;
  email: string;
  role: 'Admin' | 'Analyst';
  status: 'active' | 'pending' | 'inactive';
  last_sign_in_at: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Admin' | 'Analyst'>('Analyst');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    const response = await fetch('/api/aura/users', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar el equipo.');
    const payload: { users: TenantUser[] } = await response.json();
    setUsers(payload.users);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadUsers().catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Error desconocido');
        setLoading(false);
      });
    });
  }, [loadUsers]);

  const invite = async () => {
    setError('');
    const response = await fetch('/api/aura/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) return setError('No se pudo enviar la invitación.');
    setEmail('');
    await loadUsers();
  };

  const changeRole = async (userId: string, nextRole: 'Admin' | 'Analyst') => {
    const response = await fetch('/api/aura/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role: nextRole }),
    });
    if (!response.ok) return setError('No se pudo actualizar el rol.');
    await loadUsers();
  };

  return (
    <main className="aura-page">
      <Navigation />
      <div className="aura-wrap py-10 md:py-16 space-y-10">
        <header className="grid md:grid-cols-[1fr_auto] gap-6 items-end border-b border-[var(--ink)] pb-8 aura-enter">
          <div><p className="aura-label text-[var(--cobalt)]">Acceso y responsabilidad</p><h1 className="aura-display text-5xl md:text-7xl mt-4">El equipo detrás<br /><em>de cada decisión.</em></h1></div>
          <p className="text-sm text-[var(--muted)] max-w-xs">Invita personas y asigna el nivel de control que necesitan.</p>
        </header>
        <section className="aura-panel p-5 md:p-6 grid md:grid-cols-[1fr_160px_auto] gap-3 items-end">
          <label><span className="aura-label text-[var(--muted)] block mb-2">Correo corporativo</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@empresa.ch" className="aura-input" /></label>
          <label><span className="aura-label text-[var(--muted)] block mb-2">Rol inicial</span><select value={role} onChange={(event) => setRole(event.target.value as 'Admin' | 'Analyst')} className="aura-input">
            <option>Analyst</option><option>Admin</option>
          </select></label>
          <button onClick={invite} disabled={!email.includes('@')} className="aura-button-primary disabled:opacity-40">Enviar invitación</button>
        </section>
        {error && <p role="alert" className="text-[#a43d27] bg-[#fff1ed] border border-[#f2b9aa] rounded-lg p-3 text-sm">{error}</p>}
        <section className="aura-panel overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_130px] px-5 py-3 bg-[var(--paper)] border-b border-[var(--line)] aura-label text-[var(--muted)]"><span>Persona</span><span>Estado</span><span>Control</span></div>
          {loading ? <p className="p-8 aura-label text-[var(--cobalt)]">Cargando equipo…</p> : users.map((user) => (
            <article key={user.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_130px] gap-3 md:items-center px-5 py-5 border-b last:border-b-0 border-[var(--line)] hover:bg-[var(--paper)]">
              <div><p className="font-bold">{user.email}</p><p className="text-xs text-[var(--muted)] mt-1">Último acceso: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Aún no ha entrado'}</p></div>
              <span className={`aura-label ${user.status === 'active' ? 'text-[var(--pine)]' : 'text-[var(--signal)]'}`}>● {user.status}</span>
              <select aria-label={`Rol de ${user.email}`} value={user.role} onChange={(event) => changeRole(user.id, event.target.value as 'Admin' | 'Analyst')} className="aura-input !min-h-10 !py-1">
                <option>Analyst</option><option>Admin</option>
              </select>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
