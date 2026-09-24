/**
 * Kiosk cap so danh cho NHAN VIEN: nhan vien tu chon dung 1 nut de cap so cho benh nhan,
 * duoc cap CA "Cấp cứu" (uu tien cao nhat) - khac hoan toan kiosk cong khai (/kiosk) chi cho
 * phep chon trong cac nut ma he thong xac dinh du dieu kien qua QR.
 *
 * Bam 1 nut doi tuong se LUON chuyen thang sang man hinh "Sẵn sàng quét" (khong con hoi xac
 * nhan confirm() nhu truoc), tai day nhan vien co 2 lua chon:
 *  - Quet CCCD/BHYT cua benh nhan de XAC MINH: dung LAI ket qua "cooldown" (da co san o API
 *    /api/tickets/parse-qr) de kiem tra xem nguoi nay co VUA lay so o kiosk benh nhan (hoac o
 *    chinh kiosk nhan vien nay) trong may phut gan day khong - tranh cap trung so cho 1 nguoi
 *    da lay o kiosk roi con qua quay nhan vien lay them.
 *  - Bam nut **"🚀 Cấp số ngay"** de BO QUA xac minh hoan toan, cap so tu do ngay lap tuc,
 *    khong can giay to gi (danh cho truong hop khan/khong the/khong can quet).
 */

let priorityOptionsCache = [];
const verifyState = { priorityCode: null, cccdRaw: null, bhytRaw: null, cccd: null, bhyt: null };

// So giay tu dong quay lai man hinh chon doi tuong sau khi cap so xong - dung CHUNG cau hinh
// KIOSK_AUTO_CONFIRM_SECONDS voi kiosk cong khai (/kiosk), xem startDoneCountdown() ben duoi.
let autoConfirmSeconds = 5;

// STAFF_KIOSK_SKIP_VERIFY (.env, xem src/routes/kioskConfig.js) - true = bam chon 1 doi tuong o
// luoi nut se CAP SO NGAY LAP TUC (bo qua han man hinh "Sẵn sàng quét"), xem startVerify() ben
// duoi. Mac dinh false (giu nguyen hanh vi cu).
let staffKioskSkipVerify = false;
// Gioi han so luong toi da cho vong lap "cấp nhiều số" tu dong (STAFF_BATCH_MAX_QUANTITY trong
// .env, xem src/routes/kioskConfig.js) - CHI con duoc kiem tra o day (client), khong con route
// server rieng nao kiem tra lai (xem confirmAndStartAutoIssueSeq() o duoi). Mac dinh 50 (khop gia
// tri mac dinh phia server) neu chua kip tai xong cau hinh.
let staffBatchMaxQuantity = 50;
(async function loadKioskConfig() {
  try {
    const res = await fetch('/api/kiosk-config');
    const data = await res.json();
    if (Number.isFinite(data.autoConfirmSeconds)) autoConfirmSeconds = data.autoConfirmSeconds;
    staffKioskSkipVerify = !!data.staffKioskSkipVerify;
    if (Number.isFinite(data.staffBatchMaxQuantity) && data.staffBatchMaxQuantity >= 1) {
      staffBatchMaxQuantity = data.staffBatchMaxQuantity;
    }
  } catch {
    // Khong lay duoc cau hinh (vi du mat mang tam thoi) -> dung gia tri mac dinh o tren (5 giay,
    // KHONG bo qua man hinh xac minh, gioi han 50 so/lan cap tu dong).
  }
})();

// Ten don vi/dong chan trang (tu .env qua /api/branding) - dung de in len phieu, xem
// createStaffTicket() va public/print-receipt.js.
let brandClinicName = 'Hệ thống bắt số';
let brandFooterText = '';
let brandFooterText2 = '';
let brandPrintLogoImage = '';
(async function loadBrandingForReceipt() {
  try {
    const res = await fetch('/api/branding');
    const data = await res.json();
    brandClinicName = data.clinicName || brandClinicName;
    brandFooterText = data.footerText || '';
    brandFooterText2 = data.footerText2 || '';
    brandPrintLogoImage = data.printLogoImage || '';
  } catch {
    // Khong lay duoc (vi du mat mang tam thoi) -> giu gia tri mac dinh, khong anh huong den viec cap so.
  }
})();

/**
 * Chi tiet so luong dang cho theo TUNG doi tuong uu tien + doi tuong thuong (7 uu tien + 1 thuong
 * = 8, zero-fill du ca cac loai dang co 0 nguoi cho) - hien ngay tren luoi chon doi tuong, cap nhat
 * REALTIME qua socket.io giong /waiting-screen, /patient-screen va /kiosk (dung chung y het
 * pattern renderPriorityCountBox()). Giup nhan vien nhin thoang la biet dang dong loai nao, khong
 * can mo rieng man hinh cho.
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

const scanInput = document.getElementById('scanInput');
const verifyStatus = document.getElementById('verifyStatus');
const verifyWarning = document.getElementById('verifyWarning');

/**
 * MUC 108 - "trên widget ... quét xong nó chỉ cần hiện 1 cái cảnh báo lên là bị ... không nhập dc
 * gì được nữa": TRUOC DAY nhieu loi xay ra TU DONG NGAY SAU khi quet ma (khong can bam gi them, vi
 * du bi chan boi rao can cap so uu tien - checkPriorityIssueGate() trong ticketService.js, hoac ma
 * QR "cấp nhanh" khong hop le) duoc bao bang `alert(...)` - 1 HOP THOAI CHAN (blocking dialog).
 * Trong Electron, `window.alert()`/`window.confirm()` goi tu renderer CO THE khong tu tra lai
 * OS-level keyboard focus cho BrowserWindow sau khi dong (dung nguyen nhan da tim thay o MUC 106
 * voi `dialog.showErrorBox()` cua main process) - dac biet nguy hiem voi loi xay ra TU DONG (khong
 * ai chu dong bam nut truoc do de "biet truoc" se co hop thoai) tren 1 man hinh van hanh lien tuc
 * bang may quet. Ham nay thay the: hien 1 dong canh bao NHO o gop man hinh, KHONG CHAN thao tac gi,
 * TU BIEN MAT sau vai giay - dung CHUNG cho ca canh bao loi in (MUC 106) LAN loi cap so/QR cap nhanh
 * tu dong sau khi quet (MUC 108, xem processQuickQrScan()/createStaffTicket() ben duoi).
 */
let scannerToastEl = null;
let scannerToastTimer = null;
function showScannerToast(message, opts) {
  if (!scannerToastEl) {
    scannerToastEl = document.createElement('div');
    scannerToastEl.id = 'scannerToast';
    scannerToastEl.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)',
      'max-width:90%', 'font-size:13px', 'padding:8px 14px', 'border-radius:8px',
      'box-shadow:0 2px 8px rgba(0,0,0,.3)', 'z-index:99999', 'text-align:center',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(scannerToastEl);
  }
  const isError = !opts || opts.level !== 'info';
  scannerToastEl.style.background = isError ? '#7f1d1d' : '#1e3a8a';
  scannerToastEl.style.color = '#fff';
  scannerToastEl.textContent = message;
  scannerToastEl.style.display = 'block';
  clearTimeout(scannerToastTimer);
  scannerToastTimer = setTimeout(() => { scannerToastEl.style.display = 'none'; }, (opts && opts.durationMs) || 6000);
}

/**
 * MUC 108 (bo sung theo phan anh "còn 1 số cảnh báo confirm chiếm quyền nữa ở form staff-kiosk"):
 * ban dau chi doi CAC alert()/confirm() TU DONG sau khi quet (khong can bam nut) vi cho rang cac
 * `confirm()` con lai (xac nhan cap nhieu so, xac nhan "chuyển ngày") an toan hon do NHAN VIEN CHU
 * DONG bam nut truoc khi hop thoai hien ra. THUC TE nguoi dung phan anh la KHONG dung - hop thoai
 * `window.confirm()`/`window.alert()` cua Chromium trong Electron co the KHONG tra lai OS-focus cho
 * BrowserWindow SAU KHI DONG bat ke hop thoai do ai/vi sao mo ra (nut bam hay tu dong deu nhu nhau),
 * vi day la hanh vi cua CHINH co che hop thoai JS mac dinh, khong lien quan gi toi nguyen nhan mo no.
 * => XOA HAN moi `window.alert()`/`window.confirm()` con lai trong file nay, thay bang 1 modal XAC
 * NHAN tu dung DOM/CSS (KHONG dung API hop thoai native nao cua trinh duyet/Electron ca) - vi la
 * DOM thuan tuy ve trong CHINH trang web dang chay trong BrowserWindow, KHONG co "cua so"/"tien
 * trinh" nao khac duoc tao ra, nen KHONG co co che nao co the lam mat OS-level focus cua
 * BrowserWindow hien tai (khac han hop thoai native, luon la 1 kieu cua so/lop rieng cua he dieu
 * hanh). Dung Promise de giu nguyen duoc cau truc code `await` nhu cu o cac noi goi.
 */
