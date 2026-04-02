import { createContext, useContext, useState } from 'react';

const ServerContext = createContext(null);

export function ServerProvider({ children }) {
  const [currentServer, setCurrentServer] = useState(() => {
    try {
      const saved = localStorage.getItem('mcpanel_server');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const selectServer = (srv) => {
    localStorage.setItem('mcpanel_server', JSON.stringify(srv));
    setCurrentServer(srv);
  };

  const clearServer = () => {
    localStorage.removeItem('mcpanel_server');
    setCurrentServer(null);
  };

  return (
    <ServerContext.Provider value={{ currentServer, selectServer, clearServer }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer doit être utilisé dans un ServerProvider');
  return ctx;
}
