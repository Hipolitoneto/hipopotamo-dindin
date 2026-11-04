import { useState } from 'react';
import { api } from './api';
import { Hippo } from './ui';
import { PixBox } from './PixBox';

export function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (mode === 'register') {
      if (name.trim().length < 2) {
        setError('Como a gente te chama? Escreve seu nome.');
        return;
      }
      if (password.length < 4) {
        setError('A senha precisa ter pelo menos 4 caracteres.');
        return;
      }
      if (password !== again) {
        setError('A senha e a confirmação estão diferentes.');
        return;
      }
    }

    setSaving(true);
    try {
      const user = mode === 'login'
        ? await api.login({ username, password })
        : await api.register({ name, username, password });
      onAuth(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth">
      <section className="hero">
        <div className="float-pops" aria-hidden="true">
          <i className="stick s1" />
          <i className="stick s2" />
          <i className="stick s3" />
        </div>
        <div className="hero-hippo">
          <Hippo />
        </div>
        <p className="kicker">caderno de dindin</p>
        <h1>Hipopótamo<br />Dindin</h1>
        <p className="lede">Anota o que pegou, o sabor, quantos foram e quando o dinheiro chega.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mode" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>
              Entrar
            </button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => switchMode('register')}>
              Criar conta
            </button>
          </div>

          <form className="stack" onSubmit={submit}>
            <h2>{mode === 'login' ? 'Bom te ver' : 'Abre seu caderno'}</h2>
            <p className="muted">
              {mode === 'login'
                ? 'Entra para anotar seus dindins ou cuidar do caixa.'
                : 'Quem pega dindin cria uma conta. O caixa entra como admin.'}
            </p>
            {error && <p className="banner error" role="alert">{error}</p>}

            {mode === 'register' && (
              <label>
                Seu nome
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ana Souza" maxLength={40} autoComplete="name" required />
              </label>
            )}

            <label>
              Usuário
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                placeholder="ana"
                maxLength={20}
                autoComplete="username"
                required
              />
            </label>

            <label>
              Senha
              <span className="secret">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button type="button" className="text-btn" onClick={() => setShow((value) => !value)}>
                  {show ? 'ocultar' : 'mostrar'}
                </button>
              </span>
            </label>

            {mode === 'register' && (
              <label>
                Repetir a senha
                <input type={show ? 'text' : 'password'} value={again} onChange={(event) => setAgain(event.target.value)} autoComplete="new-password" required />
              </label>
            )}

            <button className="btn block" type="submit" disabled={saving}>
              {saving ? 'Um segundo...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <PixBox />
        </div>
      </section>
    </div>
  );
}