let scannerConfirmEl = null;
function showScannerConfirm(message, opts) {
  return new Promise((resolve) => {
    if (!scannerConfirmEl) {
      scannerConfirmEl = document.createElement('div');
      scannerConfirmEl.id = 'scannerConfirmOverlay';
      scannerConfirmEl.style.cssText = [
        'position:fixed', 'inset:0', 'background:rgba(15,23,42,.55)', 'z-index:999999',
        'display:flex', 'align-items:center', 'justify-content:center', 'padding:20px',
      ].join(';');
      const box = document.createElement('div');
      box.id = 'scannerConfirmBox';
      box.style.cssText = [
        'background:#fff', 'border-radius:14px', 'max-width:480px', 'width:100%',
        'padding:20px', 'box-shadow:0 8px 30px rgba(0,0,0,.35)',
      ].join(';');
      const msgEl = document.createElement('div');
      msgEl.id = 'scannerConfirmMsg';
      msgEl.style.cssText = 'white-space:pre-wrap; font-size:15px; line-height:1.5; color:#0f172a; margin-bottom:18px;';
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.id = 'scannerConfirmCancelBtn';
      cancelBtn.className = 'btn-secondary';
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.id = 'scannerConfirmOkBtn';
      okBtn.className = 'btn-primary';
      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(okBtn);
      box.appendChild(msgEl);
      box.appendChild(btnRow);
      scannerConfirmEl.appendChild(box);
      document.body.appendChild(scannerConfirmEl);
    }
    const msgEl = scannerConfirmEl.querySelector('#scannerConfirmMsg');
    const okBtn = scannerConfirmEl.querySelector('#scannerConfirmOkBtn');
    const cancelBtn = scannerConfirmEl.querySelector('#scannerConfirmCancelBtn');
    msgEl.textContent = message;
    okBtn.textContent = (opts && opts.confirmLabel) || 'Xác nhận';
    cancelBtn.textContent = (opts && opts.cancelLabel) || 'Huỷ';
    cancelBtn.style.display = (opts && opts.hideCancel) ? 'none' : '';
    scannerConfirmEl.style.display = 'flex';
    function cleanup(result) {
      scannerConfirmEl.style.display = 'none';
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(result);
    }
    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
  });
}

/**
 * ===== Phat hien dien thoai/may tinh bang =====
 * Dung de: (1) AN hanh vi tu dong focus o #scanInput (danh cho may quet QR USB kieu ban phim -
 * khong ton tai tren dien thoai/may tinh bang, ma focus 1 o input van con tren cac thiet bi nay
 * se tu dong bat BAN PHIM AO lien tuc, rat kho chiu vi ham nay chay lap lai moi 800ms); va
 * (2) HIEN nut "Cài đặt ứng dụng" (PWA) - chi co y nghia tren dien thoai/may tinh bang, may tinh
 * ban/laptop khong can "cai vao man hinh chinh".
 */
function detectIsIOS() {
  const ua = navigator.userAgent || navigator.vendor || '';
  // iPadOS 13+ gia mao UserAgent giong macOS Desktop Safari - phai kiem tra them so diem cham
  // (navigator.maxTouchPoints) de phan biet iPad that voi may Mac that (khong co cam ung).
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
function detectIsAndroid() {
  return /Android/i.test(navigator.userAgent || '');
}
const IS_IOS = detectIsIOS();
const IS_MOBILE_OR_TABLET = IS_IOS || detectIsAndroid();

function isRunningStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function loadPriorityOptions() {
  const grid = document.getElementById('priorityGrid');
  try {
    const res = await fetch('/api/tickets/staff-options');
    if (res.status === 401) {
      location.href = '/?next=' + encodeURIComponent('/staff-kiosk/');
      return;
    }
    const options = await res.json();
    priorityOptionsCache = options;
    grid.innerHTML = options
      .map((o) => {
        const isEmergency = o.code === 'EMERGENCY';
        const cls = isEmergency ? 'priority-btn emergency' : 'priority-btn';
        // "Đối tượng thường" doi mau nen sang den nhat (#4b5563) nen cung can chu TRANG nhu nut
        // "Cấp cứu", khac voi cac doi tuong con lai (mau nen nhat hon, chu toi la du doc). "PRIORITY"
        // (ma gop chung khi PRIORITY_MODE=basic, cung mau do dam #dc2626 - xem
        // src/config/priorityRules.js) cung can chu trang tuong tu.
        const style = isEmergency || o.code === 'PRIORITY' || o.code === 'NORMAL'
          ? `background:${o.color}; color:#fff;`
          : `background:${o.color}; color:#0f172a;`;
        // Nut nho "📱 QR" CHI hien khi doi tuong nay da cau hinh QUICK_QR_CODE_<code> trong .env
        // (o.hasSecret, xem GET /api/tickets/staff-options) - tao ma QR "cap nhanh" rieng cho
        // doi tuong do (xem showQuickQr() ben duoi). Escape dau nhay don trong label truoc khi
        // nhet vao thuoc tinh onclick (dang dung nhay don lam dau phan cach tham so JS).
        const escLabel = o.label.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const quickBtn = o.hasSecret
          ? `<button type="button" class="btn-secondary quick-qr-btn" onclick="event.stopPropagation(); showQuickQr('${o.code}', '${escLabel}')" title="Tạo mã QR cấp nhanh cho đối tượng này">📱 QR</button>`
          : '';
        return `<div class="priority-row${isEmergency ? ' emergency-row' : ''}">
          <button class="${cls}" style="${style}" onclick="handlePriorityClick('${o.code}')">${o.label}</button>
          ${quickBtn}
        </div>`;
      })
      .join('');
  } catch {
    grid.innerHTML = '<div class="muted">Không tải được danh sách đối tượng ưu tiên, vui lòng tải lại trang.</div>';
  }
}

function labelForCode(code) {
  const found = priorityOptionsCache.find((o) => o.code === code);
  return found ? found.label : code;
}

function priorityColorForCode(code) {
  const found = priorityOptionsCache.find((o) => o.code === code);
  return found ? found.color : '#1d4ed8';
}

/**
 * `staffKioskSkipVerify` (STAFF_KIOSK_SKIP_VERIFY trong .env - xem src/routes/kioskConfig.js) -
 * theo phan anh cua nguoi dung: "khi nhân viên đang xác minh ở bước này vô tình BN quét thẻ của
 * họ thì lại sai thông tin" - tuc la trong luc man hinh "Sẵn sàng quét" con dang mo (cho nhan
 * vien tu quyet dinh quet xac minh hay bam "Cấp số ngay"), NEU dung luc do co 1 luot quet CUA
 * BENH NHAN KHAC (khong lien quan gi toi doi tuong nhan vien vua chon) lot vao, he thong se HIEU
 * NHAM do la luot quet xac minh cho doi tuong dang cho (xem processScanText(), nhanh THU CONG -
 * van giu nguyen hanh vi nay khi STAFF_KIOSK_SKIP_VERIFY=false, vi do la tinh nang XAC MINH co
 * chu dich). SUA: khi bat STAFF_KIOSK_SKIP_VERIFY=true, BO HAN man hinh trung gian nay - bam
 * chon 1 doi tuong la CAP SO NGAY LAP TUC (goi thang issuePriorityImmediately() ben duoi, tuong
 * duong nhu da bam san nut "Cấp số ngay – bỏ qua xác minh"), KHONG con "cua so thoi gian" nao de
 * 1 luot quet la cua nguoi khac co the bi gan nham vao dau ca - vi `verifyState.priorityCode`
 * KHONG con duoc dat/giu o trang thai "cho" nua, nen bat ky luot quet nao toi sau do (neu co) se
 * bi BO QUA (xem processScanText() - muc 90 da bo han nhanh "quét tự động" rieng, khong con xu ly
 * gi voi 1 luot quet khi chua co doi tuong nao dang cho ca).
 */
/**
 * Doc gia tri o nhap "Số lượng cần cấp" (#batchQtyInput, xem index.html) - tra ve 1 (mac dinh)
 * neu o trong/khong hop le/nho hon 1, KHONG BAO GIO tra ve gia tri < 1 de tranh cac noi goi ham
 * nay nham lam voi 0/am.
 */
function getBatchQuantity() {
  const el = document.getElementById('batchQtyInput');
  if (!el) return 1;
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) && v >= 1 ? v : 1;
}

/**
 * Dat lai gia tri o "Số lượng cần cấp" ve DUNG 1 con so (KHONG doc/ghi tuong doi qua input.value
 * hien tai - tranh truong hop input dang chua gia tri rac/rong lam phep cong tru sai). Goi tu 2
 * noi: (1) cac nut tang/giam nhanh -10/-1/+1/+10 (stepBatchQuantity()); (2) resetBatchQuantity()
 * TU DONG ve lai 1 sau khi cap hang loat xong (theo yeu cau nguoi dung: "input Số lượng cần cấp tự
 * động reset về 1 sau khi cấp nhiều số xong để tránh sai sót" - tranh nhan vien quen doi lai ve 1,
 * bam nham 1 doi tuong khac o lan ke tiep roi cap nham hang chuc so ngoai y muon).
 */
function setBatchQuantity(value) {
  const el = document.getElementById('batchQtyInput');
  if (!el) return;
  const v = Math.max(1, Math.floor(Number(value) || 1));
  el.value = String(v);
}

function resetBatchQuantity() {
  setBatchQuantity(1);
}

/**
 * MOI (theo yeu cau nguoi dung: "ở màn hình /staff-kiosk/ thêm mới các nút tăng giảm 1 đơn vị,
 * tăng giảm 10 đơn vị vì màn hình này người dùng sử dụng máy quét để cấp số" - man hinh nay
 * chu yeu thao tac qua may quet/cham, go so bang ban phim [ao] bat tien hon nhieu nen bam nut se
 * nhanh/chinh xac hon). `delta` la +1/-1/+10/-10 (xem cac nut trong index.html) - LUON dua tren
 * gia tri HIEN TAI cua o nhap (`getBatchQuantity()`, da tu chuan hoa ve so nguyen hop le), khong
 * bao gio cho ve duoi 1 (setBatchQuantity() da tu chan o muc do do).
 */
function stepBatchQuantity(delta) {
  setBatchQuantity(getBatchQuantity() + delta);
}

