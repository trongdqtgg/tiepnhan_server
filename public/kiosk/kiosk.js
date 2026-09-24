/**
 * "Che do Kiosk" - yeu cau trinh duyet vao toan man hinh (Fullscreen API) de an thanh dia chi
 * (URL bar) cua trinh duyet, tranh benh nhan nhin thay dia chi IP/localhost cua may chu dang
 * host web nay. Day la nut danh cho NHAN VIEN bam 1 LAN luc thiet lap may cho benh nhan dung,
 * khong phai thao tac ma benh nhan can quan tam.
 *
 * GIOI HAN QUAN TRONG (khong the khac phuc bang JS thuan, la gioi han bao mat chuan cua moi
 * trinh duyet): nguoi dung luon co the bam phim Esc de thoat toan man hinh. Neu can khoa may
 * kiosk chac chan hon (khong cho thoat, an ca thanh taskbar he dieu hanh...), nen dung che do
 * "kiosk" o cap trinh duyet/he dieu hanh (vi du chay Chrome voi co `--kiosk`) - xem huong dan
 * trong README.
 */
function toggleKioskFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {
      // Mot so trinh duyet/thiet bi khong cho phep (vi du thieu tuong tac nguoi dung truoc do) -
      // bo qua loi, nut van con de nguoi dung thu lai.
    });
  } else {
    document.exitFullscreen?.();
  }
}

document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('kioskModeBtn');
  if (!btn) return;
  btn.textContent = document.fullscreenElement ? '⤢' : '⛶';
  btn.title = document.fullscreenElement
    ? 'Thoát chế độ Kiosk (hoặc bấm phím Esc)'
    : 'Chế độ Kiosk (ẩn thanh địa chỉ trình duyệt) - dành cho nhân viên thiết lập máy';
});

// An han nut neu trinh duyet khong ho tro Fullscreen API (rat hiem, nhung de phong)
if (!document.documentElement.requestFullscreen) {
  document.getElementById('kioskModeBtn')?.style.setProperty('display', 'none');
}

/**
 * YEU CAU MAT KHAU NHAN VIEN TRUOC KHI ROI KHOI KIOSK: kiosk cong khai (/kiosk) hien dang duoc BAO
 * VE boi phien dang nhap nhan vien (staff_token, xem gate trong src/server.js) - nhan vien dang
 * nhap 1 LAN luc thiet lap may roi de benh nhan tu dung. Neu benh nhan (hoac ai do) bam nut Back
 * cua trinh duyet hoac nut Home 🏠, se roi khoi day - PHIEN BAN TRUOC chi chan CUNG nut Back (khong
 * cho di dau ca, "ket" luon tai kiosk) nen da ROLLBACK LAI: thay vi chan hoan toan, gio CHO PHEP
 * roi kiosk NHUNG bat buoc nhap dung mat khau nhan vien truoc (modal #staffExitModal trong
 * index.html) - dung mat khau moi thuc su dieu huong ve "/". Bam Back van bi CHAN NGAY LAP TUC (day
 * lai lich su nhu cu, khong cho trang thuc su lui) NHUNG kem theo mo modal xin mat khau thay vi im
 * lang nhu truoc.
 */
history.pushState(null, '', location.href);
window.addEventListener('popstate', () => {
  history.pushState(null, '', location.href); // van chan lui trang thuc su - chi "mo cua" qua modal mat khau
  requestStaffExit();
});

/**
 * Modal xin xac nhan nhan vien de roi khoi Kiosk - dung chung cho ca nut Home 🏠 va khi bam Back
 * trinh duyet (xem tren). CHI CHAP NHAN quet ma QR đang nhap nhanh (KHONG co o nhap mat khau bang
 * tay - kiosk cong khai von khong dung ban phim/chuot), va TU DONG DONG LAI + O NGUYEN TAI KIOSK
 * neu KHONG co lenh quet nao trong vong KIOSK_AUTO_CONFIRM_SECONDS giay (dung chung 1 cau hinh voi
 * cac buoc tu dong khac trong kiosk - bien `autoConfirmSeconds`, xem loadKioskConfig() ben duoi).
 * `staffExitModalOpen` dung de focusScanner() (dinh nghia ben duoi) biet duong focus vao o quet nao
 * (o quet CCCD/BHYT chinh, hay o quet rieng cua modal nay) trong vong lap setInterval() dung chung.
 */
let staffExitModalOpen = false;
let staffExitCountdownTimer = null;
let staffExitCountdownInterval = null;

function clearStaffExitCountdown() {
  clearTimeout(staffExitCountdownTimer);
  clearInterval(staffExitCountdownInterval);
  staffExitCountdownTimer = null;
  staffExitCountdownInterval = null;
}

function requestStaffExit() {
  const modal = document.getElementById('staffExitModal');
  const errBox = document.getElementById('staffExitError');
  const countdownEl = document.getElementById('staffExitCountdown');
  const scanEl = document.getElementById('staffExitScanInput');
  if (!modal) return;
  staffExitModalOpen = true;
  errBox.textContent = '';
  if (scanEl) scanEl.value = '';
  modal.style.display = 'flex';
  focusScanner();

  clearStaffExitCountdown();
  const seconds = autoConfirmSeconds > 0 ? autoConfirmSeconds : 5;
  let remaining = seconds;
  if (countdownEl) countdownEl.textContent = String(remaining);
  staffExitCountdownInterval = setInterval(() => {
    remaining -= 1;
    if (countdownEl) countdownEl.textContent = String(Math.max(remaining, 0));
  }, 1000);
  staffExitCountdownTimer = setTimeout(() => {
    // Het gio ma khong co lenh quet nao -> coi nhu KHONG muon roi kiosk, tu dong dong modal va o
    // lai man hinh Kiosk (khong dieu huong di dau ca).
    closeStaffExitModal();
  }, seconds * 1000);
}

function closeStaffExitModal() {
  const modal = document.getElementById('staffExitModal');
  if (modal) modal.style.display = 'none';
  staffExitModalOpen = false;
  clearStaffExitCountdown();
  focusScanner(); // tra focus ve o quet CCCD/BHYT chinh cua man hinh Kiosk
}

/**
 * Xac minh "mat khau" quet duoc tu ma QR đang nhap nhanh (dung lai API /api/auth/staff-login da co
 * san, cung API ma o quet o trang dang nhap "/" dung - xem scanLoginInput trong public/index.html)
 * - THANH CONG moi thuc su dieu huong ve "/". Viec dieu huong nay se tu kich hoat 'pagehide' ben
 * duoi -> dang xuat luon phien vua dang nhap - CHU Y CO CHU DICH: quet ma QR CHI DE duoc phep ROI
 * KHOI kiosk, khong phai de "mo khoa" ca phien lam viec sau do - neu muon vao /counter hay cac man
 * hinh khac, van can dang nhap lai 1 lan nua o man hinh chinh.
 */
async function submitStaffExit(password) {
  const errBox = document.getElementById('staffExitError');
  errBox.textContent = '';
  try {
    const res = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      errBox.textContent = 'Mã QR không đúng, vui lòng thử lại.';
      return;
    }
    clearStaffExitCountdown();
    location.href = '/';
  } catch {
    errBox.textContent = 'Không kết nối được máy chủ, vui lòng thử lại.';
  }
}

