const socket = io({ path: '/rt-bridge/' });
let counterId = localStorage.getItem('counterId') || null;
let currentTicketId = null;
let patientWindowRef = null;
let priorityRules = []; // [{code, label, color}], tai 1 lan luc vao trang
let priorityColorMap = {};
let lastSummary = null; // luu lai summary moi nhat de ve lai duoc breakdown neu priorityRules den cham hon

async function loadPriorityRules() {
  try {
    const res = await fetch('/api/priority-rules');
    priorityRules = await res.json();
    priorityColorMap = Object.fromEntries(priorityRules.map((r) => [r.code, r.color]));
    renderLegend();
    renderPriorityCallButtons();
    // Neu danh sach thu tu uu tien / so lieu cho da duoc tai truoc do (vi du priorityRules den
    // cham hon), ve lai de hien dung ten/mau thay vi tam thoi hien ma code.
    if (priorityOrderState.length) renderPriorityOrderList();
    if (lastSummary) renderWaitingInfo(lastSummary);
  } catch {
    // khong chan luong chinh neu loi tai bang mau, chi la khong to mau/chu thich duoc
  }
}

function renderLegend() {
  const box = document.getElementById('legendList');
  if (!box) return;
  box.innerHTML = priorityRules
    .map(
      (r) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${r.color}"></span>${r.label}</span>`
    )
    .join('');
}

/**
 * Ve 8 nut "Gọi tiếp theo CỦA RIÊNG 1 đối tượng" (7 muc uu tien + "Đối tượng thường", lay tu
 * priorityRules da tai o loadPriorityRules() - LUON du 8, khong loc theo con dang cho hay khong,
 * de nhan vien co the bam bat ky luc nao). Xem callNextByPriority() ben duoi va route
 * POST /api/counters/:id/call-next-priority.
 */
function renderPriorityCallButtons() {
  const box = document.getElementById('priorityCallGrid');
  if (!box) return;
  box.innerHTML = priorityRules
    .map((r) => {
      // "Cấp cứu" (do dam #dc2626), "PRIORITY" gop chung khi PRIORITY_MODE=basic (cung mau do dam
      // #dc2626 - xem src/config/priorityRules.js) va "Đối tượng thường" (den nhat #4b5563) can
      // chu TRANG moi du tuong phan, khac voi cac doi tuong con lai (mau nen nhat hon, chu toi
      // #0f172a la du doc).
      const textColor = r.code === 'EMERGENCY' || r.code === 'PRIORITY' || r.code === 'NORMAL' ? '#fff' : '#0f172a';
      return `<button type="button" class="priority-call-btn" style="background:${r.color}; color:${textColor};"
        onclick="callNextByPriority('${r.code}')" title="Gọi tiếp theo của riêng đối tượng: ${r.label}">${r.label}</button>`;
    })
    .join('');
}

/** Token rieng cho tung trinh duyet/thiet bi, dung de nhan biet "cung 1 nguoi" khi vao lai quay. */
function getDeviceToken() {
  let token = localStorage.getItem('deviceSessionToken');
  if (!token) {
    token = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('deviceSessionToken', token);
  }
  return token;
}

async function loadCounters() {
  const res = await fetch('/api/counters');
  const counters = await res.json();
  const select = document.getElementById('counterSelect');
  // Quay dang "tam ngung" (is_active = 0, tat tu man hinh /counter-admin) van HIEN trong danh
  // sach de nhan vien biet quay do co ton tai (tranh nham "mat quay"), nhung bi VO HIEU HOA
  // (disabled) khong chon duoc - server cung tu choi enter-session cho quay tam ngung (loi
  // INACTIVE) de an toan ke ca khi danh sach o day chua kip tai lai.
  select.innerHTML = counters
    .map((c) => {
      const label = c.is_active
        ? `${c.code} - ${c.name}${c.in_use ? ' (đang có người dùng)' : ''}`
        : `${c.code} - ${c.name} (đang tạm ngưng)`;
      return `<option value="${c.id}" ${c.is_active ? '' : 'disabled'}>${label}</option>`;
    })
    .join('');
  if (counterId) select.value = counterId;
  return counters;
}

/**
 * Xin "vao phien" 1 quay. Neu quay do dang co thiet bi khac dang dung se bi tu choi (409) va
 * hien canh bao "vui long chon quay khac" - dung theo yeu cau: quay nao da vao phien thi
 * khong cho vao quay do nua cho den khi thoat phien.
 */
