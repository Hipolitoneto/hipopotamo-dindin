import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import app from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 5173);

if (isProd) {
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(dist)) {
    console.error('Roda npm run build antes de iniciar o site.');
    process.exit(1);
  }
  const { default: express } = await import('express');
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
  listen();
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  listen();
}

function listen() {
  const server = app.listen(PORT, () => {
    console.log(`Hipopótamo Dindin em http://localhost:${PORT}`);
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`A porta ${PORT} já está em uso.`);
      process.exit(1);
    }
    throw error;
  });
}
