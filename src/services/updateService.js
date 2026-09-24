const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { getAppRoot } = require('../config/appRoot');

/**
 * MUC 117 - Kiem tra & cap nhat SERVER tu GitHub Release.
 *
 * - CHAY NGAM: kiem tra 30 giay sau khi server khoi dong, sau do moi UPDATE_CHECK_INTERVAL_HOURS gio
 *   (mac dinh 6) - goi GitHub API /releases/latest cua repo trong package.json (build.publish[0]),
 *   hoac UPDATE_GITHUB_REPO=owner/repo trong .env. Loi mang (may chu khong co Internet) -> im lang,
 *   chi ghi nhan de hien khi nhan vien mo muc "Cap nhat phan mem".
 * - Cai dat: tai bo cai HeThongBatSo-Server-Setup-X.Y.Z.exe ve data\updates\, doi chieu SHA256 voi file
 *   .sha256 di kem release, roi chay bo cai IM LANG (/S) qua 1 tac vu Task Scheduler tach rieng
 *   (tai khoan SYSTEM) - KHONG chay truc tiep lam tien trinh con, vi bo cai se dung chinh server nay
 *   (va Task Scheduler ket thuc ca cay tien trinh cua tac vu server). Bo cai tu dung server, thay phan
 *   mem, giu .env/du lieu, roi tu chay lai server (xem installer/server-installer.nsi, MUC 116).
 * - Repo private: dat UPDATE_GITHUB_TOKEN (token chi can quyen doc Contents) trong .env.
 */
// UPDATE_GITHUB_API_URL: chi dung de tu kiem thu voi may chu gia lap (mac dinh GitHub that)
const API = (process.env.UPDATE_GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
const UPDATE_TASK = 'HeThongBatSo_Update';

const state = {
  enabled: true,
  repo: null,
  currentVersion: '0.0.0',
  latestVersion: null,
  updateAvailable: false,
  checkedAt: null,
  checking: false,
  error: null,
  release: null, // { name, tag, notes, url, publishedAt, setup: {name,url,apiUrl,size}, sha: {url,apiUrl} }
  installing: false,
  installStage: null,
  installError: null,
};

function readPackageJson() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getAppRoot(), 'package.json'), 'utf8'));
  } catch {
    return {};
  }
}

function loadConfig() {
  const pkg = readPackageJson();
  state.currentVersion = pkg.version || '0.0.0';
  const enabledRaw = (process.env.UPDATE_CHECK_ENABLED || 'true').trim().toLowerCase();
  state.enabled = !(enabledRaw === 'false' || enabledRaw === '0');
  let repo = (process.env.UPDATE_GITHUB_REPO || '').trim();
  if (!repo) {
    const pub = pkg.build && Array.isArray(pkg.build.publish) ? pkg.build.publish[0] : null;
    if (pub && pub.owner && pub.repo && !/^YOUR_/.test(pub.owner) && !/^YOUR_/.test(pub.repo)) {
      repo = `${pub.owner}/${pub.repo}`;
    }
  }
  state.repo = /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : null;
}

function token() {
  return (process.env.UPDATE_GITHUB_TOKEN || '').trim();
}

function headers(extra = {}) {
  const h = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'hethongbatso-server-updater',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
  if (token()) h.Authorization = `Bearer ${token()}`;
  return h;
}

/** So sanh "1.2.10" vs "1.2.9" -> 1 / 0 / -1 */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function publicStatus() {
  return {
    enabled: state.enabled,
    repo: state.repo,
    currentVersion: state.currentVersion,
    latestVersion: state.latestVersion,
    updateAvailable: state.updateAvailable,
    checkedAt: state.checkedAt,
    checking: state.checking,
    error: state.error,
    release: state.release
      ? {
          name: state.release.name,
          tag: state.release.tag,
          notes: state.release.notes,
          url: state.release.url,
          publishedAt: state.release.publishedAt,
          setupName: state.release.setup ? state.release.setup.name : null,
          setupUrl: state.release.setup ? state.release.setup.url : null,
          setupSize: state.release.setup ? state.release.setup.size : null,
        }
      : null,
    canAutoInstall: process.platform === 'win32' && !!(state.release && state.release.setup),
    installing: state.installing,
    installStage: state.installStage,
    installError: state.installError,
  };
}

