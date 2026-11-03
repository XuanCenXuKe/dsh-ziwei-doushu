/**
 * Host half of the Zi Wei Dou Shu (紫微斗数) plugin.
 *
 * The panel itself is the user's local ziwei-doushu app (Next.js). This half keeps
 * that app server alive: it pings it and, when it is not answering, starts
 * `next start` detached from the local deployment.
 *
 * Resolution (first match wins):
 *   app dir   : $ZIWEI_APP_DIR → ~/ziwei-doushu → ~/Documents/ziwei-doushu
 *               → ~/Documents/deepseek-harness/default-workspace/ziwei-doushu
 *               (must contain node_modules/next/dist/bin/next)
 *   node bin  : $ZIWEI_NODE_BIN → tools/node-<version>/bin/node next to the app dir
 *               → common Homebrew locations → node from PATH
 *
 * Environment:
 *   ZIWEI_APP_DIR    override the local app directory
 *   ZIWEI_NODE_BIN   override the Node.js executable
 *   ZIWEI_AUTO_START set to 0 to disable auto-start (panel still works if you run it yourself)
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const APP_PORT = 3000;
const CHECK_INTERVAL_MS = 30_000;
const SPAWN_COOLDOWN_MS = 15_000;

let lastSpawnAt = 0;
let checking = false;

function candidateAppDirs() {
  const dirs = [];
  if (process.env.ZIWEI_APP_DIR) dirs.push(process.env.ZIWEI_APP_DIR);
  const home = homedir();
  dirs.push(path.join(home, 'ziwei-doushu'));
  dirs.push(path.join(home, 'Documents', 'ziwei-doushu'));
  dirs.push(path.join(home, 'Documents', 'deepseek-harness', 'default-workspace', 'ziwei-doushu'));
  return dirs;
}

function findAppDir() {
  for (const dir of candidateAppDirs()) {
    if (existsSync(path.join(dir, 'node_modules', 'next', 'dist', 'bin', 'next'))) return dir;
  }
  return null;
}

function candidateNodeBins(appDir) {
  const bins = [];
  if (process.env.ZIWEI_NODE_BIN) bins.push(process.env.ZIWEI_NODE_BIN);

  // A deployment may ship its own Node runtime under <parent>/tools/node-<version>/bin/node.
  const toolsDir = path.join(path.dirname(appDir), 'tools');
  try {
    for (const name of readdirSync(toolsDir)) {
      const candidate = path.join(toolsDir, name, 'bin', 'node');
      if (existsSync(candidate)) bins.push(candidate);
    }
  } catch {
    /* tools dir is optional */
  }

  bins.push('/opt/homebrew/bin/node', '/usr/local/bin/node');
  if (/node/i.test(path.basename(process.execPath))) bins.push(process.execPath);
  bins.push('node');
  return bins;
}

function pingServer() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const req = http.get(
      { host: '127.0.0.1', port: APP_PORT, path: '/', timeout: 2000 },
      (res) => {
        res.resume();
        done(true);
      },
    );
    req.on('error', () => done(false));
    req.on('timeout', () => {
      req.destroy();
      done(false);
    });
  });
}

function trySpawn(bin, appDir) {
  return new Promise((resolve) => {
    try {
      const child = spawn(
        bin,
        ['node_modules/next/dist/bin/next', 'start', '-p', String(APP_PORT), '-H', '127.0.0.1'],
        {
          cwd: appDir,
          detached: true,
          stdio: 'ignore',
          env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
        },
      );
      child.once('spawn', () => {
        child.unref();
        resolve(true);
      });
      child.once('error', () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

async function startServer(appDir) {
  for (const bin of candidateNodeBins(appDir)) {
    if (await trySpawn(bin, appDir)) return;
  }
}

async function ensureServer() {
  if (checking || process.env.ZIWEI_AUTO_START === '0') return;
  checking = true;
  try {
    if (await pingServer()) return;
    if (Date.now() - lastSpawnAt < SPAWN_COOLDOWN_MS) return;
    lastSpawnAt = Date.now();
    const appDir = findAppDir();
    if (!appDir) return;
    await startServer(appDir);
  } finally {
    checking = false;
  }
}

export function apply(ctx) {
  ctx.effect(() => {
    void ensureServer();
    const timer = setInterval(() => void ensureServer(), CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, 'ziwei-doushu: local app server supervisor');
}
