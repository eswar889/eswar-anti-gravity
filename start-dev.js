/**
 * Zero-dependency Root Orchestrator
 * Starts the Express backend on port 5000 and serves the frontend on port 3000.
 * Automatically injects frontend/.env variables via dynamic /env.js endpoint.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const FRONTEND_PORT = 3000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');
const FRONTEND_ENV_FILE = path.join(FRONTEND_DIR, '.env');

// Helper to parse simple .env file into key-value pairs
function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        env[key] = value;
      }
    }
  } catch (err) {
    console.error('Error reading frontend/.env:', err.message);
  }
  return env;
}

// MIME types dictionary for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// 1. Start Frontend Static Server with /env.js Support
const frontendServer = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // Dynamic /env.js endpoint that serves variables from frontend/.env
  if (reqPath === '/env.js') {
    const envVars = parseEnvFile(FRONTEND_ENV_FILE);
    const scriptContent = `window.__ENV = ${JSON.stringify(envVars, null, 2)};`;
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=UTF-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(scriptContent);
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(FRONTEND_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

frontendServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${FRONTEND_PORT} is already in use.`);
    console.error(`Run: Get-Process node | Stop-Process to free ports before starting.\n`);
  } else {
    console.error('Frontend server error:', err);
  }
  process.exit(1);
});

frontendServer.listen(FRONTEND_PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🌐 FRONTEND UI is live at: http://localhost:${FRONTEND_PORT}`);
  console.log(`======================================================`);
});

// 2. Start Express Backend Process
const backendProcess = spawn(process.execPath, ['server.js'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit'
});

backendProcess.on('error', (err) => {
  console.error('Failed to start backend server:', err);
});

backendProcess.on('exit', (code) => {
  console.log(`Backend process exited with code ${code}`);
  process.exit(code || 0);
});

// Graceful cleanup on Ctrl+C
process.on('SIGINT', () => {
  console.log('\nShutting down dev servers...');
  backendProcess.kill();
  frontendServer.close(() => {
    process.exit(0);
  });
});