/**
 * MUC 92/93 - Modal chuyen NHANH sang Kiosk cap so - Nhan vien (/staff-kiosk/) tu nut moi
 * #staffKioskSwitchBtn o header, theo yeu cau nguoi dung: "Thêm mới 1 nút chuyển sang màn hình
 * staff-kiosk kế bên nút home bắt buộc nhập pass thủ công để chuyển màn hình". KHAC voi
 * requestStaffExit()/submitStaffExit() o tren (CHI chap nhan QUET MA QR, dieu huong ve "/") - modal
 * nay BAT BUOC nhap tay mat khau (o #staffKioskPasswordInput CO ban phim ao, KHONG dat
 * inputmode="none" nhu cac o quet khac trong trang), va dieu huong sang "/staff-kiosk/" thay vi "/".
 * `staffKioskPasswordModalOpen` dung de focusScanner() (xem ben duoi) KHONG cuop focus cua o nhap
 * mat khau nay trong vong lap setInterval() dung chung cho o quet CCCD/BHYT chinh.
 *
 * MUC 93 - THEM LAI bo dem nguoc, nhung theo yeu cau moi nhat: "có thời gian đếm ngược cố định
 * 10s nó sẽ tự quay về màn hình kiosk bốc số của bệnh nhân" - CO DINH 10 giay (KHONG dung chung
 * cau hinh `autoConfirmSeconds`/KIOSK_AUTO_CONFIRM_SECONDS nhu #staffExitModal, vi nguoi dung noi
 * ro "cố định"), het gio ma chua xac nhan xong (chua go dung mat khau) se TU DONG dong modal, quay
 * ve man hinh Kiosk boc so binh thuong.
 */
let staffKioskPasswordModalOpen = false;
let staffKioskPasswordCountdownTimer = null;
let staffKioskPasswordCountdownInterval = null;
const STAFF_KIOSK_PASSWORD_MODAL_SECONDS = 10; // CO DINH, khong doc tu cau hinh .env nao ca.

function clearStaffKioskPasswordCountdown() {
  clearTimeout(staffKioskPasswordCountdownTimer);
  clearInterval(staffKioskPasswordCountdownInterval);
  staffKioskPasswordCountdownTimer = null;
  staffKioskPasswordCountdownInterval = null;
}

function requestStaffKioskSwitch() {
  const modal = document.getElementById('staffKioskPasswordModal');
  const errBox = document.getElementById('staffKioskPasswordError');
  const input = document.getElementById('staffKioskPasswordInput');
  const countdownEl = document.getElementById('staffKioskPasswordCountdown');
  if (!modal) return;
  staffKioskPasswordModalOpen = true;
  if (errBox) errBox.textContent = '';
  if (input) input.value = '';
  modal.style.display = 'flex';
  input?.focus({ preventScroll: true });

  clearStaffKioskPasswordCountdown();
  let remaining = STAFF_KIOSK_PASSWORD_MODAL_SECONDS;
  if (countdownEl) countdownEl.textContent = String(remaining);
  staffKioskPasswordCountdownInterval = setInterval(() => {
    remaining -= 1;
    if (countdownEl) countdownEl.textContent = String(Math.max(remaining, 0));
  }, 1000);
  staffKioskPasswordCountdownTimer = setTimeout(() => {
    // Het gio ma chua xac nhan xong - coi nhu KHONG (hoac khong kip) muon chuyen man hinh, tu dong
    // dong modal va quay ve man hinh Kiosk boc so binh thuong (khong dieu huong di dau ca).
    closeStaffKioskPasswordModal();
  }, STAFF_KIOSK_PASSWORD_MODAL_SECONDS * 1000);
}

function closeStaffKioskPasswordModal() {
  const modal = document.getElementById('staffKioskPasswordModal');
  if (modal) modal.style.display = 'none';
  staffKioskPasswordModalOpen = false;
  clearStaffKioskPasswordCountdown();
  focusScanner(); // tra focus ve o quet CCCD/BHYT chinh cua man hinh Kiosk
}

/** Xac minh mat khau NHAP TAY (khac ban chat voi submitStaffExit() - do la mat khau QUET tu ma QR)
 * - THANH CONG moi dieu huong sang "/staff-kiosk/" (khac "/" nhu nut Home). */
async function submitStaffKioskSwitch() {
  const input = document.getElementById('staffKioskPasswordInput');
  const errBox = document.getElementById('staffKioskPasswordError');
  const password = (input?.value || '').trim();
  if (errBox) errBox.textContent = '';
  if (!password) {
    if (errBox) errBox.textContent = 'Vui lòng nhập mật khẩu.';
    return;
  }
  try {
    const res = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (errBox) errBox.textContent = 'Mật khẩu không đúng, vui lòng thử lại.';
      return;
    }
    clearStaffKioskPasswordCountdown();
    staffKioskPasswordModalOpen = false;
    location.href = '/staff-kiosk/';
  } catch {
    if (errBox) errBox.textContent = 'Không kết nối được máy chủ, vui lòng thử lại.';
  }
}

// Cho phep bam Enter ngay trong o nhap mat khau de xac nhan nhanh, khong bat buoc phai bam nut
// "Xác nhận" bang chuot/cham - tien loi hon khi go tay tren ban phim ao/vat ly.
document.getElementById('staffKioskPasswordInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitStaffKioskSwitch();
});

// Dung ScannerBuffer (public/vendor/scanner-buffer.js) thay vi lang nghe Enter truc tiep - mot so
// may quet co ty le gui nham 1 Enter GIUA CHUNG noi dung, khien xu ly nham 1 chuoi bi cat cut (xem
// ghi chu chi tiet trong scanner-buffer.js). Ma dang nhap nhanh khong co dinh dang co dinh de kiem
// tra "du hop le" nen dung mac dinh isComplete (luon coi la du khi co Enter), van huong loi tu co
// che du phong theo thoi gian (idle/reset) cho truong hop may quet khong gui Enter/Enter bi mat.
if (window.ScannerBuffer) {
  const staffExitInput = document.getElementById('staffExitScanInput');
  if (staffExitInput) {
    window.ScannerBuffer.attach(staffExitInput, {
      onComplete: (scanned) => submitStaffExit(scanned),
    });
  }
}

/**
 * BAT BUOC DANG NHAP LAI KHI THOAT KIOSK: bo sung cho phan xin mat khau o tren - truong hop trang
 * /kiosk nay THAT SU bi dong/roi khoi (dong tab, dong cua so kiosk cua ung dung Electron, tat
 * trinh duyet, dieu huong sang dia chi khac bang cach go thang URL, hoac vua roi kiosk THANH CONG
 * qua modal xin mat khau o tren...), ta CHU DONG dang xuat (huy phien dang nhap staff_token o
 * server) NGAY LUC DO - dam bao lan sau (du la chinh nguoi nay hay ai khac) muon vao lai bat ky man
 * hinh nao can dang nhap (kiosk, quay tiep nhan, kiosk nhan vien...) DEU PHAI NHAP LAI MAT KHAU tu
 * dau, khong con tan dung duoc phien cu con "song" tren cookie trinh duyet. Dung `pagehide` (khong
 * dung 'beforeunload', vi 'beforeunload' co the bi trinh duyet chan/khong chay dang tin cay tren
 * nhieu nen tang di dong) + `navigator.sendBeacon()` (gui duoc NGAY CA khi trang dang dong, khac
 * voi fetch() thong thuong co the bi huy giua chung).
 *
 * LOI DA GAP (VA DA SUA): `pagehide` KHONG CHI chay khi roi/dong trang that su - no CUNG chay moi
 * khi trang duoc TAI LAI (F5/reload)! Truoc day goi thang `/api/auth/staff-logout` (xoa phien +
 * xoa cookie NGAY LAP TUC) khien MOI LAN nhan vien F5 lai man hinh /kiosk/ dang dung, phien bi xoa
 * dung luc trang moi (cung URL) dang tai cac tai nguyen con (kiosk.js, anh nen...) - cac request do
 * bi may chu redirect ve trang dang nhap (vi da mat phien) thay vi tra ve dung noi dung, khien
 * trinh duyet bao loi cu phap ("Unexpected token '<'" - vi nhan nham HTML trang dang nhap thay cho
 * file .js that) va toan bo kiosk.js khong chay duoc, ket qua la man hinh "Đang tải..." mai khong
 * xong. Sua bang cach goi API voi `?soft=1` - phia server se KHONG xoa phien/cookie ngay, chi len
 * lich xoa sau vai giay (xem scheduleSoftLogout() trong src/services/authService.js); neu day la 1
 * lan F5 that, trang moi tai lai gan nhu ngay lap tuc va se tu huy lenh xoa dang cho do (bat ky
 * request nao qua duoc gate dang nhap deu tinh la "phien van con song"); neu la dong tab/roi han
 * that su thi khong con request nao den nua nen phien van se bi xoa nhu du dinh ban dau.
 */
