#!/usr/bin/env node
/**
 * Dong goi SERVER thanh BO CAI DAT Setup.exe (NSIS) + file zip de phat hanh (goi tu build-and-publish.bat, hoac: npm run release:build).
 *
 *   node scripts/build-release.js            -> release/HeThongBatSo-Server-Setup-<version>.exe (bo cai)
 *                                               + release/HeThongBatSo-Server-v<version>.zip (ban giai nen) + .sha256
 *   node scripts/build-release.js --no-node  -> khong kem node.exe (may cai dat tu cai Node.js >= 22.5)
 *
 * Goi zip gom: src/, public/, node_modules/ (CHI thu vien production), package.json, .env.example,
 * kiosk-questions.example.json, data/ (rong), start-server.bat + cac file chay nen/tu khoi dong cung
 * Windows (install-autostart.bat, stop-server.bat, status-server.bat, uninstall-autostart.bat, tools/), node/node.exe (lay tu may build, chi
 * khi build tren Windows x64). CO Y KHONG dong goi .env (mat khau that), data/*.db (du lieu benh
 * nhan), kiosk-questions.json (ngon tu don vi da sua) - giai nen DE LEN ban cu khong mat gi.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const VERSION = pkg.version;
const ASSET_NAME = 'HeThongBatSo-Server';
const OUT = path.join(ROOT, 'release');
const PKG_NAME = `${ASSET_NAME}-v${VERSION}`;
const STAGE = path.join(OUT, PKG_NAME);
const ZIP = path.join(OUT, `${PKG_NAME}.zip`);
const WITH_NODE = !process.argv.includes('--no-node');
const IS_WIN = process.platform === 'win32';

function fail(msg) {
  console.error(`\nLOI: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: IS_WIN, ...opts });
  return r.status === 0;
}

function listJs(dir, skip) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!skip.some((s) => p.includes(s))) out.push(...listJs(p, skip));
    } else if (ent.name.endsWith('.js') && !ent.name.endsWith('.min.js')) {
      out.push(p);
    }
  }
  return out;
}

// ---------- [1] Kiem tra cu phap ----------
console.log(`[1/5] Kiem tra cu phap source (version ${VERSION})...`);
const [major, minor] = process.versions.node.split('.').map(Number);
if (!(major > 22 || (major === 22 && minor >= 5))) fail('Can Node.js >= 22.5 de build server.');
const files = [
  ...listJs(path.join(ROOT, 'src'), []),
  ...listJs(path.join(ROOT, 'public'), [`${path.sep}vendor`]),
  ...listJs(path.join(ROOT, 'scripts'), []),
];
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    bad++;
    console.error(`  Loi cu phap: ${path.relative(ROOT, f)}\n${r.stderr}`);
  }
}
if (bad) fail(`${bad} file loi cu phap.`);
for (const req of ['src/server.js', 'package-lock.json', '.env.example', 'release-template/start-server.bat',
  'release-template/install-autostart.bat', 'release-template/tools/service.ps1', 'release-template/tools/run-service.bat']) {
  if (!fs.existsSync(path.join(ROOT, req))) fail(`Thieu file bat buoc: ${req}`);
}
console.log(`      OK - ${files.length} file .js`);

// ---------- [2] Sao chep vao thu muc dong goi ----------
console.log('[2/5] Sao chep ma nguon vao thu muc dong goi...');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });
fs.cpSync(path.join(ROOT, 'src'), path.join(STAGE, 'src'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), path.join(STAGE, 'public'), { recursive: true });
for (const f of ['package.json', 'package-lock.json', '.env.example', 'kiosk-questions.example.json', 'README.md']) {
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(STAGE, f));
}
fs.mkdirSync(path.join(STAGE, 'data'));
fs.writeFileSync(path.join(STAGE, 'data', '.gitkeep'), '');
fs.cpSync(path.join(ROOT, 'release-template'), STAGE, { recursive: true });

// ---------- [3] Cai thu vien production ----------
console.log('[3/5] Cai thu vien production (npm ci --omit=dev)...');
if (!run('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: STAGE })) {
  fail('npm ci that bai.');
}
if (WITH_NODE) {
  if (IS_WIN && process.arch === 'x64') {
    fs.mkdirSync(path.join(STAGE, 'node'));
    fs.copyFileSync(process.execPath, path.join(STAGE, 'node', 'node.exe'));
    console.log(`      Da kem node.exe ${process.version} - may cai dat KHONG can cai Node.js`);
  } else {
    console.log('      (Khong phai Windows x64 - bo qua kem node.exe)');
  }
}

// ---------- [4] Nen zip (ban giai nen - nang cao) ----------
console.log('[4/5] Nen file zip (ban giai nen)...');
let zipped = false;
if (IS_WIN) {
  // tar.exe (bsdtar) co san tu Windows 10 1803 - nhanh hon Compress-Archive nhieu
  zipped = run('tar', ['-a', '-c', '-f', ZIP, '-C', OUT, PKG_NAME]);
  if (!zipped) {
    fs.rmSync(ZIP, { force: true });
    zipped = run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `Compress-Archive -Path '${STAGE}' -DestinationPath '${ZIP}' -Force`]);
  }
} else {
  zipped = run('zip', ['-qr', ZIP, PKG_NAME], { cwd: OUT });
}
if (!zipped || !fs.existsSync(ZIP)) fail('Nen zip that bai.');

// ---------- [5] Bo cai dat Setup.exe (NSIS) ----------
console.log('[5/5] Tao bo cai dat Setup.exe (NSIS)...');
const SETUP = path.join(OUT, `${ASSET_NAME}-Setup-${VERSION}.exe`);
const makensis = findMakensis();
if (!makensis) {
  fail('Khong tim thay NSIS (makensis) de tao bo cai dat.\n' +
    '     Cai 1 lan: winget install NSIS.NSIS   (hoac tai https://nsis.sourceforge.io/Download)\n' +
    '     roi chay lai. (Da tung build widget bang electron-builder tren may nay thi thuong da co san.)');
}
console.log(`      makensis: ${makensis}`);
const nsisArgs = [
  '-V2', '-INPUTCHARSET', 'UTF8',
  `-DVERSION=${VERSION}`,
  `-DSTAGE=${STAGE}`,
  `-DOUTFILE=${SETUP}`,
  `-DICON=${path.join(ROOT, 'installer', 'icon.ico')}`,
];
if (fs.existsSync(path.join(STAGE, 'node', 'node.exe'))) nsisArgs.push('-DHAS_NODE');
nsisArgs.push(path.join(ROOT, 'installer', 'server-installer.nsi'));
if (!run(makensis, nsisArgs, { shell: false })) fail('Tao bo cai dat that bai (xem loi makensis o tren).');

for (const f of [SETUP, ZIP]) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  fs.writeFileSync(`${f}.sha256`, `${hash}  ${path.basename(f)}\n`);
}
fs.rmSync(STAGE, { recursive: true, force: true }); // chi giu lai file de upload

for (const f of [SETUP, ZIP]) {
  const mb = (fs.statSync(f).size / 1024 / 1024).toFixed(1);
  console.log(`      ${path.relative(ROOT, f)} (${mb} MB)`);
}

/**
 * Tim makensis: bien MAKENSIS -> PATH -> thu muc cai NSIS mac dinh -> bo NSIS ma electron-builder
 * da tai ve khi build widget (%LOCALAPPDATA%\electron-builder\Cache\nsis) -> tu cai qua winget.
 */
