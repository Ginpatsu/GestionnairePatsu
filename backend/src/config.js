require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_ME',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  ssh: {
    host: process.env.SSH_HOST || '127.0.0.1',
    port: parseInt(process.env.SSH_PORT, 10) || 22,
    username: process.env.SSH_USERNAME || 'minecraft',
    privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH || '',
    password: process.env.SSH_PASSWORD || '',
  },
  minecraft: {
    serverPath: process.env.MC_SERVER_PATH || '/home/minecraft/server',
    screenName: process.env.MC_SCREEN_NAME || 'minecraft',
    jarFile: process.env.MC_JAR_FILE || 'server.jar',
    minRam: process.env.MC_MIN_RAM || '1G',
    maxRam: process.env.MC_MAX_RAM || '4G',
    runAsUser: process.env.MC_RUN_AS_USER || '',
    startScript: process.env.MC_START_SCRIPT || '',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  defaultAdmin: {
    username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMeNow123!',
  },
};