window.addEventListener('pagehide', () => {
  try {
    navigator.sendBeacon('/api/auth/staff-logout?soft=1');
  } catch {
    // Trinh duyet rat cu khong ho tro sendBeacon - bo qua, khong lam gian doan viec dong trang.
  }
});

// Luoi an toan bo sung cho co che tren: neu day la 1 lan TAI LAI trang (F5) va lan pagehide truoc
// do (cua chinh trang nay) da kip gui tin hieu dang xuat mem, goi ngay 1 request can dang nhap
// (dung lai API kiem tra trang thai dang nhap co san, khong can API rieng) NGAY LUC KHOI DONG
// script - dam bao huy lenh dang xuat mem cang som cang tot, khong phu thuoc thu tu tai cac tai
// nguyen tinh khac cua trang co "vo tinh" di qua gate dang nhap som hay khong.
fetch('/api/auth/staff-status').catch(() => {});

// State cua phien boc so hien tai
let state = { cccdRaw: null, bhytRaw: null, cccd: null, bhyt: null, options: [], cooldownBlocked: false };
// Nhan doi tuong uu tien vua chon (dung de in len phieu) - mac dinh "Đối tượng thường".
let selectedPriorityLabel = 'Đối tượng thường';

const scanInput = document.getElementById('scanInput');
const scanStatus = document.getElementById('scanStatus');
const scanWarning = document.getElementById('scanWarning');
const continueBtn = document.getElementById('continueBtn');
const autoAdvanceNote = document.getElementById('autoAdvanceNote');
const autoAdvanceCountdown = document.getElementById('autoAdvanceCountdown');

/**
 * NGUYEN TAC KIOSK CONG KHAI: benh nhan KHONG duoc dung ban phim/chuot, chi thao tac qua may
 * quet QR. Vi vay moi buoc "xac nhan" (chuyen sang chon uu tien, hoac chon "Khong thuoc dien
 * uu tien" mac dinh) phai TU DONG dien ra sau 1 khoang dem nguoc (cau hinh trong .env qua bien
 * KIOSK_AUTO_CONFIRM_SECONDS, mac dinh 5 giay). Cac nut bam van con tren giao dien lam du phong
 * (vi du nhan vien can can thiep thu cong), nhung khong bat buoc benh nhan phai bam.
 */
let autoConfirmSeconds = 5; // se duoc ghi de bang gia tri that lay tu server ngay ben duoi
(async function loadKioskConfig() {
  try {
    const res = await fetch('/api/kiosk-config');
    const data = await res.json();
    if (Number.isFinite(data.autoConfirmSeconds)) autoConfirmSeconds = data.autoConfirmSeconds;
    // MUC 112: cau hoi sang loc (hien/an nut "Không mang CCCD")
    if (window.KioskSurvey) window.KioskSurvey.setConfig(data.questions);
  } catch {
    // Khong lay duoc cau hinh (vi du mat mang tam thoi) -> dung gia tri mac dinh 5 giay o tren.
  }
  toggleManualFallbackButtons();
})();

/**
 * Nut "Tiếp tục"/"Làm lại" CHI hien khi tinh nang tu dong tiep tuc BI TAT hoan toan
 * (KIOSK_AUTO_CONFIRM_SECONDS=0 trong .env) - day la truong hop DUY NHAT benh nhan can 1 cach
 * thao tac tay de chuyen buoc (neu khong se bi "ket" tai man hinh, khong co gi tu chuyen ca).
 * Mac dinh (autoConfirmSeconds > 0, vi du 5 giay) moi buoc da TU DONG dien ra nen KHONG hien nut
 * de giao dien gon gang, dung nguyen tac "benh nhan khong can bam nut nao ca" cua kiosk cong khai.
 */
function toggleManualFallbackButtons() {
  const box = document.getElementById('scanManualButtons');
  if (box) box.style.display = autoConfirmSeconds <= 0 ? 'flex' : 'none';
}

/** Ap dung anh nen (neu co cau hinh KIOSK_BACKGROUND_IMAGE trong .env) len khung kiosk. */
function applyKioskBackground(imagePath) {
  const shell = document.getElementById('kioskShell');
  if (!shell) return;
  if (imagePath) {
    shell.style.backgroundImage = `url("${imagePath.replace(/"/g, '%22')}")`;
    shell.classList.add('has-bg');
  } else {
    shell.style.backgroundImage = '';
    shell.classList.remove('has-bg');
  }
}

// Ten don vi/dong chan trang/logo lay tu .env (qua /api/branding) - dung lai o ca phan phieu in
// (xem createTicket() ben duoi va public/print-receipt.js). brandPrintLogoImage CHI dung cho
// phieu in (khong hien tren man hinh Kiosk) nen khong can bien rieng, doc thang tu API luc goi
// printReceipt() la du - nhung van luu lai o day de dung 1 lan goi /api/branding cho ca 2 viec.
let brandClinicName = 'Hệ thống bắt số';
let brandFooterText = '';
let brandFooterText2 = '';
let brandPrintLogoImage = '';

/** Ap dung anh logo (neu co cau hinh KIOSK_LOGO_IMAGE trong .env) len header kiosk, thay icon mac dinh. */
function applyKioskLogo(imagePath) {
  const iconEl = document.getElementById('brandMarkIcon');
  const imgEl = document.getElementById('clinicLogoImg');
  if (!imgEl || !iconEl) return;
  if (imagePath) {
    imgEl.src = imagePath;
    imgEl.style.display = '';
    iconEl.style.display = 'none';
  } else {
    imgEl.style.display = 'none';
    iconEl.style.display = '';
  }
}

/** Lay ten don vi (header), dong chan trang (footer, 2 dong) va logo tu .env qua API /api/branding. */
(async function loadBranding() {
  const nameEl = document.getElementById('clinicName');
  const footerEl = document.getElementById('kioskFooter');
  const footer2El = document.getElementById('kioskFooter2');
  try {
    const res = await fetch('/api/branding');
    const data = await res.json();
    brandClinicName = data.clinicName || 'Hệ thống bắt số';
    brandFooterText = data.footerText || '';
    brandFooterText2 = data.footerText2 || '';
    brandPrintLogoImage = data.printLogoImage || '';
    if (nameEl) nameEl.textContent = brandClinicName;
    if (footerEl) footerEl.textContent = brandFooterText;
    if (footer2El) {
      footer2El.textContent = brandFooterText2;
      footer2El.style.display = brandFooterText2 ? '' : 'none';
    }
    applyKioskBackground(data.kioskBackgroundImage);
    applyKioskLogo(data.kioskLogoImage);
  } catch {
    // Khong lay duoc (vi du mat mang tam thoi) -> giu nguyen text mac dinh trong HTML.
    if (nameEl) nameEl.textContent = 'Hệ thống bắt số';
  }
})();

