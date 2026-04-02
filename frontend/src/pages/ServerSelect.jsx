import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { servers as serversApi } from '../api';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import {
  Server, Lock, LogOut, Plus, RefreshCw, Pencil, Trash2,
  Sword, Gamepad2, Globe, Shield, Zap, Star, Box, Flame,
} from 'lucide-react';

const ICONS = {
  Sword, Gamepad2, Globe, Shield, Zap, Star, Box, Flame, Server,
};

const ICON_OPTIONS = [
  { value: 'Sword', label: 'Épée' },
  { value: 'Gamepad2', label: 'Manette' },
  { value: 'Globe', label: 'Globe' },
  { value: 'Shield', label: 'Bouclier' },
  { value: 'Zap', label: 'Éclair' },
  { value: 'Star', label: 'Étoile' },
  { value: 'Box', label: 'Boîte' },
  { value: 'Flame', label: 'Flamme' },
  { value: 'Server', label: 'Serveur' },
];

function ServerIcon({ name, size = 32 }) {
  const Icon = ICONS[name] || Server;
  return <Icon size={size} />;
}

const ROLE_BADGE = { user: 'badge-blue', operator: 'badge-green', admin: 'badge-red', 'admin+': 'badge-purple' };

export default function ServerSelect() {
  const { selectServer } = useServer();
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [serverList, setServerList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingSrv, setEditingSrv] = useState(null); // null = fermé, {} = nouveau, {id,...} = édition

  const fetchServers = async () => {
    setLoading(true);
    try {
      const data = await serversApi.list();
      setServerList(data.servers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServers(); }, []);

  const handleSelect = (srv) => {
    if (!srv.accessible) return;
    selectServer(srv);
    navigate('/');
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleDelete = async (srv, e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer le serveur "${srv.name}" ?`)) return;
    try {
      await serversApi.delete(srv.id);
      setMessage(`Serveur "${srv.name}" supprimé`);
      fetchServers();
    } catch (err) {
      setError(err.message);
    }
  };

  const openEdit = (srv, e) => {
    e.stopPropagation();
    setEditingSrv({ ...srv });
  };

  const openNew = () => {
    setEditingSrv({ name: '', description: '', category: 'Minecraft', icon: 'Sword' });
  };

  // Grouper par catégorie
  const categories = [...new Set(serverList.map(s => s.category || 'Minecraft'))];

  return (
    <div className="server-select-page">
      <div className="server-select-header">
        <div className="server-select-title">
          <Server size={26} />
          <span>GestionnairePatsu</span>
        </div>
        <div className="server-select-user">
          <span className="user-name">{user?.username}</span>
          <span className={`badge ${ROLE_BADGE[user?.role] || 'badge-blue'}`}>{user?.role}</span>
          <button className="btn btn-sm btn-ghost" onClick={handleLogout} title="Déconnexion">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="server-select-content">
        <div className="server-select-intro">
          <h1>Choisir un serveur</h1>
          <p>Sélectionnez le serveur que vous souhaitez gérer.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <div className="server-select-actions">
          <button className="btn btn-sm btn-ghost" onClick={fetchServers}>
            <RefreshCw size={14} /> Actualiser
          </button>
          {isAdmin && (
            <button className="btn btn-sm btn-primary" onClick={openNew}>
              <Plus size={14} /> Ajouter un serveur
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading">Chargement des serveurs...</div>
        ) : serverList.length === 0 ? (
          <div className="server-empty">
            Aucun serveur configuré.{isAdmin && ' Cliquez sur "Ajouter un serveur" pour commencer.'}
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat} className="server-category">
              <div className="server-category-title">{cat}</div>
              <div className="server-grid">
                {serverList.filter(s => (s.category || 'Minecraft') === cat).map(srv => (
                  <div
                    key={srv.id}
                    className={`server-card ${srv.accessible ? 'accessible' : 'locked'}`}
                    onClick={() => handleSelect(srv)}
                  >
                    {isAdmin && (
                      <div className="server-card-actions" onClick={e => e.stopPropagation()}>
                        <button className="server-card-btn" onClick={(e) => openEdit(srv, e)} title="Modifier">
                          <Pencil size={13} />
                        </button>
                        <button className="server-card-btn danger" onClick={(e) => handleDelete(srv, e)} title="Supprimer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                    <div className="server-card-icon">
                      {srv.accessible
                        ? <ServerIcon name={srv.icon} size={32} />
                        : <Lock size={32} />}
                    </div>
                    <div className="server-card-info">
                      <div className="server-card-name">{srv.name}</div>
                      {srv.description && <div className="server-card-desc">{srv.description}</div>}
                    </div>
                    {!srv.accessible && <div className="server-card-locked-label">Accès restreint</div>}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {editingSrv !== null && (
        <ServerEditModal
          srv={editingSrv}
          onClose={() => setEditingSrv(null)}
          onSaved={() => { setEditingSrv(null); fetchServers(); }}
        />
      )}
    </div>
  );
}

function ServerEditModal({ srv, onClose, onSaved }) {
  const isNew = !srv.id;
  const [form, setForm] = useState({
    name: srv.name || '',
    description: srv.description || '',
    category: srv.category || 'Minecraft',
    icon: srv.icon || 'Sword',
    ssh_host: srv.ssh_host || '',
    ssh_port: srv.ssh_port || 22,
    ssh_username: srv.ssh_username || '',
    ssh_password: '',
    ssh_key_path: srv.ssh_key_path || '',
    server_path: srv.server_path || '',
    screen_name: srv.screen_name || 'minecraft',
    jar_file: srv.jar_file || 'server.jar',
    min_ram: srv.min_ram || '1G',
    max_ram: srv.max_ram || '4G',
    run_as_user: srv.run_as_user || '',
    start_script: srv.start_script || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (isNew) {
        await serversApi.create(form);
      } else {
        await serversApi.update(srv.id, form);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isNew ? 'Ajouter un serveur' : `Modifier "${srv.name}"`}</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Apparence */}
          <div className="modal-section-title">Apparence</div>
          <div className="form-row">
            <div className="form-group">
              <label>Nom du serveur</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Catégorie</label>
              <input type="text" value={form.category} onChange={e => set('category', e.target.value)} placeholder="Minecraft, Gmod..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Description</label>
              <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description courte..." />
            </div>
            <div className="form-group">
              <label>Icône</label>
              <select value={form.icon} onChange={e => set('icon', e.target.value)}>
                {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Aperçu de la carte */}
          <div className="icon-preview">
            <div className="server-card accessible" style={{ width: 160, cursor: 'default' }}>
              <div className="server-card-icon">
                <ServerIcon name={form.icon} size={32} />
              </div>
              <div className="server-card-info">
                <div className="server-card-name">{form.name || 'Nom du serveur'}</div>
                {form.description && <div className="server-card-desc">{form.description}</div>}
              </div>
            </div>
          </div>

          {/* SSH */}
          <div className="modal-section-title">Connexion SSH</div>
          <div className="form-row">
            <div className="form-group">
              <label>Hôte SSH</label>
              <input type="text" value={form.ssh_host} onChange={e => set('ssh_host', e.target.value)} required placeholder="192.168.1.1" />
            </div>
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label>Port</label>
              <input type="number" value={form.ssh_port} onChange={e => set('ssh_port', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Utilisateur SSH</label>
              <input type="text" value={form.ssh_username} onChange={e => set('ssh_username', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Mot de passe SSH {!isNew && '(laisser vide = inchangé)'}</label>
              <input type="password" value={form.ssh_password} onChange={e => set('ssh_password', e.target.value)} autoComplete="new-password" />
            </div>
          </div>

          {/* Serveur */}
          <div className="modal-section-title">Configuration serveur</div>
          <div className="form-row">
            <div className="form-group">
              <label>Chemin du serveur</label>
              <input type="text" value={form.server_path} onChange={e => set('server_path', e.target.value)} required placeholder="/home/user/server" />
            </div>
            <div className="form-group">
              <label>Utilisateur d'exécution</label>
              <input type="text" value={form.run_as_user} onChange={e => set('run_as_user', e.target.value)} placeholder="minecraft" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Script de démarrage</label>
              <input type="text" value={form.start_script} onChange={e => set('start_script', e.target.value)} placeholder="/home/user/server/start.sh" />
            </div>
            <div className="form-group">
              <label>Nom screen</label>
              <input type="text" value={form.screen_name} onChange={e => set('screen_name', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>RAM min</label>
              <input type="text" value={form.min_ram} onChange={e => set('min_ram', e.target.value)} placeholder="1G" />
            </div>
            <div className="form-group">
              <label>RAM max</label>
              <input type="text" value={form.max_ram} onChange={e => set('max_ram', e.target.value)} placeholder="4G" />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement...' : (isNew ? 'Créer' : 'Enregistrer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
