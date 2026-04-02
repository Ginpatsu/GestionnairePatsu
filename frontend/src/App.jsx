import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useServer } from './context/ServerContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ServerSelect from './pages/ServerSelect';
import Dashboard from './pages/Dashboard';
import Console from './pages/Console';
import Players from './pages/Players';
import Files from './pages/Files';
import Logs from './pages/Logs';
import Users from './pages/Users';
import Commands from './pages/Commands';

function ProtectedRoute({ children, minRole = null }) {
  const { user, loading, isAdmin, isOperator } = useAuth();
  const { currentServer } = useServer();

  if (loading) return <div className="loading-screen">Chargement...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!currentServer) return <Navigate to="/servers" />;
  if (minRole === 'admin' && !isAdmin) return <Navigate to="/" />;
  if (minRole === 'operator' && !isOperator) return <Navigate to="/" />;

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/servers" element={<ServerSelect />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="console" element={<Console />} />
        <Route path="players" element={<Players />} />
        <Route path="files" element={<Files />} />
        <Route path="commands" element={<ProtectedRoute minRole="admin"><Commands /></ProtectedRoute>} />
        <Route path="logs" element={<ProtectedRoute minRole="admin"><Logs /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute minRole="admin"><Users /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
