/**
 * Widget sieu nho cho quay tiep nhan - dung chung 1 "counterId" da luu trong localStorage voi
 * trang /counter (cung origin nen dung chung localStorage). Neu chua chon quay o trang /counter
 * day du thi widget nay chi hien nut "⚙️ Chọn quầy".
 *
 * Khi chay TRONG ung dung Electron, `preload.js` cua ung dung do gan san `window.widgetBridge`
 * de nut ⚙️ mo dung cua so quan ly cua ung dung (thay vi dieu huong window nay). Khi mo bang
 * trinh duyet thuong (khong co widgetBridge) thi nut ⚙️ se dieu huong sang /counter/ nhu binh
 * thuong - tien de xem thu/test giao dien nay ma khong can chay Electron.
 */
const socket = io({ path: '/rt-bridge/' });

let counterId = localStorage.getItem('counterId') || null;
let currentTicketId = null;
let priorityRules = []; // [{code, label, color}] theo thu tu rank - dung de zero-fill queueCounts
let priorityColorMap = {};
let lastSummary = null;
// Tham chieu cua so man hinh benh nhan MO QUA TRINH DUYET THUONG (khong co widgetBridge) - de nut
// "Đăng xuất nhanh" dong duoc dung cua so nay (xem openPatientScreen()/logoutCounter() ben duoi).
// Trong Electron, main.js tu quan ly cua so nay (patientScreenWindow) nen KHONG can bien nay.
let patientScreenWinRef = null;