/**
 * SUA LAI LAN NUA THEO YEU CAU MOI NHAT (RO RANG NHAT) cua nguoi dung, sau khi muc 87 (vong lap
 * rieng voi awaitPrint/startCountdown + thanh tien do/nut "Dừng" tren step-done) van bi tu choi:
 * "tức là bỏ hết code. cấp tự động ở màn hình staff-kiosk đi. Base từ luồng cấp 1 phiếu. Số lượng
 * phiếu cần cấp tuần tự nó thay máy tính tự động cấp stt nhưng phải tuân thủ qui trình của cấp 1
 * phiếu. không được bypass qua bước nào hết. tôi có thể yêu cầu dừng ở màn hình nhập số lượng cần
 * cấp".
 *
 * TRUOC DAY (muc 87): "Số lượng cần cấp" > 1 goi 1 ham RIENG (issuePriorityImmediately voi
 * `opts.awaitPrint`/`opts.startCountdown`) CHAY TRONG 1 vong lap `while` cua chinh no, tu quan ly
 * tien do/dung lai - VAN la 1 "luong rieng" khac voi thao tac tay, chi khac cho khong con goi API
 * rieng nhu muc 81-86 nua. Day la dieu nguoi dung tiep tuc KHONG dong y.
 *
 * BAY GIO: KHONG con ham/tham so rieng nao ca. `issuePriorityImmediately()`, `createStaffTicket()`,
 * `showDoneTicket()` duoc TRA VE Y HET nhu truoc muc 87 (khong `opts`, luon in "bắn rồi thôi", luon
 * tu bat dem nguoc). Khi "Số lượng cần cấp" > 1, buoc DAU TIEN goi THANG `startVerify(priorityCode)`
 * - CHINH XAC ham ma 1 cai bam nut binh thuong se goi - nen NEU STAFF_KIOSK_SKIP_VERIFY=false, man
 * hinh "Sẵn sàng quét" van hien ra va cho nhan vien tu quet CCCD/BHYT (KHONG bypass buoc xac minh);
 * chi khi STAFF_KIOSK_SKIP_VERIFY=true thi startVerify() moi tu cap ngay (dung HANH VI CO SAN cua
 * chinh startVerify(), khong phai code rieng cho "cấp nhiều số").
 *
 * Diem TU DONG DUY NHAT nam o `resetForm()` (ham co san, LUON duoc goi khi 1 phieu "hoan tat vong
 * doi" cua no - het gio tu dong dem nguoc tren step-done, giong HET nhu khi nhan vien cap 1 so
 * binh thuong roi doi no tu quay ve man hinh chinh): neu dang co 1 chuoi "cấp nhiều số" con dang
 * chay (`autoIssueSeq`), `maybeContinueAutoIssueSeq()` se TU bam ho nut cua CHINH doi tuong do lan
 * nua (goi lai `startVerify()`) sau 1 khoang cho ngan HIEN THI RO tren man hinh nhap so luong
 * (step-form) - dung noi nguoi dung yeu cau dat nut dung ("tôi có thể yêu cầu dừng ở màn hình nhập
 * số lượng cần cấp"), KHONG con tren step-done nhu muc 87 nua.
 */
let autoIssueSeq = null; // { priorityCode, remaining, total } - null = khong dang co chuoi tu dong nao
let autoIssueContinueTimer = null;
// Khoang cho HIEN THI RO tren step-form giua 2 lan cap tu dong lien tiep - du de nhan vien kip bam
// "Dừng" neu muon, nhung khong qua lau lam cham tien do cap so (STAFF_KIOSK_SKIP_VERIFY=true).
const AUTO_ISSUE_CONTINUE_DELAY_MS = 1500;

async function handlePriorityClick(priorityCode) {
  const qty = getBatchQuantity();
  if (qty > 1) {
    await confirmAndStartAutoIssueSeq(priorityCode, qty);
    return;
  }
  startVerify(priorityCode);
}

/** Hoi xac nhan truoc khi bat dau 1 chuoi "cấp nhiều số" tu dong (giu nguyen tinh than confirm()
 * tu truoc - tranh cap nham hang chuc so chi vi bam nham nut/chua kip doi lai o so luong). Cung
 * kiem tra qua nguong STAFF_BATCH_MAX_QUANTITY (xem GET /api/kiosk-config) - CHI con la 1 phep
 * kiem tra o PHIA CLIENT (moi lan cap trong chuoi la 1 lan goi `startVerify()` BINH THUONG, giong
 * het nhu bam tay, khong con route server rieng nao kiem tra lai gia tri nay nua).
 * MUC 108 (bo sung): doi `alert()`/`confirm()` native sang `showScannerToast()`/`showScannerConfirm()`
 * (modal DOM thuan tuy, khong dung API hop thoai cua trinh duyet) - theo phan anh cua nguoi dung la
 * cac hop thoai NAY (du do NHAN VIEN CHU DONG bam nut moi mo ra) VAN co the khong tra lai duoc
 * OS-focus cho widget sau khi dong trong Electron, giong het cac truong hop da sua o tren. */
async function confirmAndStartAutoIssueSeq(priorityCode, quantity) {
  if (quantity > staffBatchMaxQuantity) {
    showScannerToast(
      `Số lượng cần cấp tối đa mỗi lần là ${staffBatchMaxQuantity} số ` +
      `(cấu hình qua STAFF_BATCH_MAX_QUANTITY trong .env). Vui lòng giảm số lượng rồi thử lại.`,
      { durationMs: 8000 }
    );
    return;
  }
  const label = labelForCode(priorityCode);
  const ok = await showScannerConfirm(
    `Xác nhận CẤP TỰ ĐỘNG ${quantity} số "${label}"? Hệ thống sẽ lần lượt cấp từng số một, ĐÚNG THEO ` +
    `quy trình cấp 1 số bình thường (không bỏ qua bước xác minh nếu đang bật) - có thể bấm "Dừng" ở ` +
    `màn hình chọn đối tượng bất kỳ lúc nào giữa 2 lần cấp.`,
    { confirmLabel: 'Cấp tự động' }
  );
  if (!ok) return;
  // Dat lai NGAY ve 1 - TRUOC KHI bat dau (tranh nhan vien lo bam sang doi tuong khac trong luc
  // dang tu dong cap dang do va vo tinh dung lai dung so luong cua lan TRUOC do).
  resetBatchQuantity();
  autoIssueSeq = { priorityCode, remaining: quantity - 1, total: quantity };
  updateAutoIssueSeqUI();
  // Buoc DAU TIEN cua chuoi CHINH LA 1 lan bam nut binh thuong - khong bypass gi ca.
  startVerify(priorityCode);
}

/** Goi tu `resetForm()` (xem ben duoi) - MOI LAN 1 phieu "xong vong doi" (dem nguoc step-done het
 * gio, huy xac minh, v.v.) va quay ve step-form, kiem tra xem co dang giua 1 chuoi "cấp nhiều số"
 * hay khong; neu con so luong can cap, hen gio (KHONG cap ngay lap tuc) bam ho nut doi tuong do 1
 * lan nua. Neu bi "Dừng" (stopAutoIssueSeq()) trong luc dang cho, `autoIssueSeq` da bi xoa nen lan
 * hen gio nay tu huy, khong cap tiep nua. */
function maybeContinueAutoIssueSeq() {
  if (!autoIssueSeq) return;
  if (autoIssueSeq.remaining <= 0) {
    // Da cap du so luong yeu cau - chuoi tu ket thuc, khong can lam gi them.
    autoIssueSeq = null;
    updateAutoIssueSeqUI();
    return;
  }
  autoIssueSeq.remaining -= 1;
  updateAutoIssueSeqUI();
  const priorityCode = autoIssueSeq.priorityCode;
  clearTimeout(autoIssueContinueTimer);
  autoIssueContinueTimer = setTimeout(() => {
    if (!autoIssueSeq) return; // Da bi bam "Dừng" trong luc dang cho.
    startVerify(priorityCode);
  }, AUTO_ISSUE_CONTINUE_DELAY_MS);
}

/** Goi tu nut "Dừng" tren man hinh nhap so luong (step-form, xem index.html) - dung theo DUNG yeu
 * cau "tôi có thể yêu cầu dừng ở màn hình nhập số lượng cần cấp": chi huy phan HEN GIO cap tiep (neu
 * dang cho) va xoa trang thai chuoi - KHONG dong lenh cap/in cua so VUA cap (da hoan tat roi moi
 * quay ve duoc man hinh nay). */
function stopAutoIssueSeq() {
  clearTimeout(autoIssueContinueTimer);
  autoIssueSeq = null;
  updateAutoIssueSeqUI();
}

/** Hien/an dong trang thai "Đang tự động cấp tiếp..." + nut "Dừng" tren man hinh step-form (KHONG
 * con tren step-done nhu muc 87 nua - dung dung vi tri nguoi dung yeu cau). */
function updateAutoIssueSeqUI() {
  const box = document.getElementById('autoIssueSeqBox');
  const textEl = document.getElementById('autoIssueSeqText');
  if (!box || !textEl) return;
  if (autoIssueSeq) {
    box.style.display = 'block';
    const label = labelForCode(autoIssueSeq.priorityCode);
    const issuedSoFar = autoIssueSeq.total - autoIssueSeq.remaining - 1;
    textEl.textContent =
      `Đang tự động cấp tiếp "${label}" — đã cấp ${issuedSoFar}/${autoIssueSeq.total}, sắp cấp số tiếp theo...`;
  } else {
    box.style.display = 'none';
  }
}

/**
 * MUC 91 - theo yeu cau nguoi dung: "nhớ kiểm tra xem cấp số thứ tự hàng loạt còn chạy thì không
 * được nút nào được phép thoát khỏi màn hình staff-kiosk". Dung CHUNG cho MOI noi co the dieu
 * huong ROI KHOI trang /staff-kiosk (nut "Trang chủ", nut "Chuyển sang kiosk bốc số" moi them, va
 * ca luot quet QR "đăng nhập nhanh" chuyen thang sang /kiosk/ - xem tryStaffQrShortcut() ben duoi)
 * - CHAN LAI (khong cho di) neu dang co 1 chuoi "cấp nhiều số" tu dong con dang chay
 * (`autoIssueSeq`), bao nhan vien biet ly do va huong dan bam "Dừng" truoc (o man hinh nhap so
 * luong, xem #autoIssueSeqBox). Tra ve `true` (cho phep di tiep, dung cho onclick="return ...") neu
 * KHONG dang co chuoi nao chay, `false` neu bi chan.
 */