/**
 * Chi tiet so luong dang cho theo TUNG doi tuong uu tien + doi tuong thuong (7 uu tien + 1 thuong
 * = 8, zero-fill du ca cac loai dang co 0 nguoi cho) - hien BEN DUOI noi dung chinh cua kiosk, cap
 * nhat REALTIME qua socket.io giong /waiting-screen va /patient-screen (xem
 * renderPriorityCountBox() dung chung y het pattern o 2 trang do). Giup benh nhan dang xep hang
 * nhin thay truoc con bao nhieu nguoi cung/khac doi tuong dang cho, khong can rieng man hinh cho.
 */
let priorityRulesForCount = [];
let lastSummaryForCount = null;

function renderPriorityCountBox(summary) {
  const box = document.getElementById('priorityCountBox');
  if (!box || !priorityRulesForCount.length) return;
  const countByCode = Object.fromEntries((summary.waitingByPriority || []).map((r) => [r.code, r.count]));
  box.innerHTML = priorityRulesForCount
    .map(
      (r) => `<span class="priority-count-chip"><span class="legend-dot" style="background:${r.color}"></span>${r.label}: <b>${countByCode[r.code] || 0}</b></span>`
    )
    .join('');
}

fetch('/api/priority-rules').then((r) => r.json()).then((rules) => {
  priorityRulesForCount = rules;
  if (lastSummaryForCount) renderPriorityCountBox(lastSummaryForCount);
});
fetch('/api/display/summary').then((r) => r.json()).then((summary) => {
  lastSummaryForCount = summary;
  renderPriorityCountBox(summary);
});
if (typeof io === 'function') {
  const countSocket = io({ path: '/rt-bridge/' });
  countSocket.on('queue:summary', (summary) => {
    lastSummaryForCount = summary;
    renderPriorityCountBox(summary);
  });
}

// Bo dem tu dong xac nhan sau khi quet thanh cong - het gio se TU DONG xac dinh doi tuong uu tien
// va tao so luon (xem goToPriorityStep() ben duoi), KHONG con buoc chon uu tien thu cong nua.
let scanAutoTimer = null;
let scanAutoInterval = null;

function clearScanAutoTimer() {
  clearTimeout(scanAutoTimer);
  clearInterval(scanAutoInterval);
  scanAutoTimer = null;
  scanAutoInterval = null;
  autoAdvanceNote.style.display = 'none';
}

/** Bat dau (hoac khoi dong lai) bo dem tu dong chuyen sang buoc chon uu tien sau khi quet thanh cong. */
function startScanAutoTimer() {
  clearScanAutoTimer();
  if (state.cooldownBlocked || autoConfirmSeconds <= 0) return; // dang bi khoa thi khong tu chuyen buoc
  let remaining = autoConfirmSeconds;
  autoAdvanceCountdown.textContent = String(remaining);
  autoAdvanceNote.style.display = 'block';
  scanAutoInterval = setInterval(() => {
    remaining -= 1;
    if (remaining >= 0) autoAdvanceCountdown.textContent = String(remaining);
  }, 1000);
  scanAutoTimer = setTimeout(() => {
    clearScanAutoTimer();
    proceedAfterScan();
  }, autoConfirmSeconds * 1000);
}


/** Hien 1 o canh bao duoi khu vuc quet - dung chung cho ca canh bao thuong (vang) va bi khoa (do). */
function showScanWarning(message, level) {
  scanWarning.style.display = 'block';
  scanWarning.textContent = message;
  if (level === 'blocked') {
    scanWarning.style.background = '#fdecec';
    scanWarning.style.border = '1px solid #f3a7a7';
    scanWarning.style.color = '#b91c1c';
  } else {
    scanWarning.style.background = '#fff7e6';
    scanWarning.style.border = '1px solid #fbd7a5';
    scanWarning.style.color = '#92400e';
  }
}

function hideScanWarning() {
  scanWarning.style.display = 'none';
  scanWarning.textContent = '';
}

/**
 * Luon giu focus vao 1 trong 2 o input an de may quet (hoat dong nhu ban phim) go noi dung vao -
 * khi modal xin xac nhan roi kiosk (#staffExitModal) dang mo (`staffExitModalOpen`, xem
 * requestStaffExit() o tren) thi focus vao o quet RIENG cua modal do (#staffExitScanInput) thay vi
 * o quet CCCD/BHYT chinh, de ma QR đang nhap nhanh quet luc nay duoc dua dung vao modal thay vi bi
 * hieu nham la dang quet CCCD/BHYT.
 */
function focusScanner() {
  // MUC 92: khi modal "nhập mật khẩu để chuyển sang staff-kiosk" đang mở, KHÔNG cướp focus - ô đó
  // cần bàn phím ảo/thao tác gõ tay bình thường của trình duyệt, khác hẳn các ô quét (luôn ẩn bàn
  // phím ảo bằng inputmode="none" vì chỉ dùng cho máy quét QR kiểu bàn phím).
  if (staffKioskPasswordModalOpen) return;
  // MUC 113: hop mat khau khoa/mo khoa dang mo -> de focus o o mat khau (go tay hoac may quet go vao)
  if (window.KioskLock && window.KioskLock.isModalOpen()) return;
  // MUC 112: dang o cau hoi NHAP SO (CCCD/SDT) -> focus o nhap so thay vi o quet an
  if (!staffExitModalOpen && window.KioskSurvey && window.KioskSurvey.wantsInputFocus()) {
    window.KioskSurvey.focusInput();
    return;
  }
  if (staffExitModalOpen) {
    document.getElementById('staffExitScanInput')?.focus({ preventScroll: true });
    return;
  }
  scanInput.focus({ preventScroll: true });
}
setInterval(focusScanner, 800);
focusScanner();

/**
 * Kiem tra chuoi vua quet co "hop le toi thieu" chua (du so phan tach boi "|" mong doi) - dung lam
 * dieu kien `isComplete` cho ScannerBuffer (xem public/vendor/scanner-buffer.js): mot so may quet
 * co ty le gui NHAM 1 Enter GIUA CHUNG noi dung, neu tin ngay Enter dau tien se xu ly nham 1 chuoi
 * CCCD/BHYT bi CAT CUT - dac biet nguy hiem neu cat dung doan chua so CCCD/ma the BHYT (truong
 * dung de doi chieu trung, chong cap so trung lap). Dinh dang: CCCD co it nhat 6 phan (phan dau la
 * DU 12 chu so), BHYT co it nhat 4 phan - xem parseCCCD()/parseBHYT() trong src/services/qrParser.js.
 */
// MUC 94 - tien to co dinh cua ma QR "cap nhanh" (giong het staff-kiosk.js) - dung de nhan biet
// 1 luot quet la ma QR cap nhanh (KHONG xac minh CCCD/BHYT) truoc khi thu phan tich thanh CCCD/BHYT
// hay ma dang nhap nhanh.
const QUICKQR_PREFIX = 'QUICKQR|';

