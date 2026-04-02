import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import {
  LayoutDashboard, Terminal, Users, FolderOpen,
  FileText, UserCog, LogOut, Server, Zap, ChevronDown,
} from 'lucide-react';

export default function Layout() {
  const { user, logout, isAdmin, isOperator } = useAuth();
  const { currentServer, clearServer } = useServer();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); clearServer(); navigate('/login'); };
  const handleChangeServer = () => navigate('/servers');

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/console', icon: Terminal, label: 'Console' },
  ];

  if (isAdmin) {
    navItems.push({ to: '/players', icon: Users, label: 'Joueurs' });
    navItems.push({ to: '/files', icon: FolderOpen, label: 'Fichiers' });
    navItems.push({ to: '/commands', icon: Zap, label: 'Commandes' });
    navItems.push({ to: '/logs', icon: FileText, label: 'Logs' });
    navItems.push({ to: '/users', icon: UserCog, label: 'Utilisateurs' });
  } else if (isOperator) {
    navItems.push({ to: '/players', icon: Users, label: 'Joueurs' });
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Server size={24} />
          <span>GestionnairePatsu</span>
        </div>

        {currentServer && (
          <button className="server-switcher" onClick={handleChangeServer} title="Changer de serveur">
            <span className="server-switcher-name">{currentServer.name}</span>
            <ChevronDown size={14} />
          </button>
        )}

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user?.username}</span>
            <span className="user-role">{user?.role}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Déconnexion">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
