import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { server as serverApi } from '../api';
import { Play, Square, RotateCcw, Cpu, MemoryStick, Users, Activity, Wifi, WifiOff } from 'lucide-react';

export default function Dashboard() {
  const { isAdmin, isOperator } = useAuth();
  const { currentServer } = useServer();
  const api = serverApi(currentServer?.id);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchStatus = async () => {
    try {
      setStatus(await api.status());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [currentServer?.id]);

  const handleAction = async (action) => {
    setActionLoading(action);
    setMessage(''); setError('');
    try {
      if (action === 'start') await api.start();
      else if (action === 'stop') await api.stop();
      else if (action === 'restart') await api.restart();
      setMessage(`Action "${action}" réussie`);
      setTimeout(fetchStatus, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <div className="page"><div className="loading">Chargement du statut...</div></div>;

  const canControl = isAdmin || isOperator;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className={`status-badge ${status?.online ? 'online' : 'offline'}`}>
          {status?.online ? <Wifi size={16} /> : <WifiOff size={16} />}
          {status?.online ? 'En ligne' : 'Hors ligne'}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><Activity size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">État</span>
            <span className={`stat-value ${status?.online ? 'text-green' : 'text-red'}`}>
              {status?.online ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Users size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Joueurs</span>
            <span className="stat-value">{status?.players?.count ?? 0} / {status?.players?.max ?? 20}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Cpu size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">CPU</span>
            <span className="stat-value">{status?.cpu ?? 'N/A'}%</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><MemoryStick size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">RAM</span>
            <span className="stat-value">{status?.memory ?? 'N/A'} MB</span>
          </div>
        </div>
      </div>

      {canControl && (
        <div className="control-panel">
          <h2>Contrôle du serveur</h2>
          <div className="control-buttons">
            <button className="btn btn-success" onClick={() => handleAction('start')} disabled={actionLoading || status?.online}>
              <Play size={18} /> {actionLoading === 'start' ? 'Démarrage...' : 'Démarrer'}
            </button>
            <button className="btn btn-danger" onClick={() => handleAction('stop')} disabled={actionLoading || !status?.online}>
              <Square size={18} /> {actionLoading === 'stop' ? 'Arrêt...' : 'Arrêter'}
            </button>
            <button className="btn btn-warning" onClick={() => handleAction('restart')} disabled={actionLoading}>
              <RotateCcw size={18} /> {actionLoading === 'restart' ? 'Redémarrage...' : 'Redémarrer'}
            </button>
          </div>
        </div>
      )}

      {status?.online && status?.players?.list?.length > 0 && (
        <div className="card">
          <h2>Joueurs en ligne ({status.players.count})</h2>
          <div className="player-list-simple">
            {status.players.list.map((player) => (
              <span key={player} className="player-tag">{player}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
