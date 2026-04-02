const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const { ROLE_LEVEL } = require('../middleware/roles');
const db = require('../database');
const logger = require('../services/logger');

const router = express.Router();

// GET /api/servers — liste les serveurs accessibles par l'utilisateur
router.get('/', authenticate, (req, res) => {
  const userLevel = ROLE_LEVEL[req.user.role] ?? -1;
  const isAdmin = userLevel >= ROLE_LEVEL['admin'];

  // Tous les serveurs actifs
  const all = db.prepare('SELECT id, name, description, category, icon, active FROM servers ORDER BY category, name').all();

  // IDs auxquels l'utilisateur a accès explicitement
  const accessIds = new Set(
    db.prepare('SELECT server_id FROM server_access WHERE user_id = ?')
      .all(req.user.id)
      .map(r => r.server_id)
  );

  const servers = all.map(srv => ({
    ...srv,
    accessible: isAdmin || accessIds.has(srv.id),
  }));

  res.json({ servers });
});

// POST /api/servers — créer un serveur (admin+)
router.post('/', authenticate, requireMinRole('admin+'), (req, res) => {
  const { name, description, category, icon, ssh_host, ssh_port, ssh_username, ssh_password, ssh_key_path,
    server_path, screen_name, jar_file, min_ram, max_ram, run_as_user, start_script } = req.body;

  if (!name || !ssh_host || !ssh_username || !server_path) {
    return res.status(400).json({ error: 'Champs obligatoires manquants : name, ssh_host, ssh_username, server_path' });
  }

  const result = db.prepare(`
    INSERT INTO servers (name, description, category, icon, ssh_host, ssh_port, ssh_username, ssh_password, ssh_key_path,
      server_path, screen_name, jar_file, min_ram, max_ram, run_as_user, start_script)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, description || '', category || 'Minecraft', icon || 'Sword',
    ssh_host, ssh_port || 22, ssh_username,
    ssh_password || '', ssh_key_path || '',
    server_path, screen_name || 'minecraft', jar_file || 'server.jar',
    min_ram || '1G', max_ram || '4G', run_as_user || '', start_script || ''
  );

  logger.log(req.user.id, req.user.username, 'SERVER_CREATE', name, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, name });
});

// PUT /api/servers/:id — modifier un serveur (admin+)
router.put('/:id', authenticate, requireMinRole('admin+'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const srv = db.prepare('SELECT id FROM servers WHERE id = ?').get(id);
  if (!srv) return res.status(404).json({ error: 'Serveur introuvable' });

  const { name, description, category, icon, ssh_host, ssh_port, ssh_username, ssh_password, ssh_key_path,
    server_path, screen_name, jar_file, min_ram, max_ram, run_as_user, start_script, active } = req.body;

  db.prepare(`
    UPDATE servers SET name=?, description=?, category=?, icon=?, ssh_host=?, ssh_port=?, ssh_username=?,
      ssh_password=?, ssh_key_path=?, server_path=?, screen_name=?, jar_file=?,
      min_ram=?, max_ram=?, run_as_user=?, start_script=?, active=?
    WHERE id=?
  `).run(
    name, description || '', category || 'Minecraft', icon || 'Sword',
    ssh_host, ssh_port || 22, ssh_username,
    ssh_password || '', ssh_key_path || '',
    server_path, screen_name || 'minecraft', jar_file || 'server.jar',
    min_ram || '1G', max_ram || '4G', run_as_user || '', start_script || '',
    active !== undefined ? (active ? 1 : 0) : 1,
    id
  );

  // Fermer la connexion SSH existante pour ce serveur
  const sshService = require('../services/ssh');
  sshService.disconnect(id);

  logger.log(req.user.id, req.user.username, 'SERVER_UPDATE', name, req.ip);
  res.json({ success: true });
});

// DELETE /api/servers/:id — supprimer un serveur (admin+)
router.delete('/:id', authenticate, requireMinRole('admin+'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const srv = db.prepare('SELECT name FROM servers WHERE id = ?').get(id);
  if (!srv) return res.status(404).json({ error: 'Serveur introuvable' });

  db.prepare('DELETE FROM servers WHERE id = ?').run(id);
  const sshService = require('../services/ssh');
  sshService.disconnect(id);

  logger.log(req.user.id, req.user.username, 'SERVER_DELETE', srv.name, req.ip);
  res.json({ success: true });
});

// GET /api/servers/:id/access — liste les accès d'un serveur (admin)
router.get('/:id/access', authenticate, requireMinRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const accesses = db.prepare(`
    SELECT u.id, u.username, u.role FROM server_access sa
    JOIN users u ON sa.user_id = u.id
    WHERE sa.server_id = ?
  `).all(id);
  res.json({ accesses });
});

// POST /api/servers/:id/access — donner accès à un user (admin)
router.post('/:id/access', authenticate, requireMinRole('admin'), (req, res) => {
  const serverId = parseInt(req.params.id, 10);
  const userId = parseInt(req.body.user_id, 10);

  if (isNaN(userId)) return res.status(400).json({ error: 'user_id invalide' });

  const srv = db.prepare('SELECT id FROM servers WHERE id = ?').get(serverId);
  if (!srv) return res.status(404).json({ error: 'Serveur introuvable' });

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  try {
    db.prepare('INSERT OR IGNORE INTO server_access (server_id, user_id) VALUES (?, ?)').run(serverId, userId);
    logger.log(req.user.id, req.user.username, 'SERVER_ACCESS_GRANT', `${user.username} → serveur #${serverId}`, req.ip);
    res.json({ success: true });
  } catch {
    res.status(409).json({ error: 'Accès déjà existant' });
  }
});

// DELETE /api/servers/:id/access/:userId — retirer l'accès (admin)
router.delete('/:id/access/:userId', authenticate, requireMinRole('admin'), (req, res) => {
  const serverId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);

  db.prepare('DELETE FROM server_access WHERE server_id = ? AND user_id = ?').run(serverId, userId);
  logger.log(req.user.id, req.user.username, 'SERVER_ACCESS_REVOKE', `user #${userId} → serveur #${serverId}`, req.ip);
  res.json({ success: true });
});

module.exports = router;