async function enterCounterAndShow(id) {
  const token = getDeviceToken();
  const res = await fetch(`/api/counters/${id}/enter-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await res.json();
  if (!res.ok) {
    UiDialog.alert(data.message || 'Quầy này đang có người sử dụng, vui lòng chọn quầy khác.');
    counterId = null;
    localStorage.removeItem('counterId');
    await loadCounters();
    return false;
  }
  counterId = id;
  localStorage.setItem('counterId', counterId);
  return true;
}

/**
 * Mo (hoac dua ra truoc) man hinh benh nhan cua dung quay dang chon. Trong ung dung Electron (trang
 * nay duoc tai trong cua so "settings" cua widget - xem createSettingsWindow() trong main.js, nay
 * co gan preload.js nen co san `window.widgetBridge`), UU TIEN dung widgetBridge.openPatientScreen
 * GIONG HET widget.js - de duoc main.js TU DONG chon man hinh phu (neu co) + tu dong vao toan man
 * hinh, thay vi 1 popup binh thuong (khong toan man hinh, khong tu doi man hinh) nhu truoc. Khi mo
 * bang trinh duyet thuong (khong co widgetBridge) van dung popup nhu cu, dung 1 "ten cua so" co
 * dinh theo counterId de nhung lan bam sau tai su dung lai cung 1 cua so thay vi mo them - nen keo
 * cua so nay sang man hinh phu (extend) roi bat F11/toan man hinh cho benh nhan xem.
 */
function openPatientScreen() {
  if (!counterId) return;
  if (window.widgetBridge?.openPatientScreen) {
    window.widgetBridge.openPatientScreen(counterId);
    return;
  }
  const url = `/patient-screen/?counter=${counterId}`;
  const winName = `patient-screen-${counterId}`;
  patientWindowRef = window.open(url, winName);
  if (patientWindowRef) patientWindowRef.focus();
}

async function selectCounter() {
  const selectedId = document.getElementById('counterSelect').value;
  const ok = await enterCounterAndShow(selectedId);
  if (!ok) return; // bi tu choi vi quay dang co nguoi -> o lai man hinh chon quay
  showWorking();
  // Goi ngay trong luot bam nut "Bat dau ca truc" de trinh duyet khong chan popup
  openPatientScreen();
  // Theo yeu cau: sau khi dang nhap quay xong CHI can hien man hinh benh nhan toan man hinh o man
  // hinh phu, KHONG can giu cua so /counter nay hien tren man hinh nua (trung lap voi widget nho -
  // ca 2 cung goi/bo qua so duoc) - chi AN di (khong dong), mo lai duoc bat ky luc nao qua nut ⚙️
  // tren widget (xem hideSettingsWindow() trong main.js). Chi ap dung trong Electron (co
  // widgetBridge) - khi mo bang trinh duyet thuong day la CHINH trang dang xem, an di se khong con
  // cach nao mo lai duoc nen KHONG an trong truong hop do.
  window.widgetBridge?.hideSettings?.();
}

/** Thoat phien quay hien tai (giai phong cho nguoi khac vao), roi quay lai man hinh chon quay. */
async function exitSession() {
  if (counterId) {
    const token = getDeviceToken();
    try {
      await fetch(`/api/counters/${counterId}/exit-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch {
      // bo qua loi mang, van cho thoat ve man hinh chon quay o phia client
    }
  }
  counterId = null;
  localStorage.removeItem('counterId');
  document.getElementById('working').style.display = 'none';
  document.getElementById('workingTools').style.display = 'none';
  document.getElementById('pick-counter').style.display = 'block';
  await loadCounters();
}

async function showWorking() {
  document.getElementById('pick-counter').style.display = 'none';
  document.getElementById('working').style.display = 'block';
  document.getElementById('workingTools').style.display = 'flex';
  const res = await fetch(`/api/counters/${counterId}/current`);
  const data = await res.json();
  document.getElementById('counterName').textContent = `${data.counter.code} - ${data.counter.name}`;
  renderTicket(data.ticket, data.ticketLabel);
  loadPriorityOrder();
}

