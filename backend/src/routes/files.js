const express = require('express');
const multer = require('multer');
const path = require('path');
const posix = require('path').posix;
const { authenticate } = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const { resolveServer } = require('../middleware/resolveServer');
const { sanitizeFilePathFor } = require('../middleware/validator');
const ssh = require('../services/ssh');
const logger = require('../services/logger');

const router = express.Router({ mergeParams: true });

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'tmp'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const dangerous = ['.sh', '.bash', '.exe', '.bat', '.cmd', '.ps1'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (dangerous.includes(ext)) return cb(new Error('Type de fichier non autorisé'));
    cb(null, true);
  },
});

// Sanitize chemin basé sur le serverPath du serveur courant
function safePath(req, filePath) {
  return sanitizeFilePathFor(filePath, req.srv.server_path);
}

router.get('/list', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const p = safePath(req, req.query.path || req.srv.server_path);
    if (!p) return res.status(400).json({ error: 'Chemin invalide ou non autorisé' });

    const result = await ssh.exec(req.srv, `ls -la --time-style=long-iso "${p}" 2>/dev/null | tail -n +2`);
    if (result.code !== 0 && result.stderr) return res.status(404).json({ error: 'Répertoire introuvable' });

    const files = result.stdout.split('\n').filter(l => l.trim()).map(line => {
      const parts = line.split(/\s+/);
      if (parts.length < 8) return null;
      const permissions = parts[0];
      const size = parseInt(parts[4], 10);
      const date = `${parts[5]} ${parts[6]}`;
      const name = parts.slice(7).join(' ');
      if (name === '.' || name === '..') return null;
      return { name, size, date, permissions, isDirectory: permissions.startsWith('d') };
    }).filter(Boolean);

    res.json({ path: req.query.path || req.srv.server_path, files });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de lister les fichiers' });
  }
});

router.get('/read', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const p = safePath(req, req.query.path);
    if (!p) return res.status(400).json({ error: 'Chemin invalide ou non autorisé' });

    const statResult = await ssh.exec(req.srv, `stat --format="%s %F" "${p}" 2>/dev/null`);
    if (statResult.code !== 0) return res.status(404).json({ error: 'Fichier introuvable' });

    const [fileSize, fileType] = statResult.stdout.trim().split(' ');
    if (fileType === 'directory') return res.status(400).json({ error: 'Ceci est un répertoire' });
    if (parseInt(fileSize, 10) > 2 * 1024 * 1024) return res.status(400).json({ error: 'Fichier trop volumineux (max 2 MB)' });

    const result = await ssh.exec(req.srv, `cat "${p}"`);
    res.json({ path: req.query.path, content: result.stdout });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de lire le fichier' });
  }
});

router.put('/write', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') return res.status(400).json({ error: 'Contenu manquant' });
    if (content.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Contenu trop volumineux (max 2 MB)' });

    const p = safePath(req, req.body.path);
    if (!p) return res.status(400).json({ error: 'Chemin invalide ou non autorisé' });

    const sshConn = await ssh.getConnection(req.srv);
    const escapedContent = content.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
    await sshConn.execCommand(`printf '%s' '${escapedContent}' > "${p}"`);

    logger.log(req.user.id, req.user.username, 'FILE_WRITE', p, req.ip, req.srv.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Impossible d\'écrire le fichier' });
  }
});

router.post('/upload', authenticate, resolveServer, requireMinRole('admin'), upload.single('file'), async (req, res) => {
  try {
    const safeDir = safePath(req, req.body.path || req.srv.server_path);
    if (!safeDir) return res.status(400).json({ error: 'Chemin de destination invalide' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

    const remotePath = `${safeDir}/${req.file.originalname}`;
    const sshConn = await ssh.getConnection(req.srv);
    await sshConn.putFile(req.file.path, remotePath);

    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    logger.log(req.user.id, req.user.username, 'FILE_UPLOAD', remotePath, req.ip, req.srv.id);
    res.json({ success: true, path: remotePath });
  } catch (err) {
    res.status(500).json({ error: 'Impossible d\'uploader le fichier' });
  }
});

router.post('/mkdir', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const p = safePath(req, req.body.path);
    if (!p) return res.status(400).json({ error: 'Chemin invalide ou non autorisé' });
    await ssh.exec(req.srv, `mkdir -p "${p}"`);
    logger.log(req.user.id, req.user.username, 'DIR_CREATE', p, req.ip, req.srv.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de créer le dossier' });
  }
});

router.delete('/delete', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const p = safePath(req, req.body.path);
    if (!p) return res.status(400).json({ error: 'Chemin invalide ou non autorisé' });

    const serverRoot = posix.resolve(req.srv.server_path.replace(/\\/g, '/'));
    if (p === serverRoot) return res.status(403).json({ error: 'Impossible de supprimer le répertoire racine du serveur' });

    await ssh.exec(req.srv, `rm -rf "${p}"`);
    logger.log(req.user.id, req.user.username, 'FILE_DELETE', p, req.ip, req.srv.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de supprimer' });
  }
});

router.get('/download', authenticate, resolveServer, requireMinRole('admin'), async (req, res) => {
  try {
    const p = safePath(req, req.query.path);
    if (!p) return res.status(400).json({ error: 'Chemin invalide ou non autorisé' });

    const statResult = await ssh.exec(req.srv, `stat --format="%s %F" "${p}" 2>/dev/null`);
    if (statResult.code !== 0 || statResult.stdout.includes('directory')) return res.status(400).json({ error: 'Chemin invalide ou répertoire' });

    const fileSize = parseInt(statResult.stdout.split(' ')[0], 10);
    if (fileSize > 100 * 1024 * 1024) return res.status(400).json({ error: 'Fichier trop volumineux (max 100 MB)' });

    const fs = require('fs');
    const tmpDir = path.join(__dirname, '..', '..', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const tmpFile = path.join(tmpDir, `download_${Date.now()}_${path.basename(p)}`);
    const sshConn = await ssh.getConnection(req.srv);
    await sshConn.getFile(tmpFile, p);

    res.download(tmpFile, path.basename(p), () => {
      try { fs.unlinkSync(tmpFile); } catch {}
    });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de télécharger le fichier' });
  }
});

module.exports = router;
