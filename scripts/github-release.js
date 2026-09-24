#!/usr/bin/env node
/**
 * Tao GitHub Release v<version> va upload moi file trong thu muc release/ (goi tu
 * build-and-publish.bat sau khi scripts/build-release.js chay xong).
 *
 * Cau hinh repo: package.json -> build.publish[0] { provider: "github", owner, repo } (cung kieu
 * electron-builder). Token: bien moi truong GH_TOKEN (quyen "Contents: Read and write" voi repo).
 * Khong can cai GitHub CLI - goi thang GitHub REST API bang fetch co san cua Node.js.
 *
 * Quy trinh: tao release o dang NHAP -> upload du file -> moi cong khai (khong ai tai phai release
 * thieu file). Release/tag v<version> da ton tai -> dung lai, bao tang version.
 * Ghi chu phat hanh: RELEASE_NOTES.md (neu co) hoac tu sinh.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const pub = pkg.build && Array.isArray(pkg.build.publish) ? pkg.build.publish[0] : null;
const API = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
const UPLOADS = (process.env.GITHUB_UPLOADS_URL || 'https://uploads.github.com').replace(/\/$/, '');
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const VERSION = pkg.version;
const TAG = `v${VERSION}`;
const OUT = path.join(ROOT, 'release');

function fail(msg) {
  console.error(`\nLOI: ${msg}`);
  process.exit(1);
}

if (!pub || pub.provider !== 'github' || !pub.owner || !pub.repo) {
  fail('package.json chua co build.publish[0] { "provider": "github", "owner": "...", "repo": "..." }');
}
if (!TOKEN) fail('Chua co GH_TOKEN.');
const REPO = `${pub.owner}/${pub.repo}`;

async function gh(method, url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'hethongbatso-release-script',
      ...(body && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body == null ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

function explain(r) {
  const msg = r.data && r.data.message ? r.data.message : String(r.data || '');
  if (r.status === 401) return 'GH_TOKEN khong hop le hoac da het han (401).';
  if (r.status === 403) return `Token khong du quyen ghi vao ${REPO} (403): ${msg}`;
  if (r.status === 404) return `Khong tim thay repo ${REPO} hoac token khong co quyen truy cap (404).`;
  return `${r.status} ${msg}`;
}

(async () => {
  const files = fs.existsSync(OUT)
    ? fs.readdirSync(OUT).map((f) => path.join(OUT, f)).filter((f) => fs.statSync(f).isFile())
    : [];
  if (!files.length) fail('Thu muc release/ khong co file nao - chay scripts/build-release.js truoc.');

  console.log(`Kiem tra repo ${REPO}...`);
  const repo = await gh('GET', `${API}/repos/${REPO}`);
  if (!repo.ok) fail(explain(repo));

  const existing = await gh('GET', `${API}/repos/${REPO}/releases/tags/${TAG}`);
  if (existing.ok) fail(`Release ${TAG} da ton tai tren ${REPO}. Hay tang "version" trong package.json roi chay lai.`);
  // Ban nhap cu cung tag (lan truoc loi giua chung) -> xoa de tao lai sach se
  const list = await gh('GET', `${API}/repos/${REPO}/releases?per_page=50`);
  if (list.ok && Array.isArray(list.data)) {
    for (const r of list.data.filter((x) => x.draft && x.tag_name === TAG)) {
      console.log(`Xoa ban nhap cu ${TAG} (id ${r.id}) con sot tu lan truoc...`);
      await gh('DELETE', `${API}/repos/${REPO}/releases/${r.id}`);
    }
  }

  const notesFile = path.join(ROOT, 'RELEASE_NOTES.md');
  const zipName = files.map((f) => path.basename(f)).find((n) => n.endsWith('.zip')) || '';
  const body = fs.existsSync(notesFile)
    ? fs.readFileSync(notesFile, 'utf8')
    : [
        `Bản phát hành SERVER v${VERSION}`,
        '',
        `**Cài mới:** giải nén \`${zipName}\` vào ổ đĩa (vd \`D:\\HeThongBatSo\`), chạy \`install-autostart.bat\` 1 lần — server chạy nền ngay và **tự khởi động cùng Windows** (không cần đăng nhập). Sửa \`.env\` (mật khẩu, tên đơn vị) rồi chạy lại \`install-autostart.bat\`.`,
        '',
        '**Các file quản lý:** `status-server.bat` (xem trạng thái + log), `stop-server.bat` (dừng), `uninstall-autostart.bat` (tắt tự khởi động), `start-server.bat` (chạy có cửa sổ để xem lỗi).',
        '',
        '**Cập nhật:** chạy `stop-server.bat`, giải nén ĐÈ LÊN thư mục cũ, chạy lại `install-autostart.bat`. `.env`, `kiosk-questions.json` và thư mục `data\\` không nằm trong gói nên không bị ghi đè.',
      ].join('\n');

  console.log(`Tao release ${TAG} (dang nhap)...`);
  const created = await gh('POST', `${API}/repos/${REPO}/releases`, {
    tag_name: TAG,
    target_commitish: repo.data.default_branch,
    name: `Server ${TAG}`,
    body,
    draft: true,
  });
  if (!created.ok) {
    if (created.status === 422) {
      fail(`Khong tao duoc release (422): ${JSON.stringify(created.data && created.data.errors || created.data)}\n` +
        '     Thuong gap: repo chua co commit nao - hay tao repo kem file README roi chay lai.');
    }
    fail(explain(created));
  }
  const id = created.data.id;

  for (const f of files) {
    const name = path.basename(f);
    const buf = fs.readFileSync(f);
    process.stdout.write(`Upload ${name} (${(buf.length / 1024 / 1024).toFixed(1)} MB)... `);
    const type = name.endsWith('.zip') ? 'application/zip' : 'text/plain';
    const up = await gh('POST', `${UPLOADS}/repos/${REPO}/releases/${id}/assets?name=${encodeURIComponent(name)}`, buf, {
      'Content-Type': type,
      'Content-Length': String(buf.length),
    });
    if (!up.ok) {
      console.log('LOI');
      fail(`Upload ${name} that bai: ${explain(up)}. Release van o dang nhap - chay lai se tu xoa ban nhap nay.`);
    }
    console.log('xong');
  }

  const published = await gh('PATCH', `${API}/repos/${REPO}/releases/${id}`, { draft: false });
  if (!published.ok) fail(`Khong cong khai duoc release: ${explain(published)}`);
  console.log(`\nDa publish: ${published.data.html_url}`);
})().catch((err) => fail(err && err.message ? err.message : String(err)));