function renderTicket(ticket, label) {
  currentTicketId = ticket ? ticket.id : null;
  const numEl = document.getElementById('currentNumber');
  // Ghep tien to hien thi ("U"/"T"...) NEU CO - xem SEPARATE_PRIORITY_SEQUENCE trong .env.example.
  numEl.textContent = ticket ? `${ticket.number_prefix || ''}${String(ticket.number).padStart(3, '0')}` : '--';
  numEl.style.color = ticket ? priorityColorMap[ticket.priority_code] || '#1d4ed8' : '#1d4ed8';
  document.getElementById('currentLabel').textContent = ticket
    ? `${label || ''}${ticket.patient?.name ? ' – ' + ticket.patient.name : ''}`
    : 'Chưa có số nào đang phục vụ';
  // MUC 112: tom tat cau tra loi sang loc tai kiosk (hinh thuc kham, kham noi khac 7 ngay, SDT...)
  const answersEl = document.getElementById('currentAnswers');
  if (answersEl) {
    const lines = ticket && Array.isArray(ticket.answers)
      ? ticket.answers.filter((a) => a && a.label).map((a) => `${a.label}: ${a.text}`)
      : [];
    answersEl.textContent = lines.join('  ·  ');
    answersEl.style.display = lines.length ? '' : 'none';
  }
}

/** Hieu ung nhap nhay ngan de nhan vien biet vua bam "Goi lai" thanh cong. */
function flashCurrentNumber() {
  const numEl = document.getElementById('currentNumber');
  numEl.classList.remove('flash-number');
  // ep trinh duyet tinh lai animation neu bam lien tuc nhieu lan
  void numEl.offsetWidth;
  numEl.classList.add('flash-number');
}

// "Goi so tiep theo" cung dong thoi hoan tat luon so dang phuc vu (neu co) - xem callNextTicket
// trong src/services/ticketService.js. Nhan vien khong can bam them nut "Hoan tat" rieng.
async function callNext() {
  const res = await fetch(`/api/counters/${counterId}/call-next`, { method: 'POST' });
  const data = await res.json();
  if (!data.ticket) {
    UiDialog.alert(data.message || 'Không còn số nào đang chờ');
    renderTicket(null);
    return;
  }
  renderTicket(data.ticket, data.label);
}

/** Goi so tiep theo CUA RIENG 1 doi tuong uu tien (bo qua thu tu uu tien mac dinh cua quay) -
 * dung khi nhan vien muon chu dong goi dung 1 loai doi tuong (vd: goi rieng "Cap cuu"). */
async function callNextByPriority(priorityCode) {
  const res = await fetch(`/api/counters/${counterId}/call-next-priority`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priorityCode }),
  });
  const data = await res.json();
  if (!res.ok) {
    UiDialog.alert(data.error || 'Không gọi được, vui lòng thử lại');
    return;
  }
  if (!data.ticket) {
    UiDialog.alert(data.message || 'Không còn số nào đang chờ');
    renderTicket(null);
    return;
  }
  renderTicket(data.ticket, data.label);
}

/** "Goi lai" so dang phuc vu hien tai cua quay (khong lay so moi) - patient-screen se nhap nhay lai. */
async function reCallCurrent() {
  if (!currentTicketId) return void UiDialog.alert('Chưa có số nào đang phục vụ để gọi lại');
  const res = await fetch(`/api/counters/${counterId}/reannounce`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    UiDialog.alert(data.error || 'Không gọi lại được, vui lòng thử lại');
    return;
  }
  flashCurrentNumber();
}

/** "Bo qua" (vang mat) - va GOI LUON so tiep theo ngay sau do (khong dung lai cho nhan vien bam
 * them 1 nut rieng "Goi so tiep theo"), giup thao tac lien tuc nhanh hon khi quay dang dong khach. */
