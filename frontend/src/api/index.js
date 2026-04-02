const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('mcpanel_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('mcpanel_token');
    localStorage.removeItem('mcpanel_user');
    window.location.href = '/login';
    throw new Error('Session expirée');
  }

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error(text || `Erreur serveur (${response.status})`); }

  if (!response.ok) throw new Error(data.error || 'Erreur inconnue');
  return data;
}

// Auth
export const auth = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) => request('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
  getUsers: () => request('/auth/users'),
  createUser: (username, password, role) => request('/auth/users', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),
  updateUserRole: (id, role) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify({ role }) }),
};

// Servers list
export const servers = {
  list: () => request('/servers'),
  create: (data) => request('/servers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/servers/${id}`, { method: 'DELETE' }),
  getAccess: (id) => request(`/servers/${id}/access`),
  grantAccess: (id, userId) => request(`/servers/${id}/access`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  revokeAccess: (id, userId) => request(`/servers/${id}/access/${userId}`, { method: 'DELETE' }),
};

// Per-server APIs
export const server = (srvId) => ({
  status: () => request(`/servers/${srvId}/mc/status`),
  start: () => request(`/servers/${srvId}/mc/start`, { method: 'POST' }),
  stop: () => request(`/servers/${srvId}/mc/stop`, { method: 'POST' }),
  restart: () => request(`/servers/${srvId}/mc/restart`, { method: 'POST' }),
  command: (command) => request(`/servers/${srvId}/mc/command`, { method: 'POST', body: JSON.stringify({ command }) }),
  console: (lines = 100) => request(`/servers/${srvId}/mc/console?lines=${lines}`),
});

export const players = (srvId) => ({
  list: () => request(`/servers/${srvId}/players`),
  op: (player) => request(`/servers/${srvId}/players/op`, { method: 'POST', body: JSON.stringify({ player }) }),
  deop: (player) => request(`/servers/${srvId}/players/deop`, { method: 'POST', body: JSON.stringify({ player }) }),
  ban: (player, reason) => request(`/servers/${srvId}/players/ban`, { method: 'POST', body: JSON.stringify({ player, reason }) }),
  unban: (player) => request(`/servers/${srvId}/players/unban`, { method: 'POST', body: JSON.stringify({ player }) }),
  kick: (player, reason) => request(`/servers/${srvId}/players/kick`, { method: 'POST', body: JSON.stringify({ player, reason }) }),
  whitelist: (player, action) => request(`/servers/${srvId}/players/whitelist`, { method: 'POST', body: JSON.stringify({ player, action }) }),
});

export const files = (srvId) => ({
  list: (path) => request(`/servers/${srvId}/files/list?path=${encodeURIComponent(path || '.')}`),
  read: (path) => request(`/servers/${srvId}/files/read?path=${encodeURIComponent(path)}`),
  write: (path, content) => request(`/servers/${srvId}/files/write`, { method: 'PUT', body: JSON.stringify({ path, content }) }),
  mkdir: (path) => request(`/servers/${srvId}/files/mkdir`, { method: 'POST', body: JSON.stringify({ path }) }),
  delete: (path) => request(`/servers/${srvId}/files/delete`, { method: 'DELETE', body: JSON.stringify({ path }) }),
  downloadUrl: (path) => `${API_BASE}/servers/${srvId}/files/download?path=${encodeURIComponent(path)}&token=${localStorage.getItem('mcpanel_token')}`,
});

export const logs = (srvId) => ({
  list: (page = 1, limit = 50) => request(`/servers/${srvId}/logs?page=${page}&limit=${limit}`),
});
