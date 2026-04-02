const ssh = require('./ssh');

// Toutes les fonctions prennent un objet `srv` (ligne de la table servers)

function sudoCmd(srv, cmd) {
  return srv.run_as_user ? `sudo -u ${srv.run_as_user} ${cmd}` : cmd;
}

async function isRunning(srv) {
  const result = await ssh.exec(srv, `pgrep -x java | while read pid; do readlink -f /proc/$pid/cwd 2>/dev/null; done | grep -qF "${srv.server_path}" && echo 1 || echo 0`);
  return result.stdout.trim() === '1';
}

async function start(srv) {
  const running = await isRunning(srv);
  if (running) throw new Error('Le serveur est déjà en cours d\'exécution');

  if (srv.start_script) {
    await ssh.shellWithPty(srv, [
      `cd ${srv.server_path}`,
      srv.start_script,
      { raw: '\x01d', wait: 5000 },
      'exit',
    ]);
  } else {
    await ssh.exec(srv, `screen -dmS ${srv.screen_name} java -Xms${srv.min_ram} -Xmx${srv.max_ram} -jar ${srv.jar_file} nogui`, srv.server_path);
  }

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    if (await isRunning(srv)) return { status: 'started' };
  }
  throw new Error('Échec du démarrage du serveur');
}

async function stop(srv) {
  if (!await isRunning(srv)) throw new Error('Le serveur n\'est pas en cours d\'exécution');

  await sendCommand(srv, 'stop');

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    if (!await isRunning(srv)) return { status: 'stopped' };
  }

  await ssh.exec(srv, sudoCmd(srv, `screen -S ${srv.screen_name} -X quit`));
  return { status: 'force_stopped' };
}

async function restart(srv) {
  if (await isRunning(srv)) {
    await stop(srv);
    await new Promise(r => setTimeout(r, 3000));
  }
  return await start(srv);
}

async function sendCommand(srv, command) {
  if (!await isRunning(srv)) throw new Error('Le serveur n\'est pas en cours d\'exécution');
  const escaped = command.replace(/"/g, '\\"');
  await ssh.exec(srv, sudoCmd(srv, `screen -S ${srv.screen_name} -p 0 -X stuff "${escaped}\n"`));
  return { sent: true, command };
}

async function getStatus(srv) {
  const running = await isRunning(srv);
  const status = { online: running };

  if (running) {
    const [sysResult, playerResult] = await Promise.allSettled([
      ssh.exec(srv, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1; free -m | awk 'NR==2{printf \"%s/%s\", $3, $2}'"),
      getOnlinePlayers(srv),
    ]);

    if (sysResult.status === 'fulfilled') {
      const lines = sysResult.value.stdout.trim().split('\n');
      status.cpu = lines[0] || 'N/A';
      status.memory = lines[1] || 'N/A';
    } else {
      status.cpu = 'N/A';
      status.memory = 'N/A';
    }

    status.players = playerResult.status === 'fulfilled'
      ? playerResult.value
      : { count: 0, max: 0, list: [] };
  }

  return status;
}

async function getOnlinePlayers(srv) {
  const logPath = `${srv.server_path}/logs/latest.log`;
  const result = await ssh.exec(srv, `tail -500 ${logPath} 2>/dev/null || echo ""`);
  const lines = result.stdout.split('\n');

  const players = new Set();
  let maxPlayers = 20;

  for (const line of lines) {
    const joinMatch = line.match(/\[Server thread\/INFO\].*?: (.+?) joined the game/);
    const leaveMatch = line.match(/\[Server thread\/INFO\].*?: (.+?) left the game/);
    const maxMatch = line.match(/There are \d+ of a max of (\d+) players online/);

    if (maxMatch) maxPlayers = parseInt(maxMatch[1], 10);
    if (joinMatch) players.add(joinMatch[1]);
    if (leaveMatch) players.delete(leaveMatch[1]);
  }

  const list = Array.from(players);
  return { count: list.length, max: maxPlayers, list };
}

async function getConsoleLogs(srv, lines = 100) {
  const logPath = `${srv.server_path}/logs/latest.log`;
  const result = await ssh.exec(srv, `tail -${Math.min(lines, 500)} ${logPath} 2>/dev/null || echo "Aucun log disponible"`);
  return result.stdout;
}

module.exports = { isRunning, start, stop, restart, sendCommand, getStatus, getOnlinePlayers, getConsoleLogs };
