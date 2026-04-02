const db = require('../database');

function log(userId, username, action, details = null, ip = null, serverId = null) {
  try {
    db.prepare(
      'INSERT INTO action_logs (user_id, username, server_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, username, serverId, action, details, ip);
  } catch (err) {
    console.error('[Logger] Erreur:', err.message);
  }
}

function getLogs(page = 1, limit = 50, serverId = null) {
  const offset = (page - 1) * limit;
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  let query = 'SELECT * FROM action_logs';
  let countQuery = 'SELECT COUNT(*) as count FROM action_logs';
  const params = [];

  if (serverId !== null) {
    query += ' WHERE server_id = ?';
    countQuery += ' WHERE server_id = ?';
    params.push(serverId);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

  const total = db.prepare(countQuery).get(...params).count;
  const logs = db.prepare(query).all(...params, safeLimit, offset);

  return {
    logs,
    pagination: { page, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
  };
}

module.exports = { log, getLogs };