function looksLikeCompleteQr(raw) {
  raw = raw || '';
  // MUC 94: ma QR "cap nhanh" (tien to QUICKQR_PREFIX, dang "QUICKQR|<code>|<secret>") LUON co dau
  // "|" nhung CHI co dung 3 phan - phai kiem tra rieng TRUOC nhanh CCCD/BHYT ben duoi (nhanh do doi
  // it nhat 4 phan, se tra ve false sai neu khong tach rieng truong hop nay).
  if (raw.startsWith(QUICKQR_PREFIX)) return raw.length > QUICKQR_PREFIX.length;
  // Khong co dau "|" -> khong phai QR CCCD/BHYT (2 dinh dang do luon co nhieu truong ngan boi
  // "|"). Rat co the la QR "dang nhap nhanh" cua nhan vien (chi encode 1 chuoi mat khau tran, xem
  // GET /api/auth/login-qr va tryStaffQrShortcut() ben duoi) - coi la du ngay de xu ly nhanh, khong
  // can cho them.
  if (!raw.includes('|')) return true;
  const parts = raw.split('|');
  if (parts.length < 4) return false;
  const isLikelyCCCD = /^\d{12}$/.test(parts[0]);
  return isLikelyCCCD ? parts.length >= 6 : true;
}

/** Tra ve nhan hien thi (label) cua 1 ma doi tuong uu tien, dung du lieu da tai san o
 * `priorityRulesForCount` (xem GET /api/priority-rules o tren) - tra ve chinh ma do neu chua tai
 * xong cau hinh (hiem gap, chi xay ra trong khoang rat ngan luc trang moi mo). */
function labelForCode(code) {
  const found = priorityRulesForCount.find((r) => r.code === code);
  return found ? found.label : code;
}

/**
 * MUC 94 - Theo yeu cau nguoi dung: "Bổ sung thêm chức năng cho phép quét mã QR của stt thường có
 * thể lấy được số tt thường mà ko cần xác minh cccd hoặc thẻ bhyt". Tai su dung LAI DUNG co che "QR
 * cấp nhanh" da co san (dung o /staff-kiosk/, xem GET /api/tickets/quick-qr-image/:code + POST
 * /api/tickets/quick trong src/routes/tickets.js) - nhan vien tao san 1 ma QR cho doi tuong "Đối
 * tượng thường" (NORMAL) qua man hinh /staff-kiosk/ (nut "📱 QR" canh doi tuong do, CAN cau hinh
 * QUICK_QR_CODE_NORMAL trong .env truoc), in ra dan o quay/khu vuc cho - benh nhan tu quet MA NAY
 * (KHONG phai CCCD/BHYT cua ho) tai kiosk cong khai se duoc cap so "Đối tượng thường" NGAY LAP TUC,
 * hoan toan KHONG can xac minh giay to gi (server chi doi chieu dung ma bi mat cau hinh san, xem
 * POST /api/tickets/quick - `requireStaff`-gated nhung DA TU DUOC PHEP vi ban than trang /kiosk
 * nay von da can dang nhap nhan vien de mo, xem GATED_PATH_PREFIXES trong src/server.js).
 *
 * CHU Y: co che nay von KHONG rieng cho "STT thường" - hoat dong voi BAT KY doi tuong nao da duoc
 * cau hinh QUICK_QR_CODE_<code>, dung y het logic ben /staff-kiosk/. Trong thuc te nguoi dung chi
 * can tao 1 ma cho NORMAL la du dung yeu cau, nhung neu sau nay muon dung them cho doi tuong khac
 * (vi du can tao san the QR cho nguoi khuyet tat...) thi khong can sua code gi them.
 */
async function processQuickQrScan(raw) {
  scanStatus.textContent = 'Đang xử lý mã QR cấp nhanh...';
  hideScanWarning();
  try {
    const res = await fetch('/api/tickets/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    const data = await res.json();
    if (!res.ok) {
      scanStatus.textContent = data.error || 'Mã QR cấp nhanh không hợp lệ, vui lòng thử lại.';
      return;
    }

    clearScanAutoTimer(); // phong khi dang co bo dem tu dong cua 1 luot quet CCCD/BHYT truoc do dang cho
    const ticket = data.ticket;
    const label = labelForCode(ticket.priority_code);
    document.getElementById('step-scan').style.display = 'none';
    const numberText = `${ticket.number_prefix || ''}${String(ticket.number).padStart(3, '0')}`;
    document.getElementById('doneNumber').textContent = numberText;
    document.getElementById('doneLabel').textContent = '';
    document.getElementById('step-done').style.display = 'block';

    // In phieu ngay - KHONG co thong tin benh nhan gi ca (patientName/patientDob de null) vi day
    // la cap so qua ma QR cap nhanh, khong quet CCCD/BHYT cua benh nhan; idQrRaw cung de null vi
    // khong co ma CCCD/BHYT nao de in lai (khac han truong hop cap so binh thuong o createTicket()).
    //
    // MUC 95: THEM `await` (truoc day "bắn rồi thôi") - xem giai thich chi tiet o ghi chu tuong tu
    // trong createTicket() ben duoi: day CHINH LA duong quet co nguy co cao nhat gay chong cheo
    // lenh in (mã QR "cấp nhanh" tao+in NGAY LAP TUC khong co dem gio nao, neu bi quet lien tuc rat
    // nhanh) - `await` o day, ket hop hang doi `kioskActionQueueTail` boc quanh ham nay
    // (`handleScanRawInner()` goi ham nay qua `enqueueKioskAction()`), dam bao luot quet TIEP THEO
    // luon phai cho dung luot quet HIEN TAI in xong hang han moi duoc xu ly.
    await printReceipt({
      clinicName: brandClinicName,
      number: numberText,
      priorityLabel: label,
      time: new Date(ticket.created_at).toLocaleString('vi-VN'),
      footerText: brandFooterText,
      footerText2: brandFooterText2,
      logoImage: brandPrintLogoImage,
      patientName: null,
      patientDob: null,
      idQrRaw: null,
    });

    startDoneCountdown();
  } catch {
    scanStatus.textContent = 'Không kết nối được máy chủ, vui lòng thử lại.';
  }
}

/**
 * QR "dang nhap nhanh" cua nhan vien (GET /api/auth/login-qr, chi encode NGUYEN VAN mat khau nhan
 * vien - xem scanLoginInput trong public/index.html va staffExitScanInput trong kiosk.js) khong co
 * dau "|" nao, khac han QR CCCD/BHYT. Neu benh nhan/nhan vien quet dung QR nay ngay tai man hinh
 * kiosk boc so (khong phai trong modal "roi kiosk"), coi la NHAN VIEN muon CHUYEN THANG sang kiosk
 * cap so nhan vien (/staff-kiosk/) - tien loi hon phai mo modal "roi kiosk" roi dang nhap lai tu
 * dau. Xac thuc THAT SU o server (goi lai chinh API dang nhap san co) truoc khi dieu huong, tranh
 * truong hop 1 QR/ma vach la khac (khong co dau "|") vo tinh bi hieu nham thanh lenh chuyen man
 * hinh - chi QR chua DUNG mat khau nhan vien moi duoc chap nhan.
 */
async function tryStaffQrShortcut(raw) {
  scanStatus.textContent = 'Đang kiểm tra mã QR...';
  try {
    const res = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: raw }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      scanStatus.textContent = 'Đang chuyển sang Kiosk cấp số – Nhân viên...';
      location.href = '/staff-kiosk/';
      return;
    }
  } catch {
    // Loi mang - roi xuong thong bao chung ben duoi, giong het truong hop QR khong doc duoc.
  }
  scanStatus.textContent = 'Không đọc được mã QR, vui lòng quét CCCD hoặc thẻ BHYT.';
}

