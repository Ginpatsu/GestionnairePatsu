import { useState, useEffect } from 'react';
import { logs as logsApi } from '../api';
import { useServer } from '../context/ServerContext';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export default function Logs() {
  const { currentServer } = useServer();
  const api = logsApi(currentServer?.id);
  const [logData, setLogData] = useState({ logs: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchLogs = async (p = page) => {
    setLoading(true);
    try {
      const data = await api.list(p, 50);
      setLogData(data);
      setPage(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionColor = (action) => {
    if (action.includes('START') || action.includes('UNBAN') || action.includes('CREATE')) return 'badge-green';
    if (action.includes('STOP') || action.includes('BAN') || action.includes('DELETE') || action.includes('KICK')) return 'badge-red';
    if (action.includes('RESTART') || action.includes('OP')) return 'badge-yellow';
    return 'badge-blue';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Journal des actions</h1>
        <button className="btn btn-sm btn-ghost" onClick={() => fetchLogs(1)}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Détails</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logData.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-sm">{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                    <td>{log.username}</td>
                    <td>
                      <span className={`badge ${getActionColor(log.action)}`}>{log.action}</span>
                    </td>
                    <td className="text-sm text-muted">{log.details || '-'}</td>
                    <td className="text-sm text-muted">{log.ip_address || '-'}</td>
                  </tr>
                ))}
                {logData.logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted text-center">Aucun log</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              className="btn btn-sm btn-ghost"
              disabled={page <= 1}
              onClick={() => fetchLogs(page - 1)}
            >
              <ChevronLeft size={16} /> Précédent
            </button>
            <span className="pagination-info">
              Page {logData.pagination.page} / {logData.pagination.totalPages || 1}
            </span>
            <button
              className="btn btn-sm btn-ghost"
              disabled={page >= logData.pagination.totalPages}
              onClick={() => fetchLogs(page + 1)}
            >
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
