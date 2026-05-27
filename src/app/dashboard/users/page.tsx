'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { getSessionContext } from '@/utils/auth/mockAuth';

interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Analyst';
  status: 'active' | 'pending' | 'inactive';
  lastLogin: string;
  initials: string;
  authMethod: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    id: '1',
    name: 'Vidal Renao',
    email: 'vidal.renao@swissglow.ch',
    role: 'Admin',
    status: 'active',
    lastLogin: 'Ahora',
    initials: 'VR',
    authMethod: 'SSO SAML',
  },
  {
    id: '2',
    name: 'Ana Müller',
    email: 'ana.mueller@swissglow.ch',
    role: 'Analyst',
    status: 'active',
    lastLogin: 'Hace 2h',
    initials: 'AM',
    authMethod: 'OAuth Google',
  },
  {
    id: '3',
    name: 'Thomas Keller',
    email: 'thomas.keller@swissglow.ch',
    role: 'Analyst',
    status: 'active',
    lastLogin: 'Hace 1d',
    initials: 'TK',
    authMethod: 'Password',
  },
  {
    id: '4',
    name: 'Sophie Weber',
    email: 'sophie.weber@swissglow.ch',
    role: 'Analyst',
    status: 'pending',
    lastLogin: '—',
    initials: 'SW',
    authMethod: 'Invitación pendiente',
  },
];