/**
 * MUC 95 - HANG DOI XU LY DUY NHAT cho MOI hanh dong co the dan den tao ve + in phieu (1 luot quet
 * moi qua `handleScanRaw()`, VA buoc "tao so" qua `goToPriorityStep()` - ca 2 deu duoc doi ten
 * thanh `...Inner()` ben duoi, chi con duoc goi GIAN TIEP qua `enqueueKioskAction()` nay).
 *
 * NGUYEN NHAN GOC (theo phan anh cua nguoi dung: "widget máy quét zebra quét 1 hồi ở màn hình
 * kiosk ứng dụng bị treo dùng màn hình cảm ứng nhập phím ảo cũng k ăn input"): may quet Zebra (kieu
 * ban phim) khong co gioi han toc do quet - neu quet LIEN TUC nhieu ma QR "cấp nhanh" (muc 94, tao+
 * in ve NGAY LAP TUC, khong co bat ky do tre/khoa nao) hoac nhieu CCCD/BHYT gan sat nhau, cac luot
 * quet nay se kich hoat NHIEU lenh tao ve + goi `printReceipt()` GAN NHU CUNG LUC - ben phia
 * electron-widget/main.js, nhieu lenh in nhu vay co the CHONG CHEO nhau tren CUNG 1 webContents
 * (xem giai thich chi tiet o `queuePrintJob()`/`printQueueTail` trong electron-widget/main.js) va
 * khien renderer/toan bo ung dung bi "ket" (treo) - khop dung trieu chung nguoi dung mo ta.
 *
 * SUA (o phia trang web nay, BO SUNG cho hang doi da them o electron-widget/main.js): MOI luot quet
 * VA moi lan "tao so" (du tu bo dem tu dong hay bam nut "Tiếp tục →" thu cong) deu di qua CHUNG 1
 * hang doi (`kioskActionQueueTail`, 1 chuoi Promise noi tiep) - hanh dong SAU chi THAT SU bat dau
 * chay SAU KHI hanh dong TRUOC no da chay XONG HAN (ke ca cho `printReceipt()` xong, vi
 * `createTicket()`/`processQuickQrScan()` da duoc sua o muc nay de `await` no thay vi "bắn rồi
 * thôi" nhu truoc) - khong con 2 luot tao ve + in nao chay chong cheo nua, du may quet gui bao
 * nhieu luot lien tuc nhanh den dau.
 */
let kioskActionQueueTail = Promise.resolve();

function enqueueKioskAction(fn) {
  const job = kioskActionQueueTail.then(fn);
  // Giu hang doi CHAY TIEP du 1 hanh dong co loi (khong de 1 loi don le lam "ket" luon moi hanh
  // dong sau do) - cac ham thuc te ben duoi da tu bat loi rieng (try/catch) roi, day chi la luoi an
  // toan bo sung.
  kioskActionQueueTail = job.catch((err) => {
    console.error('[Kiosk] Lỗi xử lý trong hàng đợi quét/tạo số:', err);
  });
  return job;
}

async function handleScanRaw(raw) {
  return enqueueKioskAction(() => handleScanRawInner(raw));
}

async function handleScanRawInner(raw) {
  raw = (raw || '').trim();
  if (!raw) return;

  // MUC 113: dang KHOA tu cap so -> bo qua MOI luot quet (CCCD/BHYT/QR cap nhanh/QR nhan vien),
  // khong cap so, khong chuyen man hinh. Mo khoa bang nut o khoa tren header.
  if (window.KioskLock && window.KioskLock.isLocked()) return;

  // MUC 112: BN quet lai CCCD/BHYT trong luc dang tra loi cau hoi (hoac dang hien thong bao het
  // gio/lien he nhan vien) -> huy luot cu, lam lai tu dau voi luot quet moi. Chua cap so nen khong
  // bi rang buoc thoi gian gi.
  if (window.KioskSurvey && window.KioskSurvey.isBusy()) {
    window.KioskSurvey.abort();
    resetKiosk();
  }

  // MUC 94: kiem tra ma QR "cap nhanh" TRUOC TIEN (tien to QUICKQR_PREFIX) - phai kiem tra truoc
  // nhanh CCCD/BHYT ben duoi vi dinh dang nay CUNG co dau "|" nhung KHONG phai CCCD/BHYT.
  if (raw.startsWith(QUICKQR_PREFIX)) {
    await processQuickQrScan(raw);
    return;
  }

  if (!raw.includes('|')) {
    await tryStaffQrShortcut(raw);
    return;
  }

  // Phan biet CCCD (co dau '|' va it nhat 6 phan) vs BHYT (chuoi bat dau bang so hoac 2 chu cai + so)
  const parts = raw.split('|');
  const isLikelyCCCD = parts.length >= 6 && /^\d{12}$/.test(parts[0]);

  scanStatus.textContent = 'Đang xử lý...';
  try {
    const payload = isLikelyCCCD ? { cccdRaw: raw } : { bhytRaw: raw };
    const res = await fetch('/api/tickets/parse-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi đọc QR');

    if (isLikelyCCCD) {
      state.cccdRaw = raw;
      state.cccd = data.cccd;
      document.getElementById('cccdInfo').textContent =
        `${data.cccd.hoTen} - ${data.cccd.age ?? '?'} tuổi - ${data.cccd.gender === 'F' ? 'Nữ' : 'Nam'}`;
    } else {
      state.bhytRaw = raw;
      state.bhyt = data.bhyt;
      document.getElementById('bhytInfo').textContent = data.bhyt.isFullCode
        ? `Mã thẻ ${data.bhyt.maThe} (đã xác định đối tượng)`
        : `Mã số ${data.bhyt.maThe} (không xác định được đối tượng qua QR)`;
    }

    // Luon canh bao ngay sau khi quet: he thong co doi chieu so CCCD/BHYT de chong lay so
    // trung/spam. Neu dang trong thoi gian "nghi" (vua lay so gan day) -> khoa luon nut Tiep tuc.
    if (data.cooldown?.blocked) {
      state.cooldownBlocked = true;
      const mins = Math.ceil(data.cooldown.remainingSeconds / 60);
      showScanWarning(
        `Giấy tờ này vừa được dùng để lấy số gần đây. Vui lòng quay lại sau khoảng ${mins} phút nữa.`,
        'blocked'
      );
      continueBtn.disabled = true;
      clearScanAutoTimer(); // dang bi khoa - khong tu dong chuyen buoc, cho benh nhan quet giay to khac
    } else {
      state.cooldownBlocked = false;
      showScanWarning('Hệ thống ghi nhận và đối chiếu số CCCD/BHYT của lượt quét này để tránh lấy số trùng.', 'warn');
      continueBtn.disabled = false;
      startScanAutoTimer(); // moi lan quet thanh cong se khoi dong lai bo dem tu dong tiep tuc
    }

    scanStatus.textContent = autoConfirmSeconds > 0
      ? 'Quét thành công. Có thể quét thêm giấy tờ khác, hoặc chờ tự động tiếp tục.'
      : 'Quét thành công. Có thể quét thêm hoặc bấm "Tiếp tục".';
  } catch (err) {
    scanStatus.textContent = 'Lỗi: ' + err.message;
  }
}

if (window.ScannerBuffer) {
  window.ScannerBuffer.attach(scanInput, {
    onComplete: (raw) => handleScanRaw(raw),
    isComplete: looksLikeCompleteQr,
  });
} else {
  // Du phong hiem gap (scanner-buffer.js khong tai duoc) - quay ve cach cu, khong chan luong chinh.
  scanInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const raw = scanInput.value.trim();
    scanInput.value = '';
    handleScanRaw(raw);
  });
}

