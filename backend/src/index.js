const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
require('./database');

const authRoutes = require('./routes/auth');
const serversRoutes = require('./routes/servers');
const serverRoutes = require('./routes/server');
const playerRoutes = require('./routes/players');
const fileRoutes = require('./routes/files');
const logRoutes = require('./routes/logs');
const { setupConsoleSocket } = require('./socket/console');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: config.frontendUrl, methods: ['GET', 'POST'] },
});
setupConsoleSocket(io);

app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

// Routes globales
app.use('/api/auth', authRoutes);
app.use('/api/servers', serversRoutes);

// Routes par serveur
app.use('/api/servers/:serverId/mc', serverRoutes);
app.use('/api/servers/:serverId/players', playerRoutes);
app.use('/api/servers/:serverId/files', fileRoutes);
app.use('/api/servers/:serverId/logs', logRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((req, res) => res.status(404).json({ error: 'Route non trouvée' }));
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });
  res.status(err.status || 500).json({ error: err.message || 'Erreur interne' });
});

server.listen(config.port, () => {
  console.log(`[MCPanel] Démarré sur le port ${config.port}`);
});

process.on('SIGINT', async () => {
  const sshService = require('./services/ssh');
  await sshService.disconnect();
  server.close();
  process.exit(0);
});
