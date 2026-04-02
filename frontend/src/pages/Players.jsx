import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { players as playersApi } from '../api';
import {
  Shield,
  ShieldOff,
  Ban,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';

export default function Players() {
  const { isAdmin } = useAuth();
  const { currentServer } = useServer();
  const api = playersApi(currentServer?.id);
  const [playerData, setPlayerData] = useState({ count: 0, max: 20, list: [] });
  const [loading, setLoading] = useState(true);
  const [actionPlayer, setActionPlayer] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchPlayers = async () => {
    try {
      const data = await api.list();
      setPlayerData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action) => {
    if (!actionPlayer.trim()) {
      setError('Entrez un nom de joueur');
      return;
    }

    setMessage('');
    setError('');

    try {
      let result;
      switch (action) {
        case 'op': result = await api.op(actionPlayer); break;
        case 'deop': result = await api.deop(actionPlayer); break;
        case 'ban': result = await api.ban(actionPlayer, actionReason); break;
        case 'unban': result = await api.unban(actionPlayer); break;
        case 'kick': result = await api.kick(actionPlayer, actionReason); break;
        default: return;
      }
      setMessage(result.message);
      setActionPlayer('');
      setActionReason('');
      setTimeout(fetchPlayers, 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Gestion des joueurs</h1>
        <button className="btn btn-sm btn-ghost" onClick={fetchPlayers}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {/* Joueurs en ligne */}
      <div className="card">
        <h2>Joueurs en ligne ({playerData.count}/{playerData.max})</h2>
        {playerData.list.length > 0 ? (
          <div className="player-grid">
            {playerData.list.map((player) => (
              <div key={player} className="player-card">
                <img
                  src={`https://mc-heads.net/avatar/${player}/40`}
                  alt={player}
                  className="player-avatar"
                />
                <span className="player-name">{player}</span>
                {isAdmin && (
                  <div className="player-actions">
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => { setActionPlayer(player); handleAction('kick'); }}
                      title="Kick"
                    >
                      <UserX size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">Aucun joueur en ligne</p>
        )}
      </div>

      {/* Actions admin */}
      {isAdmin && (
        <div className="card">
          <h2>Actions sur un joueur</h2>
          <div className="player-action-form">
            <div className="form-row">
              <div className="form-group">
                <label>Nom du joueur</label>
                <input
                  type="text"
                  value={actionPlayer}
                  onChange={(e) => setActionPlayer(e.target.value)}
                  placeholder="Nom du joueur"
                  maxLength={16}
                />
              </div>
              <div className="form-group">
                <label>Raison (optionnel)</label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Raison du ban/kick"
                  maxLength={200}
                />
              </div>
            </div>

            <div className="action-buttons">
              <button className="btn btn-success btn-sm" onClick={() => handleAction('op')}>
                <Shield size={16} /> OP
              </button>
              <button className="btn btn-warning btn-sm" onClick={() => handleAction('deop')}>
                <ShieldOff size={16} /> Deop
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleAction('kick')}>
                <UserX size={16} /> Kick
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleAction('ban')}>
                <Ban size={16} /> Ban
              </button>
              <button className="btn btn-success btn-sm" onClick={() => handleAction('unban')}>
                <UserCheck size={16} /> Unban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