function guardLeaveStaffKiosk(evt) {
  if (!autoIssueSeq) return true;
  if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
  // MUC 108 (bo sung): ham nay KHONG CHI duoc goi tu nut bam (co `evt`) ma con duoc goi TU DONG
  // ngay sau 1 luot quet QR "đăng nhập nhanh" (xem tryStaffQrShortcut() - goi khong co `evt`) - tuc
  // la CUNG la 1 duong quet co the trigger alert() ma khong co nut nao duoc bam truoc do, giong het
  // cac truong hop da sua o tren. Doi sang showScannerToast() (khong chan) cho dong bo & an toan.
  showScannerToast(
    `Đang trong chuỗi "cấp nhiều số" tự động (còn phải cấp ${autoIssueSeq.remaining + 1}/${autoIssueSeq.total} số) - ` +
    `vui lòng bấm "Dừng" ở màn hình nhập số lượng cần cấp trước khi rời khỏi màn hình này.`,
    { durationMs: 8000 }
  );
  return false;
}

function startVerify(priorityCode) {
  if (staffKioskSkipVerify) {
    issuePriorityImmediately(priorityCode);
    return;
  }

  verifyState.priorityCode = priorityCode;
  verifyState.cccdRaw = null;
  verifyState.bhytRaw = null;
  verifyState.cccd = null;
  verifyState.bhyt = null;

  document.getElementById('step-form').style.display = 'none';
  document.getElementById('step-verify').style.display = 'block';
  document.getElementById('verifyPriorityLabel').textContent = labelForCode(priorityCode);
  verifyStatus.textContent = 'Sẵn sàng quét...';
  hideVerifyWarning();
  focusScanInput();
}

/** Cap so NGAY LAP TUC cho 1 doi tuong da chon, KHONG qua man hinh "Sẵn sàng quét" - dung khi
 * STAFF_KIOSK_SKIP_VERIFY=true (xem startVerify() o tren). Chu dong don dep `verifyState` (dat ve
 * rong) TRUOC khi tao ve, tranh truong hop con sot du lieu CCCD/BHYT tu 1 lan xac minh THU CONG
 * truoc do (luc STAFF_KIOSK_SKIP_VERIFY con la false) khien phieu in nham thong tin benh nhan CU.
 *
 * KHONG con tham so `opts` nao nua (muc 89 - bo het `awaitPrint`/`startCountdown` cua muc 87): ham
 * nay LUON hanh xu giong HET nhu khi bam tay 1 nut, bat ke dang duoc goi thu cong hay tu dong tu
 * `maybeContinueAutoIssueSeq()` - dung tinh than "Base từ luồng cấp 1 phiếu ... không được bypass
 * qua bước nào hết" cua nguoi dung.
 */
async function issuePriorityImmediately(priorityCode) {
  verifyState.priorityCode = null;
  verifyState.cccdRaw = null;
  verifyState.bhytRaw = null;
  verifyState.cccd = null;
  verifyState.bhyt = null;
  return createStaffTicket(priorityCode, null);
}

/** Muc 89: neu nhan vien tu bam "Huỷ, quay lại" giua chung 1 chuoi "cấp nhiều số" tu dong (vi du
 * dang cho quet CCCD/BHYT o 1 buoc xac minh do chinh chuoi tu dong mo ra), coi day la 1 yeu cau
 * DUNG chuoi do luon - tranh truong hop nhan vien tuong da dung nhung chuoi van "am tham" tiep tuc
 * cap tiep o lan quay ve step-form ke tiep. */
function cancelVerify() {
  verifyState.priorityCode = null;
  if (window.CameraScan) window.CameraScan.close(); // dong camera neu dang mo do (an toan, khong lam gi neu chua mo)
  if (autoIssueSeq) stopAutoIssueSeq();
  document.getElementById('step-verify').style.display = 'none';
  document.getElementById('step-form').style.display = 'block';
}

/** Bo qua xac minh hoan toan tu man hinh "San sang quet" - cap so tu do ngay, khong can quet gi. */
async function issueWithoutVerify() {
  if (!verifyState.priorityCode) return;
  verifyStatus.textContent = 'Đang cấp số...';
  hideVerifyWarning();
  // MUC 108: cung nguyen tac voi finishVerifyAndCreate() o tren - CHI an step-verify khi thanh cong.
  const ok = await createStaffTicket(verifyState.priorityCode, null);
  if (ok) document.getElementById('step-verify').style.display = 'none';
}

/**
 * Truoc day CHI focus o quet trong luc dang o buoc "Sẵn sàng quét" (step-verify) - nay MO RONG
 * sang CA man hinh chinh (step-form, dang hien danh sach nut doi tuong) de nhan vien co the quet
 * 1 ma QR "cap nhanh" (xem QUICKQR_PREFIX/processQuickQrScan() ben duoi) BAT KY LUC NAO ma khong
 * can bam chon doi tuong truoc - dung tinh than "cấp nhanh" cua tinh nang nay. Chi TAT focus khi
 * dang o man hinh "Số thứ tự vừa cấp" (step-done, luc nay dang dem nguoc tu quay lai).
 */
function focusScanInput() {
  // Tren dien thoai/may tinh bang KHONG co may quet USB kieu ban phim - bo qua, khong focus o
  // input an nay (neu khong se tu dong bat ban phim ao lien tuc, gay kho chiu khi nhan vien dang
  // thao tac man hinh bang tay, vi ham nay chay lap lai moi 800ms).
  if (IS_MOBILE_OR_TABLET) return;
  // Khong focus khi dang o man hinh "Số thứ tự vừa cấp" (step-done) - man hinh nay gio dung
  // CHUNG cho ca luc cap 1 so binh thuong LAN tung so mot trong 1 chuoi "cấp nhiều số" tu dong
  // (muc 89) - tranh cuop focus trong luc dang tu dong cap/in lien tuc.
  if (document.getElementById('step-done').style.display === 'none') {
    scanInput.focus({ preventScroll: true });
  }
}
setInterval(focusScanInput, 800);

function showVerifyWarning(html, level) {
  verifyWarning.style.display = 'block';
  verifyWarning.innerHTML = html;
  if (level === 'blocked') {
    verifyWarning.style.background = '#fdecec';
    verifyWarning.style.border = '1px solid #f3a7a7';
    verifyWarning.style.color = '#b91c1c';
  } else {
    verifyWarning.style.background = '#fff7e6';
    verifyWarning.style.border = '1px solid #fbd7a5';
    verifyWarning.style.color = '#92400e';
  }
}
function hideVerifyWarning() {
  verifyWarning.style.display = 'none';
  verifyWarning.innerHTML = '';
}

/**
 * Xu ly 1 chuoi vua "quet" duoc - dung CHUNG cho CA 2 nguon: (1) may quet QR USB kieu ban phim
 * (go thang vao #scanInput, kich hoat khi bam Enter, xem listener ben duoi) VA (2) camera dien
 * thoai/may tinh bang qua CameraScan (xem openCameraScan() ben duoi) - ca 2 deu cho ra 1 chuoi
 * noi dung QR giong het nhau nen dung chung 1 ham xu ly, khong lap code.
 */
/** Giai thich ngan gon dieu kien khach quan cua 1 loai doi tuong - dung khi canh bao nhan vien
 * giay to vua quet KHONG thoa dieu kien (xem NEEDS_CONDITION_CHECK ben duoi). */
function conditionHintForCode(code) {
  if (code === 'AGE75') return 'cần đủ 75 tuổi trở lên, tính chính xác theo ngày sinh trên CCCD';
  if (code === 'CHILD6') return 'cần dưới 06 tuổi (chưa đủ 6 tuổi), tính chính xác theo ngày sinh trên CCCD';
  if (code === 'PREGNANT') return 'cần giới tính Nữ (theo CCCD hoặc thẻ BHYT)';
  return '';
}

/**
 * MUC 90: BO HAN tinh nang "QUET TU DONG" (autoIssueFromScan() cu) - truoc day, neu nhan vien CHUA
 * bam chon doi tuong nao (dang o man hinh chinh step-form, `verifyState.priorityCode` con rong) ma
 * co benh nhan tu quet CCCD/BHYT, he thong se TU DONG xac dinh doi tuong roi cap so ngay, hoan toan
 * DOC LAP voi thao tac cua nhan vien.
 *
 * Theo yeu cau nguoi dung (nguyen van): "màn hình staff-kiosk nếu đúng lúc đang chạy chuỗi tự động
 * mà có bệnh nhân khác tự quét CCCD/BHYT của họ ở cùng màn hình, trường hợp hiếm này chưa được
 * kiểm tra kỹ - loại bỏ code quét cccd/bhyt ở màn hình staff-kiosk nhé vì ko cần thiết nữa" - day
 * CHINH LA nguon goc cua 1 gioi han da cong bo o muc 89 (2 luong doc lap cung dung chung
 * resetForm()/step-done co the "dam" vao nhau khi ca 2 cung chay 1 luc). Vi tinh nang nay "khong
 * can thiet nua" (theo xac nhan cua nguoi dung), BO HAN thay vi sua/phan biet nguon goc cho phuc
 * tap - xoa het `autoIssueFromScan()`, `autoIssueBusy`, `showAutoScanNotice()`/`autoScanNoticeTimer`
 * va khoi HTML `#autoScanNotice` (xem index.html). Nho vay, KHONG con 2 luong doc lap tranh chap
 * step-done/resetForm() nua - gioi han da cong bo o muc 89 KHONG con xay ra duoc nua.
 *
 * Man hinh /staff-kiosk gio CHI con DUNG 1 cach de xac dinh danh tinh benh nhan: quet CCCD/BHYT
 * o buoc "Sẵn sàng quét" (step-verify) SAU KHI nhan vien da bam chon 1 doi tuong - dung tinh than
 * "kiosk cho NHÂN VIÊN chủ động chọn nút", khac voi kiosk cong khai (/kiosk) danh cho benh nhan tu
 * quet.
 */
