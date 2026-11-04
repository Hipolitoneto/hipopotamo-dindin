import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const DB_PATH = path.join(dataDir, 'db.json');

const SEED_FLAVORS = [
  ['Morango', 300, '🍓', '#FF4F7B'],
  ['Chocolate', 300, '🍫', '#8A5A44'],
  ['Limão', 250, '🍋', '#E2B93B'],
  ['Coco', 350, '🥥', '#C9855A'],
  ['Uva', 300, '🍇', '#7A4E9A'],
  ['Maracujá', 350, '🧡', '#F08A24'],
  ['Leite condensado', 400, '🥛', '#E7C98A'],
  ['Manga', 300, '🥭', '#FF9F1C'],
];

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function write(db) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  try {
    fs.renameSync(tmp, DB_PATH);
  } catch {
    fs.copyFileSync(tmp, DB_PATH);
    fs.unlinkSync(tmp);
  }
}

function seed() {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: crypto.randomUUID(),
        name: 'Hipopótamo',
        username: 'admin',
        passwordHash: bcrypt.hashSync('hipo123', 10),
        role: 'admin',
        createdAt: now,
      },
    ],
    flavors: SEED_FLAVORS.map(([name, priceCents, emoji, color]) => ({
      id: crypto.randomUUID(),
      name,
      priceCents,
      emoji,
      color,
      description: '',
      active: true,
      createdAt: now,
    })),
    pickups: [],
    sessions: [],
  };
}

