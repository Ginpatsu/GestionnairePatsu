const jwt = require('jsonwebtoken');
const config = require('../config');
const minecraft = require('../services/minecraft');
const db = require('../database');
const { ROLE_LEVEL } = require('../middleware/roles');

const CONSOLE_POLL_INTERVAL = 2000;

function setupConsoleSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token manquant'));

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(decoded.userId);
      if (!user) return next(new Error('Utilisateur introuvable'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    const serverId = parseInt(socket.handshake.query?.serverId, 10);

    if (!serverId || isNaN(serverId)) {
      socket.emit('console:error', 'serverId manquant');
      socket.disconnect();
      return;
    }

    // Vérifier que le serveur existe
    const srv = db.prepare('SELECT * FROM servers WHERE id = ? AND active = 1').get(serverId);
    if (!srv) {
      socket.emit('console:error', 'Serveur introuvable');
      socket.disconnect();
      return;
    }

    // Vérifier l'accès
    const userLevel = ROLE_LEVEL[socket.user.role] ?? -1;
    const isAdmin = userLevel >= ROLE_LEVEL['admin'];
    if (!isAdmin) {
      const access = db.prepare('SELECT id FROM server_access WHERE server_id = ? AND user_id = ?')
        .get(serverId, socket.user.id);
      if (!access) {
        socket.emit('console:error', 'Accès refusé');
        socket.disconnect();
        return;
      }
    }

    console.log(`[Socket] ${socket.user.username} connecté au serveur #${serverId}`);

    const canSendCommands = userLevel >= ROLE_LEVEL['admin'];
    let lastLogLength = 0;
    let pollInterval = null;

    async function sendInitialLogs() {
      try {
        const logs = await minecraft.getConsoleLogs(srv, 100);
        lastLogLength = logs.length;
        socket.emit('console:output', logs);
      } catch {
        socket.emit('console:error', 'Impossible de lire les logs');
      }
    }

    async function pollLogs() {
      try {
        const logs = await minecraft.getConsoleLogs(srv, 200);
        if (logs.length !== lastLogLength) {
          if (logs.length > lastLogLength) {
            socket.emit('console:update', logs.slice(lastLogLength));
          } else {
            socket.emit('console:output', logs);
          }
          lastLogLength = logs.length;
        }
      } catch {}
    }

    sendInitialLogs();
    pollInterval = setInterval(pollLogs, CONSOLE_POLL_INTERVAL);

    socket.on('console:command', async (command) => {
      if (!canSendCommands) { socket.emit('console:error', 'Permissions insuffisantes'); return; }
      if (!command || typeof command !== 'string' || command.length > 500) { socket.emit('console:error', 'Commande invalide'); return; }
      if (/[;&|`$()[\]<>\\!#]/.test(command)) { socket.emit('console:error', 'Caractères interdits'); return; }

      try {
        await minecraft.sendCommand(srv, command.trim());
        socket.emit('console:sent', command.trim());
      } catch (err) {
        socket.emit('console:error', err.message);
      }
    });

    socket.on('server:status', async () => {
      try {
        socket.emit('server:status', await minecraft.getStatus(srv));
      } catch (err) {
        socket.emit('server:status', { online: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user.username} déconnecté du serveur #${serverId}`);
      if (pollInterval) clearInterval(pollInterval);
    });
  });
}

module.exports = { setupConsoleSocket };