async function processScanText(raw) {
  raw = (raw || '').trim();
  if (!raw) return;
  if (!verifyState.priorityCode) {
    // Chua bam chon doi tuong nao - bo qua luot quet nay (khong con luong "tu dong xac dinh doi
    // tuong" nua, xem ghi chu o tren). Nhan vien can bam chon 1 doi tuong TRUOC khi quet.
    return;
  }

  const parts = raw.split('|');
  const isLikelyCCCD = parts.length >= 6 && /^\d{12}$/.test(parts[0]);

  verifyStatus.textContent = 'Đang xử lý...';
  hideVerifyWarning();
  try {
    // Gui KEM CA giay to da quet truoc do trong cung luot xac minh nay (neu co) de server tong hop
    // dieu kien tren TOAN BO thong tin da xac minh duoc (vi du: da quet CCCD lay tuoi/gioi tinh,
    // gio quet them BHYT) - khong chi xet rieng 1 loai giay vua quet lan nay, tranh bao sai dieu
    // kien du nhan vien da quet du giay to.
    const payload = {
      cccdRaw: isLikelyCCCD ? raw : verifyState.cccdRaw,
      bhytRaw: isLikelyCCCD ? verifyState.bhytRaw : raw,
    };
    const res = await fetch('/api/tickets/parse-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi đọc QR');

    if (isLikelyCCCD) {
      verifyState.cccdRaw = raw;
      verifyState.cccd = data.cccd;
    } else {
      verifyState.bhytRaw = raw;
      verifyState.bhyt = data.bhyt;
    }

    // ===== Kiem tra dieu kien khach quan cua doi tuong DA CHON, dua tren CHINH giay to vua xac
    // minh - chi ap dung cho 3 loai co the xac minh duoc qua QR (≥75 tuoi, <6 tuoi, gioi tinh nu
    // cho "Phụ nữ có thai"); cac doi tuong con lai (khuyet tat, cong cach mang, cap cuu...) van tu
    // khai/nhan vien tu doi chieu bang mat nhu truoc, khong chan o day. Dung LAI ket qua
    // `getEligibleOptions()` tra ve tu server (`data.options`, xem src/config/priorityRules.js) -
    // CHI 1 nguon su that duy nhat cho tuoi/dieu kien, khong tu tinh toan rieng o client de tranh
    // sai lech (dac biet doi voi CHILD6: tre em tinh tuoi theo NGAY/THANG sinh chu khong chi nam,
    // getEligibleOptions() da dung dayjs().diff(dob, 'year') tinh chinh xac den tung ngay).
    const NEEDS_CONDITION_CHECK = ['AGE75', 'CHILD6', 'PREGNANT'];
    if (NEEDS_CONDITION_CHECK.includes(verifyState.priorityCode)) {
      const stillEligible = (data.options || []).some((o) => o.code === verifyState.priorityCode);
      if (!stillEligible) {
        verifyStatus.textContent = 'Đã quét xong - KHÔNG khớp điều kiện đối tượng đã chọn.';
        showVerifyWarning(
          `Giấy tờ vừa quét <b>không thoả điều kiện</b> của đối tượng "<b>${labelForCode(verifyState.priorityCode)}</b>" ` +
            `(${conditionHintForCode(verifyState.priorityCode)}). Vui lòng kiểm tra lại giấy tờ hoặc chọn lại đối tượng.<br/>` +
            `<div style="margin-top:10px; display:flex; gap:10px;">` +
            `<button class="btn-danger" onclick="proceedAfterOverride()">Vẫn cấp số (NV xác nhận đúng đối tượng)</button>` +
            `<button class="btn-secondary" onclick="cancelVerify()">Huỷ, chọn lại đối tượng</button>` +
            `</div>`,
          'blocked'
        );
        return;
      }
    }

    if (data.cooldown?.blocked) {
      const mins = Math.ceil(data.cooldown.remainingSeconds / 60);
      verifyStatus.textContent = 'Đã quét xong - phát hiện trùng.';
      showVerifyWarning(
        `Người này vừa lấy số cách đây khoảng ${mins} phút. Có thể họ đã tự lấy số ở kiosk rồi.<br/>` +
          `<div style="margin-top:10px; display:flex; gap:10px;">` +
          `<button class="btn-danger" onclick="proceedAfterOverride()">Vẫn cấp số mới</button>` +
          `<button class="btn-secondary" onclick="cancelVerify()">Huỷ, không cấp</button>` +
          `</div>`,
        'blocked'
      );
      return;
    }

    verifyStatus.textContent = 'Xác minh thành công, đang cấp số...';
    await finishVerifyAndCreate();
  } catch (err) {
    verifyStatus.textContent = 'Lỗi: ' + err.message;
  }
}

/** Tien to co dinh cua noi dung QR "cap nhanh" (xem QUICK_QR_CODE_... trong .env) - dung de phan
 * biet voi noi dung QR CCCD/BHYT thong thuong ngay khi vua quet xong, truoc khi thu parse gi ca. */
const QUICKQR_PREFIX = 'QUICKQR|';

/**
 * Diem vao DUNG CHUNG cho MOI nguon quet (may quet USB go vao #scanInput, camera dien thoai,
 * hoac tai anh QR len - xem openCameraScan()/openUploadScan() ben duoi) - tu dong phan biet QR
 * "cap nhanh" (tien to QUICKQR_PREFIX, xu ly rieng qua processQuickQrScan(), hoat dong BAT KY LUC
 * NAO ke ca dang o man hinh chinh chua chon doi tuong gi) voi QR CCCD/BHYT thong thuong (xu ly
 * nhu cu qua processScanText(), CHI co tac dung khi da bam chon 1 doi tuong va dang o buoc xac
 * minh - xem dieu kien verifyState.priorityCode trong ham do).
 */
/**
 * QR "dang nhap nhanh" cua nhan vien (GET /api/auth/login-qr, chi encode NGUYEN VAN mat khau nhan
 * vien - xem scanLoginInput trong public/index.html va staffExitScanInput trong kiosk.js) khong co
 * dau "|" nao, khac han QR CCCD/BHYT hay QR "cap nhanh" (QUICKQR_PREFIX). Neu quet dung QR nay tai
 * man hinh kiosk cap so NHAN VIEN, coi la muon CHUYEN NGAY sang kiosk boc so cho benh nhan
 * (/kiosk/) - tinh nang doi chieu voi chieu nguoc lai da them o public/kiosk/kiosk.js (quet QR nay
 * tai /kiosk/ se chuyen sang /staff-kiosk/). Hoat dong BAT KY LUC NAO (giong QR "cap nhanh"), khong
 * can dang chon doi tuong/o buoc xac minh gi. Xac thuc THAT SU o server (goi lai chinh API dang
 * nhap san co) truoc khi dieu huong, tranh truong hop 1 QR/ma vach khac (khong co dau "|") vo tinh
 * bi hieu nham thanh lenh chuyen man hinh - chi QR chua DUNG mat khau nhan vien moi duoc chap nhan.
 *
 * MUC 91: TRUOC KHI dieu huong di, kiem tra qua `guardLeaveStaffKiosk()` - neu dang co 1 chuoi
 * "cấp nhiều số" tu dong con dang chay thi CHAN LAI (khong chuyen man hinh), dung tinh than "không
 * được nút nào được phép thoát khỏi màn hình staff-kiosk" (ap dung ca cho luot quet QR nay, khong
 * chi cac nut bam thong thuong).
 */
async function tryStaffQrShortcut(raw) {
  try {
    const res = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: raw }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      if (guardLeaveStaffKiosk()) location.href = '/kiosk/';
      return;
    }
  } catch {
    // Loi mang - roi xuong canh bao chung ben duoi, giong het truong hop QR khong doc duoc.
  }
  // MUC 108 (bo sung): day CUNG la 1 duong quet TU DONG (handleScannedText() goi thang, khong qua
  // nut bam nao) - alert() cu co the cuop OS focus vinh vien trong Electron giong het cac truong
  // hop da sua o tren. Doi sang showScannerToast() (khong chan) cho dong bo.
  showScannerToast('Không đọc được mã QR, vui lòng quét CCCD hoặc thẻ BHYT.');
}

async function handleScannedText(raw) {
  raw = (raw || '').trim();
  if (!raw) return;
  if (raw.startsWith(QUICKQR_PREFIX)) {
    await processQuickQrScan(raw);
    return;
  }
  if (!raw.includes('|')) {
    await tryStaffQrShortcut(raw);
    return;
  }
  await processScanText(raw);
}

/**
 * Kiem tra chuoi vua quet co "hop le toi thieu" chua - dung lam dieu kien `isComplete` cho
 * ScannerBuffer (xem public/vendor/scanner-buffer.js): mot so may quet co ty le gui NHAM 1 Enter
 * GIUA CHUNG noi dung, neu tin ngay Enter dau tien se xu ly nham 1 chuoi CCCD/BHYT bi CAT CUT -
 * dac biet nguy hiem neu cat dung doan chua so CCCD/ma the BHYT (truong dung de doi chieu trung,
 * chong cap so trung lap va xac minh dieu kien doi tuong o processScanText()). Dinh dang: QR "cap
 * nhanh" (tien to QUICKQR_PREFIX) can co noi dung sau tien to; CCCD can it nhat 6 phan (phan dau
 * DU 12 chu so), BHYT can it nhat 4 phan - xem parseCCCD()/parseBHYT() trong src/services/qrParser.js.
 */
