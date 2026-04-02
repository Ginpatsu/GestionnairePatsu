import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { Send, Trash2 } from 'lucide-react';

export default function Console() {
  const { isAdmin } = useAuth();
  const { currentServer } = useServer();
  const [logs, setLogs] = useState('');
  const [command, setCommand] = useState('');
  const [connected, setConnected] = useState(false);
  const consoleRef = useRef(null);
  const socketRef = useRef(null);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (!currentServer?.id) return;
    const token = localStorage.getItem('mcpanel_token');
    const socket = io('/', {
      auth: { token },
      query: { serverId: currentServer.id },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('console:output', (data) => setLogs(data));
    socket.on('console:update', (data) => setLogs((prev) => prev + data));
    socket.on('console:error', (msg) => setLogs((prev) => prev + `\n[ERREUR] ${msg}\n`));
    socket.on('console:sent', (cmd) => setLogs((prev) => prev + `\n> ${cmd}\n`));

    return () => socket.disconnect();
  }, [currentServer?.id]);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs]);

  const sendCommand = (e) => {
    e.preventDefault();
    if (!command.trim() || !socketRef.current) return;
    socketRef.current.emit('console:command', command.trim());
    setCommandHistory((prev) => [command.trim(), ...prev.slice(0, 49)]);
    setHistoryIndex(-1);
    setCommand('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const i = historyIndex + 1;
        setHistoryIndex(i);
        setCommand(commandHistory[i]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const i = historyIndex - 1;
        setHistoryIndex(i);
        setCommand(commandHistory[i]);
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Console</h1>
        <div className="header-actions">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'Connecté' : 'Déconnecté'}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setLogs('')} title="Effacer">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="console-container">
        <pre ref={consoleRef} className="console-output">
          {logs || 'En attente des logs du serveur...'}
        </pre>
        {isAdmin && (
          <form onSubmit={sendCommand} className="console-input-form">
            <span className="console-prompt">&gt;</span>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Entrez une commande Minecraft..."
              className="console-input"
              autoFocus
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!command.trim()}>
              <Send size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