async function fetchOptionsAndRender() {
  const res = await fetch('/api/tickets/parse-qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cccdRaw: state.cccdRaw, bhytRaw: state.bhytRaw }),
  });
  const data = await res.json();
  state.options = data.options || [];
  return state.options;
}

/**
 * TU DONG XAC DINH doi tuong uu tien roi tao so LUON - KHONG con man hinh "Chọn đối tượng ưu
 * tiên" cho benh nhan tu bam nhu truoc (bo ca cac muc "tu khai" nhu mang thai/khuyet tat). Chi
 * con DUNG 2 doi tuong uu tien duoc he thong TU NHAN DIEN qua tuoi tren CCCD: "≥ 75 tuổi" va
 * "Trẻ em dưới 06 tuổi" - neu khong thoa dieu kien nao thi tu dong xep vao "Đối tượng thường".
 * Benh nhan hoan toan KHONG CAN THAO TAC GI THEM sau khi quet xong giay to (dung theo yeu cau).
 *
 * Van goi lai API /api/tickets/parse-qr (qua fetchOptionsAndRender(), server tra ve `options` da
 * loc theo dung logic o src/config/priorityRules.js) thay vi tu tinh tuoi/dieu kien o phia trinh
 * duyet - dam bao CHI 1 nguon su that duy nhat cho quy tac uu tien, khong bi lech neu sau nay
 * server doi cach tinh tuoi. Chi loc lay ma AGE75/CHILD6 (che do PRIORITY_MODE=full, mac dinh)
 * hoac ma PRIORITY gop chung (che do PRIORITY_MODE=basic - xem src/config/priorityRules.js) tu
 * ket qua tra ve (bo qua moi ma khac neu co, vi cac doi tuong tu khai kia khong con duoc kiosk
 * cong khai nay ap dung tu dong).
 */
/**
 * MUC 112 - Sau khi quet xong (het dem nguoc tu dong, hoac bam "Tiếp tục" khi tat tu dong): neu
 * co cau hoi sang loc cho luong quet -> hoi truoc, tra loi du moi cap so; het gio/khong tra loi thi
 * KHONG cap so (kiosk-survey.js hien thong bao roi tu quay ve man hinh quet).
 */
async function proceedAfterScan() {
  clearScanAutoTimer();
  if (!state.cccdRaw && !state.bhytRaw) {
    scanStatus.textContent = 'Bạn chưa quét giấy tờ nào. Vui lòng quét CCCD hoặc thẻ BHYT trước.';
    return;
  }
  if (state.cooldownBlocked) {
    scanStatus.textContent = 'Bạn vừa lấy số gần đây, vui lòng quay lại sau.';
    return;
  }
  const started = window.KioskSurvey
    ? await window.KioskSurvey.start('scan', (answers) => {
        showIssuingScreen();
        goToPriorityStep({ flow: 'scan', answers });
      })
    : false;
  if (!started) goToPriorityStep(null);
}

/** MUC 112 - BN KHONG mang CCCD/BHYT: bam nut tren man hinh quet -> tra loi cau hoi + nhap so -> cap so. */
async function startNoIdFlow() {
  resetKiosk();
  if (!window.KioskSurvey) return;
  await window.KioskSurvey.start('noId', (answers) => {
    showIssuingScreen();
    selectedPriorityLabel = 'Đối tượng thường';
    enqueueKioskAction(() => createTicket('NORMAL', { flow: 'noId', answers }));
  });
}

/** Man hinh cho trong luc gui yeu cau cap so (cung la noi hien loi neu server tu choi). */
function showIssuingScreen() {
  if (window.KioskSurvey) window.KioskSurvey.showOnly('step-scan');
  hideScanWarning();
  scanStatus.textContent = 'Đang cấp số...';
}

async function goToPriorityStep(survey) {
  return enqueueKioskAction(() => goToPriorityStepInner(survey || null));
}

async function goToPriorityStepInner(survey) {
  clearScanAutoTimer(); // dang chuyen buoc (du la tu dong hay bam tay) - huy bo dem cua buoc quet
  if (!state.cccdRaw && !state.bhytRaw) {
    scanStatus.textContent = 'Bạn chưa quét giấy tờ nào. Vui lòng quét CCCD hoặc thẻ BHYT trước.';
    return;
  }
  if (state.cooldownBlocked) {
    scanStatus.textContent = 'Bạn vừa lấy số gần đây, vui lòng quay lại sau.';
    return;
  }
  const options = await fetchOptionsAndRender();
  // 'PRIORITY' xuat hien khi PRIORITY_MODE=basic (gop chung); 'AGE75'/'CHILD6' khi mac dinh (full).
  const auto =
    options.find((o) => o.code === 'PRIORITY') ||
    options.find((o) => o.code === 'AGE75') ||
    options.find((o) => o.code === 'CHILD6');
  if (auto) {
    selectedPriorityLabel = auto.label;
    await createTicket(auto.code, survey);
  } else {
    selectedPriorityLabel = 'Đối tượng thường';
    await createTicket('NORMAL', survey);
  }
}

