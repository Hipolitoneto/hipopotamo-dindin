import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { formatDate, formatDateLong, formatWhen, money, paymentLabel, todayISO } from './format';
import { Banner, Shell } from './ui';
import { PixBox } from './PixBox';

export function UserApp({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [pageError, setPageError] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickupDate, setPickupDate] = useState(todayISO());
  const [paidMode, setPaidMode] = useState('later');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [items, setItems] = useState([]);

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

  const summary = useMemo(() => {
    const pickups = data?.pickups || [];
    const qty = pickups.reduce((sum, pickup) => sum + pickup.quantity, 0);
    const owing = pickups.filter((pickup) => !pickup.paid && !pickup.settled);
    const waiting = pickups.filter((pickup) => pickup.paid && !pickup.settled);
    const settled = pickups.filter((pickup) => pickup.settled);
    const sumOf = (rows) => rows.reduce((sum, pickup) => sum + pickup.totalCents, 0);
    const dates = owing.map((pickup) => pickup.paymentDate).filter(Boolean).sort();
    return {
      qty,
      oweCents: sumOf(owing),
      waitCents: sumOf(waiting),
      settledCents: sumOf(settled),
      nextDue: dates[0] || '',
      late: dates.some((date) => date < todayISO()),
    };
  }, [data]);

  function bump(flavorId, delta) {
    setItems((current) => {
      const found = current.find((item) => item.flavorId === flavorId);
      const nextQty = (found?.quantity || 0) + delta;
      if (nextQty <= 0) return current.filter((item) => item.flavorId !== flavorId);
      if (nextQty > 50) return current;
      if (!found) return [...current, { flavorId, quantity: 1 }];
      return current.map((item) => (item.flavorId === flavorId ? { ...item, quantity: nextQty } : item));
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setOk('');
    if (!items.length) {
      setError('Escolhe pelo menos um sabor.');
      return;
    }
    if (pickupDate > todayISO()) {
      setError('Esse dia ainda não chegou.');
      return;
    }
    if (paidMode === 'later' && !paymentDate) {
      setError('Diz o dia em que vai pagar.');
      return;
    }
    setSaving(true);
    try {
      await api.createPickups({
        pickupDate,
        paid: paidMode === 'paid',
        paymentDate: paidMode === 'later' ? paymentDate : null,
        items,
      });
      setItems([]);
      setOk('Anotado no caderno.');
      await load();
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePickup(id, draft) {
    setError('');
    setOk('');
    try {
      await api.updatePickup(id, draft);
      setOk('Anotação atualizada.');
      await load();
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }

  async function removePickup(id) {
    setError('');
    setOk('');
    try {
      await api.deletePickup(id);
      setOk('Anotação apagada.');
      await load();
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }

  const flavors = data?.flavors || [];
  const totalCents = items.reduce((sum, item) => {
    const flavor = flavors.find((entry) => entry.id === item.flavorId);
    return sum + (flavor ? flavor.priceCents * item.quantity : 0);
  }, 0);

  return (
    <Shell user={user} onLogout={onLogout}>
      <header className="page-head">
        <div>
          <h1>Seu caderno</h1>
          <p>
            Diz o que pegou, quantos foram, e se já pagou ou o dia em que vai pagar.
            {data ? ` Você já anotou ${summary.qty} ${summary.qty === 1 ? 'dindin' : 'dindins'}.` : ''}
          </p>
        </div>
      </header>

      {pageError && (
        <div className="stack">
          <p className="banner error" role="alert">{pageError}</p>
          <button type="button" className="btn" onClick={() => load().catch((err) => setPageError(err.message))}>Tentar de novo</button>
        </div>
      )}

      {!data && !pageError && <p className="muted">Carregando o caderno...</p>}

      {data && (
        <>
          <section className="stats">
            <article className={`stat ${summary.late ? 'late' : ''}`}>
              <span>A pagar</span>
              <strong>{money(summary.oweCents)}</strong>
              <em>{summary.nextDue ? (summary.nextDue < todayISO() ? `atrasado desde ${formatDate(summary.nextDue)}` : `próximo ${formatDate(summary.nextDue)}`) : 'nada pendente'}</em>
            </article>
            <article className="stat wait">
              <span>Aguardando baixa</span>
              <strong>{money(summary.waitCents)}</strong>
              <em>você marcou como pago</em>
            </article>
            <article className="stat good">
              <span>Baixado</span>
              <strong>{money(summary.settledCents)}</strong>
              <em>caixa já confirmou</em>
            </article>
          </section>

          <div className="split">
            <form className="card composer" onSubmit={submit}>
              <h2>Anotar dindin</h2>
              <Banner error={error} ok={ok} />
              <label>
                Dia em que pegou
                <input type="date" value={pickupDate} max={todayISO()} onChange={(event) => setPickupDate(event.target.value)} required />
              </label>

              <div>
                <p className="field-label">Toque no sabor para somar</p>
                {flavors.length === 0 ? (
                  <p className="muted">O admin ainda não deixou sabor disponível.</p>
                ) : (
                  <div className="flavor-picks">
                    {flavors.map((flavor) => {
                      const qty = items.find((item) => item.flavorId === flavor.id)?.quantity || 0;
                      return (
                        <button
                          type="button"
                          key={flavor.id}
                          className={qty ? 'pick on' : 'pick'}
                          onClick={() => bump(flavor.id, 1)}
                        >
                          <span className="dot" style={{ '--c': flavor.color }}>{flavor.emoji}</span>
                          <span>
                            <b>{flavor.name}</b>
                            <small>{money(flavor.priceCents)}</small>
                            {flavor.description && <small className="pick-desc">{flavor.description}</small>}
                          </span>
                          {qty > 0 && <span className="count">{qty}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <ul className="lines">
                  {items.map((item) => {
                    const flavor = flavors.find((entry) => entry.id === item.flavorId);
                    if (!flavor) return null;
                    return (
                      <li key={item.flavorId}>
                        <span className="swatch" style={{ background: flavor.color }}>{flavor.emoji}</span>
                        <div>
                          <strong>{flavor.name}</strong>
                          {flavor.description && <em>{flavor.description}</em>}
                          <em>{money(flavor.priceCents)} cada</em>
                        </div>
                        <div className="stepper">
                          <button type="button" onClick={() => bump(item.flavorId, -1)} aria-label={`Diminuir ${flavor.name}`}>−</button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => bump(item.flavorId, 1)} aria-label={`Aumentar ${flavor.name}`}>+</button>
                        </div>
                        <b>{money(flavor.priceCents * item.quantity)}</b>
                      </li>
                    );
                  })}
                </ul>
              )}

              <fieldset className="pay-choice">
                <legend>Pagamento</legend>
                <label className={paidMode === 'paid' ? 'choice on' : 'choice'}>
                  <input type="radio" name="pay" checked={paidMode === 'paid'} onChange={() => setPaidMode('paid')} />
                  Já paguei
                </label>
                <label className={paidMode === 'later' ? 'choice on' : 'choice'}>
                  <input type="radio" name="pay" checked={paidMode === 'later'} onChange={() => setPaidMode('later')} />
                  Vou pagar em
                </label>
                {paidMode === 'later' && (
                  <label>
                    Dia do pagamento
                    <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
                  </label>
                )}
              </fieldset>

              <div className="total-bar">
                <span>{items.reduce((sum, item) => sum + item.quantity, 0)} dindins</span>
                <strong>{money(totalCents)}</strong>
              </div>
              <button className="btn block" type="submit" disabled={saving || flavors.length === 0}>
                {saving ? 'Anotando...' : 'Anotar no caderno'}
              </button>
              <PixBox />
            </form>

            <section className="card history">
              <h2>O que você pegou</h2>
              {data.pickups.length === 0 && <p className="muted">Nada por aqui ainda. O primeiro dindin abre o caderno.</p>}
              <DayGroups
                pickups={data.pickups}
                flavors={flavors}
                onSave={savePickup}
                onDelete={removePickup}
              />
            </section>
          </div>
        </>
      )}
    </Shell>
  );
}

function DayGroups({ pickups, flavors, onSave, onDelete }) {
  const groups = [];
  for (const pickup of pickups) {
    const last = groups[groups.length - 1];
    if (!last || last.date !== pickup.pickupDate) groups.push({ date: pickup.pickupDate, items: [pickup] });
    else last.items.push(pickup);
  }

  return groups.map((group) => (
    <section key={group.date} className="day">
      <h3>{formatDateLong(group.date)}</h3>
      {group.items.map((pickup) => (
        <PickupRow key={pickup.id} pickup={pickup} flavors={flavors} onSave={onSave} onDelete={onDelete} />
      ))}
    </section>
  ));
}

function PickupRow({ pickup, flavors, onSave, onDelete }) {
  const status = paymentLabel(pickup);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  function startEdit() {
    setDraft({
      pickupDate: pickup.pickupDate,
      flavorId: pickup.flavorId,
      quantity: pickup.quantity,
      paid: pickup.paid,
      paymentDate: pickup.paymentDate || todayISO(),
    });
    setOpen(true);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave(pickup.id, {
        ...draft,
        paid: Boolean(draft.paid),
        paymentDate: draft.paid ? null : draft.paymentDate,
      });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const options = flavors.filter((flavor) => flavor.active || flavor.id === pickup.flavorId);

  return (
    <article className="entry">
      <div className="entry-main">
        <span className="swatch" style={{ background: pickup.flavorColor }}>{pickup.flavorEmoji}</span>
        <div>
          <strong>{pickup.quantity}× {pickup.flavorName}</strong>
          {pickup.flavorDescription && <em>{pickup.flavorDescription}</em>}
          <em>{money(pickup.unitPriceCents)} cada</em>
        </div>
        <b>{money(pickup.totalCents)}</b>
      </div>
      <div className="entry-foot">
        <span className={`tag ${status.key}`}>{status.text}</span>
        {pickup.settled && <small>baixa em {formatWhen(pickup.settledAt)}</small>}
        {!pickup.settled && (
          <div className="row no-print">
            <button type="button" className="btn ghost small" onClick={() => (open ? setOpen(false) : startEdit())}>
              {open ? 'Fechar' : 'Ajustar'}
            </button>
            {confirming ? (
              <button type="button" className="btn danger small" onClick={() => onDelete(pickup.id)}>Confirmar</button>
            ) : (
              <button type="button" className="btn ghost small" onClick={() => setConfirming(true)}>Apagar</button>
            )}
          </div>
        )}
      </div>
      {open && draft && (
        <form className="edit-box stack" onSubmit={save}>
          <label>
            Dia
            <input type="date" value={draft.pickupDate} max={todayISO()} onChange={(event) => setDraft({ ...draft, pickupDate: event.target.value })} required />
          </label>
          <label>
            Sabor
            <select value={draft.flavorId} onChange={(event) => setDraft({ ...draft, flavorId: event.target.value })}>
              {!options.some((flavor) => flavor.id === pickup.flavorId) && (
                <option value={pickup.flavorId}>{pickup.flavorName}</option>
              )}
              {options.map((flavor) => (
                <option key={flavor.id} value={flavor.id}>{flavor.emoji} {flavor.name} · {money(flavor.priceCents)}</option>
              ))}
            </select>
          </label>
          <label>
            Quantidade
            <input type="number" min="1" max="50" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} required />
          </label>
          <label className={draft.paid ? 'choice on' : 'choice'}>
            <input type="checkbox" checked={draft.paid} onChange={(event) => setDraft({ ...draft, paid: event.target.checked })} />
            Já paguei
          </label>
          {!draft.paid && (
            <label>
              Vou pagar em
              <input type="date" value={draft.paymentDate} onChange={(event) => setDraft({ ...draft, paymentDate: event.target.value })} required />
            </label>
          )}
          <button className="btn small" type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar ajuste'}</button>
        </form>
      )}
    </article>
  );
}
