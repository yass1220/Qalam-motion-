// Isolated production-server integration check: no real provider credentials.
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qalam-release-'));
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const env = {...process.env, PORT: String(port), NODE_ENV: 'production',
  DATABASE_URL: '', RAILWAY_ENVIRONMENT: '', DATA_DIR: directory,
  PAYPAL_MODE: 'sandbox', PAYPAL_CLIENT_ID: '', PAYPAL_CLIENT_SECRET: '',
  PAYPAL_WEBHOOK_ID: '', ADMIN_TOKEN: '', SETUP_TOKEN: '', RESEND_API_KEY: '',
  PUBLIC_BASE_URL: base, EXPECT_INDEXABLE: 'true', I18N_TEST_BASE_URL: base};
const server = spawn(process.execPath, ['server.js'], {env, stdio: ['ignore', 'pipe', 'pipe']});
let output = '';
server.stdout.on('data', chunk => {output += chunk;});
server.stderr.on('data', chunk => {output += chunk;});
try {
  let ready = false;
  for (let n = 0; n < 200; n++) {
    try {if ((await fetch(base + '/health')).ok) {ready = true; break;}} catch {}
    if (server.exitCode !== null) break;
    await delay(100);
  }
  if (!ready) throw new Error('Isolated server did not become healthy: ' + output);
  const tests = spawn(process.execPath, ['--import', 'tsx', '--test',
    'test/i18n-http.test.ts', 'test/marketing-production.test.ts'], {env, stdio: 'inherit'});
  process.exitCode = await new Promise(resolve => tests.once('exit', code => resolve(code ?? 1)));
} finally {
  if (server.exitCode === null) {
    const stopped = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await stopped;
  }
  // The directory was created above and contains only this fixture's JSON data.
  await fs.rm(directory, {recursive: true, force: true});
}