function looksLikeCompleteScan(raw) {
  if (raw.startsWith(QUICKQR_PREFIX)) return raw.length > QUICKQR_PREFIX.length;
  // Khong co dau "|" -> khong phai QR CCCD/BHYT, rat co the la QR "dang nhap nhanh" cua nhan vien
  // (xem tryStaffQrShortcut() o tren) - coi la du ngay de xu ly nhanh, khong can cho them.
  if (!raw.includes('|')) return true;
  const parts = raw.split('|');
  if (parts.length < 4) return false;
  const isLikelyCCCD = /^\d{12}$/.test(parts[0]);
  return isLikelyCCCD ? parts.length >= 6 : true;
}

if (window.ScannerBuffer) {
  window.ScannerBuffer.attach(scanInput, {
    onComplete: (raw) => handleScannedText(raw),
    isComplete: looksLikeCompleteScan,
  });
} else {
  // Du phong hiem gap (scanner-buffer.js khong tai duoc) - quay ve cach cu, khong chan luong chinh.
  scanInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const raw = scanInput.value.trim();
    scanInput.value = '';
    await handleScannedText(raw);
  });
}

/**
 * Mo app Camera goc cua may de CHUP 1 TAM ANH chua QR - danh cho thiet bi KHONG noi may quet USB
 * (dien thoai, may tinh bang, iPad...). Dung <input capture> (xem public/vendor/camera-scan.js)
 * thay vi xem camera truc tiep, vi vay chay duoc ngay tren http:// thuong, KHONG can HTTPS.
 * Ket qua doc duoc tu anh se di qua DUNG 1 ham xu ly processScanText() giong het nhu may quet USB,
 * nen toan bo logic xac minh/chong trung phia sau khong doi gi ca.
 */
function openCameraScan() {
  if (!verifyState.priorityCode) return;
  hideVerifyWarning();

  if (!window.CameraScan || !window.CameraScan.isSupported()) {
    // Tren dien thoai/may tinh bang khong co may quet USB de goi y du phong (khac desktop) - chi
    // goi y doi trinh duyet khac.
    const msg = IS_MOBILE_OR_TABLET
      ? 'Trình duyệt này không hỗ trợ chụp ảnh bằng camera. Vui lòng thử trình duyệt khác (Chrome/Safari bản mới nhất).'
      : 'Trình duyệt này không hỗ trợ chụp ảnh bằng camera. Vui lòng dùng máy quét mã vạch/QR (USB).';
    showVerifyWarning(msg, 'warn');
    return;
  }

  window.CameraScan.open({
    onStatus: (msg) => { verifyStatus.textContent = msg; },
    onResult: (text) => { handleScannedText(text); },
    onCancel: () => { verifyStatus.textContent = 'Sẵn sàng quét...'; },
    onError: (reason) => {
      let msg;
      if (reason === 'not_found') {
        msg = 'Không đọc được mã QR trong ảnh vừa chụp. Vui lòng chụp lại — đưa mã QR vào giữa khung hình, đủ sáng, không bị mờ/loá.';
      } else if (IS_MOBILE_OR_TABLET) {
        msg = 'Có lỗi khi đọc ảnh vừa chụp. Vui lòng thử chụp lại.';
      } else {
        msg = 'Có lỗi khi đọc ảnh vừa chụp. Vui lòng thử chụp lại, hoặc dùng máy quét USB thay thế.';
      }
      showVerifyWarning(msg, 'warn');
      verifyStatus.textContent = 'Sẵn sàng quét...';
    },
  });
}

/**
 * "Tải ảnh QR lên" - danh cho truong hop nhan vien DA CO SAN 1 tam anh chua ma QR tren may (vi
 * du anh chup man hinh, anh nhan qua Zalo/tin nhan, hoac anh da chup tu truoc) thay vi phai chup
 * moi bang camera. Dung CHUNG toan bo pipeline doc QR/xu ly voi openCameraScan() o tren (chi
 * khac o cho mo hop thoai chon file - xem gallery:true trong camera-scan.js), nen khong lap lai
 * logic xac minh/chong trung phia sau.
 */
function openUploadScan() {
  if (!verifyState.priorityCode) return;
  hideVerifyWarning();

  if (!window.CameraScan || !window.CameraScan.isSupported()) {
    showVerifyWarning('Trình duyệt này không hỗ trợ tải ảnh lên. Vui lòng dùng máy quét mã vạch/QR (USB) hoặc trình duyệt khác.', 'warn');
    return;
  }

  window.CameraScan.open({
    gallery: true,
    onStatus: (msg) => { verifyStatus.textContent = msg; },
    onResult: (text) => { handleScannedText(text); },
    onCancel: () => { verifyStatus.textContent = 'Sẵn sàng quét...'; },
    onError: (reason) => {
      const msg = reason === 'not_found'
        ? 'Không đọc được mã QR trong ảnh vừa chọn. Vui lòng chọn ảnh khác, đảm bảo mã QR rõ nét, không bị mờ/loá.'
        : 'Có lỗi khi đọc ảnh vừa chọn. Vui lòng thử lại với ảnh khác.';
      showVerifyWarning(msg, 'warn');
      verifyStatus.textContent = 'Sẵn sàng quét...';
    },
  });
}

/** Nhan vien xac nhan VAN muon cap them so moi du da phat hien nguoi nay vua lay so gan day. */
async function proceedAfterOverride() {
  hideVerifyWarning();
  verifyStatus.textContent = 'Đang cấp số...';
  await finishVerifyAndCreate();
}

/** Sau khi quet CCCD/BHYT thanh cong o buoc xac minh - dung luon thong tin tu giay to do lam
 * thong tin benh nhan (khong con o nhap ten thu cong tren giao dien nua). */
async function finishVerifyAndCreate() {
  const patientFromScan = verifyState.cccd
    ? {
        name: verifyState.cccd.hoTen,
        dob: verifyState.cccd.dob,
        gender: verifyState.cccd.gender,
        id_number: verifyState.cccd.cccd,
        source: 'CCCD',
        qr_raw: verifyState.cccdRaw,
      }
    : verifyState.bhyt
    ? {
        // KHONG lay ten tu QR BHYT (xem ghi chu trong parseBHYT() o src/services/qrParser.js) -
        // de trong, tranh hien thi/luu nham ten sai/loi do giai ma nham.
        name: null,
        dob: verifyState.bhyt.ngaySinh,
        gender: null,
        id_number: verifyState.bhyt.maThe,
        source: 'BHYT',
        qr_raw: verifyState.bhytRaw,
      }
    : null;

  // MUC 108: CHI an step-verify (va #scanInput ben trong no) khi cap so THANH CONG - that bai thi
  // O LAI man hinh nay (van hien duoc #scanInput) de nhan vien xem canh bao (showVerifyWarning() -
  // xem createStaffTicket()) roi quet lai ngay, khong bi "trắng màn hình"/mất input.
  const ok = await createStaffTicket(verifyState.priorityCode, patientFromScan);
  if (ok) document.getElementById('step-verify').style.display = 'none';
}

/**
 * Muc 89: bo het tham so `opts` (`awaitPrint`/`startCountdown` cua muc 87) - LUON "bắn lệnh in rồi
 * thôi" (khong cho in xong moi quay ve man hinh) va LUON tu bat dem nguoc, bat ke dang cap 1 so
 * thu cong hay dang o giua 1 chuoi "cấp nhiều số" tu dong - dung Y HET 1 lan bam nut, khong phan
 * biet 2 truong hop nay o tang nay nua (xem maybeContinueAutoIssueSeq() o tren - diem "tu dong"
 * DUY NHAT nam o resetForm(), khong nam trong ham nay).
 */
/**
 * MUC 108: TRUOC DAY khi cap so THAT BAI (vi du bi chan boi rao can cap so uu tien -
 * checkPriorityIssueGate() trong ticketService.js - dung kich ban nguoi dung nêu "quét ưu tiên ở
 * STT 1"), ham nay goi `alert(...)` (hop thoai CHAN, co the cuop OS-focus vinh vien trong Electron -
 * xem ghi chu MUC 108 o dau file) RỒI vẫn `return` binh thuong (khong nem loi) - khien 2 noi goi
 * ham nay (finishVerifyAndCreate()/issueWithoutVerify() ben duoi) ẨN LUÔN man hinh "Sẵn sàng quét"
 * (step-verify) NGAY SAU ĐÓ MÀ KHÔNG PHÂN BIỆT thành công hay thất bại - tren man hinh THAT BAI,
 * dieu nay lam #scanInput (nam trong step-verify) bị ẨN theo, càng làm trầm trọng thêm tình trạng
 * "không nhập được gì nữa" (input ẩn thì focus() cũng vô nghĩa), CHỨ KHÔNG CHỈ riêng vấn đề alert()
 * cướp OS-focus.
 * SUA: (1) thay `alert()` bang `showVerifyWarning()` (canh bao NGAY TRONG step-verify, KHONG CHAN
 * gi, giong het cach /kiosk da lam tu truoc - xem ghi chu trong README muc 108); (2) ham nay tra ve
 * `true`/`false` de 2 noi goi BEN DUOI biet CHINH XAC co that su cap so thanh cong hay khong, CHI an
 * step-verify khi THANH CONG - khi THAT BAI, o LAI step-verify (van con hien #scanInput, nhan vien
 * xem canh bao roi quet lai NGAY, khong can thao tac gi them).
 */
