import app from '../server/app.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  const url = req.url || '/';
  if (!url.startsWith('/api')) {
    const q = url.indexOf('?');
    const path = q === -1 ? url : url.slice(0, q);
    const search = q === -1 ? '' : url.slice(q);
    req.url = `/api${path === '/' ? '' : path}${search}`;
  }
  return app(req, res);
}
