import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { addDays, centsToInput, formatDate, formatWhen, money, paymentLabel, reaisToCents, todayISO } from './format';
import { Banner, Shell } from './ui';

const EMOJIS = ['🍓', '🍫', '🍋', '🥥', '🍇', '🧡', '🥛', '🥭', '🍉', '🫐', '🍒', '🥝', '🍍', '🍬', '🍦', '🌽'];
const COLORS = ['#FF4F7B', '#FF9F1C', '#E2B93B', '#1F9D78', '#2A9D8F', '#3D7EFF', '#7A4E9A', '#8A5A44', '#E85D4C', '#F4A4B8'];

const EMPTY_FLAVOR = { name: '', description: '', price: '', emoji: '🍦', color: '#FF4F7B' };

export function AdminApp({ user, onLogout }) {
  const [tab, setTab] = useState('move');
  const [data, setData] = useState(null);
  const [pageError, setPageError] = useState('');

  async function load() {
    const [flavors, pickups] = await Promise.all([api.flavors(), api.pickups()]);
    setData({ flavors, pickups });
    setPageError('');
  }

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [flavors, pickups] = await Promise.all([api.flavors(), api.pickups()]);
        if (live) setData({ flavors, pickups });
      } catch (err) {
        if (!live) return;
        if (err.status === 401) onLogout();
        else setPageError(err.message);
      }
    })();
    return () => { live = false; };
  }, [onLogout]);

  return (
    <Shell user={user} onLogout={onLogout}>
      <div className="tabs no-print" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'move'} className={tab === 'move' ? 'on' : ''} onClick={() => setTab('move')}>
          Quem pegou
        </button>
        <button type="button" role="tab" aria-selected={tab === 'flavors'} className={tab === 'flavors' ? 'on' : ''} onClick={() => setTab('flavors')}>
          Sabores e preços
        </button>
      </div>

      {pageError && (
        <div className="stack">
          <p className="banner error" role="alert">{pageError}</p>
          <button type="button" className="btn" onClick={() => load().catch((err) => setPageError(err.message))}>Tentar de novo</button>
        </div>
      )}
      {!data && !pageError && <p className="muted">Carregando o caderno...</p>}
      {data && tab === 'move' && <Movement data={data} onLogout={onLogout} reload={load} />}
      {data && tab === 'flavors' && <Flavors flavors={data.flavors} onLogout={onLogout} reload={load} />}
    </Shell>
  );
}