async function checkNow() {
  loadConfig();
  if (!state.enabled) {
    state.error = 'Đã tắt kiểm tra cập nhật (UPDATE_CHECK_ENABLED=false trong .env).';
    return publicStatus();
  }
  if (!state.repo) {
    state.error = 'Chưa cấu hình repo GitHub (build.publish trong package.json hoặc UPDATE_GITHUB_REPO trong .env).';
    return publicStatus();
  }
  if (state.checking) return publicStatus();
  state.checking = true;
  try {
    const res = await fetch(`${API}/repos/${state.repo}/releases/latest`, {
      headers: headers(),
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 404) throw new Error('Repo chưa có bản phát hành nào (hoặc repo private mà thiếu UPDATE_GITHUB_TOKEN).');
    if (res.status === 401 || res.status === 403) throw new Error(`GitHub từ chối truy cập (${res.status}) - kiểm tra UPDATE_GITHUB_TOKEN.`);
    if (!res.ok) throw new Error(`GitHub trả về lỗi ${res.status}.`);
    const r = await res.json();
    const latest = String(r.tag_name || '').replace(/^v/i, '');
    const assets = Array.isArray(r.assets) ? r.assets : [];
    const setup = assets.find((a) => /-Setup-.*\.exe$/i.test(a.name)) || assets.find((a) => /\.exe$/i.test(a.name));
    const sha = setup ? assets.find((a) => a.name === `${setup.name}.sha256`) : null;
    state.latestVersion = latest || null;
    state.updateAvailable = !!latest && compareVersions(latest, state.currentVersion) > 0;
    state.release = {
      name: r.name || r.tag_name,
      tag: r.tag_name,
      notes: String(r.body || '').slice(0, 4000),
      url: r.html_url,
      publishedAt: r.published_at,
      setup: setup ? { name: setup.name, url: setup.browser_download_url, apiUrl: setup.url, size: setup.size } : null,
      sha: sha ? { url: sha.browser_download_url, apiUrl: sha.url } : null,
    };
    state.error = null;
    if (state.updateAvailable) {
      console.log(`[Cập nhật] Có phiên bản server mới v${latest} (đang chạy v${state.currentVersion}) - vào Trang chủ > Cập nhật phần mềm.`);
    }
  } catch (err) {
    const msg = err && err.name === 'TimeoutError' ? 'Hết thời gian chờ kết nối GitHub.' : (err && err.message) || String(err);
    state.error = /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(msg)
      ? 'Không kết nối được GitHub - máy chủ có thể không có Internet.'
      : msg;
  } finally {
    state.checking = false;
    state.checkedAt = new Date().toISOString();
  }
  return publicStatus();
}

async function download(asset) {
  // Repo private: tai qua API url + Accept octet-stream (can token); public: browser_download_url
  const useApi = !!token();
  const res = await fetch(useApi ? asset.apiUrl : asset.url, {
    headers: useApi ? headers({ Accept: 'application/octet-stream' }) : { 'User-Agent': 'hethongbatso-server-updater' },
    redirect: 'follow',
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!res.ok) throw new Error(`Tải ${asset.name || 'file'} thất bại (HTTP ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

/** Tai + kiem tra + chay bo cai im lang. Tra ve ngay sau khi da len lich chay bo cai. */
async function installUpdate() {
  if (process.platform !== 'win32') throw new Error('Tự cập nhật chỉ hỗ trợ máy chủ Windows.');
  if (state.installing) throw new Error('Đang cập nhật, vui lòng chờ.');
  if (!state.updateAvailable || !state.release || !state.release.setup) {
    throw new Error('Không có bản cập nhật có bộ cài Setup.exe - bấm "Kiểm tra ngay" trước.');
  }
  state.installing = true;
  state.installError = null;
  try {
    const rel = state.release;
    const dir = path.join(getAppRoot(), 'data', 'updates');
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) {
      try { fs.rmSync(path.join(dir, f), { force: true }); } catch { /* file dang bi khoa - bo qua */ }
    }

    state.installStage = `Đang tải ${rel.setup.name}...`;
    const buf = await download(rel.setup);
    if (rel.sha) {
      state.installStage = 'Đang kiểm tra toàn vẹn file (SHA256)...';
      const shaText = (await download({ ...rel.sha, name: `${rel.setup.name}.sha256` })).toString('utf8');
      const expected = (shaText.match(/[a-f0-9]{64}/i) || [])[0];
      const actual = crypto.createHash('sha256').update(buf).digest('hex');
      if (!expected || expected.toLowerCase() !== actual) {
        throw new Error('File tải về không khớp mã SHA256 (có thể bị hỏng khi tải) - đã huỷ, không cài.');
      }
    }
    const file = path.join(dir, rel.setup.name);
    fs.writeFileSync(file, buf);

    state.installStage = 'Đang chạy bộ cài đặt (máy chủ sẽ tự khởi động lại)...';
    // Tac vu rieng, chay bang SYSTEM - tach khoi cay tien trinh cua server (xem ghi chu dau file).
    // /sc once /st 00:00 chi de tao duoc tac vu, chay ngay bang /run ben duoi.
    const create = run('schtasks.exe', ['/create', '/tn', UPDATE_TASK, '/tr', `"${file}" /S`,
      '/sc', 'once', '/st', '00:00', '/ru', 'SYSTEM', '/rl', 'HIGHEST', '/f']);
    if (!create.ok) {
      throw new Error('Không tạo được tác vụ cài đặt - máy chủ đang chạy KHÔNG có quyền quản trị (vd chạy bằng '
        + 'start-server.bat). Hãy tải bộ cài về và chạy tay, hoặc cài bằng Setup.exe để máy chủ chạy nền. '
        + `Chi tiết: ${create.out.split('\n')[0]}`);
    }
    const start = run('schtasks.exe', ['/run', '/tn', UPDATE_TASK]);
    if (!start.ok) throw new Error(`Không chạy được bộ cài đặt: ${start.out.split('\n')[0]}`);
    console.log(`[Cập nhật] Đã chạy bộ cài ${rel.setup.name} - máy chủ sẽ dừng và tự khởi động lại bản v${state.latestVersion}.`);
    state.installStage = 'Đã chạy bộ cài - máy chủ sẽ dừng và khởi động lại trong 1-3 phút.';
    return publicStatus();
  } catch (err) {
    state.installing = false;
    state.installStage = null;
    state.installError = (err && err.message) || String(err);
    throw err;
  }
}

let started = false;
function startBackgroundChecks() {
  if (started) return;
  started = true;
  loadConfig();
  const hours = Number(process.env.UPDATE_CHECK_INTERVAL_HOURS);
  const intervalMs = (Number.isFinite(hours) && hours >= 1 ? hours : 6) * 60 * 60 * 1000;
  const tick = () => { if (state.enabled && state.repo) checkNow().catch(() => {}); };
  setTimeout(tick, 30 * 1000).unref();
  setInterval(tick, intervalMs).unref();
}

module.exports = { checkNow, installUpdate, publicStatus, startBackgroundChecks, compareVersions, loadConfig };