export default function UsersPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<DemoUser[]>(DEMO_USERS);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Analyst'>('Analyst');
  const [inviteSent, setInviteSent] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    setIsAdmin(getSessionContext().role === 'Admin');
    const handleRole = () => setIsAdmin(getSessionContext().role === 'Admin');
    window.addEventListener('roleChange', handleRole);
    return () => window.removeEventListener('roleChange', handleRole);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleChangeRole = (userId: string, newRole: 'Admin' | 'Analyst') => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    showToast(`Rol actualizado correctamente.`);
  };

  const handleDeactivate = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: 'inactive' } : u))
    );
    showToast('Usuario desactivado del tenant.');
  };

  const handleReactivate = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: 'active' } : u))
    );
    showToast('Usuario reactivado.');
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) return;
    await new Promise((r) => setTimeout(r, 800));
    const initials = inviteEmail.split('@')[0].slice(0, 2).toUpperCase();
    const newUser: DemoUser = {
      id: String(Date.now()),
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      status: 'pending',
      lastLogin: '—',
      initials,
      authMethod: 'Invitación pendiente',
    };
    setUsers((prev) => [...prev, newUser]);
    setInviteSent(true);
    setTimeout(() => {
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('Analyst');
      setInviteSent(false);
    }, 1800);
    showToast(`Invitación enviada a ${inviteEmail}`);
  };

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === 'Admin').length,
    analysts: users.filter((u) => u.role === 'Analyst').length,
    active: users.filter((u) => u.status === 'active').length,
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#f5f5f5] font-sans">
      <Navigation />

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#111] border border-[#deff9a]/30 text-[#deff9a] text-xs font-mono px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
          ✓ {toastMsg}
        </div>
      )}

      <div className="max-w-6xl mx-auto p-8 space-y-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#daffde]/20 pb-6 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-[#f5f5f5]">
              Gestión de <span className="text-[#deff9a]">Usuarios</span>
            </h1>
            <p className="text-[#daffde]/70 text-sm mt-1">
              Tenant: SwissGlow Tech · Acceso y roles del equipo corporativo
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-6 py-3 rounded-lg bg-[#deff9a] text-[#000000] font-bold text-sm tracking-wider uppercase border border-[#deff9a] hover:bg-[#000000] hover:text-[#deff9a] transition-all shadow-[0_0_15px_rgba(222,255,154,0.12)]"
            >
              + Invitar Usuario
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Usuarios', value: stats.total, color: 'text-[#f5f5f5]' },
            { label: 'Administradores', value: stats.admins, color: 'text-[#deff9a]' },
            { label: 'Analistas', value: stats.analysts, color: 'text-blue-400' },
            { label: 'Sesiones Activas', value: stats.active, color: 'text-emerald-400' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#111111] border border-[#daffde]/10 rounded-xl p-5 space-y-1"
            >
              <p className="text-[10px] font-mono text-[#daffde]/40 uppercase tracking-widest">
                {stat.label}
              </p>
              <p className={`text-3xl font-black font-mono ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabla de usuarios */}
        <div className="bg-[#111111] rounded-xl border border-[#daffde]/10 overflow-hidden shadow-xl">
          <div className="bg-[#0a0a0a] border-b border-[#daffde]/10 px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#f5f5f5] uppercase tracking-wider">
              Miembros del Tenant
            </h2>
            <span className="text-[10px] font-mono text-[#daffde]/40 border border-[#daffde]/10 px-2 py-0.5 rounded">
              {users.length} usuarios
            </span>
          </div>

          <div className="divide-y divide-[#daffde]/5">
            {users.map((user) => (
              <div
                key={user.id}
                className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors hover:bg-[#1a1a1a]/50 ${
                  user.status === 'inactive' ? 'opacity-50' : ''
                }`}
              >
                {/* Avatar + info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      user.role === 'Admin'
                        ? 'bg-[#deff9a]/10 text-[#deff9a] border border-[#deff9a]/20'
                        : 'bg-blue-950/50 text-blue-400 border border-blue-900/40'
                    }`}
                  >
                    {user.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#f5f5f5] truncate">{user.name}</p>
                    <p className="text-xs font-mono text-[#daffde]/50 truncate">{user.email}</p>
                  </div>
                </div>

                {/* Role badge */}
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                      user.role === 'Admin'
                        ? 'bg-[#deff9a]/10 text-[#deff9a] border-[#deff9a]/20'
                        : 'bg-blue-950 text-blue-400 border-blue-900'
                    }`}
                  >
                    {user.role}
                  </span>

                  {/* Status */}
                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${
                      user.status === 'active'
                        ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/40'
                        : user.status === 'pending'
                        ? 'bg-amber-950/50 text-amber-400 border-amber-900/40'
                        : 'bg-[#1a1a1a] text-[#daffde]/30 border-[#daffde]/10'
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${
                        user.status === 'active'
                          ? 'bg-emerald-400 animate-pulse'
                          : user.status === 'pending'
                          ? 'bg-amber-400'
                          : 'bg-[#daffde]/20'
                      }`}
                    />
                    {user.status === 'active' ? 'Activo' : user.status === 'pending' ? 'Pendiente' : 'Inactivo'}
                  </span>
                </div>

                {/* Auth method + last login */}
                <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0 min-w-[140px]">
                  <span className="text-[10px] font-mono text-[#daffde]/30">{user.authMethod}</span>
                  <span className="text-[10px] font-mono text-[#daffde]/40">
                    Última sesión: {user.lastLogin}
                  </span>
                </div>

                {/* Actions */}
                {isAdmin && user.email !== getSessionContext().email && (
                  <div className="flex gap-2 shrink-0">
                    {user.status !== 'inactive' && (
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeRole(user.id, e.target.value as 'Admin' | 'Analyst')}
                        className="text-[10px] font-mono bg-[#0a0a0a] border border-[#daffde]/15 text-[#daffde]/60 rounded px-2 py-1 focus:outline-none focus:border-[#deff9a]/40 cursor-pointer"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Analyst">Analyst</option>
                      </select>
                    )}
                    {user.status === 'inactive' ? (
                      <button
                        onClick={() => handleReactivate(user.id)}
                        className="text-[10px] font-mono font-bold uppercase px-2 py-1 rounded border border-emerald-900/60 text-emerald-400 hover:bg-emerald-950/30 transition-all"
                      >
                        Reactivar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeactivate(user.id)}
                        className="text-[10px] font-mono font-bold uppercase px-2 py-1 rounded border border-red-900/60 text-red-400/70 hover:bg-red-950/30 hover:text-red-400 transition-all"
                      >
                        Desactivar
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Security info */}
        <div className="bg-[#0a0a0a] border border-[#daffde]/8 rounded-xl p-5 flex flex-col md:flex-row gap-6 items-start">
          <div className="space-y-1 flex-1">
            <p className="text-xs font-bold text-[#f5f5f5]">Política de Seguridad Corporativa</p>
            <p className="text-[11px] font-mono text-[#daffde]/40 leading-relaxed">
              Los cambios de rol tienen efecto inmediato en la próxima sesión. Los usuarios desactivados
              pierden acceso instantáneo al panel. Todas las acciones quedan registradas en el audit trail
              bajo estándar Swiss DSG / ISO 27001.
            </p>
          </div>
          <div className="flex flex-col gap-1.5 text-[10px] font-mono text-[#daffde]/30 shrink-0">
            <span>TLS 1.3 · AES-256</span>
            <span>MFA: Habilitado</span>
            <span>Región: fra1 (DACH)</span>
          </div>
        </div>
      </div>

      {/* Modal de invitación */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#daffde]/20 rounded-2xl p-8 w-full max-w-md shadow-2xl space-y-6">
            {inviteSent ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#deff9a]/10 border border-[#deff9a]/20 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-[#deff9a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-[#f5f5f5]">Invitación enviada</p>
                <p className="text-xs font-mono text-[#daffde]/50">{inviteEmail}</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#f5f5f5]">Invitar Usuario</h2>
                  <p className="text-sm text-[#daffde]/50">
                    El usuario recibirá un enlace de acceso al tenant SwissGlow Tech.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-[#daffde]/50 uppercase tracking-widest block">
                      Correo Corporativo
                    </label>
                    <input
                      type="email"
                      autoFocus
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="usuario@empresa.ch"
                      className="w-full bg-[#0a0a0a] border border-[#daffde]/15 rounded-lg px-4 py-3 text-[#f5f5f5] text-sm font-mono placeholder-[#daffde]/20 focus:outline-none focus:border-[#deff9a]/50 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-[#daffde]/50 uppercase tracking-widest block">
                      Rol Asignado
                    </label>
                    <div className="flex gap-2">
                      {(['Analyst', 'Admin'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setInviteRole(r)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                            inviteRole === r
                              ? r === 'Admin'
                                ? 'bg-[#deff9a] text-black border-[#deff9a]'
                                : 'bg-blue-950 text-blue-400 border-blue-900'
                              : 'border-[#daffde]/15 text-[#daffde]/40 hover:border-[#daffde]/30'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowInviteModal(false); setInviteEmail(''); }}
                    className="flex-1 py-2.5 rounded-lg border border-[#daffde]/15 text-[#daffde]/50 hover:bg-[#daffde]/5 text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim() || !inviteEmail.includes('@')}
                    className="flex-1 py-2.5 rounded-lg bg-[#deff9a] text-black hover:bg-black hover:text-[#deff9a] border border-[#deff9a] text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Enviar Invitación
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
