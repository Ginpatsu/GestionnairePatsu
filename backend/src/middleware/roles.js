// Hiérarchie des rôles (plus le chiffre est élevé, plus le rôle est puissant)
const ROLE_LEVEL = {
  user: 0,
  operator: 1,
  admin: 2,
  'admin+': 3,
};

const VALID_ROLES = Object.keys(ROLE_LEVEL);

// Middleware : l'utilisateur doit avoir l'un des rôles listés
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
  };
}

// Middleware : l'utilisateur doit avoir un niveau >= au rôle minimum
function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const userLevel = ROLE_LEVEL[req.user.role] ?? -1;
    const minLevel = ROLE_LEVEL[minRole] ?? 999;
    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    next();
  };
}

// Vérifie si un rôle peut gérer (créer/supprimer) un autre rôle
// Un utilisateur ne peut gérer que les rôles strictement inférieurs au sien
function canManageRole(actorRole, targetRole) {
  const actorLevel = ROLE_LEVEL[actorRole] ?? -1;
  const targetLevel = ROLE_LEVEL[targetRole] ?? 999;
  return actorLevel > targetLevel;
}

module.exports = { requireRole, requireMinRole, canManageRole, ROLE_LEVEL, VALID_ROLES };
