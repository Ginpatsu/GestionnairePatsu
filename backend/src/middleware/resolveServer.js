const db = require('../database');
const { ROLE_LEVEL } = require('./roles');

// Attache req.srv depuis :serverId
// Les admin+ et admin voient tous les serveurs
// Les autres (user, operator) n'ont accès qu'aux serveurs explicitement assignés
function resolveServer(req, res, next) {
  const serverId = parseInt(req.params.serverId, 10);
  if (isNaN(serverId)) {
    return res.status(400).json({ error: 'ID de serveur invalide' });
  }

  const srv = db.prepare('SELECT * FROM servers WHERE id = ? AND active = 1').get(serverId);
  if (!srv) {
    return res.status(404).json({ error: 'Serveur introuvable' });
  }

  const userLevel = ROLE_LEVEL[req.user?.role] ?? -1;

  // admin et admin+ ont accès à tous les serveurs
  if (userLevel >= ROLE_LEVEL['admin']) {
    req.srv = srv;
    return next();
  }

  // operator et user : vérifier server_access
  const access = db.prepare(
    'SELECT id FROM server_access WHERE server_id = ? AND user_id = ?'
  ).get(serverId, req.user.id);

  if (!access) {
    return res.status(403).json({ error: 'Accès refusé à ce serveur' });
  }

  req.srv = srv;
  next();
}

module.exports = { resolveServer };
