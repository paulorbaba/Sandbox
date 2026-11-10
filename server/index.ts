import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { attachRealtime, stats } from './realtime';
import { SessionStore } from './session';

const isDev = process.argv.includes('--dev');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const store = new SessionStore({
  maxSessions: Number(process.env.MAX_SESSIONS) || 200,
  numberStart: Number(process.env.SESSION_NUMBER_START) || 1,
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '8kb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  // Mesmo domínio da interface: sem CORS e sem URL fixa.
  serveClient: false,
  pingInterval: 10_000,
  pingTimeout: 8_000,
  maxHttpBufferSize: 16_000,
});
attachRealtime(io, store);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), sessions: store.size });
});

// Limite simples de criação de sessões por IP (protótipo).
const createLog = new Map<string, number[]>();
app.post('/api/sessions', (req, res) => {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const recent = (createLog.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 40) {
    res.status(429).json({ error: 'Muitas sessões criadas em pouco tempo. Aguarde alguns minutos.' });
    return;
  }
  const s = store.create(now);
  if (!s) {
    res.status(503).json({ error: 'Limite de sessões em memória atingido. Tente novamente em instantes.' });
    return;
  }
  recent.push(now);
  createLog.set(ip, recent);
  stats.sessionsCreated++;
  res.status(201).json({ id: s.id, number: s.number, controlKey: s.getControlKey() });
});

app.get('/api/sessions/:id', (req, res) => {
  const s = store.get(req.params.id);
  if (!s) {
    res.status(404).json({ exists: false });
    return;
  }
  res.json({ exists: true, id: s.id, number: s.number, phase: s.phase });
});

/** Indicadores reais desta instância (sala demonstrativa). Não se misturam aos dados simulados do dashboard. */
app.get('/api/stats', (_req, res) => {
  let connected = 0;
  let live = 0;
  for (const s of store.all()) {
    const st = s.getState(Date.now());
    connected += st.counts.connected;
    if (st.phase !== 'lobby' && st.phase !== 'ended') live++;
  }
  res.json({
    sessionsInMemory: store.size,
    sessionsLive: live,
    sessionsCreated: stats.sessionsCreated,
    participantsConnected: connected,
    reactionsSinceBoot: stats.reactionsSinceBoot,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

if (isDev) {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.join(here, 'client');
  if (!existsSync(path.join(clientDir, 'index.html'))) {
    console.error('Build do front-end não encontrado em', clientDir, '— rode "npm run build".');
    process.exit(1);
  }
  app.use(
    '/assets',
    express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '30d', fallthrough: true }),
  );
  app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
  // Fallback do SPA: acesso direto e atualização de rotas sem 404.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/socket.io') || path.extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

httpServer.listen(PORT, HOST, () => {
  console.log(`Lek Trek LIVE ${isDev ? '(dev)' : ''} ouvindo em http://${HOST}:${PORT}`);
});

const shutdown = () => {
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
