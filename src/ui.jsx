import { useState } from 'react';
import { api } from './api';

export function Hippo({ size = 168, variant = 'hero' }) {
  return (
    <svg className="hippo" width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <ellipse cx="100" cy="176" rx="46" ry="8" fill="#ead9c8" />
      {variant === 'hero' && (
        <g>
          <rect x="28" y="96" width="26" height="52" rx="12" fill="#1F9D78" />
          <rect x="33" y="102" width="8" height="18" rx="4" fill="#fff" opacity="0.35" />
          <rect x="37" y="146" width="8" height="22" rx="3" fill="#E6C48A" />
          <rect x="150" y="78" width="24" height="48" rx="11" fill="#FF9F1C" />
          <rect x="155" y="84" width="7" height="16" rx="3" fill="#fff" opacity="0.4" />
          <rect x="158" y="124" width="8" height="20" rx="3" fill="#E6C48A" />
        </g>
      )}
      <ellipse cx="46" cy="58" rx="18" ry="22" fill="#8d868f" />
      <ellipse cx="154" cy="58" rx="18" ry="22" fill="#8d868f" />
      <ellipse cx="46" cy="60" rx="10" ry="13" fill="#f3b6c6" />
      <ellipse cx="154" cy="60" rx="10" ry="13" fill="#f3b6c6" />
      <ellipse cx="100" cy="118" rx="72" ry="58" fill="#9a939c" />
      <ellipse cx="100" cy="132" rx="46" ry="32" fill="#c9c2c8" />
      <circle cx="100" cy="92" r="60" fill="#9a939c" />
      <ellipse cx="100" cy="114" rx="40" ry="28" fill="#b7b0b8" />
      <ellipse cx="86" cy="112" rx="8" ry="11" fill="#4c4650" />
      <ellipse cx="114" cy="112" rx="8" ry="11" fill="#4c4650" />
      <ellipse cx="88" cy="108" rx="3" ry="4" fill="#fff" opacity="0.35" />
      <circle cx="74" cy="80" r="9" fill="#fff" />
      <circle cx="126" cy="80" r="9" fill="#fff" />
      <circle cx="76" cy="81" r="4.5" fill="#241910" />
      <circle cx="128" cy="81" r="4.5" fill="#241910" />
      <circle cx="77.5" cy="79.5" r="1.5" fill="#fff" />
      <circle cx="129.5" cy="79.5" r="1.5" fill="#fff" />
      <ellipse cx="58" cy="98" rx="8" ry="5" fill="#f4a4b8" opacity="0.9" />
      <ellipse cx="142" cy="98" rx="8" ry="5" fill="#f4a4b8" opacity="0.9" />
      <path d="M84 128 Q100 140 116 128" fill="none" stroke="#4c4650" strokeWidth="3" strokeLinecap="round" />
      <rect x="132" y="118" width="30" height="50" rx="12" fill="#FF4F7B" />
      <rect x="138" y="124" width="8" height="16" rx="4" fill="#fff" opacity="0.4" />
      <rect x="143" y="166" width="8" height="22" rx="3" fill="#E6C48A" />
    </svg>
  );
}

export function Shell({ user, onLogout, children }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function logout() {
    await api.logout();
    onLogout();
  }

  async function savePassword(event) {
    event.preventDefault();
    setError('');
    if (next.length < 4) {
      setError('A nova senha precisa ter pelo menos 4 caracteres.');
      return;
    }
    if (next !== again) {
      setError('A nova senha e a confirmação estão diferentes.');
      return;
    }
    setSaving(true);
    try {
      await api.password({ current, next });
      setOpen(false);
      setCurrent('');
      setNext('');
      setAgain('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Hippo size={46} variant="mark" />
          <div>
            <strong>Hipopótamo</strong>
            <em>dindin</em>
          </div>
        </div>
        <div className="who">
          <span className="role">{user.role === 'admin' ? 'Admin' : 'Usuário'}</span>
          <strong title={user.name}>{user.name}</strong>
        </div>
        <div className="top-actions no-print">
          <button type="button" className="btn ghost small" onClick={() => { setError(''); setOpen(true); }}>
            Senha
          </button>
          <button type="button" className="btn small" onClick={logout}>Sair</button>
        </div>
      </header>
      <main className="wrap">{children}</main>
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-labelledby="senha-titulo" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="senha-titulo">Trocar senha</h2>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            </header>
            <form className="stack" onSubmit={savePassword}>
              {error && <p className="banner error" role="alert">{error}</p>}
              <label>
                Senha atual
                <input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required />
              </label>
              <label>
                Nova senha
                <input type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" required />
              </label>
              <label>
                Repetir a nova senha
                <input type="password" value={again} onChange={(event) => setAgain(event.target.value)} autoComplete="new-password" required />
              </label>
              <button className="btn block" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar senha'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function Banner({ error, ok }) {
  if (!error && !ok) return null;
  return (
    <>
      {error && <p className="banner error" role="alert">{error}</p>}
      {ok && <p className="banner ok" role="status">{ok}</p>}
    </>
  );
}