async function skip() {
  if (!currentTicketId) return void UiDialog.alert('Chưa có số nào đang phục vụ để bỏ qua');
  await fetch(`/api/counters/${counterId}/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketId: currentTicketId }),
  });
  renderTicket(null);
  await callNext();
}

/**
 * Modal "Cai dat hien thi" (chu thich mau + thu tu uu tien) - gom vao 1 popup rieng thay vi
 * hien thuong truc, vi man hinh nay thuong duoc mo trong 1 cua so trinh duyet NHO dat 1 goc man
 * hinh (kieu widget ho tro cho nhan vien tiep nhan), nen phan chinh chi giu lai nhung gi can
 * thao tac ngay (so dang goi, 3 nut chinh, so luong cho theo loai uu tien).
 */
function openSettingsModal() {
  document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
}

let skippedModalOpen = false;

/** Mo modal "Xem DS bo qua", tai danh sach moi nhat tu server ngay khi mo. */
function openSkippedModal() {
  skippedModalOpen = true;
  document.getElementById('skippedModal').style.display = 'flex';
  loadSkippedModal();
}

function closeSkippedModal() {
  skippedModalOpen = false;
  document.getElementById('skippedModal').style.display = 'none';
}

async function loadSkippedModal() {
  const body = document.getElementById('skippedModalBody');
  try {
    const res = await fetch('/api/counters/skipped-list');
    const tickets = await res.json();
    if (tickets.length === 0) {
      body.innerHTML = '<div class="muted">Không có số nào đang bị bỏ qua.</div>';
      return;
    }
    body.innerHTML = tickets
      .map((t) => {
        const color = priorityColorMap[t.priority_code] || '#e2e8f0';
        const label = (priorityRules.find((r) => r.code === t.priority_code) || {}).label || t.priority_code;
        const name = t.patient?.name ? t.patient.name : '(không có tên)';
        const counterInfo = t.counterCode ? `Bị bỏ qua bởi ${t.counterCode}` : 'Chưa rõ quầy bỏ qua';
        return `<div class="skip-row">
          <div class="skip-number" style="color:${color}">${t.number_prefix || ''}${String(t.number).padStart(3, '0')}</div>
          <div class="skip-info">
            <div class="skip-name">${name}</div>
            <div class="skip-meta">${label} · ${counterInfo}</div>
          </div>
          <button class="btn-ok" onclick="recallSkippedTicket(${t.id})">Gọi lại</button>
        </div>`;
      })
      .join('');
  } catch {
    body.innerHTML = '<div class="muted">Không tải được danh sách, vui lòng thử lại.</div>';
  }
}

/**
 * Goi lai 1 so trong DS bo qua: goi THANG so do ve quay minh NGAY (giong "Goi so tiep theo"
 * nhung chon dung so nay) - so se hien thi/nhap nhay ngay tren man hinh benh nhan cua quay
 * minh. Neu quay dang phuc vu so khac thi so do tu dong duoc xem la da hoan tat truoc.
 * Sau khi goi thanh cong, dong modal va cap nhat luon so dang phuc vu tren the lam viec.
 */
async function recallSkippedTicket(ticketId) {
  if (!counterId) return;
  const res = await fetch(`/api/counters/${counterId}/recall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    UiDialog.alert(data.error || 'Không gọi lại được, vui lòng thử lại');
    await loadSkippedModal(); // co the so vua bi quay khac goi mat, lam moi lai danh sach
    return;
  }
  renderTicket(data.ticket, data.label);
  flashCurrentNumber();
  closeSkippedModal();
}

let calledModalOpen = false;

/** Mo modal "Xem số đã gọi", tai danh sach moi nhat tu server ngay khi mo. */
function openCalledModal() {
  calledModalOpen = true;
  document.getElementById('calledModal').style.display = 'flex';
  loadCalledModal();
}

function closeCalledModal() {
  calledModalOpen = false;
  document.getElementById('calledModal').style.display = 'none';
}

/** Nhan biet mo ta ngan gon trang thai HIEN TAI cua 1 ve trong lich su da goi - dung mau/chu khac
 * nhau de nhan vien nhan dien nhanh so nao van dang cho xu ly (bi bo qua) so voi so da xong han. */
function calledStatusLabel(status) {
  if (status === 'called') return { text: 'Đang phục vụ', color: '#2563eb' };
  if (status === 'skipped') return { text: 'Bị bỏ qua', color: '#b45309' };
  if (status === 'done') return { text: 'Đã xong', color: '#15803d' };
  return { text: status, color: '#64748b' };
}