function Movement({ data, onLogout, reload }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('all');
  const [day, setDay] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busyId, setBusyId] = useState('');

  const summary = useMemo(() => {
    const promised = data.pickups.filter((pickup) => !pickup.paid && !pickup.settled);
    const marked = data.pickups.filter((pickup) => pickup.paid && !pickup.settled);
    const settled = data.pickups.filter((pickup) => pickup.settled);
    const sumOf = (rows) => rows.reduce((total, pickup) => total + pickup.totalCents, 0);
    return { promised: sumOf(promised), marked: sumOf(marked), settled: sumOf(settled), markedCount: marked.length };
  }, [data.pickups]);

  const visible = useMemo(() => {
    const today = todayISO();
    const weekStart = addDays(today, -6);
    const text = query.trim().toLowerCase();
    return data.pickups.filter((pickup) => {
      if (text && !`${pickup.userName} ${pickup.username} ${pickup.flavorName}`.toLowerCase().includes(text)) return false;
      if (status === 'due' && (pickup.paid || pickup.settled)) return false;
      if (status === 'paid' && (!pickup.paid || pickup.settled)) return false;
      if (status === 'late' && (pickup.paid || pickup.settled || !pickup.paymentDate || pickup.paymentDate >= today)) return false;
      if (status === 'settled' && !pickup.settled) return false;
      if (day) return pickup.pickupDate === day;
      if (range === 'today') return pickup.pickupDate === today;
      if (range === 'week') return pickup.pickupDate >= weekStart && pickup.pickupDate <= today;
      return true;
    });
  }, [data.pickups, query, status, range, day]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const pickup of visible) {
      if (!map.has(pickup.userId)) {
        map.set(pickup.userId, {
          userId: pickup.userId,
          userName: pickup.userName,
          username: pickup.username,
          items: [],
        });
      }
      map.get(pickup.userId).items.push(pickup);
    }
    const rows = [...map.values()];
    for (const group of rows) {
      group.openCents = group.items.filter((item) => !item.settled).reduce((sum, item) => sum + item.totalCents, 0);
    }
    rows.sort((a, b) => b.openCents - a.openCents || a.userName.localeCompare(b.userName, 'pt-BR'));
    return rows;
  }, [visible]);

  const openVisible = visible.filter((pickup) => !pickup.settled).reduce((sum, pickup) => sum + pickup.totalCents, 0);

  async function settle(ids, needsConfirm) {
    if (!ids.length) return;
    if (needsConfirm && !window.confirm('Tem gente que ainda não marcou como pago. Dar baixa mesmo assim?')) return;
    setError('');
    setOk('');
    setBusyId(ids[0]);
    try {
      const result = await api.settle(ids);
      setOk(result.count ? `Baixa feita em ${result.count} ${result.count === 1 ? 'anotação' : 'anotações'}.` : 'Essas anotações já estavam baixadas.');
      await reload();
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  async function remove(id) {
    setError('');
    setOk('');
    try {
      await api.deletePickup(id);
      setOk('Anotação apagada.');
      await reload();
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Quem pegou</h1>
          <p>Vê o que cada pessoa anotou e dá baixa no que já foi pago.</p>
        </div>
        <button type="button" className="btn ghost no-print" onClick={() => window.print()}>Imprimir</button>
      </header>

      <section className="stats">
        <article className="stat late">
          <span>Vão pagar</span>
          <strong>{money(summary.promised)}</strong>
          <em>ainda não marcaram pago</em>
        </article>
        <article className="stat wait">
          <span>Falta dar baixa</span>
          <strong>{money(summary.marked)}</strong>
          <em>{summary.markedCount} {summary.markedCount === 1 ? 'anotação paga' : 'anotações pagas'}</em>
        </article>
        <article className="stat good">
          <span>Baixado</span>
          <strong>{money(summary.settled)}</strong>
          <em>dinheiro conferido</em>
        </article>
      </section>

      <div className="card filters no-print">
        <Banner error={error} ok={ok} />
        <div className="filter-grid">
          <label>
            Buscar
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pessoa ou sabor" />
          </label>
          <label>
            Situação
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Tudo</option>
              <option value="due">A pagar</option>
              <option value="late">Atrasado</option>
              <option value="paid">Pago, falta baixa</option>
              <option value="settled">Baixado</option>
            </select>
          </label>
          <label>
            Um dia
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
        </div>
        <div className="row">
          {[
            ['all', 'Tudo'],
            ['today', 'Hoje'],
            ['week', '7 dias'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={range === value && !day ? 'chip on' : 'chip'}
              onClick={() => { setRange(value); setDay(''); }}
            >
              {label}
            </button>
          ))}
          {day && <button type="button" className="chip" onClick={() => setDay('')}>Limpar dia</button>}
        </div>
        <p className="muted">Neste filtro: {money(openVisible)} ainda sem baixa.</p>
      </div>

      {groups.length === 0 && <p className="card muted empty">Ninguém anotou dindin com esse filtro.</p>}

      <div className="people">
        {groups.map((group) => {
          const paidIds = group.items.filter((item) => item.paid && !item.settled).map((item) => item.id);
          return (
            <section key={group.userId} className="card person">
              <header>
                <div>
                  <h2>{group.userName}</h2>
                  <p className="muted">@{group.username}</p>
                </div>
                <div className="person-side">
                  <strong>{group.openCents > 0 ? `${money(group.openCents)} em aberto` : 'Em dia'}</strong>
                  {paidIds.length > 0 && (
                    <button type="button" className="btn green small no-print" disabled={busyId !== ''} onClick={() => settle(paidIds, false)}>
                      Baixar os pagos
                    </button>
                  )}
                </div>
              </header>
              <ul className="ledger">
                {group.items.map((pickup) => {
                  const label = paymentLabel(pickup);
                  return (
                    <li key={pickup.id}>
                      <div>
                        <strong>{formatDate(pickup.pickupDate)}</strong>
                        <span>{pickup.flavorEmoji} {pickup.quantity}× {pickup.flavorName}</span>
                        {pickup.flavorDescription && <small className="line-desc">{pickup.flavorDescription}</small>}
                      </div>
                      <b>{money(pickup.totalCents)}</b>
                      <span className={`tag ${label.key}`}>{label.text}</span>
                      <div className="row no-print">
                        {!pickup.settled && (
                          <button
                            type="button"
                            className="btn green small"
                            disabled={busyId !== ''}
                            onClick={() => settle([pickup.id], !pickup.paid)}
                          >
                            Dar baixa
                          </button>
                        )}
                        {pickup.settled && <small>baixa {formatWhen(pickup.settledAt)}</small>}
                        <DeleteButton onDelete={() => remove(pickup.id)} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

function DeleteButton({ onDelete }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <button type="button" className="btn danger small" onClick={onDelete}>Confirmar</button>
    );
  }
  return (
    <button type="button" className="btn ghost small" onClick={() => setOpen(true)}>Apagar</button>
  );
}

function Flavors({ flavors, onLogout, reload }) {
  const [form, setForm] = useState(EMPTY_FLAVOR);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);

  function edit(flavor) {
    setEditing(flavor.id);
    setForm({
      name: flavor.name,
      description: flavor.description || '',
      price: centsToInput(flavor.priceCents),
      emoji: flavor.emoji,
      color: flavor.color,
    });
    setError('');
    setOk('');
  }

  function reset() {
    setEditing(null);
    setForm(EMPTY_FLAVOR);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setOk('');
    const priceCents = reaisToCents(form.price);
    if (priceCents == null) {
      setError('Escreve o preço assim: 3,50');
      return;
    }
    const body = { name: form.name, description: form.description, priceCents, emoji: form.emoji, color: form.color };
    setSaving(true);
    try {
      if (editing) {
        await api.updateFlavor(editing, body);
        setOk('Sabor atualizado. O preço novo vale nas próximas anotações.');
      } else {
        await api.createFlavor(body);
        setOk('Sabor no balcão.');
      }
      reset();
      await reload();
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(flavor) {
    setError('');
    setOk('');
    try {
      await api.updateFlavor(flavor.id, { active: !flavor.active });
      setOk(flavor.active ? `${flavor.name} pausado. Sai da lista de quem anota.` : `${flavor.name} voltou para a lista.`);
      await reload();
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }

  async function remove(flavor) {
    setError('');
    setOk('');
    try {
      await api.deleteFlavor(flavor.id);
      if (editing === flavor.id) reset();
      setOk('Sabor apagado. As anotações antigas continuam com o nome e o preço da época.');
      await reload();
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Sabores e preços</h1>
          <p>Cadastra o dindin do balcão. Mudar o preço não mexe no que já foi anotado.</p>
        </div>
      </header>

      <form className="card composer flavor-form" onSubmit={submit}>
        <h2>{editing ? 'Editar sabor' : 'Novo sabor'}</h2>
        <Banner error={error} ok={ok} />
        <div className="filter-grid">
          <label>
            Nome
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Milho verde" maxLength={32} required />
          </label>
          <label>
            Preço
            <input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="3,50" inputMode="decimal" required />
          </label>
        </div>
        <label className="desc-field">
          Descrição
          <input
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Chocolate com pedacinhos crocantes"
            maxLength={80}
          />
        </label>
        <div>
          <p className="field-label">Emoji</p>
          <div className="emoji-row">
            {EMOJIS.map((emoji) => (
              <button type="button" key={emoji} className={form.emoji === emoji ? 'emoji on' : 'emoji'} onClick={() => setForm({ ...form, emoji })}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="field-label">Cor</p>
          <div className="emoji-row">
            {COLORS.map((color) => (
              <button
                type="button"
                key={color}
                className={form.color === color ? 'swatch-btn on' : 'swatch-btn'}
                style={{ background: color }}
                onClick={() => setForm({ ...form, color })}
                aria-label={color}
              />
            ))}
          </div>
        </div>
        <div className="preview-pop" style={{ '--c': form.color }}>
          <span>{form.emoji}</span>
          <div>
            <strong>{form.name || 'Sabor novo'}</strong>
            {form.description && <small className="line-desc">{form.description}</small>}
            <em>{form.price ? `R$ ${form.price}` : 'sem preço'}</em>
          </div>
        </div>
        <div className="row">
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar sabor' : 'Colocar no balcão'}</button>
          {editing && <button type="button" className="btn ghost" onClick={reset}>Cancelar</button>}
        </div>
      </form>

      <div className="flavor-grid">
        {flavors.map((flavor) => (
          <FlavorCard key={flavor.id} flavor={flavor} onEdit={() => edit(flavor)} onToggle={() => toggle(flavor)} onDelete={() => remove(flavor)} />
        ))}
      </div>
    </>
  );
}

function FlavorCard({ flavor, onEdit, onToggle, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <article className={`flavor-card ${flavor.active ? '' : 'paused'}`}>
      <div className="flavor-blob" style={{ background: flavor.color }}>{flavor.emoji}</div>
      <h3>{flavor.name}</h3>
      {flavor.description && <p className="flavor-desc">{flavor.description}</p>}
      <p className="price">{money(flavor.priceCents)}</p>
      {!flavor.active && <span className="tag due">pausado</span>}
      <div className="row">
        <button type="button" className="btn ghost small" onClick={onEdit}>Editar</button>
        <button type="button" className="btn ghost small" onClick={onToggle}>{flavor.active ? 'Pausar' : 'Ativar'}</button>
        {confirming ? (
          <button type="button" className="btn danger small" onClick={onDelete}>Confirmar</button>
        ) : (
          <button type="button" className="btn ghost small" onClick={() => setConfirming(true)}>Apagar</button>
        )}
      </div>
    </article>
  );
}
