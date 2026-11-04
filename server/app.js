import express from 'express';
import cookieParser from 'cookie-parser';
import * as db from './db.js';

const COOKIE = 'dindin_session';

const app = express();
app.use((req, res, next) => {
  if (req.body !== undefined) return next();
  return express.json({ limit: '200kb' })(req, res, next);
});
app.use(cookieParser());

function wrap(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      if (res.headersSent) return;
      const status = error.status || 500;
      if (status === 500) console.error(error);
      res.status(status).json({
        error: status === 500 ? 'Deu um problema aqui. Tenta de novo.' : error.message,
      });
    });
  };
}

async function auth(req, res, next) {
  try {
    const user = await db.getUserByToken(req.cookies[COOKIE]);
    if (!user) {
      res.status(401).json({ error: 'Faça login de novo.' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    if (res.headersSent) return;
    const status = error.status || 500;
    if (status === 500) console.error(error);
    res.status(status).json({
      error: status === 500 ? 'Deu um problema aqui. Tenta de novo.' : error.message,
    });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Só o admin pode fazer isso.' });
    return;
  }
  next();
}

function setSession(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(process.env.VERCEL),
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

app.get('/api/health', wrap(async (req, res) => {
  res.json({
    ok: true,
    store: process.env.DATABASE_URL ? 'postgres' : 'file',
    vercel: Boolean(process.env.VERCEL),
  });
}));

app.post('/api/auth/register', wrap(async (req, res) => {
  const user = await db.registerUser(req.body || {});
  const session = await db.createSession(user.id);
  setSession(res, session.token);
  res.status(201).json({ user: session.user });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const user = await db.authenticate(req.body?.username, req.body?.password);
  const session = await db.createSession(user.id);
  setSession(res, session.token);
  res.json({ user: session.user });
}));

app.post('/api/auth/logout', wrap(async (req, res) => {
  if (req.cookies[COOKIE]) await db.deleteSession(req.cookies[COOKIE]);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}));

app.get('/api/auth/me', wrap(async (req, res) => {
  const user = await db.getUserByToken(req.cookies[COOKIE]);
  if (!user) {
    res.status(401).json({ error: 'Faça login de novo.' });
    return;
  }
  res.json({ user });
}));

app.post('/api/auth/password', auth, wrap(async (req, res) => {
  await db.changePassword(req.user.id, req.body?.current, req.body?.next);
  res.json({ ok: true });
}));

app.get('/api/flavors', auth, wrap(async (req, res) => {
  res.json({ flavors: await db.listFlavors(req.user) });
}));

app.post('/api/flavors', auth, adminOnly, wrap(async (req, res) => {
  const flavor = await db.createFlavor(req.body || {});
  res.status(201).json({ flavor });
}));

app.patch('/api/flavors/:id', auth, adminOnly, wrap(async (req, res) => {
  const flavor = await db.updateFlavor(req.params.id, req.body || {});
  res.json({ flavor });
}));

app.delete('/api/flavors/:id', auth, adminOnly, wrap(async (req, res) => {
  await db.deleteFlavor(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/pickups', auth, wrap(async (req, res) => {
  res.json({ pickups: await db.listPickups(req.user) });
}));

app.post('/api/pickups', auth, wrap(async (req, res) => {
  if (req.user.role === 'admin') {
    res.status(403).json({ error: 'O admin cuida do caixa. Quem pegou dindin anota na própria conta.' });
    return;
  }
  const pickups = await db.createPickups(req.user, req.body || {});
  res.status(201).json({ pickups });
}));

app.post('/api/pickups/settle', auth, adminOnly, wrap(async (req, res) => {
  const count = await db.settlePickups(req.body?.ids);
  res.json({ count });
}));

app.patch('/api/pickups/:id', auth, wrap(async (req, res) => {
  const pickup = await db.updatePickup(req.user, req.params.id, req.body || {});
  res.json({ pickup });
}));

app.delete('/api/pickups/:id', auth, wrap(async (req, res) => {
  await db.deletePickup(req.user, req.params.id);
  res.json({ ok: true });
}));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Não encontrei isso.' });
});

export default app;
