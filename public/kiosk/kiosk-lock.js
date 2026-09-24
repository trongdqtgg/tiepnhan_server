/**
 * MUC 113 - KHOA / MO KHOA tu cap so tai Kiosk benh nhan (/kiosk).
 *
 * - Nut icon o khoa tren header. Bam -> hop "Nhap mat khau nhan vien" (go tay HOAC quet ma QR mat
 *   khau - dung chung 1 o nhap), CHI co 10 giay; het gio tu dong dong, giu nguyen trang thai cu.
 * - Dang KHOA: an toan bo man hinh quet/cau hoi, hien thong bao lon (lockMessage trong
 *   kiosk-questions.json) - moi luot quet CCCD/BHYT/QR cap nhanh deu bi bo qua, KHONG cap so.
 * - Trang thai khoa luu RIENG tung may kiosk (localStorage - trong widget Electron la phan vung
 *   persist:queue-widget) nen tat/mo lai ung dung, F5, mat dien... van giu nguyen dang khoa.
 *
 * MUC 113.1: hop mat khau cho CHON 1 trong 2 cach - "Quet ma QR" (o an, chi nhan may quet) hoac
 * "Nhap mat khau" (o hien, go tay) - xem setMode() ben duoi.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'kioskSelfServiceLocked';
  const MODAL_SECONDS = 10; // theo yeu cau: chi co 10 giay de thao tac
  const DEFAULT_MESSAGE =
    'Vui lòng lấy số thứ tự có sẵn ở hộp bên dưới máy.\nNếu hết số, vui lòng liên hệ nhân viên hướng dẫn tiếp nhận.';
  const el = (id) => document.getElementById(id);

  let locked = false;
  let modalOpen = false;
  let countdownTimer = null;
  let countdownInterval = null;
  let submitting = false;

  function readStored() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  }
  function writeStored(v) {
    try { v ? localStorage.setItem(STORAGE_KEY, '1') : localStorage.removeItem(STORAGE_KEY); } catch { /* bo qua */ }
  }

  async function loadMessage() {
    try {
      const res = await fetch('/api/kiosk-config', { cache: 'no-store' });
      const data = await res.json();
      const msg = data && data.questions && data.questions.lockMessage;
      el('lockMessageText').textContent = msg || DEFAULT_MESSAGE;
    } catch {
      if (!el('lockMessageText').textContent) el('lockMessageText').textContent = DEFAULT_MESSAGE;
    }
  }

  function applyLocked(v) {
    locked = !!v;
    document.body.classList.toggle('kiosk-locked', locked);
    const btn = el('kioskLockBtn');
    if (btn) {
      btn.classList.toggle('is-locked', locked);
      btn.title = locked
        ? 'Đang KHÓA tự cấp số - bấm để MỞ KHÓA (yêu cầu mật khẩu nhân viên)'
        : 'KHÓA tự cấp số (yêu cầu mật khẩu nhân viên)';
      el('lockIconClosed').style.display = locked ? '' : 'none';
      el('lockIconOpen').style.display = locked ? 'none' : '';
    }
    if (locked) {
      // Huy moi luot dang do (dem nguoc sau quet, cau hoi, man hinh so vua cap...)
      if (window.KioskSurvey) window.KioskSurvey.abort();
      if (typeof resetKiosk === 'function') resetKiosk();
      loadMessage();
    }
  }

  // ---------- Hop nhap mat khau ----------
  /**
   * MUC 113.1 - Tach 2 che do RIENG BIET (truoc day dung chung 1 o mat khau cho ca go tay lan may
   * quet - may quet go vao o hien, bat ban phim ao va "chiem" o nhap lien tuc):
   *  - 'qr'    : o nhap AN (inputmode=none, khong bat ban phim ao), giu focus lien tuc, chi nhan tu
   *              may quet qua ScannerBuffer (co/khong co Enter deu duoc) -> tu xac nhan.
   *  - 'manual': o mat khau hien ro, KHONG giu focus cuong ep, KHONG tu xac nhan - chi Enter/nut.
   * Moi lan chon/doi che do tinh lai 10 giay.
   */
  let mode = null; // null (dang chon) | 'qr' | 'manual'
  let qrFocusTimer = null;
  let qrBuffer = null;

  function clearCountdown() {
    clearTimeout(countdownTimer);
    clearInterval(countdownInterval);
    countdownTimer = null;
    countdownInterval = null;
  }

  function startCountdown() {
    clearCountdown();
    let remaining = MODAL_SECONDS;
    el('kioskLockCountdown').textContent = String(remaining);
    countdownInterval = setInterval(() => {
      remaining -= 1;
      el('kioskLockCountdown').textContent = String(Math.max(remaining, 0));
    }, 1000);
    // Het 10 giay ma chua xac nhan dung -> dong hop, GIU NGUYEN trang thai khoa/mo hien tai
    countdownTimer = setTimeout(closeModal, MODAL_SECONDS * 1000);
  }

  function stopQrFocus() {
    clearInterval(qrFocusTimer);
    qrFocusTimer = null;
  }

  function setMode(next) {
    mode = next;
    stopQrFocus();
    el('kioskLockChoose').style.display = next ? 'none' : '';
    el('kioskLockQrMode').style.display = next === 'qr' ? '' : 'none';
    el('kioskLockManualMode').style.display = next === 'manual' ? '' : 'none';
    el('kioskLockConfirmBtn').style.display = next === 'manual' ? '' : 'none';
    el('kioskLockError').textContent = '';
    el('kioskLockQrInput').value = '';
    el('kioskLockPasswordInput').value = '';
    if (next === 'qr') {
      const qr = el('kioskLockQrInput');
      el('kioskLockPasswordInput').blur();
      qr.focus({ preventScroll: true });
      qrFocusTimer = setInterval(() => {
        if (modalOpen && mode === 'qr' && document.activeElement !== qr) qr.focus({ preventScroll: true });
      }, 300);
    } else if (next === 'manual') {
      el('kioskLockPasswordInput').focus({ preventScroll: true });
    }
    if (next) startCountdown();
  }

  function openModal() {
    modalOpen = true;
    submitting = false;
    el('kioskLockModalTitle').textContent = locked ? '🔓 MỞ KHÓA tự cấp số' : '🔒 KHÓA tự cấp số';
    el('kioskLockConfirmBtn').textContent = locked ? 'Mở khóa' : 'Khóa';
    setMode(null);
    el('kioskLockModal').style.display = 'flex';
    // bo focus khoi o quet chinh de may quet vo tinh quet luc nay khong lot vao dau ca
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    startCountdown();
  }

  function closeModal() {
    el('kioskLockModal').style.display = 'none';
    el('kioskLockPasswordInput').value = '';
    el('kioskLockQrInput').value = '';
    modalOpen = false;
    mode = null;
    stopQrFocus();
    clearCountdown();
    if (typeof focusScanner === 'function') focusScanner();
  }

  async function submit(rawPassword) {
    if (submitting || !modalOpen) return;
    const errBox = el('kioskLockError');
    const password = String(rawPassword ?? el('kioskLockPasswordInput').value ?? '').trim();
    errBox.textContent = '';
    if (!password) {
      errBox.textContent = mode === 'qr' ? 'Chưa đọc được mã QR, vui lòng quét lại.' : 'Vui lòng nhập mật khẩu.';
      return;
    }
    submitting = true;
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!modalOpen) return; // da het 10 giay trong luc cho may chu
      if (!res.ok || !data.ok) {
        errBox.textContent = mode === 'qr'
          ? 'Mã QR không đúng mật khẩu nhân viên, vui lòng quét lại.'
          : 'Mật khẩu không đúng, vui lòng thử lại.';
        el('kioskLockPasswordInput').value = '';
        if (mode === 'manual') el('kioskLockPasswordInput').focus({ preventScroll: true });
        return;
      }
      const next = !locked;
      writeStored(next);
      closeModal();
      applyLocked(next);
    } catch {
      if (modalOpen) errBox.textContent = 'Không kết nối được máy chủ, vui lòng thử lại.';
    } finally {
      submitting = false;
    }
  }

  function init() {
    const input = el('kioskLockPasswordInput');
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') closeModal();
      el('kioskLockError').textContent = '';
    });
    const qrInput = el('kioskLockQrInput');
    if (window.ScannerBuffer) {
      qrBuffer = window.ScannerBuffer.attach(qrInput, { onComplete: (raw) => { if (mode === 'qr') submit(raw); } });
    } else {
      qrInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const v = qrInput.value;
        qrInput.value = '';
        if (mode === 'qr') submit(v);
      });
    }
    el('kioskLockChooseQr').addEventListener('click', () => setMode('qr'));
    el('kioskLockChooseManual').addEventListener('click', () => setMode('manual'));
    el('kioskLockToManual').addEventListener('click', () => setMode('manual'));
    el('kioskLockToQr').addEventListener('click', () => setMode('qr'));
    el('kioskLockConfirmBtn').addEventListener('click', () => submit());
    el('kioskLockCancelBtn').addEventListener('click', closeModal);
    el('kioskLockBtn').addEventListener('click', () => { if (!modalOpen) openModal(); });
    applyLocked(readStored());
    if (!locked) loadMessage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.KioskLock = {
    isLocked: () => locked,
    isModalOpen: () => modalOpen,
  };
})();
