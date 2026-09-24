/**
 * ui-dialog.js - Hop thoai THAY THE cho window.alert()/window.confirm()/window.prompt() (MUC 111).
 *
 * VI SAO: window.alert()/confirm() la hop thoai NATIVE cua Chromium. Trong widget Electron (cua so
 * frameless/kiosk/fullscreen/luon-noi-ben-tren) hop thoai nay CO THE khong tra lai OS-focus cho cua
 * so sau khi dong -> nhan vien "khong nhap duoc gi nua" (xem README muc 106, 108). File nay cung cap
 * hop thoai tu ve bang DOM ngay trong trang (khong tao cua so OS nao) nen focus KHONG bao gio roi
 * khoi trang, va sau khi dong tu tra focus ve dung o nhap truoc do.
 *
 * API (tat ca tra ve Promise, KHONG chan luong JS nhu native - nho dung `await`):
 *   await UiDialog.alert('Noi dung')                         -> undefined (sau khi bam OK)
 *   const ok = await UiDialog.confirm('Noi dung', {          -> true/false
 *     confirmLabel: 'Đồng ý', cancelLabel: 'Huỷ', danger: true, title: 'Tieu de' })
 *   UiDialog.toast('Noi dung', { type: 'error'|'info'|'success', duration: 4000 })  (khong chan)
 *
 * Cua so QUA NHO de ve hop thoai (widget sieu nho 480x40 cua Electron): neu widget co ho tro
 * `window.widgetBridge.showDialog()` (electron-widget >= ban co muc 111) thi nho main process mo 1
 * cua so hop thoai rieng co kiem soat focus; neu widget ban cu chua co API do thi dung tam native
 * (hanh vi cu) vi khong con cach nao khac hien noi dung trong 40px chieu cao.
 */
