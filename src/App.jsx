import React, { useState } from 'react';
import AdminApp from './AdminApp.jsx';
import TeamApp from './TeamApp.jsx';
import { ADMIN_PASSWORD } from './shared.js';

const Icon = {
  compass: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8l-2 6-6 2 2-6z"/></svg>,
  camera: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/></svg>,
  lock: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  arrowRight: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
};

export default function App() {
  const [role, setRole] = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  if (role === 'admin') {
    if (!adminUnlocked) {
      return (
        <AdminPasswordGate
          onSuccess={() => setAdminUnlocked(true)}
          onExit={() => setRole(null)}
        />
      );
    }
    return <AdminApp onExit={() => { setRole(null); setAdminUnlocked(false); }} />;
  }
  if (role === 'team') return <TeamApp onExit={() => setRole(null)} />;

  return (
    <div style={S.page}>
      <div style={S.brandWrap}>
        <div style={S.bigEmoji}>📸</div>
        <h1 style={S.h1}>Rallye photo</h1>
        <p style={S.lead}>Choisis ton accès</p>
      </div>
      <div style={S.roleGrid}>
        <button style={S.roleCard} onClick={() => setRole('admin')}>
          <Icon.compass style={S.roleIcon} />
          <span style={S.roleLabel}>Organisateur</span>
          <span style={S.roleSub}>Créer la partie, valider les photos</span>
        </button>
        <button style={S.roleCard} onClick={() => setRole('team')}>
          <Icon.camera style={S.roleIcon} />
          <span style={S.roleLabel}>Équipe</span>
          <span style={S.roleSub}>Jouer avec le code de partie</span>
        </button>
      </div>
    </div>
  );
}

function AdminPasswordGate({ onSuccess, onExit }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (password === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError('Mot de passe incorrect.');
    }
  }

  return (
    <div style={S.page}>
      <div style={S.gateWrap}>
        <button style={S.exitLink} onClick={onExit}>← Accueil</button>
        <Icon.lock style={S.gateIcon} />
        <h2 style={S.h2}>Espace organisateur</h2>
        <p style={S.lead}>Entre le mot de passe pour continuer</p>
        <input
          type="password"
          style={S.gateInput}
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        {error && <p style={S.gateError}>{error}</p>}
        <button style={S.primaryBtn} onClick={submit}>
          Entrer <Icon.arrowRight style={S.iconSm} />
        </button>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#FFF8EF', fontFamily: "'Nunito', 'Quicksand', -apple-system, sans-serif", color: '#2B2440', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px' },
  brandWrap: { textAlign: 'center', marginTop: '10vh', marginBottom: 48 },
  bigEmoji: { fontSize: 64, marginBottom: 8 },
  h1: { fontFamily: "'Baloo 2', 'Nunito', sans-serif", fontSize: 38, fontWeight: 800, margin: '0 0 8px', color: '#2B2440' },
  lead: { fontSize: 16, color: '#2B2440', opacity: 0.65, margin: 0, fontWeight: 600 },
  roleGrid: { display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 },
  roleCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 200, padding: '28px 20px', background: '#FFFFFF', border: '3px solid #2B2440', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 0 #2B2440' },
  roleIcon: { width: 32, height: 32, color: '#FF6F61', marginBottom: 4 },
  roleLabel: { fontSize: 17, fontWeight: 800, color: '#2B2440' },
  roleSub: { fontSize: 13, color: '#2B2440', opacity: 0.6, textAlign: 'center', lineHeight: 1.4 },

  gateWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '12vh', width: '100%', maxWidth: 320 },
  exitLink: { background: 'none', border: 'none', color: '#9C6ADE', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: 0, marginBottom: 20, fontFamily: 'inherit', alignSelf: 'flex-start' },
  gateIcon: { width: 40, height: 40, color: '#9C6ADE', marginBottom: 12 },
  h2: { fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 800, color: '#2B2440', margin: '0 0 6px' },
  gateInput: { width: '100%', height: 50, borderRadius: 16, border: '3px solid #2B2440', background: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: 700, color: '#2B2440', margin: '16px 0 8px', boxShadow: '0 4px 0 #2B2440' },
  gateError: { fontSize: 13, color: '#FF6F61', fontWeight: 700, marginBottom: 8 },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 24px', borderRadius: 16, border: '3px solid #2B2440', background: '#FF6F61', color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 0 #2B2440', marginTop: 8 },
  iconSm: { width: 16, height: 16 },
};
