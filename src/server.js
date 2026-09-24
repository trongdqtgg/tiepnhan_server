const path = require('path');
const { getAppRoot } = require('./config/appRoot');

// Doc file .env NGAY TAI GOC UNG DUNG (khong phai cwd hien tai, co the khac nhau tuy cach chay -
// xem giai thich chi tiet trong src/config/appRoot.js) - quan trong nhat khi dong goi thanh 1 file
// .exe DUY NHAT (xem packaging/exe-build/): .env van la file RIENG nam CANH file .exe, KHONG duoc
// nhung vao ben trong .exe, de quan tri vien tu do sua cau hinh ma khong can dong goi lai.
require('dotenv').config({ path: path.join(getAppRoot(), '.env') });

// Kiem tra som: he thong dung node:sqlite co san trong Node.js (tu ban 22.5+), khong can
// cai dat native module nao. Neu Node qua cu se bao loi ro rang thay vi loi kho hieu ve sau.
try {
  require('node:sqlite');
} catch {
  console.error(
    '\n[LỖI] Phiên bản Node.js hiện tại chưa hỗ trợ "node:sqlite".\n' +
      'Vui lòng cài Node.js bản 22.5.0 trở lên (khuyến nghị bản LTS mới nhất) rồi chạy lại "npm start".\n' +
      'Kiểm tra phiên bản đang dùng bằng lệnh: node -v\n'
  );
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');

const { connectDB, getDB } = require('./config/db');
const { getDisplaySummary } = require('./services/ticketService');
const { getEffectiveDay } = require('./services/sequenceService');
const { cleanupOldData } = require('./services/cleanupService');
const { isValidSession } = require('./services/authService');

const ticketsRouter = require('./routes/tickets');
const countersRouter = require('./routes/counters');
const displayRouter = require('./routes/display');
const authRouter = require('./routes/auth');
const priorityRulesRouter = require('./routes/priorityRules');
const serverInfoRouter = require('./routes/serverInfo');
const kioskConfigRouter = require('./routes/kioskConfig');
const brandingRouter = require('./routes/branding');
const patientScreenManifestRouter = require('./routes/patientScreenManifest');

async function main() {
  const app = express();
  const server = http.createServer(app);
  /**
   * Theo phan anh: "File server ở máy người dùng báo lỗi localhost:4000/socket.io.ks net
   * err_emty_response io is not defined" - doc lai chinh xac la trinh duyet bao
   * `net::ERR_EMPTY_RESPONSE` khi tai file client cua Socket.IO, roi VI THU VIEN CHUA TAI DUOC nen
   * bien global `io` khong ton tai, dan toi loi JS tiep theo "io is not defined" khi cac trang goi
   * `io()` de ket noi. `ERR_EMPTY_RESPONSE` (ket noi TCP thanh cong nhung server dong ket noi ma
   * KHONG tra ve du lieu nao) - kem viec nguoi dung xac nhan DAY LA CUNG 1 MAY khach hang da tung
   * nghi ngo bi phan mem diet virus can thiep (muc 70), VA loi nay xay ra LUON LUON/100%, trong
   * khi cua so dong lenh chay server VAN MO BINH THUONG, KHONG co dong log loi nao (yeu cau CHUA
   * TUNG toi duoc toi Node.js/Express - bi chan tu ben ngoai) - rat khop voi kha nang 1 so phan
   * mem diet virus/tuong lua/proxy loc web co QUY TAC LOC/CHAN THEO TU KHOA "socket.io" xuat hien
   * trong URL (thu vien Socket.IO rat pho bien, mot so AV/proxy doanh nghiep co san chu ky/luat
   * chan).
   *
   * LAN SUA DAU TIEN (muc 72) chi doi TIEN TO duong dan (`path: '/rt-bridge/socket.io/'`) - VAN
   * CHUA DU, boi vi phat hien ra: thu vien Socket.IO (`node_modules/socket.io/dist/index.js`, ham
   * `path()`) LUON LUON tu dong ghep CO DINH hau to "/socket\.io(...)?.js" vao SAU gia tri `path`
   * bat ke `path` duoc dat la gi, de tu phuc vu file client cua no - nghia la URL cuoi cung LUON
   * LUON con nguyen chu "socket.io.js" trong do (vi du "/rt-bridge/socket.io/socket.io.js" - VAN
   * chua dung tu khoa "socket.io" y het truoc), khong the doi ten hau to nay qua cau hinh - CHINH
   * la ly do nguoi dung xac nhan qua anh chup Console (F12) van thay DUNG loi
   * `net::ERR_EMPTY_RESPONSE` tren `/rt-bridge/socket.io/socket.io.js` sau khi da cap nhat ban vá
   * lan 1.
   *
   * CACH SUA LAN NAY (triet de hon): TAT han tinh nang tu phuc vu file client cua Socket.IO
   * (`serveClient: false`), roi TU TAY phuc vu 1 BAN SAO tinh cua dung file do duoi 1 TEN HOAN TOAN
   * KHONG CHUA chu "socket"/"io" nao ca - dat san trong `public/vendor/rt-client.js` (xem
   * `express.static(...public...)` da co san ben duoi, dung CHUNG co che phuc vu file tinh on dinh
   * da dung cho moi packaging - Inno Setup/SEA/npm start - THAY VI dua vao co che tu phuc vu rieng
   * cua thu vien Socket.IO, von LUON gan chet ten "socket.io.js"). `path` (dung cho DUONG DAN THAT
   * SU cua ket noi realtime/polling/websocket, KHONG lien quan gi toi ten file .js) van giu
   * "/rt-bridge/" nhu cu - phan nay da dung, khong chua chu "socket.io" nao.
   */
  const io = new Server(server, { cors: { origin: '*' }, path: '/rt-bridge/', serveClient: false });

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // TAT CA cac man hinh (quay tiep nhan, kiosk cap nhan vien, kiosk boc so cho benh nhan, man
  // hinh benh nhan tai quay, man hinh cho goi so) deu yeu cau da dang nhap bang mat khau nhan
  // vien (STAFF_PASSWORD trong .env) truoc khi vao duoc - trang chu "/" (man hinh dang nhap) va
  // cac tai nguyen PWA cong khai (manifest.json/sw.js/icon) la ngoai le duy nhat, xem ben duoi.
  //
  // Cac man hinh dang kiosk/TV (khong co ban phim vat ly) dang nhap bang cach QUET MA QR co san
  // (encode san mat khau STAFF_PASSWORD) vao 1 input an luon focus san tren trang dang nhap -
  // xem scanInput trong public/index.html - thay vi go tay.
  // /patient-screen va /waiting-screen la 2 man hinh CHI XEM (khong co thao tac gi nhay cam - chi
  // hien so dang goi, doc bang tieng...), nen KHONG yeu cau dang nhap nua (truoc day co gate nham
  // theo cung danh sach voi cac man hinh thao tac khac) - giup dat/mo nhanh cac man hinh TV/man
  // hinh phu ma khong phai quet QR/nhap mat khau nhan vien truoc.
  // MUC 98 - '/staff-printer' (man hinh IN LAI phieu da cap cho nhan vien) THEM VAO danh sach
  // gated nay - cung yeu cau dang nhap nhu /staff-kiosk/counter/counter-admin, vi co the xem lai
  // ten/ngay sinh benh nhan da quet truoc do (thong tin nhay cam, khong phai man hinh cong khai).
  const GATED_PATH_PREFIXES = ['/counter', '/staff-kiosk', '/kiosk', '/counter-admin', '/staff-printer'];
  // BYPASS RIENG cho /kiosk (man hinh boc so cho BENH NHAN - khong co thao tac nhay cam, chi bam
  // nut lay so) - theo yeu cau nguoi dung: widget PHAI luon vao thang duoc man hinh nay ma KHONG
  // can dang nhap chon quay, DU server co bi restart (session dang nhap luu trong bo nho RAM, xem
  // authService.js, se MAT het khi restart) hay tat/mo lai widget (truoc day dua vao cookie dang
  // nhap luu tren dia trong widget - van bi "mo lai tu dau" neu nguoi dung/IT xoa du lieu widget,
  // hoac neu server restart giua chung thi cookie con nhung session phia server da mat). Co che
  // moi: 1 "chia khoa" rieng (KHONG phai mat khau nhan vien, KHONG dung cookie/session) gui kem
  // qua header HTTP tren MOI request toi /kiosk - widget tu dong dinh kem header nay (xem
  // electron-widget/main.js, onBeforeSendHeaders tren session cua kioskWindow) nen luon vao duoc
  // NGAY CA server vua khoi dong lai (khong con session nao) hay widget vua mo lai (khong con
  // cookie nao). CHI ap dung cho DUY NHAT "/kiosk" (dung nhu pham vi nguoi dung yeu cau: "màn hình
  // kiosk cấp số cho bệnh nhân") - KHONG anh huong /staff-kiosk, /counter, /counter-admin (van bat
  // buoc dang nhap nhu cu, vi cac man hinh do co thao tac nhay cam: xem thong tin benh nhan, cap
  // so, cai dat...).
  //
  // Gia tri mac dinh duoc dat san (khong bat buoc cau hinh .env) de "chay duoc ngay" dung tinh
  // than yeu cau ("bắt buộc phải bỏ qua") - co the doi qua KIOSK_WIDGET_SECRET trong .env neu muon
  // that chat hon (vi du: may chu dat o noi co the bi truy cap tu ben ngoai LAN noi bo). Luu y day
  // la 1 danh doi bao mat CO CHU DICH: bat ky ai biet "chia khoa" nay (mac dinh neu khong doi) VA
  // truy cap duoc dia chi server co the vao thang /kiosk ma khong can mat khau nhan vien - nhung
  // ban than /kiosk von di khong lo thong tin nhay cam (chi la man hinh bam nut lay so cong khai,
  // dung dat ngay tai sanh cho benh nhan tu bam), nen day la danh doi hop ly theo dung yeu cau.
  const DEFAULT_KIOSK_WIDGET_SECRET = 'queue-widget-kiosk-2024';
  function getKioskWidgetSecret() {
    const raw = process.env.KIOSK_WIDGET_SECRET;
    return (typeof raw === 'string' && raw.trim()) ? raw.trim() : DEFAULT_KIOSK_WIDGET_SECRET;
  }
  function isKioskPath(p) {
    return p === '/kiosk' || p.startsWith('/kiosk/');
  }
  function hasValidKioskWidgetSecret(req) {
    const header = req.headers['x-kiosk-widget-secret'];
    return typeof header === 'string' && header === getKioskWidgetSecret();
  }
  // manifest.json/icons/sw.js cua tung trang PHAI la file CONG KHAI - trinh duyet (va he dieu
  // hanh, khi kiem tra "co du dieu kien cai vao man hinh chinh" khong) tu dong tai cac file nay
  // bat ky luc nao (ke ca truoc khi dang nhap), khong kem theo cookie dang nhap; neu chan o day
  // thi PWA se KHONG BAO GIO cai duoc (luon nhan ve trang dang nhap thay vi manifest.json that),
  // ke ca sau khi da dang nhap that.
  const PUBLIC_PWA_ASSET_PATHS = new Set([
    '/staff-kiosk/manifest.json', '/staff-kiosk/sw.js',
    '/counter/manifest.json', '/counter/sw.js',
    '/kiosk/manifest.json', '/kiosk/sw.js',
    '/patient-screen/manifest.json', '/patient-screen/sw.js',
    '/waiting-screen/manifest.json', '/waiting-screen/sw.js',
  ]);
  const PUBLIC_PWA_ASSET_PREFIXES = ['/staff-kiosk/icons/', '/counter/icons/'];

  function isGatedPath(p) {
    // "/counter/widget" la trang widget SIEU NHO (danh cho ung dung desktop Electron luon-noi-
    // ben-tren) - KHONG chan bang staff_token o day, vi ban than trang nay khong lo gi nhay cam
    // (chi goi cac API cong khai san co nhu /api/counters/:id/current, /api/priority-rules...) va
    // can mo duoc ngay ca truoc khi dang nhap de nguoi dung con thay nut ⚙️ dan vao trang dang
    // nhap/quan ly day du (van bi chan binh thuong o nhanh ben duoi).
    if (p === '/counter/widget' || p.startsWith('/counter/widget/')) return false;
    if (PUBLIC_PWA_ASSET_PATHS.has(p)) return false;
    if (PUBLIC_PWA_ASSET_PREFIXES.some((prefix) => p.startsWith(prefix))) return false;
    return GATED_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
  }
  // Chan truy cap tren DIEN THOAI/MAY TINH BANG cho 3 man hinh chi danh cho thiet bi chuyen
  // dung (man hinh cham lon dat co dinh tai kiosk/quay tiep nhan) - dung UserAgent de nhan biet,
  // don gian nhung du dung cho da so truong hop thuc te. Kiem tra o day (TRUOC ca gate dang nhap)
  // de chan som, khong phu thuoc trang thai dang nhap.
  const DEVICE_BLOCKED_PATHS = ['/kiosk', '/counter', '/patient-screen'];
  function isMobileOrTabletUA(ua) {
    if (!ua) return false;
    return /Mobi|Android|iPhone|iPad|iPod|Tablet|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(ua);
  }
  function isDeviceBlockedPath(p) {
    // "/counter/widget" la widget rieng cho ung dung desktop Electron, khong nam trong pham vi
    // chan nay (van bi gate dang nhap binh thuong o nhanh ben duoi, tru truong hop da duoc mien).
    if (p === '/counter/widget' || p.startsWith('/counter/widget/')) return false;
    return DEVICE_BLOCKED_PATHS.some((base) => p === base || p === base + '/');
  }
  function deviceBlockedHtml() {
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Không hỗ trợ thiết bị này</title>
<link rel="stylesheet" href="/common.css" /></head>
<body><div class="device-block-wrap"><div class="card device-block-card">
<div class="device-block-icon"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="3" y1="3" x2="21" y2="17"/></svg></div>
<h1 style="font-size:18px;">Màn hình này chỉ hỗ trợ máy tính/thiết bị chuyên dụng</h1>
<div class="sub" style="margin-bottom:0;">Vui lòng mở trên máy tính hoặc màn hình cảm ứng chuyên dụng đặt tại kiosk/quầy tiếp nhận, không hỗ trợ điện thoại hoặc máy tính bảng cá nhân.</div>
</div></div></body></html>`;
  }
  app.use((req, res, next) => {
    if (isDeviceBlockedPath(req.path) && isMobileOrTabletUA(req.headers['user-agent'])) {
      return res.status(403).send(deviceBlockedHtml());
    }
    next();
  });

  app.use((req, res, next) => {
    if (isGatedPath(req.path) && !isValidSession(req.cookies?.staff_token)) {
      // BYPASS rieng cho /kiosk qua "chia khoa" header - xem giai thich chi tiet o dinh nghia
      // DEFAULT_KIOSK_WIDGET_SECRET/hasValidKioskWidgetSecret ben tren. Kiem tra TRUOC khi redirect
      // ve trang dang nhap, va CHI cho pham vi isKioskPath (khong mo rong sang cac man hinh gated
      // khac dung chung middleware nay).
      if (isKioskPath(req.path) && hasValidKioskWidgetSecret(req)) {
        return next();
      }
      // Giu lai NGUYEN VEN duong dan + query goc (vi du "/patient-screen/?counter=3") de sau khi
      // dang nhap thanh cong co the dua thang nguoi dung ve dung man hinh ho dinh vao, thay vi
      // luon ve trang chon vai tro.
      return res.redirect(`/?next=${encodeURIComponent(req.originalUrl)}`);
    }
    next();
  });

  // Phai mount TRUOC express.static ben duoi, vi manifest.json cua /patient-screen can duoc SINH
  // DONG (giu lai ?counter=ID) - dat truoc de route nay luon duoc uu tien, khong phu thuoc vao
  // viec co ton tai file tinh trung ten hay khong.
  app.use('/patient-screen', patientScreenManifestRouter());

  app.use(express.static(path.join(getAppRoot(), 'public')));

  connectDB();
  const db = getDB();

  const retentionDays = Number(process.env.DATA_RETENTION_DAYS || 3);
  // Don du lieu cu ngay luc khoi dong, roi lap lai moi gio (SQLite khong co TTL tu dong nhu Mongo,
  // nen phai tu quan ly viec don dep nay).
  cleanupOldData(db, retentionDays);
  setInterval(() => cleanupOldData(db, retentionDays), 60 * 60 * 1000);

  app.use('/api/tickets', ticketsRouter(io));
  app.use('/api/counters', countersRouter(io));
  app.use('/api/display', displayRouter());
  app.use('/api/auth', authRouter());
  app.use('/api/priority-rules', priorityRulesRouter());
  app.use('/api/server-info', serverInfoRouter());
  app.use('/api/kiosk-config', kioskConfigRouter());
  app.use('/api/branding', brandingRouter());

  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

  /**
   * Theo phan anh cua nguoi dung: "cài trên máy khách hàng nó báo lỗi IO" - kiem tra ky hoa ra
   * KHONG PHAI loi trinh cai dat, ma la loi khi VAO trang /counter/ (man hinh quan ly quay tiep
   * nhan) - tuc la server ĐÃ chay binh thuong (khoi dong duoc, cac trang web tai duoc), nhung 1
   * THAO TAC DOC/GHI CO SO DU LIEU SQLite (data/queue.db) SAU DO bi loi (rat co the la
   * SQLITE_IOERR/EACCES/EPERM - lien quan quyen truy cap thu muc data\, hoac phan mem diet virus/
   * Windows Defender "Kiểm soát truy cập thư mục được kiểm soát" dang khoa/chan node.exe ghi vao
   * thu muc cai dat tren MAY KHACH HANG cu the - khong xay ra tren may cua chinh nguoi dung vi may
   * do co the da duoc them ngoai le/khong bat tinh nang do).
   *
   * TRUOC DAY: KHONG CO middleware xu ly loi (error-handling middleware, ham co 4 tham so) nao ca -
   * khi 1 route (vi du GET /api/counters trong counters.js) NEM LOI dong bo (throw, khong co
   * try/catch rieng) do thao tac DB that bai, Express se tu dong chuyen loi do sang trinh xu ly loi
   * MAC DINH cua no - tra ve 1 trang LOI DANG HTML (khong phai JSON) - phia client (public/counter/
   * counter.js, vi du loadSkippedModal()/loadCalledModal()) dang goi `res.json()` de doc du lieu,
   * gap trang HTML nay se NEM LOI PARSE JSON, roi vao khoi `catch` chi hien 1 dong chung chung
   * "Không tải được danh sách, vui lòng thử lại." - dung LA trieu chung "ko load được dữ liệu" nguoi
   * dung mo ta, nhung KHONG HE co dong log/thong bao nao chi ro NGUYEN NHAN THAT SU (loi DB kieu
   * gi, lien quan quyen/antivirus hay khong) o ca 2 phia (server console lan man hinh trinh duyet),
   * rat kho chan doan tu xa qua dien thoai/Zalo voi khach hang.
   *
   * THEM MOI: 1 error-handling middleware CHUNG (dat SAU CUNG, sau tat ca cac route o tren) - bat
   * MOI loi chua duoc cac route tu xu ly (ca loi DB), GHI LOG chi tiet + GOI Y NGUYEN NHAN/CACH XU
   * LY ngay trong console server (huu ich khi remote/nho khach hang doc log giup), VA tra ve dung
   * dinh dang JSON (thay vi trang HTML mac dinh cua Express) de client van doc duoc phan hoi, hien
   * dung thong bao thay vi loi parse JSON kho hieu.
   */
  app.use((err, req, res, next) => {
    const message = String((err && err.message) || err);
    // Cac ma loi/cum tu thuong gap khi SQLite (hoac he dieu hanh) tu choi doc/ghi file: IOERR (loi
    // doc/ghi o dia that su, hay gap nhat khi antivirus dang QUET/KHOA file .db-wal/.db-shm ngay
    // luc ghi), CANTOPEN (khong mo duoc file, thuong do duong dan sai/bi xoa), EACCES/EPERM (thieu
    // quyen he dieu hanh, thuong do cai vao thu muc bi khoa hoac Windows Defender "Kiểm soát truy
    // cập thư mục được kiểm soát" chan node.exe).
    const isIoLikeError = /SQLITE_IOERR|SQLITE_CANTOPEN|SQLITE_READONLY|EACCES|EPERM|disk I\/O error|unable to open database/i.test(message);
    console.error(`[LỖI SERVER] ${req.method} ${req.originalUrl} — ${message}`);
    if (err && err.stack) console.error(err.stack);
    if (isIoLikeError) {
      console.error(
        '  ↳ NGHI NGỜ đây là lỗi ĐỌC/GHI Ổ ĐĨA hoặc THIẾU QUYỀN TRUY CẬP khi thao tác với file cơ sở\n' +
          '    dữ liệu SQLite (thư mục "data" cạnh nơi cài đặt hệ thống). Các nguyên nhân THƯỜNG GẶP\n' +
          '    NHẤT (đặc biệt nếu chỉ xảy ra ở máy khách hàng, KHÔNG xảy ra ở máy của bạn):\n' +
          '    1) Phần mềm diệt virus / Windows Defender ("Kiểm soát truy cập thư mục được kiểm soát" -\n' +
          '       Controlled folder access) đang CHẶN chương trình ghi vào thư mục cài đặt trên MÁY ĐÓ -\n' +
          '       cần thêm ngoại lệ (exception/exclusion) cho thư mục cài đặt (mặc định "C:\\HeThongBatSo")\n' +
          '       trong phần mềm diệt virus của máy khách hàng.\n' +
          '    2) Thư mục cài đặt/thư mục "data" bị THIẾU QUYỀN GHI cho tài khoản Windows đang đăng nhập\n' +
          '       (ví dụ do copy tay thư mục sang thay vì dùng đúng trình cài đặt HeThongBatSo-Setup-\n' +
          '       ....exe - trình cài đặt tự cấp quyền "Users - Modify" cho thư mục cài đặt, xem mục\n' +
          '       [Dirs] trong packaging/windows-installer/HeThongBatSo.iss) - nên gỡ và cài lại ĐÚNG\n' +
          '       bằng trình cài đặt.\n' +
          '    3) Thư mục cài đặt nằm trong 1 thư mục đang được đồng bộ đám mây (OneDrive/Google Drive/\n' +
          '       Dropbox...) - phần mềm đồng bộ có thể khoá file tạm thời trong lúc đồng bộ, gây lỗi\n' +
          '       đọc/ghi ngắt quãng - nên cài vào ổ đĩa cục bộ thông thường, không đặt trong thư mục\n' +
          '       đồng bộ đám mây.\n'
      );
    }
    if (res.headersSent) return next(err);
    res.status(500).json({
      error: isIoLikeError
        ? 'Không đọc/ghi được dữ liệu (nghi ngờ do phần mềm diệt virus hoặc thiếu quyền truy cập thư mục cài đặt) - vui lòng báo quản trị viên kiểm tra, xem hướng dẫn trong log máy chủ.'
        : 'Đã có lỗi xảy ra ở máy chủ, vui lòng thử lại.',
    });
  });

  io.on('connection', (socket) => {
    // Gui ngay trang thai hien tai cho client vua ket noi, khong can doi den thay doi tiep theo
    try {
      const summary = getDisplaySummary(db, getEffectiveDay(db));
      socket.emit('queue:summary', summary);
    } catch (err) {
      console.error('[SOCKET] Lỗi gửi summary ban đầu:', err.message);
    }
  });

  // Luoi an toan: cu moi vai giay lai bao cao toan bo trang thai cho tat ca man hinh,
  // phong truong hop mot socket event nao do bi rot (mat mang tam thoi, v.v.).
  setInterval(() => {
    try {
      const summary = getDisplaySummary(db, getEffectiveDay(db));
      io.emit('queue:summary', summary);
    } catch (err) {
      console.error('[BROADCAST] Lỗi:', err.message);
    }
  }, 4000);

  const desiredPort = parseInt(process.env.PORT, 10) || 4000;
  // Số lần thử cổng kế tiếp (desiredPort+1, +2, ...) nếu cổng cấu hình trong .env đã bị chiếm,
  // trước khi bỏ cuộc hẳn. Không thử vô hạn để tránh treo app im lặng.
  const MAX_PORT_FALLBACK_ATTEMPTS = 10;

  function printReadyBanner(port) {
    console.log(`\n[OK] Hệ thống bắt số đang chạy tại http://localhost:${port}`);
    console.log(`  - Trang chủ (chọn Bệnh nhân / Nhân viên): http://localhost:${port}/`);
    console.log(`  - Kiosk bốc số (bệnh nhân, cần quét CCCD/BHYT): http://localhost:${port}/kiosk`);
    console.log(`  - Kiosk cấp số (NV, cần mật khẩu, cấp mọi loại kể cả Cấp cứu): http://localhost:${port}/staff-kiosk`);
    console.log(`  - Màn hình quầy (NV, cần mật khẩu): http://localhost:${port}/counter`);
    console.log(`  - Màn hình bệnh nhân:  http://localhost:${port}/patient-screen?counter=<ID_QUAY>`);
    console.log(`  - Màn hình chờ chung:  http://localhost:${port}/waiting-screen\n`);
    if (port !== desiredPort) {
      console.log(`[LƯU Ý] Cổng cấu hình trong .env (PORT=${desiredPort}) đang bị chương trình khác chiếm dụng,`);
      console.log(`  nên hệ thống đã TỰ ĐỘNG chuyển sang chạy ở cổng ${port} thay thế.`);
      console.log(`  Mọi màn hình/link đã lưu sẵn theo cổng ${desiredPort} (bookmark, mã QR, icon Desktop trỏ`);
      console.log(`  thẳng tới patient-screen...) sẽ KHÔNG còn đúng nữa cho tới khi bạn xử lý bằng 1 trong 2 cách:`);
      console.log(`    1) Tắt chương trình đang chiếm cổng ${desiredPort} rồi khởi động lại He Thống Bắt Số, hoặc`);
      console.log(`    2) Sửa PORT=${port} (hoặc cổng trống khác) trong file .env để cố định lâu dài, rồi cập nhật`);
      console.log(`       lại các link/mã QR đã phát cho phù hợp.\n`);
    }
  }

  function tryListen(port, attemptsLeft) {
    const onError = (err) => {
      server.removeListener('error', onError);
      if (err.code === 'EADDRINUSE') {
        if (attemptsLeft > 0) {
          console.warn(`[CẢNH BÁO] Cổng ${port} đang bị chương trình khác chiếm dụng, thử cổng ${port + 1}...`);
          tryListen(port + 1, attemptsLeft - 1);
        } else {
          console.error(`\n[LỖI] Không tìm được cổng trống nào trong khoảng ${desiredPort}-${port} để khởi động server.`);
          console.error(`  Cổng ${desiredPort} (và ${MAX_PORT_FALLBACK_ATTEMPTS} cổng kế tiếp) đều đang bị chiếm dụng bởi`);
          console.error(`  chương trình khác trên máy này.`);
          console.error(`  Cách khắc phục: đóng bớt chương trình đang dùng các cổng đó, hoặc sửa PORT=<cổng khác>`);
          console.error(`  trong file .env rồi khởi động lại.\n`);
          process.exit(1);
        }
      } else {
        console.error('[FATAL] Lỗi khởi động server:', err.message);
        process.exit(1);
      }
    };
    server.once('error', onError);
    server.listen(port, () => {
      server.removeListener('error', onError);
      printReadyBanner(port);
    });
  }

  tryListen(desiredPort, MAX_PORT_FALLBACK_ATTEMPTS);
}

main().catch((err) => {
  console.error('[FATAL] Không khởi động được server:', err);
  process.exit(1);
});
