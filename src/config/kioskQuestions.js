const fs = require('fs');
const path = require('path');
const { getAppRoot } = require('./appRoot');

/**
 * MUC 112 - Cau hoi sang loc tai Kiosk benh nhan tu cap so (/kiosk).
 *
 * Noi dung cau hoi/nut tra loi/thoi gian dem nguoc doc tu file JSON nam CANH file .env:
 *   1. kiosk-questions.json          (file cua don vi - tu sua ngon tu o day)
 *   2. kiosk-questions.example.json  (file mau di kem moi ban cap nhat, dung khi chua co file 1)
 *   3. DEFAULT_CONFIG ben duoi        (du phong cuoi cung neu ca 2 file deu thieu/loi cu phap)
 * File duoc doc lai TU DONG khi thay doi (so sanh thoi gian sua file) - KHONG can khoi dong lai
 * server; kiosk lay cau hinh moi o lan bat dau hoi tiep theo.
 *
 * Cau truc:
 *   questions: { <id>: { type: 'choice'|'input', text, printLabel, options|pattern... } }
 *   flows: { scan: [id...], noId: [id...] }   - thu tu cau hoi cua tung luong
 *   - choice: options [{ value, label, stop?, stopMessage? }] - stop=true -> KET THUC, khong cap so
 *   - input : role 'cccd' | 'phone' (gan vao thong tin benh nhan), pattern (RegExp), maxLength,
 *             errorText - chi dung trong luong noId (BN khong mang CCCD/BHYT)
 */
const DEFAULT_CONFIG = {
  enabled: true,
  answerTimeoutSeconds: 10,
  inputTimeoutSeconds: 30,
  messageSeconds: 10,
  noIdButtonLabel: 'Không mang CCCD / thẻ BHYT? Bấm vào đây',
  // MUC 113: thong bao tren man hinh khi nhan vien KHOA tu cap so (nut o khoa tren header /kiosk)
  lockMessage:
    'Vui lòng lấy số thứ tự có sẵn ở hộp bên dưới máy.\nNếu hết số, vui lòng liên hệ nhân viên hướng dẫn tiếp nhận.',
  contactStaffMessage:
    'Xin lỗi, máy chưa thể cấp số cho Ông/Bà.\nVui lòng liên hệ NHÂN VIÊN HƯỚNG DẪN TIẾP NHẬN để được hỗ trợ.',
  timeoutMessageScan:
    'Hết thời gian trả lời - CHƯA cấp số.\nVui lòng quét lại CCCD hoặc thẻ BHYT để làm lại.',
  timeoutMessageNoId:
    'Hết thời gian trả lời - CHƯA cấp số.\nVui lòng bấm lại nút "Không mang CCCD / thẻ BHYT" để làm lại.',
  questions: {
    visitedOtherFacility7d: {
      type: 'choice',
      text: 'Trong 7 ngày vừa qua, Ông/Bà có đi khám bệnh ở BỆNH VIỆN hoặc TRẠM Y TẾ nào khác không?',
      printLabel: 'Khám nơi khác 7 ngày qua',
      options: [
        { value: 'yes', label: 'CÓ' },
        { value: 'no', label: 'KHÔNG' },
      ],
    },
    paymentType: {
      type: 'choice',
      text: 'Ông/Bà khám BẢO HIỂM Y TẾ hay khám DỊCH VỤ (tự trả tiền)?',
      printLabel: 'Hình thức khám',
      options: [
        { value: 'BHYT', label: 'BẢO HIỂM Y TẾ' },
        { value: 'DICH_VU', label: 'DỊCH VỤ' },
      ],
    },
    visitedHereBefore: {
      type: 'choice',
      text: 'Ông/Bà đã từng khám bệnh ở đây lần nào chưa?',
      printLabel: 'Đã khám ở đây',
      options: [
        { value: 'yes', label: 'ĐÃ TỪNG KHÁM' },
        { value: 'no', label: 'CHƯA, LẦN ĐẦU' },
      ],
    },
    noIdVisitedHereBefore: {
      type: 'choice',
      text: 'Ông/Bà đã từng khám bệnh ở đây lần nào chưa?',
      printLabel: 'Đã khám ở đây',
      options: [
        { value: 'yes', label: 'ĐÃ TỪNG KHÁM' },
        { value: 'no', label: 'CHƯA, LẦN ĐẦU', stop: true },
      ],
    },
    canUseKeypad: {
      type: 'choice',
      text: 'Ông/Bà có tự bấm số được trên màn hình cảm ứng hoặc bàn phím không?',
      printLabel: '',
      options: [
        { value: 'yes', label: 'CÓ, TÔI TỰ BẤM ĐƯỢC' },
        { value: 'no', label: 'KHÔNG', stop: true },
      ],
    },
    cccdNumber: {
      type: 'input',
      role: 'cccd',
      text: 'Mời Ông/Bà bấm SỐ CĂN CƯỚC CÔNG DÂN (12 số)',
      printLabel: 'CCCD (nhập tay)',
      pattern: '^\\d{12}$',
      maxLength: 12,
      errorText: 'Số căn cước phải đủ 12 chữ số. Vui lòng kiểm tra lại.',
    },
    phoneNumber: {
      type: 'input',
      role: 'phone',
      text: 'Mời Ông/Bà bấm SỐ ĐIỆN THOẠI (10 số)',
      printLabel: 'SĐT',
      pattern: '^0\\d{9}$',
      maxLength: 10,
      errorText: 'Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0. Vui lòng kiểm tra lại.',
    },
  },
  flows: {
    scan: ['visitedOtherFacility7d', 'paymentType', 'visitedHereBefore'],
    noId: ['noIdVisitedHereBefore', 'canUseKeypad', 'cccdNumber', 'phoneNumber', 'visitedOtherFacility7d', 'paymentType'],
  },
};

