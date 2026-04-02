const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const { resolveServer } = require('../middleware/resolveServer');
const { sanitizeMinecraftCommand } = require('../middleware/validator');
const minecraft = require('../services/minecraft');
const logger = require('../services/logger');

const router = express.Router({ mergeParams: true });

router.get('/status', authenticate, resolveServer, async (req, res) => {
  try {
    res.json(await minecraft.getStatus(req.srv));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', authenticate, resolveServer, requireMinRole('operator'), async (req, res) => {
  try {
    const result = await minecraft.start(req.srv);
    logger.log(req.user.id, req.user.username, 'SERVER_START', null, req.ip, req.srv.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stop', authenticate, resolveServer, requireMinRole('operator'), async (req, res) => {
  try {
    const result = await minecraft.stop(req.srv);
    logger.log(req.user.id, req.user.username, 'SERVER_STOP', null, req.ip, req.srv.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/restart', authenticate, resolveServer, requireMinRole('operator'), async (req, res) => {
  try {
    const result = await minecraft.restart(req.srv);
    logger.log(req.user.id, req.user.username, 'SERVER_RESTART', null, req.ip, req.srv.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/command', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const command = sanitizeMinecraftCommand(req.body.command);
    if (!command) return res.status(400).json({ error: 'Commande invalide ou contient des caractères interdits' });
    const result = await minecraft.sendCommand(req.srv, command);
    logger.log(req.user.id, req.user.username, 'SEND_COMMAND', command, req.ip, req.srv.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/console', authenticate, resolveServer, async (req, res) => {
  try {
    const lines = parseInt(req.query.lines, 10) || 100;
    const logs = await minecraft.getConsoleLogs(req.srv, Math.min(lines, 500));
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de lire les logs' });
  }
});

module.exports = router;
