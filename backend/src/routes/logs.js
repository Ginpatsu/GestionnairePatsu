const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const { resolveServer } = require('../middleware/resolveServer');
const logger = require('../services/logger');

const router = express.Router({ mergeParams: true });

router.get('/', authenticate, resolveServer, requireMinRole('admin'), (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 50, 1);
    res.json(logger.getLogs(page, limit, req.srv.id));
  } catch (err) {
    res.status(500).json({ error: 'Impossible de récupérer les logs' });
  }
});

module.exports = router;
