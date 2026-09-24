/**
 * MUC 98 - man hinh moi `/staff-printer/`: IN LAI phieu so thu tu DA CAP TRUOC DO (may in ket
 * giay, mat phieu, in loi...) - theo dung yeu cau nguoi dung: "Thêm mới 1 chức năng staff-printer
 * cho phép tôi nhập stt từ - stt đến, ngày hôm nay/ngày mai và ưu tiên/thường để in tuần tự từng
 * phiếu lại giống như chức năng cấp số stt chỉ là ko cấp số lại thôi. stt in lại phải nằm trong
 * giới hạn stt max của ngày hôm nay/ngày mai và ưu tiên. hoặc là của ngày hôm nay/ngày mai và
 * thường".
 *
 * KHONG cap so moi, KHONG doi trang thai ve (status/counter_id/... giu nguyen) - CHI doc lai dung
 * nguyen du lieu da luu (GET /api/tickets/reprint-list trong src/routes/tickets.js) roi goi lai
 * `printReceipt()` (dung CHUNG ham voi kiosk.js/staff-kiosk.js, xem public/print-receipt.js) cho
 * tung ve MOT theo dung thu tu STT tang dan ("in tuần tự") - tuong tu nhip do cua "cấp nhiều số" o
 * staff-kiosk.js (AUTO_ISSUE_CONTINUE_DELAY_MS) nhung KHONG goi lai server de tao ve, chi in lai.
 */

let selectedDayChoice = 'today';
let selectedGroup = 'NORMAL';
let reprintCancelled = false;
let reprintRunning = false;

// Ten don vi/dong chan trang (tu .env qua /api/branding) - dung de in len phieu, dung CHUNG cau
// hinh voi cac man hinh khac (xem staff-kiosk.js/kiosk.js).
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
    // Khong lay duoc (vi du mat mang tam thoi) -> giu gia tri mac dinh, khong anh huong den viec in lai.
  }
})();

// Nhan hien thi ("Cấp cứu", "≥ 75 tuổi"...) theo priority_code - doc dong tu /api/priority-rules,
// KHONG hardcode danh sach (dung tinh than voi moi man hinh khac trong he thong, xem
// labelForCode() trong kiosk.js).
let priorityRulesMap = {};
(async function loadPriorityRules() {
  try {
    const res = await fetch('/api/priority-rules');
    const rules = await res.json();
    priorityRulesMap = Object.fromEntries(rules.map((r) => [r.code, r.label]));
  } catch {
    // Khong lay duoc -> labelForCode() se tu tra ve chinh priority_code lam nhan du phong.
  }
})();

function labelForCode(code) {
  return priorityRulesMap[code] || code;
}

/**
 * MUC 107 - "input nhập từ stt-đến stt không tương thích với màn hình cảm ứng ... phải sử dụng nút
 * tăng giảm từng số 1": #fromInput/#toInput da doi tu `type="number"` sang `type="text"` (xem ghi
 * chu chi tiet trong index.html) de tranh 2 van de tren man hinh cam ung: nut spinner +/- chiem het
 * dien tich cham, va ban phim ao khong hien on dinh voi type="number" tren 1 so trinh duyet/webview
 * kiosk. Vi `type="text"` khong tu rang buoc CHI duoc nhap chu so nhu `type="number"`, ham nay tu
 * loc BO moi ky tu KHONG PHAI chu so (0-9) NGAY KHI nguoi dung go/dan vao (ca go tay lan dan qua
 * clipboard) - giu nguyen vi tri con tro (dua tren do lech do dai truoc/sau khi loc) de khong lam
 * gian doan trai nghiem go so binh thuong.
 */
function sanitizeDigitsInput(inputEl) {
  const before = inputEl.value;
  const cleaned = before.replace(/[^0-9]/g, '');
  if (cleaned === before) return;
  const caretFromEnd = before.length - (inputEl.selectionEnd ?? before.length);
  inputEl.value = cleaned;
  const newCaret = Math.max(0, cleaned.length - caretFromEnd);
  try { inputEl.setSelectionRange(newCaret, newCaret); } catch { /* mot so trinh duyet/loai input khong ho tro - bo qua */ }
}
['fromInput', 'toInput'].forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => sanitizeDigitsInput(el));
});