async function loadCalledModal() {
  const body = document.getElementById('calledModalBody');
  try {
    const res = await fetch('/api/counters/called-list');
    const tickets = await res.json();
    if (tickets.length === 0) {
      body.innerHTML = '<div class="muted">Chưa có số nào được gọi trong hôm nay.</div>';
      return;
    }
    body.innerHTML = tickets
      .map((t) => {
        const color = priorityColorMap[t.priority_code] || '#e2e8f0';
        const label = (priorityRules.find((r) => r.code === t.priority_code) || {}).label || t.priority_code;
        const name = t.patient?.name ? t.patient.name : '(không có tên)';
        const counterInfo = t.counterCode ? `Gọi bởi ${t.counterCode}` : 'Chưa rõ quầy đã gọi';
        const calledTime = t.called_at
          ? new Date(t.called_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '--';
        const st = calledStatusLabel(t.status);
        return `<div class="skip-row">
          <div class="skip-number" style="color:${color}">${t.number_prefix || ''}${String(t.number).padStart(3, '0')}</div>
          <div class="skip-info">
            <div class="skip-name">${name}</div>
            <div class="skip-meta">${label} · ${counterInfo} · ${calledTime}</div>
          </div>
          <div style="font-size:12px; font-weight:700; color:${st.color}; white-space:nowrap;">${st.text}</div>
        </div>`;
      })
      .join('');
  } catch {
    body.innerHTML = '<div class="muted">Không tải được danh sách, vui lòng thử lại.</div>';
  }
}

/** Dang xuat khoi khu vuc nhan vien - xoa cookie phien dang nhap, quay ve trang chu. */
/**
 * "Thứ tự ưu tiên gọi số" - nhan vien co the keo-tha doi thu tu goi so CHI cho quay minh dang
 * truc, ap dung ngay cho lan bam "Gọi số tiếp theo" tiep theo. Thu tu nay duoc luu o server
 * (gan voi quay), nen van giu nguyen neu tai lai trang, va TU DONG VE MAC DINH HE THONG ngay
 * khi thoat phien (xem exitSession() va API server tuong ung).
 */
let priorityOrderState = []; // mang ma code, dung thu tu hien tai tren giao dien
let priorityOrderIsCustom = false;
let orderDragState = null; // { code, pointerId } - dang keo muc nao bang con tro (chuot/cham) nao

async function loadPriorityOrder() {
  if (!counterId) return;
  try {
    const res = await fetch(`/api/counters/${counterId}/priority-order`);
    const data = await res.json();
    priorityOrderState = data.order;
    priorityOrderIsCustom = data.isCustom;
    renderPriorityOrderList();
  } catch {
    // khong chan luong chinh neu loi tai thu tu uu tien
  }
}

function renderPriorityOrderList() {
  const list = document.getElementById('priorityOrderList');
  const statusEl = document.getElementById('priorityOrderStatus');
  if (!list || !statusEl) return;

  list.innerHTML = priorityOrderState
    .map((code, idx) => {
      const rule = priorityRules.find((r) => r.code === code);
      const label = rule ? rule.label : code;
      const color = priorityColorMap[code] || '#e2e8f0';
      return `<li class="order-item" data-code="${code}" onpointerdown="onOrderPointerDown(event)">
        <span class="order-handle">⠿</span>
        <span class="order-dot" style="background:${color}"></span>
        <span class="order-rank">${idx + 1}.</span>
        <span class="order-label">${label}</span>
      </li>`;
    })
    .join('');

  statusEl.textContent = priorityOrderIsCustom
    ? 'Đang dùng thứ tự TUỲ CHỈNH cho quầy này (tự về mặc định khi thoát phiên).'
    : 'Đang dùng thứ tự MẶC ĐỊNH của hệ thống.';
}

/**
 * Keo-tha bang Pointer Events (thay vi HTML5 Drag-and-Drop API) - hoat dong dong nhat tren ca
 * chuot va man hinh cam ung (quay tiep nhan co the dung tablet/man hinh cam ung), va khong phu
 * thuoc phien "keo" cua trinh duyet (native drag-and-drop doi khi khong nhat quan tren nhieu
 * trinh duyet/thiet bi khac nhau).
 *
 * QUAN TRONG: gan pointermove/pointerup vao `document` (KHONG dung setPointerCapture tren chinh
 * muc dang keo) - vi trong pointermove ta CHUYEN VI TRI (insertBefore) chinh phan tu dang keo
 * trong DOM de doi cho song, thao tac nay ve mat ky thuat la "go ra roi gan lai" nen se LAM MAT
 * pointer capture giua chung neu dung setPointerCapture, khien pointerup sau do khong con nhan
 * dung event nua (da gap loi nay khi test). Gan thang vao `document` thi khong bi anh huong.
 */
function onOrderPointerDown(e) {
  const li = e.currentTarget;
  e.preventDefault();
  orderDragState = { code: li.dataset.code, startOrder: priorityOrderState.slice() };
  li.classList.add('dragging');
  document.addEventListener('pointermove', onOrderPointerMove);
  document.addEventListener('pointerup', onOrderPointerUp);
  document.addEventListener('pointercancel', onOrderPointerUp);
}

/** Trong luc keo: doi cho ngay voi muc dang de con tro len tren (dua vao vi tri giua muc do). */
function onOrderPointerMove(e) {
  if (!orderDragState) return;
  const list = document.getElementById('priorityOrderList');
  if (!list) return;
  const draggedLi = list.querySelector(`.order-item[data-code="${orderDragState.code}"]`);
  if (!draggedLi) return;

  const items = Array.from(list.querySelectorAll('.order-item')).filter((el) => el !== draggedLi);
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const before = e.clientY - rect.top < rect.height / 2;
      list.insertBefore(draggedLi, before ? item : item.nextSibling);
      break;
    }
  }
}

