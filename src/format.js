export function todayISO() {
  return toISO(new Date());
}

export function toISO(date) {
  const z = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function money(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function formatDateLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function paymentLabel(pickup) {
  if (pickup.settled) return { key: 'settled', text: 'Baixado' };
  if (pickup.paid) return { key: 'paid', text: 'Pago · falta baixa' };
  if (pickup.paymentDate && pickup.paymentDate < todayISO()) {
    return { key: 'late', text: `Atrasado · era ${formatDate(pickup.paymentDate)}` };
  }
  if (pickup.paymentDate) return { key: 'due', text: `A pagar em ${formatDate(pickup.paymentDate)}` };
  return { key: 'due', text: 'A pagar' };
}

export function reaisToCents(value) {
  const text = String(value || '').trim().replace(/\s/g, '').replace(/^R\$/i, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  if (amount < 0 || amount > 999.99) return null;
  return Math.round(amount * 100);
}

export function centsToInput(cents) {
  return (cents / 100).toFixed(2).replace('.', ',');
}
