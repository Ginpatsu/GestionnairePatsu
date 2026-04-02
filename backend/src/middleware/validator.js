const validator = require('validator');
const path = require('path');
const posix = require('path').posix;

// Valide qu'un nom d'utilisateur est safe
function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 32) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return null;
  return trimmed;
}

// Valide qu'un nom de joueur Minecraft est safe (3-16 chars, alphanum + _)
function sanitizePlayerName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 16) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return null;
  return trimmed;
}

// Valide une commande Minecraft (pas de shell injection)
function sanitizeMinecraftCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return null;
  const trimmed = cmd.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return null;
  // Bloquer les caractères dangereux pour le shell
  if (/[;&|`$()[\]<>\\!#]/.test(trimmed)) return null;
  return trimmed;
}

// Valide et sécurise un chemin de fichier (empêche path traversal)
// serverBasePath : le server_path du serveur courant
function sanitizeFilePathFor(filePath, serverBasePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  if (!serverBasePath) return null;

  const normalized = posix.normalize(filePath.replace(/\\/g, '/'));
  const base = serverBasePath.replace(/\\/g, '/');
  const fullPath = posix.resolve(base, normalized);
  const resolvedBase = posix.resolve(base);

  if (!fullPath.startsWith(resolvedBase + '/') && fullPath !== resolvedBase) {
    return null;
  }

  return fullPath;
}

// Compatibilité avec l'ancien code (utilise config si encore appelé)
function sanitizeFilePath(filePath) {
  const config = require('../config');
  return sanitizeFilePathFor(filePath, config.minecraft.serverPath);
}

// Valide un chemin relatif (pour navigation)
function sanitizeRelativePath(relPath) {
  if (!relPath || typeof relPath !== 'string') return null;
  const normalized = path.normalize(relPath).replace(/\\/g, '/');
  // Empêcher de remonter au-dessus de la racine
  if (normalized.startsWith('..') || normalized.includes('/../')) return null;
  return normalized;
}

// Middleware de validation du body
function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`Le champ '${field}' est requis`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push(`Le champ '${field}' doit être une chaîne`);
        }
        if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
          errors.push(`Le champ '${field}' doit faire au moins ${rules.minLength} caractères`);
        }
        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
          errors.push(`Le champ '${field}' doit faire au plus ${rules.maxLength} caractères`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation échouée', details: errors });
    }
    next();
  };
}

module.exports = {
  sanitizeUsername,
  sanitizePlayerName,
  sanitizeMinecraftCommand,
  sanitizeFilePath,
  sanitizeFilePathFor,
  sanitizeRelativePath,
  validateBody,
};