async function createTicket(priorityCode, survey) {
  scanStatus.textContent = 'Đang tạo số...';
  // Kiosk cong khai BAT BUOC phai co giay to - luon uu tien CCCD (co so tuoi de xet AGE75),
  // roi den BHYT lam dinh danh (id_number) va nguon goc raw QR de doi chieu/audit.
  const patient = state.cccd
    ? {
        name: state.cccd.hoTen,
        dob: state.cccd.dob,
        gender: state.cccd.gender,
        id_number: state.cccd.cccd,
        source: 'CCCD',
        qr_raw: state.cccdRaw,
      }
    : state.bhyt
    ? {
        // KHONG lay ten tu QR BHYT (xem ghi chu trong parseBHYT() o src/services/qrParser.js) -
        // de trong, tranh hien thi/luu nham ten sai/loi do giai ma nham.
        name: null,
        dob: state.bhyt.ngaySinh,
        gender: null,
        id_number: state.bhyt.maThe,
        source: 'BHYT',
        qr_raw: state.bhytRaw,
      }
    : null;

  const isNoId = !!(survey && survey.flow === 'noId');
  if (!patient && !isNoId) {
    scanStatus.textContent = 'Vui lòng quét CCCD hoặc thẻ BHYT trước khi lấy số.';
    return;
  }

  let res;
  let data;
  try {
    res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorityCode, patient: isNoId ? null : patient, survey: survey || undefined }),
    });
    data = await res.json();
  } catch {
    scanStatus.textContent = 'Không kết nối được máy chủ - CHƯA cấp số. Vui lòng thử lại.';
    return;
  }
  if (!res.ok) {
    // MUC 112: luong khong giay to - loi hien ro rang (vd so CCCD vua lay so gan day)
    if (isNoId) showScanWarning(data.error || 'Chưa cấp được số.', 'blocked');
    // 429 = dang trong thoi gian "nghi" chong spam (co the vua bi khoa o may khac/tab khac)
    scanStatus.textContent = 'Lỗi: ' + data.error;
    if (res.status === 429) {
      state.cooldownBlocked = true;
      showScanWarning(data.error, 'blocked');
      continueBtn.disabled = true;
      clearScanAutoTimer(); // dang bi khoa - khong tu dong chuyen buoc nua
      document.getElementById('step-scan').style.display = 'block';
    }
    return;
  }

  document.getElementById('step-scan').style.display = 'none';
  // Ghep tien to hien thi ("U"/"T"...) NEU CO - chi khac rong khi bat SEPARATE_PRIORITY_SEQUENCE
  // trong .env (xem src/services/ticketService.js) - rong/null o che do mac dinh, khong doi gi.
  const numberText = `${data.ticket.number_prefix || ''}${String(data.ticket.number).padStart(3, '0')}`;
  document.getElementById('doneNumber').textContent = numberText;
  document.getElementById('doneLabel').textContent = '';
  document.getElementById('step-done').style.display = 'block';

  // In phieu ngay tren trinh duyet cua chinh may kiosk nay (xem public/print-receipt.js) - hop
  // thoai in se tu nhan may in USB (may tinh) hoac may in Bluetooth da ghep doi (may tinh bang)
  // dang cai san o cap he dieu hanh cua may nay.
  // Ho ten + ngay sinh benh nhan (tu ket qua parse QR CCCD/BHYT o buoc quet) - in ro tren phieu,
  // xem patientInfoForReceipt() trong public/print-receipt.js.
  //
  // MUC 95: THEM `await` (truoc day "bắn rồi thôi", khong cho) - CHO THAT SU lenh in nay xong hang
  // han (thanh cong hay that bai) truoc khi ham nay (va ca hang doi `kioskActionQueueTail` dang giu
  // no) duoc coi la xong - dam bao khong co luot quet/tao ve TIEP THEO nao bat dau truoc khi lenh
  // in cua ve HIEN TAI da thuc su hoan tat, loai bo nguy co chong cheo lenh in gay treo ung dung
  // (xem giai thich chi tiet o enqueueKioskAction()/queuePrintJob() trong electron-widget/main.js).
  const patientInfo = patientInfoForReceipt(state.cccd, state.bhyt);
  // MUC 112: cac dong tra loi cau hoi sang loc (lay tu ve server tra ve - dung du lieu da luu)
  const extraLines = Array.isArray(data.ticket.answers)
    ? data.ticket.answers.filter((a) => a && a.label).map((a) => `${a.label}: ${a.text}`)
    : [];
  await printReceipt({
    clinicName: brandClinicName,
    number: numberText,
    priorityLabel: selectedPriorityLabel,
    time: new Date(data.ticket.created_at).toLocaleString('vi-VN'),
    footerText: brandFooterText,
    footerText2: brandFooterText2,
    logoImage: brandPrintLogoImage,
    patientName: patientInfo.name,
    patientDob: patientInfo.dob,
    extraLines,
    // In lai chinh ma QR cua CCCD/BHYT vua quet len phieu (uu tien CCCD neu co ca 2) - xem ghi
    // chu opts.idQrRaw trong public/print-receipt.js. Neu ca 2 deu khong co (khong the xay ra o
    // /kiosk vi bat buoc phai quet 1 trong 2 moi lay duoc so, nhung van phong hoi de code chac
    // chan), phan QR tren phieu se tu bo qua (de trong).
    idQrRaw: state.cccdRaw || state.bhytRaw || null,
  });

  startDoneCountdown();
}

/**
 * Truoc day man hinh "Số thứ tự của bạn" co 1 nut "Xong – Bốc số cho người khác" de benh nhan tu
 * bam, kem 1 dong hen gio CO DINH 8 giay chay ngam de phong benh nhan quen bam - nay BO HAN nut do
 * (kiosk cong khai khong can benh nhan thao tac tay gi ca), thay bang bo dem nguoc HIEN THI RO
 * (#doneCountdown trong index.html) va dung CHUNG cau hinh KIOSK_AUTO_CONFIRM_SECONDS
 * (`autoConfirmSeconds`, xem loadKioskConfig() o tren) thay vi con so 8 giay co dinh rieng truoc
 * day - het gio se TU DONG quay lai man hinh quet (resetKiosk()).
 */
let doneCountdownTimer = null;
let doneCountdownInterval = null;

function clearDoneCountdown() {
  clearTimeout(doneCountdownTimer);
  clearInterval(doneCountdownInterval);
  doneCountdownTimer = null;
  doneCountdownInterval = null;
}

function startDoneCountdown() {
  clearDoneCountdown();
  const seconds = autoConfirmSeconds > 0 ? autoConfirmSeconds : 5;
  let remaining = seconds;
  const el = document.getElementById('doneCountdown');
  if (el) el.textContent = String(remaining);
  doneCountdownInterval = setInterval(() => {
    remaining -= 1;
    if (el) el.textContent = String(Math.max(remaining, 0));
  }, 1000);
  doneCountdownTimer = setTimeout(() => {
    clearDoneCountdown();
    resetKiosk();
  }, seconds * 1000);
}

function resetKiosk() {
  if (window.KioskSurvey) window.KioskSurvey.abort(); // MUC 112: huy luot hoi/thong bao dang hien
  clearDoneCountdown();
  clearScanAutoTimer();
  state = { cccdRaw: null, bhytRaw: null, cccd: null, bhyt: null, options: [], cooldownBlocked: false };
  selectedPriorityLabel = 'Đối tượng thường';
  document.getElementById('cccdInfo').textContent = 'chưa quét';
  document.getElementById('bhytInfo').textContent = 'chưa quét';
  scanStatus.textContent = 'Sẵn sàng quét...';
  hideScanWarning();
  continueBtn.disabled = false;
  document.getElementById('step-scan').style.display = 'block';
  document.getElementById('step-done').style.display = 'none';
  focusScanner();
}

/**
 * MUC 106 - "kiểm tra chức năng máy quét ... mất form nhập liệu": TRUOC DAY loi in lang le duoc
 * bao qua dialog.showErrorBox() BEN PHIA main.js (electron-widget) - 1 HOP THOAI HE DIEU HANH cuop
 * OS-level keyboard focus khoi cua so kiosk (luon fullscreen, khong ai truc de bam dong), khien may
 * quet ma (hoat dong y het ban phim vat ly) ngung nhap duoc vao #scanInput cho toi khi co ai vao
 * tan may bam OK - dung NGUYEN NHAN goc re gay ra phan anh "quét một lúc thì không nhập liệu được
 * nữa". Da BO hop thoai do (xem ghi chu chi tiet trong printTicketSilently() cua main.js), thay
 * bang kenh IPC KHONG CHAN 'print-error' (qua window.electronPrint.onPrintError() - xem preload.js)
 * - o day CHI hien 1 dong canh bao NHO, TU BIEN MAT sau vai giay, KHONG lam mat focus/chan tuong
 * tac gi ca (khac han native dialog). Benh nhan van thay duoc so cua minh (ve da duoc tao thanh
 * cong du in loi hay khong), nhan vien/IT xem lai chi tiet loi qua file log (xem logPrintIssue()
 * trong main.js) khi can. Chi co tac dung trong Electron (window.electronPrint chi ton tai o do);
 * mo bang trinh duyet thuong thi khong co gi de dang ky (khong anh huong gi, im lang bo qua).
 */
(function setupPrintErrorToast() {
  if (!window.electronPrint || typeof window.electronPrint.onPrintError !== 'function') return;
  let toastEl = null;
  let toastTimer = null;
  window.electronPrint.onPrintError((message) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'printErrorToast';
      toastEl.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)',
        'max-width:90%', 'background:#7f1d1d', 'color:#fff', 'font-size:13px',
        'padding:8px 14px', 'border-radius:8px', 'box-shadow:0 2px 8px rgba(0,0,0,.3)',
        'z-index:99999', 'text-align:center', 'pointer-events:none',
      ].join(';');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = 'Lỗi in phiếu (số vẫn được cấp bình thường): ' + message;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 6000);
  });
})();
