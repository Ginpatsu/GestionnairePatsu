const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../database');
const { authenticate } = require('../middleware/auth');
const { requireMinRole, canManageRole, VALID_ROLES } = require('../middleware/roles');
const { sanitizeUsername, validateBody } = require('../middleware/validator');
const logger = require('../services/logger');

const router = express.Router();

// Rate limiter strict pour le login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  validateBody({
    username: { required: true, type: 'string', minLength: 3, maxLength: 32 },
    password: { required: true, type: 'string', minLength: 1, maxLength: 128 },
  }),
  (req, res) => {
    try {
      const username = sanitizeUsername(req.body.username);
      if (!username) {
        return res.status(400).json({ error: 'Nom d\'utilisateur invalide' });
      }

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user) {
        return res.status(401).json({ error: 'Identifiants incorrects' });
      }

      const validPassword = bcrypt.compareSync(req.body.password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Identifiants incorrects' });
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      });

      logger.log(user.id, user.username, 'LOGIN', null, req.ip);

      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role },
      });
    } catch (err) {
      console.error('[Auth] Erreur login:', err.message);
      res.status(500).json({ error: 'Erreur interne' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/users — admin et admin+ uniquement
// Un utilisateur ne peut créer que des comptes de niveau inférieur au sien
router.post(
  '/users',
  authenticate,
  requireMinRole('admin'),
  validateBody({
    username: { required: true, type: 'string', minLength: 3, maxLength: 32 },
    password: { required: true, type: 'string', minLength: 8, maxLength: 128 },
    role: { required: false, type: 'string' },
  }),
  (req, res) => {
    try {
      const username = sanitizeUsername(req.body.username);
      if (!username) {
        return res.status(400).json({ error: 'Nom d\'utilisateur invalide (alphanumérique + _, 3-32 chars)' });
      }

      const requestedRole = req.body.role && VALID_ROLES.includes(req.body.role)
        ? req.body.role
        : 'user';

      // Vérifier que l'acteur peut attribuer ce rôle
      if (!canManageRole(req.user.role, requestedRole)) {
        return res.status(403).json({
          error: `Vous ne pouvez pas créer un compte avec le rôle "${requestedRole}"`,
        });
      }

      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        return res.status(409).json({ error: 'Cet utilisateur existe déjà' });
      }

      const hashedPassword = bcrypt.hashSync(req.body.password, 12);
      const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
        username,
        hashedPassword,
        requestedRole
      );

      logger.log(req.user.id, req.user.username, 'CREATE_USER', `${username} (${requestedRole})`, req.ip);

      res.status(201).json({ id: result.lastInsertRowid, username, role: requestedRole });
    } catch (err) {
      console.error('[Auth] Erreur création user:', err.message);
      res.status(500).json({ error: 'Erreur interne' });
    }
  }
);

// GET /api/auth/users — admin et admin+
router.get('/users', authenticate, requireMinRole('admin'), (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
    res.json({ users });
  } catch (err) {
    console.error('[Auth] Erreur liste users:', err.message);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// DELETE /api/auth/users/:id — admin et admin+
// On ne peut supprimer que des comptes de niveau inférieur au sien
router.delete('/users/:id', authenticate, requireMinRole('admin'), (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const target = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
    if (!target) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Vérifier que l'acteur peut supprimer ce rôle
    if (!canManageRole(req.user.role, target.role)) {
      return res.status(403).json({
        error: `Vous ne pouvez pas supprimer un compte avec le rôle "${target.role}"`,
      });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    logger.log(req.user.id, req.user.username, 'DELETE_USER', `${target.username} (${target.role})`, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Erreur suppression user:', err.message);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// PUT /api/auth/users/:id — modifier le rôle d'un utilisateur
router.put('/users/:id', authenticate, requireMinRole('admin'), (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' });
    }

    const newRole = req.body.role;
    if (!newRole || !VALID_ROLES.includes(newRole)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const target = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
    if (!target) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Vérifier que l'acteur peut gérer le rôle actuel ET le nouveau rôle
    if (!canManageRole(req.user.role, target.role)) {
      return res.status(403).json({ error: `Vous ne pouvez pas modifier un compte "${target.role}"` });
    }
    if (!canManageRole(req.user.role, newRole)) {
      return res.status(403).json({ error: `Vous ne pouvez pas attribuer le rôle "${newRole}"` });
    }

    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newRole, userId);

    logger.log(req.user.id, req.user.username, 'UPDATE_USER_ROLE', `${target.username}: ${target.role} → ${newRole}`, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Erreur modification user:', err.message);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// PUT /api/auth/password — tous les rôles (changer son propre mot de passe)
router.put(
  '/password',
  authenticate,
  validateBody({
    currentPassword: { required: true, type: 'string' },
    newPassword: { required: true, type: 'string', minLength: 8, maxLength: 128 },
  }),
  (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      const valid = bcrypt.compareSync(req.body.currentPassword, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }

      const hashedPassword = bcrypt.hashSync(req.body.newPassword, 12);
      db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        hashedPassword,
        req.user.id
      );

      logger.log(req.user.id, req.user.username, 'CHANGE_PASSWORD', null, req.ip);

      res.json({ success: true });
    } catch (err) {
      console.error('[Auth] Erreur changement mdp:', err.message);
      res.status(500).json({ error: 'Erreur interne' });
    }
  }
);

module.exports = router;