function read() {
  if (!fs.existsSync(DB_PATH)) {
    const db = seed();
    write(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

let sqlClient;
let schemaReady;

function postgres() {
  if (!sqlClient) {
    sqlClient = import('@neondatabase/serverless').then(({ neon }) => neon(process.env.DATABASE_URL));
  }
  return sqlClient;
}

async function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = sql`CREATE TABLE IF NOT EXISTS ledger (
      id integer PRIMARY KEY,
      version integer NOT NULL,
      data jsonb NOT NULL
    )`.catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function parseLedger(row) {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { version: Number(row.version), db: data };
}

async function loadPostgres() {
  const sql = await postgres();
  await ensureSchema(sql);
  let rows = await sql`SELECT version, data FROM ledger WHERE id = 1`;
  if (!rows.length) {
    const seeded = seed();
    await sql`INSERT INTO ledger (id, version, data)
      VALUES (1, 1, ${JSON.stringify(seeded)}::jsonb)
      ON CONFLICT (id) DO NOTHING`;
    rows = await sql`SELECT version, data FROM ledger WHERE id = 1`;
  }
  return parseLedger(rows[0]);
}

async function savePostgres(db, version) {
  const sql = await postgres();
  const rows = await sql`UPDATE ledger
    SET data = ${JSON.stringify(db)}::jsonb, version = version + 1
    WHERE id = 1 AND version = ${version}
    RETURNING version`;
  return rows.length > 0;
}

async function load() {
  if (process.env.DATABASE_URL) return loadPostgres();
  if (process.env.VERCEL) fail('O caderno online ainda não está ligado a um banco.', 503);
  return { version: 0, db: read() };
}

let chain = Promise.resolve();

function mutate(fn) {
  if (process.env.VERCEL && !process.env.DATABASE_URL) {
    fail('O caderno online ainda não está ligado a um banco.', 503);
  }
  if (process.env.DATABASE_URL) return mutatePostgres(fn);
  const run = chain.then(() => {
    const db = read();
    const result = fn(db);
    write(db);
    return result;
  });
  chain = run.then(() => {}, () => {});
  return run;
}

async function mutatePostgres(fn) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { db, version } = await loadPostgres();
    const result = fn(db);
    if (await savePostgres(db, version)) return result;
  }
  fail('O caderno estava ocupado. Tenta de novo.', 503);
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

export function todayISO() {
  const now = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${z(now.getMonth() + 1)}-${z(now.getDate())}`;
}

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) fail(`${label} inválida.`);
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    fail(`${label} inválida.`);
  }
  return value;
}

function cleanPersonName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 40) fail('O nome precisa ter entre 2 e 40 caracteres.');
  return name;
}

function cleanUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9._]{3,20}$/.test(username)) {
    fail('Usuário precisa ter de 3 a 20 caracteres: letras, números, ponto ou _.');
  }
  return username;
}

function cleanPassword(value, label = 'A senha') {
  const password = String(value || '');
  if (password.length < 4 || password.length > 72) fail(`${label} precisa ter entre 4 e 72 caracteres.`);
  return password;
}

function cleanFlavorName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 32) fail('O nome do sabor precisa ter entre 2 e 32 caracteres.');
  return name;
}

function cleanDescription(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length > 80) fail('A descrição pode ter no máximo 80 caracteres.');
  return text;
}

function cleanEmoji(value) {
  const emoji = String(value || '').trim();
  if (!emoji || emoji.length > 8) fail('Escolhe um emoji curto para o sabor.');
  return emoji;
}

function cleanColor(value) {
  const color = String(value || '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail('Cor do sabor inválida.');
  return color.toUpperCase();
}

function cleanPrice(value) {
  const cents = Number(value);
  if (!Number.isInteger(cents) || cents < 0 || cents > 99999) fail('Preço inválido.');
  return cents;
}

function hydrate(db, pickup) {
  const user = db.users.find((item) => item.id === pickup.userId);
  const flavor = db.flavors.find((item) => item.id === pickup.flavorId);
  return {
    ...pickup,
    userName: user?.name || 'Alguém',
    username: user?.username || '',
    flavorDescription: flavor?.description || '',
    totalCents: pickup.unitPriceCents * pickup.quantity,
  };
}

export async function getUserByToken(token) {
  if (!token) return null;
  const { db } = await load();
  const session = db.sessions.find((item) => item.token === token && item.expiresAt > Date.now());
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId);
  return user ? publicUser(user) : null;
}

export async function registerUser({ name, username, password }) {
  const clean = {
    name: cleanPersonName(name),
    username: cleanUsername(username),
    password: cleanPassword(password),
  };
  const passwordHash = await bcrypt.hash(clean.password, 10);
  return mutate((db) => {
    if (db.users.some((user) => user.username === clean.username)) fail('Esse usuário já existe.', 409);
    const user = {
      id: crypto.randomUUID(),
      name: clean.name,
      username: clean.username,
      passwordHash,
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    return publicUser(user);
  });
}

export async function authenticate(username, password) {
  const normalized = String(username || '').trim().toLowerCase();
  const { db } = await load();
  const user = db.users.find((item) => item.username === normalized);
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    fail('Usuário ou senha não confere.', 401);
  }
  return publicUser(user);
}

export function createSession(userId) {
  return mutate((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) fail('Usuário não encontrado.', 401);
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions.push({
      token,
      userId,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    return { token, user: publicUser(user) };
  });
}

export function deleteSession(token) {
  return mutate((db) => {
    db.sessions = db.sessions.filter((item) => item.token !== token);
    return true;
  });
}

export async function changePassword(userId, current, next) {
  const password = cleanPassword(next, 'A nova senha');
  const { db } = await load();
  const user = db.users.find((item) => item.id === userId);
  if (!user) fail('Faça login de novo.', 401);
  if (!(await bcrypt.compare(String(current || ''), user.passwordHash))) {
    fail('A senha atual não confere.');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  return mutate((fresh) => {
    const target = fresh.users.find((item) => item.id === userId);
    if (!target) fail('Faça login de novo.', 401);
    target.passwordHash = passwordHash;
    return true;
  });
}

export async function listFlavors(user) {
  const { db } = await load();
  const flavors = user.role === 'admin' ? [...db.flavors] : db.flavors.filter((flavor) => flavor.active);
  flavors.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'));
  return flavors.map((flavor) => ({ ...flavor, description: flavor.description || '' }));
}

export function createFlavor({ name, priceCents, emoji, color, description }) {
  const flavor = {
    id: crypto.randomUUID(),
    name: cleanFlavorName(name),
    description: cleanDescription(description),
    priceCents: cleanPrice(priceCents),
    emoji: cleanEmoji(emoji),
    color: cleanColor(color),
    active: true,
    createdAt: new Date().toISOString(),
  };
  return mutate((db) => {
    if (db.flavors.some((item) => item.name.toLowerCase() === flavor.name.toLowerCase())) {
      fail('Já existe um sabor com esse nome.');
    }
    db.flavors.push(flavor);
    return flavor;
  });
}

export function updateFlavor(id, patch) {
  return mutate((db) => {
    const flavor = db.flavors.find((item) => item.id === id);
    if (!flavor) fail('Sabor não encontrado.', 404);
    if (patch.name != null) {
      const name = cleanFlavorName(patch.name);
      if (db.flavors.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) {
        fail('Já existe um sabor com esse nome.');
      }
      flavor.name = name;
    }
    if (patch.description != null) flavor.description = cleanDescription(patch.description);
    if (patch.priceCents != null) flavor.priceCents = cleanPrice(patch.priceCents);
    if (patch.emoji != null) flavor.emoji = cleanEmoji(patch.emoji);
    if (patch.color != null) flavor.color = cleanColor(patch.color);
    if (patch.active != null) flavor.active = Boolean(patch.active);
    return flavor;
  });
}

export function deleteFlavor(id) {
  return mutate((db) => {
    const before = db.flavors.length;
    db.flavors = db.flavors.filter((item) => item.id !== id);
    if (db.flavors.length === before) fail('Sabor não encontrado.', 404);
    return true;
  });
}

function sortedPickups(db, rows) {
  return rows
    .map((pickup) => hydrate(db, pickup))
    .sort((a, b) => b.pickupDate.localeCompare(a.pickupDate) || b.createdAt.localeCompare(a.createdAt));
}

export async function listPickups(user) {
  const { db } = await load();
  const rows = user.role === 'admin' ? db.pickups : db.pickups.filter((item) => item.userId === user.id);
  return sortedPickups(db, rows);
}

function buildPickup(db, user, { flavor, quantity, pickupDate, paid, paymentDate }) {
  return {
    id: crypto.randomUUID(),
    userId: user.id,
    flavorId: flavor.id,
    flavorName: flavor.name,
    flavorEmoji: flavor.emoji,
    flavorColor: flavor.color,
    unitPriceCents: flavor.priceCents,
    quantity,
    pickupDate,
    paid,
    paymentDate: paid ? null : paymentDate,
    settled: false,
    settledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createPickups(user, body) {
  const pickupDate = assertDate(body?.pickupDate, 'A data em que pegou');
  if (pickupDate > todayISO()) fail('Esse dia ainda não chegou.');
  const paid = Boolean(body?.paid);
  const paymentDate = paid ? null : assertDate(body?.paymentDate, 'A data do pagamento');
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) fail('Escolhe pelo menos um sabor.');

  const merged = new Map();
  for (const item of items) {
    const flavorId = String(item?.flavorId || '');
    const quantity = Number(item?.quantity);
    if (!flavorId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      fail('Quantidade inválida. Pode anotar de 1 a 50 de cada sabor.');
    }
    merged.set(flavorId, (merged.get(flavorId) || 0) + quantity);
  }
  for (const quantity of merged.values()) {
    if (quantity > 50) fail('Quantidade inválida. Pode anotar de 1 a 50 de cada sabor.');
  }

  return mutate((db) => {
    const created = [];
    for (const [flavorId, quantity] of merged) {
      const flavor = db.flavors.find((item) => item.id === flavorId);
      if (!flavor || !flavor.active) fail('Um dos sabores não está mais disponível.');
      const pickup = buildPickup(db, user, { flavor, quantity, pickupDate, paid, paymentDate });
      db.pickups.push(pickup);
      created.push(pickup);
    }
    return sortedPickups(db, created);
  });
}

export function updatePickup(user, id, patch) {
  const pickupDate = assertDate(patch?.pickupDate, 'A data em que pegou');
  if (pickupDate > todayISO()) fail('Esse dia ainda não chegou.');
  const quantity = Number(patch?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    fail('Quantidade inválida. Pode anotar de 1 a 50.');
  }
  const paid = Boolean(patch?.paid);
  const paymentDate = paid ? null : assertDate(patch?.paymentDate, 'A data do pagamento');
  const flavorId = String(patch?.flavorId || '');

  return mutate((db) => {
    const pickup = db.pickups.find((item) => item.id === id);
    if (!pickup) fail('Anotação não encontrada.', 404);
    if (pickup.userId !== user.id) fail('Essa anotação é de outra pessoa.', 403);
    if (pickup.settled) fail('Essa anotação já foi baixada.', 409);

    if (flavorId && flavorId !== pickup.flavorId) {
      const flavor = db.flavors.find((item) => item.id === flavorId && item.active);
      if (!flavor) fail('Esse sabor não está disponível.');
      pickup.flavorId = flavor.id;
      pickup.flavorName = flavor.name;
      pickup.flavorEmoji = flavor.emoji;
      pickup.flavorColor = flavor.color;
      pickup.unitPriceCents = flavor.priceCents;
    }

    pickup.pickupDate = pickupDate;
    pickup.quantity = quantity;
    pickup.paid = paid;
    pickup.paymentDate = paymentDate;
    pickup.updatedAt = new Date().toISOString();
    return hydrate(db, pickup);
  });
}

export function deletePickup(user, id) {
  return mutate((db) => {
    const pickup = db.pickups.find((item) => item.id === id);
    if (!pickup) fail('Anotação não encontrada.', 404);
    const isOwner = pickup.userId === user.id;
    if (!isOwner && user.role !== 'admin') fail('Essa anotação é de outra pessoa.', 403);
    if (pickup.settled && user.role !== 'admin') fail('Essa anotação já foi baixada.', 409);
    db.pickups = db.pickups.filter((item) => item.id !== id);
    return true;
  });
}

export function settlePickups(ids) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter(Boolean);
  if (!unique.length) fail('Escolhe o que vai dar baixa.');
  if (unique.length > 200) fail('Dá baixa em menos itens de cada vez.');
  const now = new Date().toISOString();
  const today = todayISO();

  return mutate((db) => {
    let count = 0;
    for (const id of unique) {
      const pickup = db.pickups.find((item) => item.id === id);
      if (!pickup) fail('Uma das anotações não existe mais.', 404);
      if (pickup.settled) continue;
      pickup.settled = true;
      pickup.settledAt = now;
      pickup.paid = true;
      if (!pickup.paymentDate) pickup.paymentDate = today;
      pickup.updatedAt = now;
      count += 1;
    }
    return count;
  });
}