function selectDay(choice) {
  if (reprintRunning) return; // dang in tuan tu - khong cho doi lua chon giua chung
  selectedDayChoice = choice;
  document.getElementById('dayTodayBtn').classList.toggle('active', choice === 'today');
  document.getElementById('dayTomorrowBtn').classList.toggle('active', choice === 'tomorrow');
  refreshMaxInfo();
}

function selectGroup(group) {
  if (reprintRunning) return;
  selectedGroup = group;
  document.getElementById('groupNormalBtn').classList.toggle('active', group === 'NORMAL');
  document.getElementById('groupPriorityBtn').classList.toggle('active', group === 'PRIORITY');
  refreshMaxInfo();
}

/** Goi moi khi doi "Ngày"/"Đối tượng" - CHI de HIEN THI gioi han cho de nhin (khong phai lop kiem
 * tra chinh - lop chinh nam o server, xem GET /reprint-list trong src/routes/tickets.js se tu
 * kiem tra lai truoc khi tra du lieu, du gia tri hien o day co the da cu vi 1 nhan vien khac vua
 * cap them so o man hinh khac). */
async function refreshMaxInfo() {
  const box = document.getElementById('maxInfoBox');
  box.textContent = 'Đang tải số tối đa hiện có...';
  try {
    const params = new URLSearchParams({ dayChoice: selectedDayChoice, group: selectedGroup });
    const res = await fetch(`/api/tickets/reprint-info?${params}`);
    const data = await res.json();
    const dayLabel = selectedDayChoice === 'tomorrow' ? 'ngày mai' : 'hôm nay';
    const groupLabel = selectedGroup === 'PRIORITY' ? 'ưu tiên' : 'đối tượng thường';
    if (!data.maxNumber) {
      box.textContent = `Chưa có số nào được cấp cho ${dayLabel} (${groupLabel}).`;
    } else {
      const prefix = data.numberPrefix || '';
      box.textContent = `Số tối đa hiện có của ${dayLabel} (${groupLabel}): ${prefix}${String(data.maxNumber).padStart(3, '0')} (STT ${data.maxNumber}).`;
    }
  } catch {
    box.textContent = 'Không lấy được số tối đa hiện có, vui lòng thử lại.';
  }
}

function showReprintError(message) {
  const box = document.getElementById('reprintErrorBox');
  if (!message) {
    box.style.display = 'none';
    box.textContent = '';
    return;
  }
  box.textContent = message;
  box.style.display = 'block';
}

async function handleStartReprintClick() {
  showReprintError('');
  const from = Number(document.getElementById('fromInput').value);
  const to = Number(document.getElementById('toInput').value);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    showReprintError('Vui lòng nhập "STT từ"/"STT đến" hợp lệ (số nguyên, "từ" ≥ 1 và ≤ "đến").');
    return;
  }
  const dayLabel = selectedDayChoice === 'tomorrow' ? 'NGÀY MAI' : 'HÔM NAY';
  const groupLabel = selectedGroup === 'PRIORITY' ? 'ƯU TIÊN' : 'ĐỐI TƯỢNG THƯỜNG';
  const ok = await UiDialog.confirm(
    `XÁC NHẬN in lại tuần tự các phiếu từ STT ${from} đến ${to} (ngày ${dayLabel}, nhóm ${groupLabel})?\n\n` +
      'Đây CHỈ in lại đúng dữ liệu đã lưu, KHÔNG cấp số mới, KHÔNG ảnh hưởng đến bộ đếm/hàng chờ hiện tại.',
    { confirmLabel: 'In lại' }
  );
  if (!ok) return;

  let data;
  try {
    const params = new URLSearchParams({ dayChoice: selectedDayChoice, group: selectedGroup, from: String(from), to: String(to) });
    const res = await fetch(`/api/tickets/reprint-list?${params}`);
    data = await res.json();
    if (!res.ok) {
      showReprintError(data.error || 'Không lấy được danh sách phiếu cần in lại, vui lòng thử lại.');
      return;
    }
  } catch {
    showReprintError('Không kết nối được máy chủ, vui lòng thử lại.');
    return;
  }

  if (!data.tickets || data.tickets.length === 0) {
    showReprintError('Không tìm thấy phiếu nào trong khoảng STT đã chọn.');
    return;
  }

  // Khi KHONG bat SEPARATE_PRIORITY_SEQUENCE (.env), "ưu tiên" va "thường" DUNG CHUNG 1 day so
  // lien tuc (xem getSequenceConfig() trong ticketService.js) - nen 1 khoang STT chon co the co
  // XEN LAN ca 2 nhom, khien so phieu TIM THAY THUC TE it hon khoang da nhap (vi 1 phan STT trong
  // khoang do thuoc nhom con lai). Canh bao ro truoc khi in, tranh nham tuong bi "mất phiếu".
  const expectedCount = to - from + 1;
  if (data.tickets.length !== expectedCount) {
    const proceed = await UiDialog.confirm(
      `Chỉ tìm thấy ${data.tickets.length}/${expectedCount} phiếu thuộc đúng nhóm "${groupLabel}" trong khoảng STT đã chọn ` +
        '(có thể do hệ thống đang dùng CHUNG 1 dãy số giữa "Ưu tiên"/"Đối tượng thường", nên một số STT trong khoảng thuộc ' +
        `nhóm còn lại). Tiếp tục in ${data.tickets.length} phiếu tìm thấy?`,
      { confirmLabel: 'Tiếp tục in' }
    );
    if (!proceed) return;
  }

  await runReprintSequence(data.tickets);
}