const els = {
  mainView: document.getElementById('mainView'),
  emptyState: document.getElementById('emptyState'),
  counterTag: document.getElementById('counterTag'),
  sttNumber: document.getElementById('sttNumber'),
  queueCounts: document.getElementById('queueCounts'),
  statusToast: document.getElementById('statusToast'),
  btnNext: document.getElementById('btnNext'),
  btnRecall: document.getElementById('btnRecall'),
  btnSkip: document.getElementById('btnSkip'),
  patientScreenBtn: document.getElementById('patientScreenBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  staffKioskBtn: document.getElementById('staffKioskBtn'),
  priorityOrderBtn: document.getElementById('priorityOrderBtn'),
  skippedListBtn: document.getElementById('skippedListBtn'),
  quickIssueActions: document.getElementById('quickIssueActions'),
};

/**
 * MUC 103 - phat hien che do PRIORITY_MODE=basic (CHI 2 doi tuong gop "PRIORITY"/"NORMAL" - xem
 * src/config/priorityRules.js) TU CHINH danh sach `priorityRules` da tai (khong can them API rieng
 * bao PRIORITY_MODE - o che do "full" luon co NHIEU HON 2 doi tuong (8), nen chi can kiem tra DUNG
 * 2 phan tu VA co ma 'PRIORITY' la du phan biet chac chan 2 che do). MUC 104: van con dung trong
 * renderQueueCounts() ben duoi (quyet dinh hien 2 nut to "Gọi ưu tiên/Gọi thường" hay AN HOAN TOAN
 * cum nay o che do "full") - rieng renderQuickIssueButtons() thi KHONG con dung ham nay nua vi cum
 * "Cấp số nhanh" nay bi an vinh vien o CA 2 che do (xem ghi chu MUC 104 trong ham do).
 */
function isBasicPriorityMode() {
  return priorityRules.length === 2 && priorityRules.some((r) => r.code === 'PRIORITY');
}

// Ten don vi/dong chan trang/logo (tu .env qua /api/branding) - dung de in phieu cho 3 nut "Cấp số
// nhanh" ben duoi (xem quickIssueTicket()), lay GIONG HET cach lam cua public/staff-kiosk/staff-kiosk.js.
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
 * `openTarget` (tuy chon): 'priority-order' hoac 'skipped' - mo THANG dung modal tuong ung tren
 * trang /counter day du thay vi chi mo man hinh lam viec thuong (dung cho 2 nut ⏱️/👥 moi, xem
 * ben duoi). Trong Electron, main.js tu dieu huong cua so settings toi URL kem "#<openTarget>",
 * roi counter.js (trang /counter) doc location.hash luc tai xong de tu bam mo dung modal.
 */
function openSettings(openTarget) {
  if (window.widgetBridge?.openSettings) {
    window.widgetBridge.openSettings(openTarget);
  } else {
    location.href = openTarget ? `/counter/#${openTarget}` : '/counter/';
  }
}

/**
 * Mo man hinh benh nhan (/patient-screen) cua dung quay dang chon. Trong ung dung Electron,
 * `widgetBridge.openPatientScreen` bao main.js tao/dua ra 1 cua so RIENG, TU DONG chuyen sang
 * man hinh (monitor) PHU neu may co nhieu man hinh, va TU DONG vao toan man hinh luon - khong
 * can nhan vien tu keo cua so + bam F11 nhu truoc. Khi mo bang trinh duyet thuong (khong co
 * widgetBridge) thi mo popup nhu cach lam o /counter, kem nhac nho tu keo/toan man hinh thu cong.
 */
function openPatientScreen() {
  if (!counterId) return;
  if (window.widgetBridge?.openPatientScreen) {
    window.widgetBridge.openPatientScreen(counterId);
  } else {
    const url = `/patient-screen/?counter=${counterId}`;
    const win = window.open(url, `patient-screen-${counterId}`);
    if (win) win.focus();
    patientScreenWinRef = win;
  }
}

/** Token rieng cho tung trinh duyet/thiet bi - GIONG HET getDeviceToken() trong /counter/counter.js
 * (dung chung key localStorage, cung origin) de server nhan ra "cung 1 nguoi" khi goi exit-session. */
function getDeviceToken() {
  let token = localStorage.getItem('deviceSessionToken');
  if (!token) {
    token = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('deviceSessionToken', token);
  }
  return token;
}

/**
 * Nut "Đăng xuất nhanh" moi tren widget - theo yeu cau: 1 nut BAM 1 LAN de vua (1) thoat phien quay
 * hien tai (giai phong quay cho nguoi ca sau vao dung, giong exitSession() o /counter/counter.js)
 * VUA (2) dong luon cua so man hinh benh nhan dang mo (neu co) - khong con ly do gi de man hinh do
 * tiep tuc hien khi khong con ai truc quay nua. Co hoi xac nhan truoc khi thuc hien (khac voi nut
 * "Thoát" o trang /counter day du) vi day la 1 nut nho, de bam nham giua nhieu nut khac trong widget
 * sieu nho - bam nham se lam mat phien dang lam viec giua chung, can canh bao truoc.
 */
async function logoutCounter() {
  if (!counterId) return;
  if (!await UiDialog.confirm('Đăng xuất khỏi quầy hiện tại và đóng màn hình bệnh nhân?', { confirmLabel: 'Đăng xuất', danger: true })) return;

  const idToExit = counterId;
  try {
    await fetch(`/api/counters/${idToExit}/exit-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: getDeviceToken() }),
    });
  } catch {
    // Bo qua loi mang - van cho dang xuat o phia client (giong exitSession() o /counter/counter.js),
    // nhan vien co the dang xuat lai neu server chua kip nhan duoc yeu cau nay.
  }

  if (window.widgetBridge?.closePatientScreen) {
    window.widgetBridge.closePatientScreen();
  } else if (patientScreenWinRef && !patientScreenWinRef.closed) {
    patientScreenWinRef.close();
  }
  patientScreenWinRef = null;

  setCounterId(null);
}

/**
 * Mo THANG kiosk cap so - Nhan vien (/staff-kiosk) - KHONG phu thuoc quay nao dang chon (nhan
 * vien co the cap so cho benh nhan bat ky luc nao du chua chon quay de goi so). Trong ung dung
 * Electron, `widgetBridge.openStaffKiosk` bao main.js mo/dua ra truoc 1 cua so RIENG NGAY TRONG
 * ung dung nay (dung chung ham voi muc tray "Mở kiosk cấp số – Nhân viên") - BAT BUOC phai mo theo
 * cach nay (khong phai tab trinh duyet thuong) thi tinh nang in lang le qua may in nhiet moi hoat
 * dong duoc (xem preload.js/printTicketSilently() trong main.js). Khi mo bang trinh duyet thuong
 * (khong co widgetBridge) thi mo tab moi nhu binh thuong - phieu se in qua hop thoai in cua trinh
 * duyet thay vi in lang le.
 */
function openStaffKiosk() {
  if (window.widgetBridge?.openStaffKiosk) {
    window.widgetBridge.openStaffKiosk();
  } else {
    const win = window.open('/staff-kiosk/', 'staff-kiosk');
    if (win) win.focus();
  }
}

/**
 * Nut "Cấp số NHANH" (đủ đối tượng của hệ thống, VE DONG theo priorityRules - xem
 * renderQuickIssueButtons() ben duoi) - cap thang 1 so cho 1 doi tuong CO DINH, KHONG can
 * quet/nhap thong tin xac thuc benh nhan nao. Ban dau (theo yeu cau: "widget có thể bổ sung 3
 * icon lấy số thường,>=75,<=6 ko cần qua xác thực được không") chi co 3 nut (Thường/≥75/<6); sau
 * do bo sung THEM 5 nut con thieu (theo yeu cau: "widget bổ sung thêm 5 nút cấp nhanh stt tiếp
 * nhận còn thiếu") de du het 8 doi tuong dinh nghia trong src/config/priorityRules.js (Cấp cứu,
 * Phụ nữ có thai, Khuyết tật đặc biệt nặng, Khuyết tật nặng, Có công với cách mạng); sau do lai
 * doi sang VE DONG (thay vi 8 nut co dinh trong HTML) de tu dong khop theo PRIORITY_MODE (che do
 * "basic" gop chung con 2 doi tuong "Ưu tiên"/"Đối tượng thường" thay vi 8 - xem
 * src/config/priorityRules.js). Dung LAI DUNG endpoint POST /api/tickets/staff da co san (giong
 * het createStaffTicket() trong public/staff-kiosk/staff-kiosk.js) voi `patient: null`, roi in
 * lang le qua print-receipt.js (khong phu thuoc quay dang chon tren widget, giong staffKioskBtn).
 *
 * CHONG SPAM - 2 LOP theo dung yeu cau:
 * (1) "1 icon đang nhấn thì 2 icon còn lại không được phép spam": dung DUY NHAT 1 bien khoa
 *     `quickIssueBusy` CHUNG cho TAT CA nut (khong phai khoa rieng tung nut) - ngay khi 1 nut duoc
 *     bam, TAT CA nut deu bi disable() NGAY LAP TUC va chi duoc mo lai (finally) sau khi toan bo (hoi
 *     xac nhan + goi API cap so + in phieu) da xong, du thanh cong/bi huy/loi - vi lenh in can thoi
 *     gian xu ly (dung print-receipt.js -> IPC 'print-ticket' -> Electron in that ra may in nhiet,
 *     KHONG phai tuc thi), neu khong khoa chung tat ca nut thi nhan vien van co the bam nut KHAC
 *     trong luc nut truoc con dang cho in, gay cap trung/thua so.
 * (2) Moi theo yeu cau ("các nút phải trải qua 1 confirm xác nhận nữa để tránh spam cấp số"): THEM
 *     1 hop thoai xac nhan (`confirm()`) truoc khi thuc su goi API - vua giup nhan vien tranh bam
 *     nham (khong co man hinh xac thuc nao khac de "chan tay" nhu luc quet CCCD/BHYT), vua la 1 lop
 *     chan spam BO SUNG: `confirm()` la hop thoai MODAL chan toan bo tuong tac khac tren cua so cho
 *     toi khi nguoi dung tra loi, nen trong luc hop thoai con hien, khong the bam duoc nut nao khac
 *     (ke ca nut khac tren widget) du gi. Huy (Cancel) thi KHONG goi API/in gi ca, chi mo khoa lai.
 */
let quickIssueBusy = false;

/**
 * MUC 104 - "xóa luôn nút ƯT và TT ko cần hiển thị trên widget kể cả full ... đều bỏ trên widget":
 * cum "Cấp số nhanh" (VE DONG nhan viet tat "shortLabel" cua tung doi tuong - vi du "CC"/"ƯT"/"TT")
 * bi AN VINH VIEN tren widget o CA 2 CHE DO (full lan basic), khac voi MUC 103 truoc day CHI an
 * rieng che do "basic". KHONG con phan biet che do nua - luon luon rong/an, bat ke PRIORITY_MODE la
 * gi. Giu lai HAM nay (khong xoa han) vi loadPriorityRules() ben duoi van goi no sau moi lan tai lai
 * danh sach `priorityRules` - de don gian, chi cho ham LUON LAM RONG + AN element thay vi xoa hoan
 * toan cho goi.
 */
function renderQuickIssueButtons() {
  if (!els.quickIssueActions) return;
  els.quickIssueActions.innerHTML = '';
  els.quickIssueActions.style.display = 'none';
}

/**
 * Xu ly khi 1 trong 3 nut cap so nhanh nhan ve 401 (chua dang nhap nhan vien/phien dang nhap da het
 * han - cookie staff_token khong con hop le) - theo yeu cau moi nhat: "nếu ko có phiên đăng nhập
 * thì xác nhận logout để đăng nhập lại thay vì cảnh báo lỗi" - TRUOC DAY chi hien 1 dong canh bao
 * (showStatus, tu bien mat, khong lam gi them) khien nhan vien khong biet phai lam gi tiep; NAY hoi
 * xac nhan (confirm()) va NEU DONG Y thi TU DONG dang xuat (POST /api/auth/staff-logout - xoa cookie
 * staff_token, GIONG HET staffLogout() trong /counter/counter.js) roi mo THANG man hinh quan ly day
 * du (/counter/) qua openSettings() de nhan vien dang nhap lai NGAY - trang do se tu chuyen sang man
 * hinh dang nhap vi luc nay cookie da bi xoa (xem middleware gate o src/server.js).
 */
async function handleQuickIssueUnauthorized() {
  const wantsRelogin = await UiDialog.confirm(
    'Phiên đăng nhập nhân viên đã hết hạn (hoặc chưa đăng nhập). Đăng xuất ngay để mở màn hình đăng nhập lại?',
    { confirmLabel: 'Đăng nhập lại' }
  );
  if (!wantsRelogin) return;
  try {
    await fetch('/api/auth/staff-logout', { method: 'POST' });
  } catch {
    // Bo qua loi mang - van mo man hinh dang nhap o phia client de nhan vien tu dang nhap lai.
  }
  openSettings();
}

function setQuickIssueButtonsDisabled(disabled) {
  if (!els.quickIssueActions) return;
  els.quickIssueActions.querySelectorAll('button').forEach((btn) => { btn.disabled = disabled; });
}
async function quickIssueTicket(priorityCode) {
  if (quickIssueBusy) return; // dang co 1 nut khac (hoac chinh no) con dang xu ly - bo qua, khong spam.
  quickIssueBusy = true;
  setQuickIssueButtonsDisabled(true);
  try {
    const label = (priorityRules.find((r) => r.code === priorityCode) || {}).label || priorityCode;
    const confirmed = await UiDialog.confirm(`Xác nhận cấp NHANH 1 số "${label}" (không cần xác thực)?`, { confirmLabel: 'Cấp số' });
    if (!confirmed) return; // huy - khong cap so, khong in gi ca (finally van mo khoa lai ben duoi).
    const res = await fetch('/api/tickets/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorityCode, patient: null }),
    });
    if (res.status === 401) {
      await handleQuickIssueUnauthorized();
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      showStatus(data.error || 'Không cấp được số, thử lại');
      return;
    }
    const ticket = data.ticket;
    // Ghep tien to hien thi ("U"/"T"...) NEU CO - xem SEPARATE_PRIORITY_SEQUENCE trong .env.example.
    const numberText = `${ticket.number_prefix || ''}${String(ticket.number).padStart(3, '0')}`;
    showStatus(`Đã cấp số ${numberText} (${label})`);
    if (window.printReceipt) {
      await window.printReceipt({
        clinicName: brandClinicName,
        number: numberText,
        priorityLabel: label,
        time: new Date(ticket.created_at).toLocaleString('vi-VN'),
        footerText: brandFooterText,
        footerText2: brandFooterText2,
        logoImage: brandPrintLogoImage,
      });
    }
  } catch {
    showStatus('Lỗi kết nối, thử lại');
  } finally {
    quickIssueBusy = false;
    setQuickIssueButtonsDisabled(false);
  }
}

/**
 * Dam bao man hinh benh nhan cua QUAY DANG CHON dang duoc mo - theo yeu cau: cac nut goi so (Gọi
 * tiếp theo/Gọi lại/Bỏ qua/Gọi riêng đối tượng) deu phai TU DONG bat man hinh benh nhan NEU man hinh
 * do CHUA duoc bat. Goi O DAU moi hanh dong goi so (truoc khi goi API), de neu man hinh CHUA mo, no
 * kip mo/ket noi socket TRUOC khi lenh goi so thuc su toi may chu - man hinh benh nhan CHI phat am
 * thanh khi NHAN duoc su kien socket "counter:called"/"counter:reannounce" luc do (xem
 * public/patient-screen/index.html), KHONG phat lai am thanh cho lan goi da qua neu mo MAN HINH SAU
 * khi da goi xong (luc do chi thay dung SO hien tai qua 1 lan fetch trang thai, khong co am thanh).
 *
 * Trong Electron, dung `widgetBridge.ensurePatientScreen` (moi, khac voi `widgetBridge.
 * openPatientScreen` cua nut mo man hinh benh nhan bam thu cong): ham nay KHONG cuop focus/hien lai
 * cua so neu ĐÃ đang mở sẵn rồi (xem giai thich opts.bringToFront trong openPatientScreenWindow() ở
 * main.js) - quan trong vi day la ham goi TU DONG o MOI lan bam goi so (hang chuc lan/ca truc, khac
 * han nut mo thu cong chi bam 1-2 lan/ca).
 */
async function ensurePatientScreen() {
  if (!counterId) return;
  if (window.widgetBridge?.ensurePatientScreen) {
    // QUAN TRONG: PHAI cho (await) xong roi moi cho ham goi cho HANH DONG GOI SO thuc su chay tiep -
    // main.js chi "resolve" promise nay SAU KHI man hinh benh nhan da mo VA doi du 1 khoang cho
    // socket.io ket noi xong (hoac ngay lap tuc neu man hinh DA dang mo san tu truoc) - neu goi API
    // goi so NGAY khi man hinh con dang mo/chua ket noi socket, su kien "counter:called" se "bay qua
    // dau" (man hinh chua kip nhan), phieu van goi duoc so nhung KHONG co am thanh thong bao cho lan
    // goi do - day chinh la loi nguoi dung phan anh ("chưa auto đọc số"). Xem giai thich chi tiet
    // trong openPatientScreenWindow() trong electron-widget/main.js.
    await window.widgetBridge.ensurePatientScreen(counterId);
  } else if (!patientScreenWinRef || patientScreenWinRef.closed) {
    // Trinh duyet thuong (khong co widgetBridge) - CHI mo neu CHUA co/da dong cua so popup tu truoc
    // (tranh mo them cua so moi/cuop focus moi lan bam neu da dang mo san). Khong co cach dang tin
    // cay de biet luc nao socket cua popup nay ket noi xong (khac Electron, khong co IPC de doi tin
    // hieu tu cua so kia) nen CHI mo, khong cho them - truong hop nay (chay ngoai Electron) van co
    // the bi mat tieng o lan goi dau neu popup chua kip ket noi, nhung day la truong hop phu (khuyen
    // nghi dung ung dung widget Electron de co day du tinh nang).
    openPatientScreen();
  }
}

let statusTimer = null;
/** Thong bao ngan hien de tren cung 1 khoi (khong lam widget cao them) - tu bien mat sau 2.5s. */
function showStatus(message) {
  clearTimeout(statusTimer);
  if (!message) { els.statusToast.style.display = 'none'; return; }
  els.statusToast.textContent = message;
  els.statusToast.style.display = 'block';
  statusTimer = setTimeout(() => { els.statusToast.style.display = 'none'; }, 2500);
}

async function loadPriorityRules() {
  try {
    const res = await fetch('/api/priority-rules');
    priorityRules = await res.json();
    priorityColorMap = Object.fromEntries(priorityRules.map((r) => [r.code, r.color]));
    renderQuickIssueButtons();
    if (lastSummary) renderQueueCounts(lastSummary);
  } catch {
    // khong chan luong chinh neu loi tai mau - chi anh huong mau sac hien thi/nut cap nhanh
  }
}

/**
 * Ve cum so luong cho, ZERO-FILL du tat ca doi tuong (ke ca dang co 0 ve) theo dung thu tu rank,
 * phan tach bang dau "/", moi so 1 mau rieng trung voi mau so o man hinh benh nhan/quay.
 *
 * GOP LAM 1 voi chuc nang "goi tiep theo theo tung doi tuong" (truoc day la 1 DONG RIENG ben duoi
 * gom 8 nut icon, nay bo dong do di) - MOI SO O DAY LA 1 NUT BAM LUON: bam vao = goi tiep theo
 * CUA RIENG doi tuong do (xem callNextByPriority() ben duoi), giup nhan vien vua nhin duoc so
 * luong dang cho VUA goi rieng ngay tai cung 1 cho, ca widget van gon trong DUNG 1 DONG NGANG.
 */
/**
 * MUC 103/104/105 - cum "Gọi riêng ưu tiên/thường":
 * - Che do "basic" (dung 2 doi tuong gop "Ưu tiên"/"Đối tượng thường"): VE thanh 2 NUT NHO, NEN TO
 *   DAC MAU rieng cua doi tuong (MUC 104), CHI hien 1 CON SO dang cho (MUC 105 - bo chu nhan "Gọi ưu
 *   tiên"/"Gọi thường" da co o MUC 103, theo dung yeu cau moi nhat "để lại số lượng như cũ thay vì
 *   ghi rõ..."), dat NGAY SAU nhom #actions trong HTML (MUC 105 - "đưa nút... kế bên nút Gọi số tiếp
 *   theo") - van dung DUNG endpoint callNextByPriority() da co san, KHONG doi hanh vi goi so, chi doi
 *   CACH HIEN THI/VI TRI cho noi bat va tien tay hon.
 * - Che do "full" (nhieu hon 2 doi tuong, KHONG the gop gon thanh dung 2 nut "ưu tiên/không ưu
 *   tiên" ma khong lam mat kha nang goi rieng tung loai vi du chi goi rieng "Trẻ em") - MUC 104: cum
 *   nay bi AN HOAN TOAN theo dung lua chon cua nguoi dung ("Ẩn luôn chức năng trên widget"). Nhan
 *   vien VAN goi duoc so theo tung doi tuong uu tien rieng le nhu binh thuong qua trang /counter
 *   day du - CHI khong con o widget sieu nho nay nua.
 */
function renderQueueCounts(summary) {
  lastSummary = summary;
  if (!priorityRules.length) return;
  const countByCode = Object.fromEntries((summary.waitingByPriority || []).map((r) => [r.code, r.count]));

  if (isBasicPriorityMode()) {
    els.queueCounts.style.display = '';
    els.queueCounts.classList.add('prominent');
    const labelByCode = { PRIORITY: 'Ưu tiên', NORMAL: 'Đối tượng thường' };
    const parts = ['PRIORITY', 'NORMAL'].map((code) => {
      const r = priorityRules.find((x) => x.code === code);
      if (!r) return '';
      const count = countByCode[code] || 0;
      // MUC 104: nen VA vien deu to DAC mau rieng cua doi tuong (background-color + border-color
      // cung 1 mau r.color), chu mau trang (dinh nghia trong CSS) - noi bat tren nen dam.
      // MUC 105: CHI hien so luong (khong con chu nhan "Gọi ưu tiên/Gọi thường" rieng) - nhan van
      // con day du trong `title` (tooltip) cho ai can xem lai muon lam gi.
      return `<button type="button" class="no-drag queueCallBig" style="background-color:${r.color};border-color:${r.color}"
        title="Gọi tiếp theo — ${labelByCode[code]} — đang chờ ${count}"
        onclick="callNextByPriority('${code}')">${count}</button>`;
    });
    els.queueCounts.innerHTML = parts.join('');
    return;
  }

  // Che do "full" - an hoan toan theo yeu cau MUC 104.
  els.queueCounts.classList.remove('prominent');
  els.queueCounts.innerHTML = '';
  els.queueCounts.style.display = 'none';
}

function renderTicket(ticket, label) {
  currentTicketId = ticket ? ticket.id : null;
  // Ghep tien to hien thi ("U"/"T"...) NEU CO - xem SEPARATE_PRIORITY_SEQUENCE trong .env.example.
  els.sttNumber.textContent = ticket ? `${ticket.number_prefix || ''}${String(ticket.number).padStart(3, '0')}` : '---';
  // Mau mac dinh (khi khong co ticket/khong ro ma uu tien) doi tu vang gold '#facc15' (hop voi nen
  // toi truoc day) sang xanh duong y te '#1d4ed8' - theo yeu cau doi phong cach widget sang
  // "trắng, xanh dương ngành y tế" (xem toan bo <style> trong index.html).
  els.sttNumber.style.color = ticket ? priorityColorMap[ticket.priority_code] || '#1d4ed8' : '#1d4ed8';
  // Ten benh nhan/nhan uu tien chi hien qua tooltip (rê chuột) thay vi 1 dong rieng, de giu
  // widget gon trong DUNG 1 DONG NGANG duy nhat.
  els.sttNumber.title = ticket
    ? `${label || ''}${ticket.patient?.name ? ' – ' + ticket.patient.name : ''}`
    : 'Chưa có số đang phục vụ';
  els.btnRecall.disabled = !ticket;
  els.btnSkip.disabled = !ticket;
}

async function refreshCounter() {
  if (!counterId) return;
  try {
    const res = await fetch(`/api/counters/${counterId}/current`);
    if (!res.ok) {
      // Quay khong con ton tai (vi du bi xoa) - coi nhu chua chon quay, yeu cau chon lai.
      if (res.status === 404) { setCounterId(null); }
      return;
    }
    const data = await res.json();
    els.counterTag.textContent = data.counter.code;
    renderTicket(data.ticket, data.ticketLabel);
  } catch {
    showStatus('Mất kết nối máy chủ');
  }
}

/**
 * Bao "Không còn số nào đang chờ" (khi bam 1 trong cac nut GOI SO ma hang cho da het) - theo yeu
 * cau moi nhat: "điều chỉnh cảnh báo không còn số nào đang chờ của tất cả các nút gọi số trên
 * widget điều chỉnh thành confirm được không ạ" - TRUOC DAY chi hien 1 dong showStatus() (toast
 * nho, TU BIEN MAT sau 2.5s, nhan vien de vo tinh khong kip thay/bo lo) - NAY doi sang 1 hop thoai
 * MODAL (`alert()`), PHAI tu bam OK moi dong duoc, dam bao chac chan nhan vien nhin thay va nhan
 * biet duoc la hang cho da het. Dung `alert()` (khong phai `confirm()` co Huy) vi day CHI la 1
 * THONG BAO - khong co hanh dong "Huy" nao khac de chon (khac voi cac hop thoai confirm() o 3 nut
 * "Cap so nhanh"/khoa quay - noi CO 2 lua chon that su Dong y/Huy) - dat ten ham la
 * `confirmNoWaitingTicket()` de nhat quan voi cach goi "confirm" cua nguoi dung trong yeu cau.
 */
function confirmNoWaitingTicket(message) {
  // MUC 111: doi alert() native -> UiDialog.alert() (van la hop thoai phai bam Dong, khong cuop focus)
  return UiDialog.alert(message || 'Không còn số nào đang chờ');
}

async function callNext() {
  if (!counterId) return;
  // Vo hieu hoa nut NGAY (truoc khi cho ensurePatientScreen()) - trong luc dang cho man hinh benh
  // nhan mo/ket noi xong (co the mat toi vai tram ms o lan goi dau tien), tranh nhan vien bam nham
  // nhieu lan lien tiep gay goi so lap.
  els.btnNext.disabled = true;
  await ensurePatientScreen();
  try {
    const res = await fetch(`/api/counters/${counterId}/call-next`, { method: 'POST' });
    const data = await res.json();
    if (!data.ticket) { confirmNoWaitingTicket(data.message); renderTicket(null); return; }
    renderTicket(data.ticket, data.label);
  } catch {
    showStatus('Lỗi kết nối, thử lại');
  } finally {
    els.btnNext.disabled = false;
  }
}

/** Goi so tiep theo CUA RIENG 1 doi tuong uu tien (bo qua thu tu uu tien mac dinh cua quay) -
 * dung tu cac nut so luong dang cho trong #queueCounts (xem renderQueueCounts() o tren). */
async function callNextByPriority(priorityCode) {
  if (!counterId) return;
  await ensurePatientScreen();
  try {
    const res = await fetch(`/api/counters/${counterId}/call-next-priority`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorityCode }),
    });
    const data = await res.json();
    if (!res.ok) { showStatus(data.error || 'Không gọi được, thử lại'); return; }
    if (!data.ticket) { confirmNoWaitingTicket(data.message); renderTicket(null); return; }
    renderTicket(data.ticket, data.label);
  } catch {
    showStatus('Lỗi kết nối, thử lại');
  }
}

async function reCall() {
  if (!counterId || !currentTicketId) return;
  await ensurePatientScreen();
  try {
    const res = await fetch(`/api/counters/${counterId}/reannounce`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { showStatus(data.error || 'Không gọi lại được'); return; }
  } catch {
    showStatus('Lỗi kết nối, thử lại');
  }
}

/** "Bo qua" (vang mat) - va GOI LUON so tiep theo ngay sau do, giong het hanh vi o /counter day
 * du - khong dung lai cho nhan vien bam them nut "Goi tiep theo" rieng. */
async function skip() {
  if (!counterId || !currentTicketId) return;
  await ensurePatientScreen();
  try {
    await fetch(`/api/counters/${counterId}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: currentTicketId }),
    });
    renderTicket(null);
    await callNext();
  } catch {
    showStatus('Lỗi kết nối, thử lại');
  }
}

