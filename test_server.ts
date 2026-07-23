import express from 'express';
import { createServer as createViteServer } from 'vite';

async function start() {
  const app = express();
  const server = app.listen(3000, () => console.log('started'));
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server }
    },
    appType: 'spa'
  });
  app.use(vite.middlewares);
}
start();
