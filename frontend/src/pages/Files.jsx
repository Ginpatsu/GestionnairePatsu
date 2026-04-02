import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { files as filesApi } from '../api';
import {
  Folder,
  File,
  ArrowLeft,
  Save,
  Download,
  Upload,
  Trash2,
  FolderPlus,
  X,
  RefreshCw,
} from 'lucide-react';

export default function Files() {
  const { isAdmin } = useAuth();
  const { currentServer } = useServer();
  const api = filesApi(currentServer?.id);
  const [currentPath, setCurrentPath] = useState('.');
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Éditeur de fichier
  const [editingFile, setEditingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Nouveau dossier
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchFiles = async (path = currentPath) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.list(path);
      setFileList(data.files);
      setCurrentPath(path);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPath('.');
    fetchFiles('.');
  }, [currentServer?.id]);

  const navigateTo = (name, isDirectory) => {
    if (isDirectory) {
      const newPath = currentPath === '.' ? name : `${currentPath}/${name}`;
      fetchFiles(newPath);
    } else {
      openFile(name);
    }
  };

  const goBack = () => {
    if (currentPath === '.') return;
    const parts = currentPath.split('/');
    parts.pop();
    const parentPath = parts.length === 0 ? '.' : parts.join('/');
    fetchFiles(parentPath);
  };

  const openFile = async (name) => {
    const filePath = currentPath === '.' ? name : `${currentPath}/${name}`;
    try {
      const data = await api.read(filePath);
      setEditingFile(filePath);
      setFileContent(data.content);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;
    setSaving(true);
    try {
      await api.write(editingFile, fileContent);
      setMessage('Fichier sauvegardé');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteFile = async (name) => {
    const filePath = currentPath === '.' ? name : `${currentPath}/${name}`;
    if (!window.confirm(`Supprimer "${name}" ?`)) return;

    try {
      await api.delete(filePath);
      setMessage(`"${name}" supprimé`);
      fetchFiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const folderPath = currentPath === '.' ? newFolderName : `${currentPath}/${newFolderName}`;
    try {
      await api.mkdir(folderPath);
      setNewFolderName('');
      setShowNewFolder(false);
      setMessage('Dossier créé');
      fetchFiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);

    try {
      const token = localStorage.getItem('mcpanel_token');
      const response = await fetch(`/api/servers/${currentServer.id}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage('Fichier uploadé');
      fetchFiles();
    } catch (err) {
      setError(err.message);
    }

    e.target.value = '';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Vue éditeur
  if (editingFile) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Édition: {editingFile}</h1>
          <div className="header-actions">
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={saveFile} disabled={saving}>
                <Save size={16} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingFile(null)}>
              <X size={16} /> Fermer
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <textarea
          className="file-editor"
          value={fileContent}
          onChange={(e) => setFileContent(e.target.value)}
          readOnly={!isAdmin}
          spellCheck={false}
        />
      </div>
    );
  }

  // Vue navigateur
  return (
    <div className="page">
      <div className="page-header">
        <h1>Fichiers</h1>
        <div className="header-actions">
          {isAdmin && (
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowNewFolder(!showNewFolder)}>
                <FolderPlus size={16} /> Nouveau dossier
              </button>
              <label className="btn btn-sm btn-ghost upload-btn">
                <Upload size={16} /> Upload
                <input type="file" hidden onChange={handleUpload} />
              </label>
            </>
          )}
          <button className="btn btn-sm btn-ghost" onClick={() => fetchFiles()}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="breadcrumb">
        <span className="breadcrumb-item" onClick={() => fetchFiles('.')}>
          Racine
        </span>
        {currentPath !== '.' &&
          currentPath.split('/').map((part, i, arr) => (
            <span key={i}>
              <span className="breadcrumb-sep">/</span>
              <span
                className="breadcrumb-item"
                onClick={() => fetchFiles(arr.slice(0, i + 1).join('/'))}
              >
                {part}
              </span>
            </span>
          ))}
      </div>

      {showNewFolder && isAdmin && (
        <div className="inline-form">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nom du dossier"
            onKeyDown={(e) => e.key === 'Enter' && createFolder()}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={createFolder}>Créer</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNewFolder(false)}>Annuler</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : (
        <div className="file-list">
          {currentPath !== '.' && (
            <div className="file-item file-item-back" onClick={goBack}>
              <ArrowLeft size={18} />
              <span>..</span>
            </div>
          )}
          {fileList.map((file) => (
            <div key={file.name} className="file-item">
              <div className="file-info" onClick={() => navigateTo(file.name, file.isDirectory)}>
                {file.isDirectory ? <Folder size={18} className="icon-folder" /> : <File size={18} className="icon-file" />}
                <span className="file-name">{file.name}</span>
                <span className="file-size">{file.isDirectory ? '-' : formatSize(file.size)}</span>
                <span className="file-date">{file.date}</span>
              </div>
              <div className="file-actions">
                {!file.isDirectory && (
                  <a
                    href={api.downloadUrl(currentPath === '.' ? file.name : `${currentPath}/${file.name}`)}
                    className="btn btn-xs btn-ghost"
                    title="Télécharger"
                  >
                    <Download size={14} />
                  </a>
                )}
                {isAdmin && (
                  <button
                    className="btn btn-xs btn-ghost text-red"
                    onClick={() => deleteFile(file.name)}
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {fileList.length === 0 && <p className="text-muted">Dossier vide</p>}
        </div>
      )}
    </div>
  );
}