const FILE_NAMES = ['kiosk-questions.json', 'kiosk-questions.example.json'];
let cache = { file: null, mtimeMs: -1, config: null };

function toInt(v, dflt, min, max) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : dflt;
}

/** Chuan hoa + kiem tra cau hinh doc tu file; phan nao sai thi dung gia tri mac dinh, KHONG lam sap server. */
function normalizeConfig(raw) {
  const d = DEFAULT_CONFIG;
  const r = raw && typeof raw === 'object' ? raw : {};
  const str = (v, dflt) => (typeof v === 'string' ? v : dflt);
  const questions = {};
  const srcQuestions = r.questions && typeof r.questions === 'object' ? r.questions : d.questions;
  for (const [id, q] of Object.entries(srcQuestions)) {
    if (!q || typeof q !== 'object') continue;
    if (q.type === 'choice') {
      const options = (Array.isArray(q.options) ? q.options : [])
        .filter((o) => o && typeof o.value === 'string' && o.value && typeof o.label === 'string')
        .map((o) => ({
          value: o.value,
          label: o.label,
          printText: typeof o.printText === 'string' ? o.printText : '',
          stop: !!o.stop,
          stopMessage: typeof o.stopMessage === 'string' ? o.stopMessage : '',
        }));
      if (options.length < 2) continue;
      questions[id] = { id, type: 'choice', text: str(q.text, id), printLabel: str(q.printLabel, ''), options };
    } else if (q.type === 'input') {
      let pattern = str(q.pattern, '^\\d+$');
      try { new RegExp(pattern); } catch { pattern = '^\\d+$'; }
      questions[id] = {
        id,
        type: 'input',
        role: q.role === 'cccd' || q.role === 'phone' ? q.role : '',
        text: str(q.text, id),
        printLabel: str(q.printLabel, ''),
        pattern,
        maxLength: toInt(q.maxLength, 20, 1, 30),
        errorText: str(q.errorText, 'Giá trị chưa hợp lệ, vui lòng kiểm tra lại.'),
      };
    }
  }
  const flows = {};
  for (const name of ['scan', 'noId']) {
    const list = r.flows && Array.isArray(r.flows[name]) ? r.flows[name] : d.flows[name];
    flows[name] = list.filter((id) => typeof id === 'string' && questions[id]);
  }
  // Luong noId BAT BUOC co 1 cau nhap so CCCD (dung lam dinh danh chong lay so trung) - thieu thi tat luong nay.
  if (!flows.noId.some((id) => questions[id].type === 'input' && questions[id].role === 'cccd')) flows.noId = [];
  // Luong quet giay to khong duoc chua cau "input" (da co CCCD/BHYT tu may quet)
  flows.scan = flows.scan.filter((id) => questions[id].type === 'choice');

  return {
    enabled: r.enabled === undefined ? d.enabled : !!r.enabled,
    answerTimeoutSeconds: toInt(r.answerTimeoutSeconds, d.answerTimeoutSeconds, 3, 300),
    inputTimeoutSeconds: toInt(r.inputTimeoutSeconds, d.inputTimeoutSeconds, 5, 600),
    messageSeconds: toInt(r.messageSeconds, d.messageSeconds, 3, 120),
    noIdButtonLabel: str(r.noIdButtonLabel, d.noIdButtonLabel),
    lockMessage: str(r.lockMessage, d.lockMessage),
    contactStaffMessage: str(r.contactStaffMessage, d.contactStaffMessage),
    timeoutMessageScan: str(r.timeoutMessageScan, d.timeoutMessageScan),
    timeoutMessageNoId: str(r.timeoutMessageNoId, d.timeoutMessageNoId),
    questions,
    flows,
  };
}