function onOrderPointerUp() {
  if (!orderDragState) return;
  document.removeEventListener('pointermove', onOrderPointerMove);
  document.removeEventListener('pointerup', onOrderPointerUp);
  document.removeEventListener('pointercancel', onOrderPointerUp);

  const list = document.getElementById('priorityOrderList');
  const startOrder = orderDragState.startOrder;
  // Dong bo lai state tu thu tu THAT SU tren DOM sau khi keo xong, roi ve lai (an toan vi luc
  // nay khong con dang keo nua) de cap nhat lai so thu tu hien thi (1., 2., 3.…) va bo class
  // "dragging".
  if (list) priorityOrderState = Array.from(list.querySelectorAll('.order-item')).map((el) => el.dataset.code);
  orderDragState = null;
  renderPriorityOrderList();

  // Chi tu dong luu khi thu tu THAT SU thay doi (tranh goi API thua khi chi bam/tha ma khong keo
  // di dau ca) - khong con nut "Luu thu tu" rieng nua, keo tha xong la luu ngay cho phien nay.
  const changed = !startOrder || startOrder.length !== priorityOrderState.length ||
    startOrder.some((code, idx) => code !== priorityOrderState[idx]);
  if (changed) savePriorityOrder();
}

async function savePriorityOrder() {
  if (!counterId) return;
  const statusEl = document.getElementById('priorityOrderStatus');
  if (statusEl) statusEl.textContent = 'Đang lưu thứ tự...';
  try {
    const res = await fetch(`/api/counters/${counterId}/priority-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: priorityOrderState }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      UiDialog.alert(data.error || 'Không lưu được thứ tự ưu tiên, vui lòng thử lại');
      renderPriorityOrderList();
      return;
    }
    priorityOrderIsCustom = true;
    renderPriorityOrderList();
  } catch {
    UiDialog.alert('Không kết nối được máy chủ, thứ tự chưa được lưu. Vui lòng thử kéo thả lại.');
    renderPriorityOrderList();
  }
}

async function resetPriorityOrder() {
  if (!counterId) return;
  const res = await fetch(`/api/counters/${counterId}/priority-order/reset`, { method: 'POST' });
  if (res.ok) await loadPriorityOrder();
}

async function staffLogout() {
  try {
    await fetch('/api/auth/staff-logout', { method: 'POST' });
  } catch {
    // bo qua loi mang, van chuyen huong ve trang chu o phia client
  }
  location.href = '/';
}

/** Hien tong so ve dang cho + chi tiet theo tung doi tuong uu tien (VD: 🚨 Cấp cứu: 1, ≥75 tuổi: 2…),
 * giup nhan vien biet ro dang cho nhung loai nao ma khong can mo rieng man hinh nao khac. */
function renderWaitingInfo(summary) {
  lastSummary = summary;
  document.getElementById('waitingInfo').textContent = `Đang có ${summary.waitingCount} số đang chờ trong hàng đợi.`;

  const box = document.getElementById('waitingBreakdown');
  if (!box) return;
  const byPriority = summary.waitingByPriority || [];
  if (byPriority.length === 0) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = byPriority
    .map(({ code, count }) => {
      const rule = priorityRules.find((r) => r.code === code);
      const label = rule ? rule.label : code;
      const color = priorityColorMap[code] || '#e2e8f0';
      return `<span class="wait-chip"><span class="legend-dot" style="background:${color}"></span>${label}: <span class="wait-count">${count}</span></span>`;
    })
    .join('');
}

socket.on('queue:summary', (summary) => {
  renderWaitingInfo(summary);
  // Neu modal DS bo qua dang mo va co quay khac vua bo qua/goi lai 1 so, cap nhat lai danh sach
  if (skippedModalOpen) loadSkippedModal();
  // Tuong tu, neu modal "Số đã gọi" dang mo va co quay bat ky (ke ca quay khac) vua goi 1 so moi,
  // lam moi lai lich su ngay (queue:summary duoc phat sau MOI lan goi/bo qua/hoan tat o bat ky quay
  // nao - xem broadcastSummary() trong src/routes/counters.js).
  if (calledModalOpen) loadCalledModal();
});

/**
 * Quan tri vien vua TAM NGUNG dung quay minh dang truc (tu man hinh /counter-admin, xem
 * POST /api/counters/:id/pause) - dua nhan vien VE LAI man hinh chon quay NGAY LAP TUC thay vi de
 * ho tiep tuc thao tac tren 1 quay da bi khoa phia server (session da bi xoa) ma khong hay biet
 * cho toi khi bam nut nao do va gap loi kho hieu.
 */
socket.on('counter:paused', async ({ counterId: pausedId }) => {
  if (!counterId || String(pausedId) !== String(counterId)) return;
  counterId = null;
  localStorage.removeItem('counterId');
  await UiDialog.alert('Quầy này vừa được quản trị viên tạm ngưng hoạt động. Vui lòng chọn quầy khác.');
  location.reload();
});

// Co gang giai phong phien khi dong tab/trinh duyet (best-effort, khong dam bao 100% neu may
// tat dot ngot) - dung sendBeacon vi no chay duoc ngay ca khi trang dang dong.
window.addEventListener('pagehide', () => {
  if (!counterId) return;
  const token = getDeviceToken();
  const blob = new Blob([JSON.stringify({ token })], { type: 'application/json' });
  navigator.sendBeacon(`/api/counters/${counterId}/exit-session`, blob);
});

/**
 * "Nhip song" - bao cho server biet man hinh nay VAN DANG HOAT DONG (moi 20s). Day la luoi an
 * toan cho truong hop `pagehide` o tren KHONG kip chay (rot mang, mat dien, trinh duyet/may bi
 * tat dot ngot khong theo trinh tu binh thuong) - neu khong con heartbeat nao den trong 1 khoang
 * thoi gian, server se TU DONG giai phong quay (xem sweepStaleCounterSessions() o server) thay
 * vi khoa cung mai mai cho toi khi co nguoi goi force-exit-session thu cong.
 */
setInterval(() => {
  if (!counterId) return;
  const token = getDeviceToken();
  fetch(`/api/counters/${counterId}/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).catch(() => {
    // Bo qua loi mang tam thoi - lan heartbeat sau se thu lai, khong lam gian doan thao tac
  });
}, 20 * 1000);

