import { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('mcpanel_token');
    const savedUser = localStorage.getItem('mcpanel_user');

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('mcpanel_token');
        localStorage.removeItem('mcpanel_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const data = await authApi.login(username, password);
    localStorage.setItem('mcpanel_token', data.token);
    localStorage.setItem('mcpanel_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('mcpanel_token');
    localStorage.removeItem('mcpanel_user');
    setUser(null);
  };

  const ROLE_LEVEL = { user: 0, operator: 1, admin: 2, 'admin+': 3 };
  const userLevel = ROLE_LEVEL[user?.role] ?? -1;
  const isAdmin = userLevel >= ROLE_LEVEL['admin'];
  const isOperator = userLevel >= ROLE_LEVEL['operator'];

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isOperator }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