function getKioskQuestionsConfig() {
  const root = getAppRoot();
  for (const name of FILE_NAMES) {
    const file = path.join(root, name);
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    if (cache.file === file && cache.mtimeMs === stat.mtimeMs && cache.config) return cache.config;
    try {
      // Bo BOM dau file (Notepad cu tren Windows hay tu them khi luu UTF-8)
      const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
      const config = normalizeConfig(JSON.parse(text));
      cache = { file, mtimeMs: stat.mtimeMs, config };
      console.log(`[Kiosk] Đã nạp câu hỏi sàng lọc từ ${name}`);
      return config;
    } catch (err) {
      console.warn(`[Kiosk] File ${name} bị lỗi (${err.message}) - dùng câu hỏi mặc định. Kiểm tra lại dấu phẩy/ngoặc trong file.`);
      cache = { file, mtimeMs: stat.mtimeMs, config: normalizeConfig(DEFAULT_CONFIG) };
      return cache.config;
    }
  }
  if (cache.file !== '(default)') cache = { file: '(default)', mtimeMs: 0, config: normalizeConfig(DEFAULT_CONFIG) };
  return cache.config;
}

/** Luong co bat va co it nhat 1 cau hoi khong. */
function isFlowActive(config, flow) {
  return !!(config.enabled && config.flows[flow] && config.flows[flow].length);
}

/**
 * Kiem tra cau tra loi kiosk gui len. Tra ve { ok, error, answers, cccd, phone }.
 * answers: [{ id, label, value, text }] - luu vao tickets.kiosk_answers, in len phieu (label: text).
 */
function validateSurvey(config, flow, rawAnswers) {
  if (!isFlowActive(config, flow)) return { ok: false, error: 'Luồng câu hỏi không hợp lệ hoặc đã tắt.' };
  const given = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {};
  const answers = [];
  let cccd = null;
  let phone = null;
  for (const id of config.flows[flow]) {
    const q = config.questions[id];
    const v = typeof given[id] === 'string' ? given[id].trim() : '';
    if (!v) return { ok: false, error: 'Chưa trả lời đủ các câu hỏi - chưa cấp số.' };
    if (q.type === 'choice') {
      const opt = q.options.find((o) => o.value === v);
      if (!opt) return { ok: false, error: 'Câu trả lời không hợp lệ - chưa cấp số.' };
      if (opt.stop) return { ok: false, error: 'Trường hợp này cần nhân viên hướng dẫn tiếp nhận hỗ trợ.' };
      answers.push({ id, label: q.printLabel, value: opt.value, text: opt.printText || opt.label });
    } else {
      if (v.length > q.maxLength || !new RegExp(q.pattern).test(v)) return { ok: false, error: q.errorText };
      if (q.role === 'cccd') cccd = v;
      if (q.role === 'phone') phone = v;
      answers.push({ id, label: q.printLabel, value: v, text: v });
    }
  }
  return { ok: true, answers, cccd, phone };
}

/** Cau hinh gui cho trang kiosk (khong co gi bi mat, chi la noi dung hien thi). */
function publicKioskQuestions() {
  return getKioskQuestionsConfig();
}

module.exports = { getKioskQuestionsConfig, validateSurvey, isFlowActive, publicKioskQuestions, DEFAULT_CONFIG };