loadPriorityRules();

/**
 * Mo san dung modal neu trang duoc dieu huong toi voi 1 "hash" cu the tren URL (vi du
 * "/counter/#priority-order" hoac "/counter/#skipped") - dung boi 2 nut moi tren widget sieu nho
 * (⏱️ Thứ tự ưu tiên / 👥 DS vắng mặt, xem openSettings(openTarget) trong widget.js va
 * createSettingsWindow(openTarget) trong electron-widget/main.js) de "dan" thang nhan vien toi
 * dung phan can xem, khong bat phai tu tim/bam lai tu dau. Chi ap dung SAU KHI da vao duoc phien
 * quay (can counterId hop le de cac modal nay hoat dong dung - vi du "gọi lại" trong DS bo qua
 * can biet quay hien tai).
 */
function openAutoTargetFromHash() {
  if (location.hash === '#priority-order') openSettingsModal();
  else if (location.hash === '#skipped') openSkippedModal();
}

loadCounters().then(async () => {
  if (counterId) {
    // Tai lai trang voi quay da luu san -> thu vao lai (cung thiet bi nen se duoc chap nhan).
    // Khong the tu dong mo lai man hinh benh nhan o day (trinh duyet chan popup ngoai luot bam nut).
    const ok = await enterCounterAndShow(counterId);
    if (ok) {
      showWorking();
      openAutoTargetFromHash();
    }
  }
});