async function createStaffTicket(priorityCode, patientFromScan) {
  const res = await fetch('/api/tickets/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priorityCode, patient: patientFromScan || null }),
  });
  if (res.status === 401) {
    location.href = '/?next=' + encodeURIComponent('/staff-kiosk/');
    return false;
  }
  const data = await res.json();
  if (!res.ok) {
    showVerifyWarning(data.error || 'Không cấp được số, vui lòng thử lại', 'blocked');
    verifyStatus.textContent = 'Chưa cấp được số - có thể quét lại hoặc thử lại.';
    return false;
  }

  showDoneTicket(data.ticket, priorityCode);
  printTicketReceipt(data.ticket, priorityCode, verifyState.cccd, verifyState.bhyt, verifyState.cccdRaw, verifyState.bhytRaw);
  return true;
}

/**
 * CAP SO NGAY LAP TUC tu 1 ma QR "cap nhanh" vua quet duoc (tien to QUICKQR_PREFIX, xem
 * handleScannedText() o tren) - goi thang API POST /api/tickets/quick, server tu xac thuc ma bi
 * mat khop voi cau hinh QUICK_QR_CODE_<code> trong .env roi tao ve luon, KHONG can chon doi
 * tuong/xac minh CCCD/BHYT/nhap thong tin gi ca o phia giao dien nay.
 */
async function processQuickQrScan(raw) {
  try {
    const res = await fetch('/api/tickets/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (res.status === 401) {
      location.href = '/?next=' + encodeURIComponent('/staff-kiosk/');
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      // MUC 108: doi tu alert() (CHAN, co the cuop OS focus vinh vien trong Electron - xem ghi chu
      // dau file) sang showScannerToast() - ma QR "cấp nhanh" co the quet BAT KY LUC NAO (ca luc
      // dang o step-form CHU KHONG chi step-verify), nen dung toast NOI (khong phu thuoc dang o
      // man hinh con nao) thay vi showVerifyWarning() (chi hien duoc trong step-verify).
      showScannerToast(data.error || 'Mã QR cấp nhanh không hợp lệ, vui lòng thử lại.');
      return;
    }
    // Dam bao dang o dung trang thai giao dien (phong khi quet luc dang o step-verify) truoc khi
    // hien man hinh "Số thứ tự vừa cấp".
    if (window.CameraScan) window.CameraScan.close();
    document.getElementById('step-verify').style.display = 'none';
    showDoneTicket(data.ticket, data.ticket.priority_code);
    // MUC 95: THEM `await` (truoc day "bắn rồi thôi") - cung 1 ly do nhu ben /kiosk/ (xem
    // processQuickQrScan() trong public/kiosk/kiosk.js): tranh 2 lenh in chong cheo neu ma QR "cấp
    // nhanh" nay bi quet lai lien tuc rat nhanh (vi du may quet loi gui trung tin hieu). Hang doi
    // in toan cuc o electron-widget/main.js (queuePrintJob()) van la tuyen phong thu chinh chan
    // treo ung dung; `await` o day chi la lop bao ve bo sung, khong thay the.
    await printTicketReceipt(data.ticket, data.ticket.priority_code, null, null, null, null);
  } catch {
    // MUC 108: cung ly do voi nhanh loi o tren - doi alert() sang showScannerToast().
    showScannerToast('Không kết nối được máy chủ, vui lòng thử lại.');
  }
}

/** Hien man hinh "Số thứ tự vừa cấp" - dung chung cho ca cap so qua nut bam LAN qua QR cap nhanh.
 * Muc 89: bo tham so `opts.startCountdown` cua muc 87 - LUON bat dem nguoc (dung Y HET 1 lan bam
 * nut thu cong); "cấp nhiều số" tu dong gio khong con can tam ngung dem nguoc nay nua vi diem tu
 * dong tiep theo nam o resetForm() (chay SAU KHI dem nguoc nay het gio), khong nam trong luc dang
 * hien so nay. */
function showDoneTicket(ticket, priorityCode) {
  document.getElementById('step-form').style.display = 'none';
  // Ghep tien to hien thi ("U"/"T"...) NEU CO - xem SEPARATE_PRIORITY_SEQUENCE trong .env.example.
  const numberText = `${ticket.number_prefix || ''}${String(ticket.number).padStart(3, '0')}`;
  document.getElementById('doneNumber').textContent = numberText;
  document.getElementById('doneNumber').style.color = priorityColorForCode(priorityCode);
  document.getElementById('doneLabel').textContent = '';
  document.getElementById('step-done').style.display = 'block';
  startDoneCountdown();
}

/** In phieu ngay tren trinh duyet cua chinh may nay (xem public/print-receipt.js) - hop thoai in
 * se tu nhan may in USB (may tinh) hoac may in Bluetooth da ghep doi (may tinh bang/dien thoai). */
function printTicketReceipt(ticket, priorityCode, cccd, bhyt, cccdRaw, bhytRaw) {
  const numberText = `${ticket.number_prefix || ''}${String(ticket.number).padStart(3, '0')}`;
  // Ho ten + ngay sinh benh nhan (tu ket qua parse QR CCCD/BHYT o buoc xac minh, neu co) - in ro
  // tren phieu, xem patientInfoForReceipt() trong public/print-receipt.js. Cap qua QR cap nhanh
  // hoac "Cấp số ngay" (bo qua xac minh) thi khong co giay to gi -> phan nay tu bo qua (de trong).
  const patientInfo = patientInfoForReceipt(cccd, bhyt);
  // TRA VE (return) Promise cua printReceipt() - nhung KHONG co noi goi nao (ke ca
  // createStaffTicket()) `await` gia tri nay ca (muc 89: bo het co che `awaitPrint` cua muc 87) -
  // phieu LUON tu in "ngầm" phia sau, giong het nhau du dang cap 1 so thu cong hay dang o giua 1
  // chuoi "cấp nhiều số" tu dong, khong lam cham man hinh o ca 2 truong hop.
  return printReceipt({
    clinicName: brandClinicName,
    number: numberText,
    priorityLabel: labelForCode(priorityCode),
    time: new Date(ticket.created_at).toLocaleString('vi-VN'),
    footerText: brandFooterText,
    footerText2: brandFooterText2,
    logoImage: brandPrintLogoImage,
    patientName: patientInfo.name,
    patientDob: patientInfo.dob,
    // In lai chinh ma QR cua CCCD/BHYT vua quet/xac minh len phieu (uu tien CCCD neu co ca 2).
    idQrRaw: cccdRaw || bhytRaw || null,
  });
}

/**
 * Truoc day man hinh "Số thứ tự vừa cấp" co 1 nut "Xong – Cấp số cho người khác" de nhan vien tu
 * bam - nay BO HAN nut do, thay bang bo dem nguoc HIEN THI RO (#doneCountdown trong index.html)
 * dung CHUNG cau hinh KIOSK_AUTO_CONFIRM_SECONDS voi kiosk cong khai (/kiosk) - het gio tu dong
 * quay lai man hinh chon doi tuong, giup nhan vien cap so lien tuc nhanh hon.
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
    resetForm();
  }, seconds * 1000);
}

/** Modal hien anh QR "cap nhanh" cho 1 doi tuong (xem GET /api/tickets/quick-qr-image/:code). */
async function showQuickQr(code, label) {
  const modal = document.getElementById('quickQrModal');
  const statusEl = document.getElementById('quickQrStatus');
  const img = document.getElementById('quickQrImg');
  const titleEl = document.getElementById('quickQrTitle');
  titleEl.textContent = `Mã QR cấp nhanh — ${label}`;
  modal.style.display = 'flex';
  img.style.display = 'none';
  statusEl.style.display = 'block';
  statusEl.textContent = 'Đang tạo mã...';
  try {
    const res = await fetch(`/api/tickets/quick-qr-image/${encodeURIComponent(code)}`);
    if (res.status === 401) {
      location.href = '/?next=' + encodeURIComponent('/staff-kiosk/');
      return;
    }
    const data = await res.json();
    if (!res.ok || !data.qr) {
      statusEl.textContent = data.error || 'Không tạo được mã QR, vui lòng thử lại.';
      return;
    }
    img.src = data.qr;
    img.style.display = 'block';
    statusEl.style.display = 'none';
  } catch {
    statusEl.textContent = 'Không kết nối được máy chủ, vui lòng thử lại.';
  }
}

function closeQuickQrModal() {
  document.getElementById('quickQrModal').style.display = 'none';
}

async function staffLogout() {
  try {
    await fetch('/api/auth/staff-logout', { method: 'POST' });
  } catch {
    // bo qua loi mang, van chuyen huong ve trang chu o phia client
  }
  location.href = '/';
}

/** Muc 89: DAY LA DIEM TU DONG DUY NHAT cua tinh nang "cấp nhiều số" - ham nay von da duoc goi
 * MOI LAN 1 phieu "hoan tat vong doi" va quay ve man hinh chinh (het gio dem nguoc tren step-done,
 * huy xac minh...), tu truoc khi co tinh nang tu dong nay. Gio chi them 1 dong goi
 * `maybeContinueAutoIssueSeq()` o cuoi - neu dang co 1 chuoi con dang chay, ham do se TU bam ho
 * nut doi tuong 1 lan nua (startVerify()) sau 1 khoang cho ngan. */
function resetForm() {
  clearDoneCountdown();
  document.getElementById('step-done').style.display = 'none';
  document.getElementById('step-verify').style.display = 'none';
  document.getElementById('step-form').style.display = 'block';
  maybeContinueAutoIssueSeq();
}

