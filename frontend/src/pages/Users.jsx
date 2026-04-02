import { useState, useEffect } from 'react';
import { auth as authApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Trash2, RefreshCw, Pencil, Check, X } from 'lucide-react';

const ROLE_LEVEL = { user: 0, operator: 1, admin: 2, 'admin+': 3 };

const ROLE_LABELS = {
  user: 'Utilisateur',
  operator: 'Opérateur',
  admin: 'Administrateur',
  'admin+': 'Administrateur+',
};

const ROLE_BADGE = {
  user: 'badge-blue',
  operator: 'badge-green',
  admin: 'badge-red',
  'admin+': 'badge-purple',
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Création
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');

  // Édition de rôle inline
  const [editingId, setEditingId] = useState(null);
  const [editingRole, setEditingRole] = useState('');

  const currentLevel = ROLE_LEVEL[currentUser?.role] ?? -1;
  // Rôles que l'utilisateur courant peut attribuer (strictement inférieurs au sien)
  const creatableRoles = Object.entries(ROLE_LEVEL)
    .filter(([, level]) => level < currentLevel)
    .map(([role]) => role);

  const canManage = (targetRole) => (ROLE_LEVEL[targetRole] ?? 999) < currentLevel;

  const fetchUsers = async () => {
    try {
      const data = await authApi.getUsers();
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await authApi.createUser(newUsername, newPassword, newRole);
      setMessage(`Utilisateur "${newUsername}" créé`);
      setNewUsername(''); setNewPassword(''); setNewRole('user');
      setShowForm(false);
      fetchUsers();
    } catch (err) { setError(err.message); }
  };

  const deleteUser = async (id, username) => {
    if (!window.confirm(`Supprimer l'utilisateur "${username}" ?`)) return;
    try {
      await authApi.deleteUser(id);
      setMessage(`Utilisateur "${username}" supprimé`);
      fetchUsers();
    } catch (err) { setError(err.message); }
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setEditingRole(user.role);
  };

  const cancelEdit = () => { setEditingId(null); setEditingRole(''); };

  const saveEdit = async (user) => {
    if (editingRole === user.role) { cancelEdit(); return; }
    setError(''); setMessage('');
    try {
      await authApi.updateUserRole(user.id, editingRole);
      setMessage(`Rôle de "${user.username}" mis à jour : ${ROLE_LABELS[editingRole]}`);
      cancelEdit();
      fetchUsers();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Gestion des utilisateurs</h1>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            <UserPlus size={16} /> Ajouter
          </button>
          <button className="btn btn-sm btn-ghost" onClick={fetchUsers}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {showForm && (
        <div className="card">
          <h2>Nouvel utilisateur</h2>
          <form onSubmit={createUser} className="user-form">
            <div className="form-row">
              <div className="form-group">
                <label>Nom d'utilisateur</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="username"
                  required minLength={3} maxLength={32}
                />
              </div>
              <div className="form-group">
                <label>Mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>Rôle</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  {creatableRoles.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Créer</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom d'utilisateur</th>
                <th>Rôle</th>
                <th>Créé le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td className="font-medium">{user.username}</td>
                  <td>
                    {editingId === user.id ? (
                      <select
                        value={editingRole}
                        onChange={(e) => setEditingRole(e.target.value)}
                        style={{ padding: '3px 6px', fontSize: '12px', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                      >
                        {creatableRoles.map((role) => (
                          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`badge ${ROLE_BADGE[user.role] || 'badge-blue'}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    )}
                  </td>
                  <td className="text-sm">{new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {editingId === user.id ? (
                        <>
                          <button className="btn btn-xs btn-success" onClick={() => saveEdit(user)} title="Confirmer">
                            <Check size={13} />
                          </button>
                          <button className="btn btn-xs btn-ghost" onClick={cancelEdit} title="Annuler">
                            <X size={13} />
                          </button>
                        </>
                      ) : canManage(user.role) && (
                        <>
                          <button className="btn btn-xs btn-ghost" onClick={() => startEdit(user)} title="Modifier le rôle">
                            <Pencil size={13} />
                          </button>
                          <button className="btn btn-xs btn-ghost text-red" onClick={() => deleteUser(user.id, user.username)} title="Supprimer">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
