const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const { resolveServer } = require('../middleware/resolveServer');
const { sanitizePlayerName } = require('../middleware/validator');
const minecraft = require('../services/minecraft');
const logger = require('../services/logger');

const router = express.Router({ mergeParams: true });

router.get('/', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    res.json(await minecraft.getOnlinePlayers(req.srv));
  } catch (err) {
    res.status(500).json({ error: 'Impossible de récupérer les joueurs' });
  }
});

router.post('/op', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const player = sanitizePlayerName(req.body.player);
    if (!player) return res.status(400).json({ error: 'Nom de joueur invalide' });
    await minecraft.sendCommand(req.srv, `op ${player}`);
    logger.log(req.user.id, req.user.username, 'PLAYER_OP', player, req.ip, req.srv.id);
    res.json({ success: true, message: `${player} est maintenant OP` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deop', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const player = sanitizePlayerName(req.body.player);
    if (!player) return res.status(400).json({ error: 'Nom de joueur invalide' });
    await minecraft.sendCommand(req.srv, `deop ${player}`);
    logger.log(req.user.id, req.user.username, 'PLAYER_DEOP', player, req.ip, req.srv.id);
    res.json({ success: true, message: `${player} n'est plus OP` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ban', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const player = sanitizePlayerName(req.body.player);
    if (!player) return res.status(400).json({ error: 'Nom de joueur invalide' });
    const reason = req.body.reason ? String(req.body.reason).slice(0, 200).replace(/[;&|`$]/g, '') : 'Banni par un administrateur';
    await minecraft.sendCommand(req.srv, `ban ${player} ${reason}`);
    logger.log(req.user.id, req.user.username, 'PLAYER_BAN', `${player}: ${reason}`, req.ip, req.srv.id);
    res.json({ success: true, message: `${player} a été banni` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/unban', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const player = sanitizePlayerName(req.body.player);
    if (!player) return res.status(400).json({ error: 'Nom de joueur invalide' });
    await minecraft.sendCommand(req.srv, `pardon ${player}`);
    logger.log(req.user.id, req.user.username, 'PLAYER_UNBAN', player, req.ip, req.srv.id);
    res.json({ success: true, message: `${player} a été débanni` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/kick', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const player = sanitizePlayerName(req.body.player);
    if (!player) return res.status(400).json({ error: 'Nom de joueur invalide' });
    const reason = req.body.reason ? String(req.body.reason).slice(0, 200).replace(/[;&|`$]/g, '') : 'Expulsé par un administrateur';
    await minecraft.sendCommand(req.srv, `kick ${player} ${reason}`);
    logger.log(req.user.id, req.user.username, 'PLAYER_KICK', `${player}: ${reason}`, req.ip, req.srv.id);
    res.json({ success: true, message: `${player} a été expulsé` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/whitelist', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const player = sanitizePlayerName(req.body.player);
    const action = req.body.action === 'remove' ? 'remove' : 'add';
    if (!player) return res.status(400).json({ error: 'Nom de joueur invalide' });
    await minecraft.sendCommand(req.srv, `whitelist ${action} ${player}`);
    logger.log(req.user.id, req.user.username, 'WHITELIST', `${action}: ${player}`, req.ip, req.srv.id);
    res.json({ success: true, message: `${player} ${action === 'add' ? 'ajouté à' : 'retiré de'} la whitelist` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
