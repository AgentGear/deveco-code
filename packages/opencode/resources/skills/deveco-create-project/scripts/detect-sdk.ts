import path from 'node:path';

type Source = 'sdk_pkg' | 'oh_uni_package' | 'fallback';

type Result = {
  apiLevel: number;
  source: Source;
  detectedFrom?: string;
  devecoHome?: string;
};

type Pkg = {
  data?: {
    apiVersion?: unknown;
  };
  apiVersion?: unknown;
};

function envPath() {
  return String(process.env.DEVECO_HOME || '').trim();
}

async function isDir(file: string) {
  if (!file) {
    return false;
  }
  return Bun.file(file)
    .stat()
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

function nodePath(home: string) {
  return process.platform === 'win32'
    ? path.join(home, 'tools', 'node', 'node.exe')
    : path.join(home, 'tools', 'node', 'bin', 'node');
}

async function findDevEcoHome() {
  const env = envPath();
  if (env && (await isDir(env)) && (await Bun.file(nodePath(env)).exists())) {
    return env;
  }
  for (const item of defaults()) {
    if (!(await isDir(item))) {
      continue;
    }
    if (await Bun.file(nodePath(item)).exists()) {
      return item;
    }
  }
}

function ok(apiLevel: number) {
  return Number.isInteger(apiLevel) && apiLevel >= 17 && apiLevel <= 24;
}

function parse(raw: unknown) {
  if (typeof raw !== 'string') {
    return;
  }
  const apiLevel = Number(raw);
  if (!ok(apiLevel)) {
    return;
  }
  return apiLevel;
}

async function json(file: string) {
  const item = Bun.file(file);
  if (!(await item.exists())) {
    return;
  }
  return item.json() as Promise<Pkg>;
}

export async function detectApiLevel(): Promise<Result> {
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

  const files = [
    path.join(home, 'sdk', 'default', 'openharmony', 'toolchains', 'oh-uni-package.json'),
    path.join(home, 'sdk', 'default', 'openharmony', 'native', 'oh-uni-package.json'),
    path.join(home, 'sdk', 'default', 'openharmony', 'previewer', 'oh-uni-package.json'),
  ];

  for (const file of files) {
    const next = await json(file).catch(() => undefined);
    const apiLevel = parse(next?.apiVersion);
    if (!apiLevel) {
      continue;
    }
    return {
      apiLevel,
      source: 'oh_uni_package',
      detectedFrom: file,
      devecoHome: home,
    };
  }

  return {
    apiLevel: 22,
    source: 'fallback',
    devecoHome: home,
  };
}
