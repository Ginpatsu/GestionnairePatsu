const { NodeSSH } = require('node-ssh');
const fs = require('fs');

// Pool de connexions SSH : une par server_id
const connections = new Map();
const connecting = new Map();

async function getConnection(serverConfig) {
  const id = serverConfig.id;

  const existing = connections.get(id);
  if (existing && existing.isConnected()) {
    return existing;
  }

  // Éviter les connexions simultanées pour le même serveur
  if (connecting.has(id)) {
    return connecting.get(id);
  }

  const promise = (async () => {
    const ssh = new NodeSSH();
    const opts = {
      host: serverConfig.ssh_host,
      port: serverConfig.ssh_port || 22,
      username: serverConfig.ssh_username,
      readyTimeout: 15000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 5,
    };

    if (serverConfig.ssh_key_path && fs.existsSync(serverConfig.ssh_key_path)) {
      opts.privateKeyPath = serverConfig.ssh_key_path;
    } else if (serverConfig.ssh_password) {
      opts.password = serverConfig.ssh_password;
    } else {
      throw new Error('Aucune méthode d\'authentification SSH configurée');
    }

    await ssh.connect(opts);
    connections.set(id, ssh);
    connecting.delete(id);
    console.log(`[SSH] Connexion établie pour serveur #${id}`);

    ssh.connection.on('close', () => {
      console.log(`[SSH] Connexion fermée pour serveur #${id}`);
      connections.delete(id);
    });
    ssh.connection.on('error', (err) => {
      console.error(`[SSH] Erreur serveur #${id}:`, err.message);
      connections.delete(id);
    });

    return ssh;
  })();

  connecting.set(id, promise);

  try {
    return await promise;
  } catch (err) {
    connecting.delete(id);
    throw err;
  }
}

async function exec(serverConfig, command, cwd = null) {
  const ssh = await getConnection(serverConfig);
  const options = {};
  if (cwd) options.cwd = cwd;
  const result = await ssh.execCommand(command, options);
  return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}

function shellWithPty(serverConfig, commands) {
  return new Promise(async (resolve, reject) => {
    let conn;
    try {
      conn = await getConnection(serverConfig);
    } catch (err) {
      return reject(err);
    }

    conn.connection.shell({ term: 'xterm', cols: 220, rows: 50 }, (err, stream) => {
      if (err) return reject(err);

      let output = '';
      stream.on('data', d => { output += d.toString(); });
      stream.stderr.on('data', d => { output += d.toString(); });
      stream.on('close', () => resolve(output));

      let delay = 300;
      for (const cmd of commands) {
        if (typeof cmd === 'string') {
          setTimeout(() => stream.write(cmd + '\n'), delay);
          delay += 200;
        } else if (cmd.raw !== undefined) {
          setTimeout(() => stream.write(cmd.raw), delay);
          delay += cmd.wait || 200;
        }
      }

      setTimeout(() => {
        try { stream.close(); } catch {}
        resolve(output);
      }, delay + 2000);
    });
  });
}

async function disconnect(serverId = null) {
  if (serverId !== null) {
    const conn = connections.get(serverId);
    if (conn && conn.isConnected()) {
      conn.dispose();
      connections.delete(serverId);
    }
  } else {
    for (const [id, conn] of connections.entries()) {
      if (conn.isConnected()) conn.dispose();
      connections.delete(id);
    }
    console.log('[SSH] Toutes les connexions fermées');
  }
}

module.exports = { getConnection, exec, shellWithPty, disconnect };