(function () {
  'use strict';
  if (window.UiDialog) return;

  const STYLE_ID = 'ui-dialog-style';
  const CSS = `
  .uidlg-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483600;display:flex;
    align-items:center;justify-content:center;padding:16px;box-sizing:border-box;}
  .uidlg-box{background:#fff;color:#0f172a;border-radius:14px;max-width:480px;width:100%;max-height:100%;
    display:flex;flex-direction:column;box-shadow:0 10px 36px rgba(0,0,0,.35);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;outline:none;}
  .uidlg-title{font-weight:700;font-size:16px;padding:18px 20px 0;}
  .uidlg-msg{white-space:pre-wrap;word-break:break-word;font-size:15px;line-height:1.5;padding:14px 20px 4px;overflow:auto;}
  .uidlg-btns{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;padding:16px 20px 18px;}
  .uidlg-btn{font:inherit;font-size:15px;font-weight:600;border-radius:10px;padding:10px 18px;cursor:pointer;
    border:1px solid #cbd5e1;background:#f1f5f9;color:#0f172a;min-width:90px;}
  .uidlg-btn:focus-visible{outline:3px solid #93c5fd;outline-offset:2px;}
  .uidlg-btn.primary{background:#2563eb;border-color:#2563eb;color:#fff;}
  .uidlg-btn.danger{background:#dc2626;border-color:#dc2626;color:#fff;}
  .uidlg-toast-wrap{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483601;
    display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:max-content;max-width:calc(100vw - 24px);}
  .uidlg-toast{pointer-events:auto;background:#0f172a;color:#fff;border-radius:10px;padding:10px 16px;
    font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);
    white-space:pre-wrap;word-break:break-word;cursor:pointer;}
  .uidlg-toast.error{background:#b91c1c;} .uidlg-toast.success{background:#15803d;} .uidlg-toast.warning{background:#b45309;}
  `;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /** Cua so qua nho de ve modal ben trong (vd thanh widget 480x40). */
  function viewportTooSmall() {
    return window.innerHeight < 220 || window.innerWidth < 280;
  }
  function bridgeDialog() {
    const b = window.widgetBridge;
    return b && typeof b.showDialog === 'function' ? b : null;
  }

  function isFocusable(el) {
    return el && el !== document.body && el.isConnected && !el.disabled &&
      typeof el.focus === 'function' && (el.offsetParent !== null || el === document.activeElement);
  }
  function restoreFocus(el) {
    try {
      if (isFocusable(el)) el.focus({ preventScroll: true });
    } catch { /* bo qua */ }
  }

  // Xep hang: hop thoai sau chi hien khi hop thoai truoc da dong (giong native, khong chong len nhau)
  let queueTail = Promise.resolve();
  function enqueue(fn) {
    const run = queueTail.then(fn, fn);
    queueTail = run.catch(() => {});
    return run;
  }

  /**
   * Hien 1 hop thoai DOM. buttons: [{label, value, kind}] ; cancelValue: gia tri khi bam Esc.
   * Tra ve value cua nut duoc bam.
   */
  function showDomDialog({ title, message, buttons, cancelValue, focusIndex }) {
    return new Promise((resolve) => {
      ensureStyle();
      const prevFocus = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'uidlg-overlay';
      overlay.setAttribute('role', 'presentation');
      const box = document.createElement('div');
      box.className = 'uidlg-box';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      box.tabIndex = -1;
      if (title) {
        const t = document.createElement('div');
        t.className = 'uidlg-title';
        t.textContent = title;
        box.appendChild(t);
      }
      const msg = document.createElement('div');
      msg.className = 'uidlg-msg';
      msg.textContent = message == null ? '' : String(message);
      box.appendChild(msg);
      const row = document.createElement('div');
      row.className = 'uidlg-btns';
      const btnEls = buttons.map((b) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'uidlg-btn' + (b.kind ? ' ' + b.kind : '');
        el.textContent = b.label;
        el.addEventListener('click', (e) => { e.stopPropagation(); finish(b.value); });
        row.appendChild(el);
        return el;
      });
      box.appendChild(row);
      overlay.appendChild(box);

      // Chan MOI phim di xuong trang ben duoi khi hop thoai dang mo (vd ScannerBuffer, phim tat) -
      // chi xu ly Esc (huy), Enter/Space (bam nut dang focus), Tab (giu focus trong hop thoai).
      function onKey(e) {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); finish(cancelValue); return; }
        if (e.key === 'Tab') {
          e.preventDefault();
          const i = btnEls.indexOf(document.activeElement);
          const n = btnEls.length;
          btnEls[((i < 0 ? 0 : i) + (e.shiftKey ? n - 1 : 1)) % n].focus();
          return;
        }
        if ((e.key === 'Enter' || e.key === ' ') && btnEls.indexOf(document.activeElement) < 0) {
          e.preventDefault(); // Enter khi chua focus nut nao -> bo qua, tranh bam nham
        }
      }
      function onFocusIn(e) {
        if (!overlay.contains(e.target)) {
          const f = btnEls[focusIndex] || btnEls[0] || box;
          f.focus({ preventScroll: true });
        }
      }
      let done = false;
      function finish(value) {
        if (done) return;
        done = true;
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('keypress', stopOnly, true);
        window.removeEventListener('keyup', stopOnly, true);
        document.removeEventListener('focusin', onFocusIn, true);
        overlay.remove();
        restoreFocus(prevFocus);
        resolve(value);
      }
      function stopOnly(e) { e.stopPropagation(); }

      window.addEventListener('keydown', onKey, true);
      window.addEventListener('keypress', stopOnly, true);
      window.addEventListener('keyup', stopOnly, true);
      document.addEventListener('focusin', onFocusIn, true);
      (document.body || document.documentElement).appendChild(overlay);
      const f = btnEls[focusIndex] || btnEls[0] || box;
      f.focus({ preventScroll: true });
    });
  }

  async function viaBridge(opts) {
    const prevFocus = document.activeElement;
    try {
      const idx = await bridgeDialog().showDialog(opts);
      return idx;
    } finally {
      restoreFocus(prevFocus);
    }
  }

  function uiAlert(message, opts) {
    opts = opts || {};
    return enqueue(async () => {
      const okLabel = opts.okLabel || 'Đóng';
      if (viewportTooSmall()) {
        if (bridgeDialog()) { await viaBridge({ type: 'info', title: opts.title || '', message: String(message ?? ''), buttons: [okLabel], defaultId: 0, cancelId: 0 }); return; }
        window.alert(message); // widget ban cu chua co showDialog - khong con cach nao khac
        return;
      }
      await showDomDialog({
        title: opts.title,
        message,
        buttons: [{ label: okLabel, value: undefined, kind: 'primary' }],
        cancelValue: undefined,
        focusIndex: 0,
      });
    });
  }

  function uiConfirm(message, opts) {
    opts = opts || {};
    return enqueue(async () => {
      const okLabel = opts.confirmLabel || 'Đồng ý';
      const cancelLabel = opts.cancelLabel || 'Huỷ';
      if (viewportTooSmall()) {
        if (bridgeDialog()) {
          const idx = await viaBridge({ type: 'question', title: opts.title || '', message: String(message ?? ''), buttons: [cancelLabel, okLabel], defaultId: 1, cancelId: 0, danger: !!opts.danger });
          return idx === 1;
        }
        return window.confirm(message);
      }
      return showDomDialog({
        title: opts.title,
        message,
        buttons: [
          { label: cancelLabel, value: false },
          { label: okLabel, value: true, kind: opts.danger ? 'danger' : 'primary' },
        ],
        cancelValue: false,
        focusIndex: 1,
      });
    });
  }

  let toastWrap = null;
  function uiToast(message, opts) {
    opts = opts || {};
    if (viewportTooSmall() && bridgeDialog()) {
      // Khong du cho ve toast trong thanh widget -> dung hop thoai rieng (khong xep hang de khong chan)
      bridgeDialog().showDialog({ type: 'info', message: String(message ?? ''), buttons: ['Đóng'], defaultId: 0, cancelId: 0 }).catch(() => {});
      return;
    }
    ensureStyle();
    if (!toastWrap || !toastWrap.isConnected) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'uidlg-toast-wrap';
      (document.body || document.documentElement).appendChild(toastWrap);
    }
    const el = document.createElement('div');
    el.className = 'uidlg-toast' + (opts.type ? ' ' + opts.type : '');
    el.setAttribute('role', 'status');
    el.textContent = String(message ?? '');
    el.title = 'Bấm để đóng';
    el.addEventListener('click', () => el.remove());
    toastWrap.appendChild(el);
    setTimeout(() => el.remove(), opts.duration || 4000);
  }

  window.UiDialog = { alert: uiAlert, confirm: uiConfirm, toast: uiToast };
})();
