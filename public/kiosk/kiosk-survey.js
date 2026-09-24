/**
 * MUC 112 - Cau hoi sang loc tai Kiosk benh nhan tu cap so (/kiosk).
 *
 * 2 luong (noi dung/thu tu cau hoi cau hinh trong kiosk-questions.json canh file .env - xem
 * src/config/kioskQuestions.js):
 *  - "scan": sau khi quet CCCD/BHYT -> hoi lan luot -> tra loi du moi cap so.
 *  - "noId": BN KHONG mang CCCD/BHYT, bam nut tren man hinh -> hoi + nhap so CCCD, SDT -> cap so.
 *
 * Moi cau hoi co dem nguoc (answerTimeoutSeconds, mac dinh 10s; cau nhap so dung
 * inputTimeoutSeconds, tinh lai moi lan bam phim). HET GIO = KHONG cap so, hien thong bao roi tu
 * quay ve man hinh quet. Trong luc dang hoi, BN quet lai CCCD/BHYT bat ky luc nao -> huy luot hoi
 * hien tai va lam lai tu dau (kiosk.js goi KioskSurvey.abort() trong handleScanRawInner()).
 *
 * Phu thuoc cac ham/bien toan cuc cua kiosk.js: resetKiosk(), handleScanRaw().
 */
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  let cfg = null; // cau hinh cau hoi moi nhat lay tu /api/kiosk-config
  let active = null; // { flow, ids, index, answers, onDone }
  let messageActive = false;
  let tickTimer = null;
  let deadline = 0;
  let totalMs = 0;
  let messageTimer = null;
  let messageInterval = null;
  let scanSniffTimer = null; // phat hien may quet go vao o nhap so (xem onInputChanged)

  function setConfig(questions) {
    if (questions && typeof questions === 'object') cfg = questions;
    updateNoIdButton();
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/kiosk-config', { cache: 'no-store' });
      const data = await res.json();
      setConfig(data.questions);
    } catch {
      // mat mang tam thoi -> dung cau hinh da co
    }
    return cfg;
  }

  function isFlowEnabled(flow) {
    return !!(cfg && cfg.enabled && cfg.flows && Array.isArray(cfg.flows[flow]) && cfg.flows[flow].length);
  }

  function updateNoIdButton() {
    const btn = el('noIdBtn');
    if (!btn) return;
    btn.style.display = isFlowEnabled('noId') ? '' : 'none';
    if (cfg && cfg.noIdButtonLabel) el('noIdBtnLabel').textContent = cfg.noIdButtonLabel;
  }

  // ---------- Hien/an cac buoc ----------
  function showOnly(stepId) {
    for (const id of ['step-scan', 'step-done', 'step-question', 'step-message']) {
      const node = el(id);
      if (node) node.style.display = id === stepId ? 'block' : 'none';
    }
    const inner = document.querySelector('.kiosk-main-inner');
    if (inner) inner.classList.toggle('wide', stepId === 'step-question' || stepId === 'step-message');
  }

  function clearTick() {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  function clearMessage() {
    clearTimeout(messageTimer);
    clearInterval(messageInterval);
    messageTimer = null;
    messageInterval = null;
    messageActive = false;
  }

  // ---------- Dem nguoc ----------
  function startCountdown(seconds) {
    clearTick();
    totalMs = seconds * 1000;
    deadline = Date.now() + totalMs;
    renderCountdown();
    tickTimer = setInterval(() => {
      if (renderCountdown() <= 0) {
        clearTick();
        onTimeout();
      }
    }, 200);
  }
  /** Bam phim/nut o cau nhap so -> tinh lai thoi gian tu dau. */
  function restartCountdownIfInput() {
    const q = currentQuestion();
    if (q && q.type === 'input') startCountdown(cfg.inputTimeoutSeconds);
  }
  function renderCountdown() {
    const left = Math.max(0, deadline - Date.now());
    const secs = Math.ceil(left / 1000);
    el('qTimer').textContent = String(secs);
    const bar = el('qTimerBar');
    bar.style.width = `${totalMs ? (left / totalMs) * 100 : 0}%`;
    bar.classList.toggle('urgent', secs <= 3);
    return left;
  }

  function currentQuestion() {
    if (!active) return null;
    return cfg.questions[active.ids[active.index]] || null;
  }

  // ---------- Luong cau hoi ----------
  /**
   * Bat dau 1 luong. Tra ve false neu luong nay dang TAT/khong co cau hoi (kiosk.js tu xu ly nhu
   * cu). onDone(answers) duoc goi khi tra loi xong het - answers: { <id>: <value> }.
   */
  async function start(flow, onDone) {
    abort();
    await loadConfig();
    if (!isFlowEnabled(flow)) return false;
    active = { flow, ids: cfg.flows[flow].slice(), index: 0, answers: {}, onDone };
    renderQuestion();
    return true;
  }

  function renderQuestion() {
    const q = currentQuestion();
    if (!q) return finish();
    showOnly('step-question');
    el('qProgress').textContent = `Câu ${active.index + 1} / ${active.ids.length}`;
    el('qText').textContent = q.text;
    const optsBox = el('qOptions');
    const inputBox = el('qInputWrap');
    el('qInputError').textContent = '';
    optsBox.innerHTML = '';
    el('step-question').classList.toggle('is-input', q.type === 'input');
    el('qKeypad').style.display = q.type === 'input' ? 'grid' : 'none';
    if (q.type === 'choice') {
      inputBox.style.display = 'none';
      optsBox.style.display = '';
      optsBox.classList.toggle('many', q.options.length > 2);
      q.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'q-opt ' + (opt.stop ? 'q-opt-stop' : i === 0 ? 'q-opt-a' : 'q-opt-b');
        b.textContent = opt.label;
        b.addEventListener('click', () => answerChoice(q, opt));
        optsBox.appendChild(b);
      });
      startCountdown(cfg.answerTimeoutSeconds);
    } else {
      optsBox.style.display = 'none';
      inputBox.style.display = '';
      const input = el('qInput');
      input.value = '';
      input.placeholder = '';
      input.dataset.maxLength = String(q.maxLength || 20);
      fitInputFont();
      startCountdown(cfg.inputTimeoutSeconds);
      focusInput();
    }
  }

  function answerChoice(q, opt) {
    if (!active || currentQuestion() !== q) return;
    active.answers[q.id] = opt.value;
    if (opt.stop) {
      const flow = active.flow;
      stopFlow();
      showMessage(opt.stopMessage || cfg.contactStaffMessage, 'stop', flow);
      return;
    }
    next();
  }

  function submitInput() {
    const q = currentQuestion();
    if (!q || q.type !== 'input') return;
    const input = el('qInput');
    const v = (input.value || '').replace(/\D/g, '');
    input.value = v;
    let ok = false;
    try { ok = v.length <= (q.maxLength || 20) && new RegExp(q.pattern).test(v); } catch { ok = false; }
    if (!ok) {
      el('qInputError').textContent = q.errorText;
      restartCountdownIfInput();
      focusInput();
      return;
    }
    active.answers[q.id] = v;
    next();
  }

  function next() {
    active.index += 1;
    if (active.index >= active.ids.length) finish();
    else renderQuestion();
  }

  function finish() {
    const { onDone, answers, flow } = active;
    stopFlow();
    if (typeof onDone === 'function') onDone(answers, flow);
  }

  function stopFlow() {
    clearTick();
    clearTimeout(scanSniffTimer);
    active = null;
  }

  function onTimeout() {
    if (!active) return;
    const flow = active.flow;
    stopFlow();
    showMessage(flow === 'noId' ? cfg.timeoutMessageNoId : cfg.timeoutMessageScan, 'timeout', flow);
  }

  /** Thong bao ket thuc (het gio / can nhan vien ho tro) - tu quay ve man hinh quet sau messageSeconds. */
  function showMessage(text, kind) {
    clearMessage();
    messageActive = true;
    showOnly('step-message');
    el('msgIcon').textContent = kind === 'timeout' ? '⏱' : 'ℹ';
    el('msgText').textContent = text;
    el('step-message').classList.toggle('is-timeout', kind === 'timeout');
    let remaining = (cfg && cfg.messageSeconds) || 10;
    el('msgCountdown').textContent = String(remaining);
    messageInterval = setInterval(() => {
      remaining -= 1;
      el('msgCountdown').textContent = String(Math.max(remaining, 0));
    }, 1000);
    messageTimer = setTimeout(() => {
      clearMessage();
      resetKiosk();
    }, remaining * 1000);
  }

  /** Huy moi thu (luot hoi dang chay, thong bao dang hien) - KHONG tu doi man hinh. */
  function abort() {
    stopFlow();
    clearMessage();
    const q = el('step-question');
    const m = el('step-message');
    if (q) q.style.display = 'none';
    if (m) m.style.display = 'none';
    const inner = document.querySelector('.kiosk-main-inner');
    if (inner) inner.classList.remove('wide');
  }

  function isBusy() {
    return !!active || messageActive;
  }
  function wantsInputFocus() {
    const q = currentQuestion();
    return !!(q && q.type === 'input');
  }
  function focusInput() {
    const input = el('qInput');
    if (input && document.activeElement !== input) input.focus({ preventScroll: true });
  }

  // ---------- O nhap so + ban phim so tren man hinh ----------
  /**
   * Tu chon co chu LON NHAT ma van hien DU so ky tu toi da (12 so CCCD / 10 so SDT) trong 1 o -
   * do bang chinh o nhap voi chuoi mau toan so "8" (so rong nhat), giam dan toi khi vua.
   */
  function fitInputFont() {
    const input = el('qInput');
    if (!input || !input.offsetWidth) return;
    const max = Number(input.dataset.maxLength) || 12;
    const saved = input.value;
    input.value = '8'.repeat(max);
    let size = 72;
    input.style.fontSize = size + 'px';
    while (input.scrollWidth > input.clientWidth && size > 18) {
      size -= 2;
      input.style.fontSize = size + 'px';
    }
    input.value = saved;
  }
  window.addEventListener('resize', () => { if (wantsInputFocus()) fitInputFont(); });

  function keypadPress(key) {
    const q = currentQuestion();
    if (!q || q.type !== 'input') return;
    const input = el('qInput');
    el('qInputError').textContent = '';
    if (key === 'del') input.value = input.value.slice(0, -1);
    else if (key === 'clear') input.value = '';
    else if (key === 'ok') return submitInput();
    else if (/^\d$/.test(key) && input.value.length < (q.maxLength || 20)) input.value += key;
    restartCountdownIfInput();
    focusInput();
  }

  /**
   * May quet QR hoat dong nhu ban phim: neu BN quet CCCD/BHYT trong luc dang o cau nhap so, cac
   * ky tu se go vao o nay. Nhan dien qua dau "|" (QR CCCD/BHYT luon co) -> cho may quet go xong
   * (khong co ky tu moi trong 200ms) roi chuyen cho kiosk.js xu ly nhu 1 luot quet binh thuong
   * (huy luot hoi, lam lai tu dau). Go tay binh thuong: sau 200ms moi loc bo ky tu khong phai so
   * (khong loc ngay, tranh cat mat chu cai dau ma QR BHYT truoc khi dau "|" kip toi).
   */
  function onInputChanged() {
    const input = el('qInput');
    clearTimeout(scanSniffTimer);
    restartCountdownIfInput();
    el('qInputError').textContent = '';
    scanSniffTimer = setTimeout(() => {
      const v = input.value || '';
      if (v.includes('|')) {
        input.value = '';
        abort();
        if (typeof handleScanRaw === 'function') handleScanRaw(v);
        return;
      }
      const max = Number(input.dataset.maxLength) || 20;
      input.value = v.replace(/\D/g, '').slice(0, max);
    }, 200);
  }

  function onInputKeydown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if ((el('qInput').value || '').includes('|')) return; // may quet dang go - de onInputChanged xu ly
    clearTimeout(scanSniffTimer);
    submitInput();
  }

  function buildKeypad() {
    const pad = el('qKeypad');
    if (!pad || pad.childElementCount) return;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
    const labels = { del: '⌫ Xoá', ok: '✔ Xong' };
    for (const k of keys) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'q-key' + (k === 'ok' ? ' q-key-ok' : k === 'del' ? ' q-key-del' : '');
      b.textContent = labels[k] || k;
      // pointerdown thay vi click: phan hoi nhanh hon tren man hinh cam ung, khong lam mat focus o nhap
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); keypadPress(k); });
      b.addEventListener('click', (e) => { if (e.detail === 0) keypadPress(k); }); // Enter/Space tu ban phim
      pad.appendChild(b);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    buildKeypad();
    const input = el('qInput');
    if (input) {
      input.addEventListener('input', onInputChanged);
      input.addEventListener('keydown', onInputKeydown);
    }
    const back = el('msgBackBtn');
    if (back) back.addEventListener('click', () => { clearMessage(); resetKiosk(); });
    const cancel = el('qCancelBtn');
    if (cancel) cancel.addEventListener('click', () => { abort(); resetKiosk(); });
    updateNoIdButton();
  }

  window.KioskSurvey = {
    start, abort, isBusy, isFlowEnabled, setConfig, loadConfig, wantsInputFocus, focusInput,
    showOnly,
  };
})();
