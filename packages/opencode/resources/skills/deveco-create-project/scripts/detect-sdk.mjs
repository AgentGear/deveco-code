import path from 'node:path';
import fs from 'node:fs/promises';

function envPath() {
  return String(process.env.DEVECO_HOME || '').trim();
}

async function isDir(file) {
  if (!file) {
    return false;
  }
  return fs.stat(file)
    .then((info) => info.isDirectory())
    .catch(() => false);
}

function defaults() {
  if (process.platform === 'darwin') {
    return ['/Applications/DevEco-Studio.app/Contents'];
  }
  if (process.platform === 'linux') {
    const home = String(process.env.HOME || '').trim();
    return [
      home ? path.join(home, 'devecostudio/Contents') : '',
      home ? path.join(home, 'DevEco-Studio/Contents') : '',
    ].filter(Boolean);
  }
  const home = String(process.env.USERPROFILE || '').trim();
  return [
    'C:\\Program Files\\Huawei\\DevEco Studio',
    'C:\\Program Files\\DevEco Studio',
    'C:\\Program Files (x86)\\DevEco Studio',
    home ? path.join(home, 'DevEco Studio') : '',
  ].filter(Boolean);
}

function nodePath(home) {
  return process.platform === 'win32'
    ? path.join(home, 'tools', 'node', 'node.exe')
    : path.join(home, 'tools', 'node', 'bin', 'node');
}

async function findDevEcoHome() {
  const env = envPath();
  if (env && (await isDir(env)) && (await exists(nodePath(env)))) {
    return env;
  }
  for (const item of defaults()) {
    if (!(await isDir(item))) {
      continue;
    }
    if (await exists(nodePath(item))) {
      return item;
    }
  }
}

function ok(apiLevel) {
  return Number.isInteger(apiLevel) && apiLevel >= 17 && apiLevel <= 24;
}

function parse(raw) {
  if (typeof raw !== 'string') {
    return;
  }
  const apiLevel = Number(raw);
  if (!ok(apiLevel)) {
    return;
  }
  return apiLevel;
}

async function json(file) {
  if (!(await exists(file))) {
    return;
  }
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function exists(file) {
  return fs.access(file).then(() => true).catch(() => false);
}

export async function detectApiLevel() {
  const home = await findDevEcoHome().catch(() => undefined);
  if (!home) {
    return {
      apiLevel: 22,
      source: 'fallback',
    };
  }

  const sdk = path.join(home, 'sdk', 'default', 'sdk-pkg.json');
  const first = await json(sdk).catch(() => undefined);
  const firstLevel = parse(first?.data?.apiVersion);
  if (firstLevel) {
    return {
      apiLevel: firstLevel,
      source: 'sdk_pkg',
      detectedFrom: sdk,
      devecoHome: home,
    };
  }

  return {
    apiLevel: 22,
    source: 'fallback',
    devecoHome: home,
  };
}