function setCounterId(id) {
  counterId = id;
  if (id) localStorage.setItem('counterId', id);
  else localStorage.removeItem('counterId');
  render();
}

function render() {
  els.patientScreenBtn.disabled = !counterId;
  els.logoutBtn.disabled = !counterId;
  els.priorityOrderBtn.disabled = !counterId;
  els.skippedListBtn.disabled = !counterId;
  if (counterId) {
    els.mainView.style.display = 'flex';
    els.emptyState.style.display = 'none';
    refreshCounter();
  } else {
    els.mainView.style.display = 'none';
    els.emptyState.style.display = 'flex';
  }
}

// Trang /counter (mo qua nut ⚙️) va widget nay CUNG ORIGIN nen chia se chung 1 localStorage -
// bat su kien "storage" de tu cap nhat NGAY khi nhan vien chon/doi quay ben trang quan ly day du
// ma khong can khoi dong lai widget.
window.addEventListener('storage', (e) => {
  if (e.key === 'counterId') {
    counterId = e.newValue || null;
    render();
  }
});

socket.on('queue:summary', (summary) => renderQueueCounts(summary));
socket.on('counter:called', (payload) => { if (String(payload.counterId) === String(counterId)) refreshCounter(); });
socket.on('counter:skipped', (payload) => { if (String(payload.counterId) === String(counterId)) refreshCounter(); });
socket.on('counter:completed', (payload) => { if (String(payload.counterId) === String(counterId)) refreshCounter(); });

loadPriorityRules();
render();
// Luoi an toan: dinh ky tu lam moi phong khi rot 1 su kien socket nao do (vi du mat mang tam thoi).
setInterval(() => { if (counterId) refreshCounter(); }, 8000);
