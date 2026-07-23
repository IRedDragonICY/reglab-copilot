import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseSimeruHtml } from './src/lib/simeru';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // API route for crawling Simeru schedule
  app.post('/api/crawl-simeru', async (req, res) => {
    try {
      const { username, password, targetCourses } = req.body; // targetCourses: { kode: string, kelas: string }[]
      
      // 1. Login
      const loginUrl = 'https://simeru.uad.ac.id/?mod=auth&sub=auth&do=process';
      const loginParams = new URLSearchParams();
      loginParams.append('user', username);
      loginParams.append('pass', password);
      loginParams.append('submit', 'Log In');
      loginParams.append('id', '');

      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        body: loginParams,
        redirect: 'manual'
      });
      
      const cookies = loginRes.headers.raw()['set-cookie'];
      if (!cookies) {
        return res.status(401).json({ error: 'Failed to login (no cookies returned)' });
      }
      const sessionCookie = cookies.map((c: string) => c.split(';')[0]).join('; ');

      // 2. Fetch Schedule
      const searchParams = new URLSearchParams();
      searchParams.append('fakultas', '4');
      searchParams.append('prodi', '18');
      searchParams.append('submit', 'Cari');
      
      const pageRes = await fetch('https://simeru.uad.ac.id/?mod=laporan_baru&sub=jadwal_prodi&do=daftar', {
        method: 'POST',
        headers: { 'Cookie': sessionCookie },
        body: searchParams
      });
      
      const html = await pageRes.text();
      const matchedSchedules = parseSimeruHtml(html, targetCourses);

      res.json({ schedules: matchedSchedules });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
          clientPort: 443
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