/**
 * In tuan tu TUNG PHIEU MOT theo dung thu tu STT tang dan (mang `tickets` da duoc server sap san,
 * xem GET /reprint-list) - dung CHUNG `printReceipt()` voi kiosk.js/staff-kiosk.js, LUON `await`
 * moi lenh in (khong "bắn rồi thôi") de dam bao KHONG bao gio 2 lenh in chay chong cheo nhau -
 * dung tinh than voi loi treo ung dung da sua o muc 95 (`kioskActionQueueTail`/`queuePrintJob`) -
 * hang doi in o `electron-widget/main.js` van la lop bao ve cuoi cung, nhung o day CHU DONG khong
 * bao gio ban 2 lenh cung luc tu dau. Co the bam "Dừng" GIUA 2 lan in de huy cac phieu con lai.
 */
async function runReprintSequence(tickets) {
  reprintCancelled = false;
  reprintRunning = true;
  document.getElementById('startReprintBtn').disabled = true;
  document.getElementById('reprintProgressBox').style.display = 'block';

  const total = tickets.length;
  let lastPrintedIndex = -1;
  for (let i = 0; i < total; i++) {
    if (reprintCancelled) break;
    const t = tickets[i];
    const numberText = `${t.numberPrefix || ''}${String(t.number).padStart(3, '0')}`;
    document.getElementById('reprintProgressText').textContent =
      `Đang in lại phiếu ${i + 1}/${total} (STT ${numberText})...`;
    try {
      await printReceipt({
        clinicName: brandClinicName,
        number: numberText,
        priorityLabel: labelForCode(t.priorityCode),
        time: new Date(t.createdAt).toLocaleString('vi-VN'),
        footerText: brandFooterText,
        footerText2: brandFooterText2,
        logoImage: brandPrintLogoImage,
        patientName: t.patientName,
        patientDob: t.patientDobDisplay,
        extraLines: t.answerLines || [],
        idQrRaw: null,
      });
      lastPrintedIndex = i;
    } catch (err) {
      console.error('[staff-printer] Lỗi in lại phiếu STT ' + numberText + ':', err && err.message);
      // Van tiep tuc sang phieu tiep theo (1 phieu loi khong nen chan het ca lo) - nhan vien thay
      // ngay o dong tien do neu can dung lai kiem tra thu cong.
    }
  }

  const wasCancelled = reprintCancelled;
  reprintRunning = false;
  document.getElementById('startReprintBtn').disabled = false;
  document.getElementById('reprintProgressBox').style.display = 'none';
  if (wasCancelled) {
    showReprintError(`Đã dừng theo yêu cầu - đã in được ${lastPrintedIndex + 1}/${total} phiếu, còn ${total - lastPrintedIndex - 1} phiếu chưa in.`);
  }
}

function stopReprint() {
  reprintCancelled = true;
}

refreshMaxInfo();