/**
 * ===== Nut "Cài đặt ứng dụng" (PWA) - chi hien tren dien thoai/may tinh bang =====
 * Co 2 truong hop:
 *  1) Trinh duyet ho tro "beforeinstallprompt" (Chrome/Edge tren Android) VA trang du dieu kien
 *     "installable" (thuong can HTTPS hoac localhost) -> bat duoc su kien nay, bam nut se hien
 *     dung hop thoai cai dat GOC cua trinh duyet.
 *  2) Cac truong hop con lai (LUON dung tren iOS Safari - Apple khong lam "beforeinstallprompt";
 *     hoac tren Android nhung trang dang mo qua http:// thuong tren dia chi IP LAN thay vi HTTPS/
 *     localhost nen chua du dieu kien) -> khong co hop thoai tu dong, bam nut se hien huong dan
 *     thao tac thu cong (khac nhau giua iOS va Android).
 */
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallButtonVisibility();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const btn = document.getElementById('installPwaBtn');
  const instr = document.getElementById('installPwaInstructions');
  if (btn) btn.style.display = 'none';
  if (instr) instr.style.display = 'none';
});

function updateInstallButtonVisibility() {
  const btn = document.getElementById('installPwaBtn');
  if (!btn) return;
  btn.style.display = IS_MOBILE_OR_TABLET && !isRunningStandalone() ? 'inline-block' : 'none';
}

async function handleInstallPwaClick() {
  const instr = document.getElementById('installPwaInstructions');

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (choice.outcome === 'accepted') {
      updateInstallButtonVisibility();
      if (instr) instr.style.display = 'none';
    }
    return;
  }

  // Khong co hop thoai tu dong -> hien/an huong dan thao tac thu cong khi bam nut.
  if (!instr) return;
  const showing = instr.style.display !== 'none';
  if (showing) {
    instr.style.display = 'none';
    return;
  }
  instr.innerHTML = IS_IOS
    ? 'Trên iPhone/iPad (Safari): bấm nút <b>Chia sẻ</b> (hình vuông có mũi tên, thường ở thanh dưới hoặc thanh trên trình duyệt) → chọn <b>"Thêm vào MH chính"</b> (Add to Home Screen) → bấm <b>"Thêm"</b>.'
    : 'Trên điện thoại/máy tính bảng Android: mở menu trình duyệt (thường là nút <b>⋮</b> ở góc trên bên phải) → chọn <b>"Thêm vào Màn hình chính"</b> hoặc <b>"Cài đặt ứng dụng"</b>.';
  instr.style.display = 'block';
}

updateInstallButtonVisibility();

loadPriorityOptions();

/**
 * ===== MUC 96/97 - "Mở reset > 16h": CHUYỂN "ngày hiệu lực" cấp số sang ngày tiếp theo =====
 * Theo dung yeu cau nguoi dung (muc 96): "bổ sung 1 nút trong staff-kiosk Mở reset > 16h nếu thời
 * gian hiện tại > 16h thì sẽ cho phép reset stt tiếp nhận", va LAM RO lai o muc 97: "Mở reset >
 * 16h ở màn hình staff-kiosk là ngưng cấp số ở ngày hiện tại. bắt đầu cấp số cho ngày tiếp theo đó
 * ạ" - tuc KHONG PHAI "xoa bo dem de cap lai tu 1 NGAY HOM NAY" (thiet ke ban dau o muc 96, SAI) ma
 * la "chuyen han sang NGAY MAI": tu luc bam nut, moi ve MOI cap se duoc tinh la cua ngay mai (STT
 * tu bat dau lai tu 1 vi la ngay/khoa hoan toan moi), khong con ve nao duoc gan cho "hom nay" nua.
 * Xem getEffectiveDay()/setEffectiveDayOverrideToNextDay() trong src/services/sequenceService.js
 * va route POST /api/tickets/reset-sequence trong src/routes/tickets.js.
 *
 * isResetSequenceAllowedNow() chi dung DONG HO MAY KHACH - CHI de bat/tat giao dien nut cho de
 * nhin (nhan vien biet ngay khi nao dung duoc), KHONG PHAI lop bao ve that su: lop quyet dinh nam
 * O SERVER (route POST /api/tickets/reset-sequence trong src/routes/tickets.js dung dayjs() - dong
 * ho may chu - de kiem tra lai, tra ve 403 neu chua qua 16h du client co gui request len). Cap nhat
 * lai moi 30s (updateResetSequenceBtnUI) de nut tu dong "mo khoa" dung thoi diem 16:00 ma khong can
 * nhan vien tai lai trang.
 */
function isResetSequenceAllowedNow() {
  return new Date().getHours() >= 16;
}

function updateResetSequenceBtnUI() {
  const btn = document.getElementById('resetSequenceBtn');
  if (!btn) return;
  const allowed = isResetSequenceAllowedNow();
  btn.disabled = !allowed;
  btn.title = allowed
    ? 'Ngưng cấp số cho ngày hôm nay, chuyển sang cấp số cho ngày tiếp theo (STT bắt đầu lại từ 1) - chỉ nên dùng khi hàng chờ hôm nay đã hết/đã xử lý xong.'
    : 'Chỉ được phép mở tính năng này sau 16:00 (hiện tại chưa đến giờ).';
}

// MUC 108 (bo sung): ca 5 hop thoai `alert()`/`confirm()` native trong ham nay doi sang
// `showScannerToast()`/`showScannerConfirm()` (modal DOM thuan tuy) - theo phan anh cua nguoi dung,
// hop thoai native VAN co the khong tra lai OS-focus cho widget sau khi dong du la do nhan vien chu
// dong bam nut "Chuyển ngày" moi mo ra (xem ghi chu chi tiet tai dinh nghia showScannerConfirm()).
async function handleResetSequenceClick() {
  // Chan lai neu dang co 1 chuoi "cấp nhiều số" tu dong dang chay - tranh chuyen ngay ngay giua
  // luc dang cap so tu dong, gay nham lan (mot phan cua lo dang cap se roi sang ngay khac).
  if (autoIssueSeq) {
    showScannerToast(
      'Đang trong chuỗi "cấp nhiều số" tự động - vui lòng bấm "Dừng" (ở màn hình nhập số lượng cần cấp) trước khi chuyển sang ngày tiếp theo.',
      { durationMs: 8000 }
    );
    return;
  }
  if (!isResetSequenceAllowedNow()) {
    showScannerToast('Chỉ được phép mở tính năng này sau 16:00.');
    updateResetSequenceBtnUI();
    return;
  }
  // Canh bao so luong con dang cho (chua goi) cua ngay hom nay - lay tu summary realtime da co san
  // (lastSummaryForCount, cap nhat qua socket "queue:summary"/GET /api/display/summary) de KHONG
  // can goi them 1 API rieng chi de kiem tra. MUC 99: cac so nay se KHONG CON GOI DUOC O QUAY nua
  // sau khi chuyen ngay (callNextTicket()/callNextTicketByPriority() trong ticketService.js nay da
  // loc dung theo "ngay hieu luc", xem README muc 99 - truoc do co the goi duoc nhung day chinh la
  // LOI da duoc phan anh va sua) - nen phai canh bao THAT MANH truoc khi nhan vien xac nhan.
  const stillWaiting = lastSummaryForCount && typeof lastSummaryForCount.waitingCount === 'number'
    ? lastSummaryForCount.waitingCount
    : null;
  const waitingWarning = stillWaiting
    ? `\n\n⚠ CÒN ${stillWaiting} SỐ CHƯA GỌI của hôm nay. Sau khi chuyển sang ngày tiếp theo, các số ` +
      'này sẽ KHÔNG còn gọi được ở quầy nữa (và cũng không còn hiển thị trong bảng tổng hợp/danh ' +
      'sách chờ) cho đến khi thực sự sang đúng ngày đó. CHỈ nên tiếp tục nếu chắc chắn hàng chờ hôm ' +
      'nay đã xử lý xong hết.'
    : '';
  const ok = await showScannerConfirm(
    'XÁC NHẬN ngưng cấp số cho NGÀY HÔM NAY, bắt đầu cấp số cho NGÀY TIẾP THEO?\n\n' +
      'Từ thời điểm này, số MỚI cấp (ở mọi màn hình) sẽ được tính là của ngày tiếp theo, STT sẽ bắt ' +
      'đầu lại từ 1. Các số đã cấp trong hôm nay không bị xoá.' +
      waitingWarning,
    { confirmLabel: 'Xác nhận chuyển ngày' }
  );
  if (!ok) return;
  try {
    const res = await fetch('/api/tickets/reset-sequence', { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showScannerToast(data.error || 'Không thực hiện được, vui lòng thử lại.');
      return;
    }
    showScannerToast(`Đã chuyển sang cấp số cho ngày ${data.nextDay} - số cấp tiếp theo sẽ bắt đầu lại từ 1.`, { level: 'info', durationMs: 8000 });
  } catch {
    showScannerToast('Không kết nối được máy chủ, vui lòng thử lại.');
  }
}

updateResetSequenceBtnUI();
setInterval(updateResetSequenceBtnUI, 30000);

/**
 * MUC 106 - "kiểm tra chức năng máy quét ... mất form nhập liệu": giong het co che o public/kiosk/
 * kiosk.js (xem ghi chu chi tiet tai do) - TRUOC DAY loi in lang le duoc bao qua dialog.showErrorBox()
 * (hop thoai He dieu hanh, co the cuop OS focus khoi #scanInput cua man hinh nay khong co cach tu
 * phuc hoi) - NAY thay bang toast NHO (showScannerToast(), dinh nghia o dau file - MUC 108 tai su
 * dung LAI CHINH ham nay cho ca canh bao loi in LAN loi cap so/QR cap nhanh), KHONG CHAN, tu bien
 * mat, qua kenh IPC 'print-error'.
 */
(function setupPrintErrorToast() {
  if (!window.electronPrint || typeof window.electronPrint.onPrintError !== 'function') return;
  window.electronPrint.onPrintError((message) => {
    showScannerToast('Lỗi in phiếu (số vẫn được cấp bình thường): ' + message);
  });
})();