function findMakensis() {
  const exe = IS_WIN ? 'makensis.exe' : 'makensis';
  const candidates = [];
  if (process.env.MAKENSIS) candidates.push(process.env.MAKENSIS);
  for (const dir of (process.env.PATH || '').split(path.delimiter)) if (dir) candidates.push(path.join(dir, exe));
  if (IS_WIN) {
    for (const base of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles]) {
      if (base) candidates.push(path.join(base, 'NSIS', 'makensis.exe'), path.join(base, 'NSIS', 'Bin', 'makensis.exe'));
    }
    const cache = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'nsis');
    if (fs.existsSync(cache)) {
      for (const d of fs.readdirSync(cache)) {
        candidates.push(path.join(cache, d, 'makensis.exe'), path.join(cache, d, 'Bin', 'makensis.exe'));
      }
    }
  }
  const found = candidates.find((c) => { try { return fs.statSync(c).isFile(); } catch { return false; } });
  if (found || !IS_WIN || process.env.NO_AUTO_INSTALL_NSIS) return found || null;
  // Tu cai NSIS qua winget (co san tren Windows 10/11) - chi 1 lan
  console.log('      Chua co NSIS - dang tu cai qua winget (NSIS.NSIS)...');
  if (run('winget', ['install', '--id', 'NSIS.NSIS', '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements'])) {
    process.env.NO_AUTO_INSTALL_NSIS = '1';
    return findMakensis();
  }
  return null;
}
