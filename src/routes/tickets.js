const express = require('express');
const dayjs = require('dayjs');
const QRCode = require('qrcode');
const { getDB } = require('../config/db');
const { parseCCCD, parseBHYT } = require('../services/qrParser');
const { getEligibleOptions, getAllOptionsForStaff, getRuleByCode, getQuickQrSecret } = require('../config/priorityRules');
const { createTicket, checkCooldown, getDisplaySummary, getWaitingCount } = require('../services/ticketService');
const { getEffectiveDay, setEffectiveDayOverrideToNextDay } = require('../services/sequenceService');
const { printTicket } = require('../services/printerService');
const { isValidSession } = require('../services/authService');
const { getKioskQuestionsConfig, validateSurvey, isFlowActive } = require('../config/kioskQuestions');

/**
 * MUC 98 - man hinh moi `/staff-printer/` (IN LAI phieu da cap, KHONG cap so moi): quy doi lua
 * chon "Hôm nay"/"Ngày mai" cua nhan vien thanh NGAY THAT (dayjs() - dong ho may chu, KHONG tin
 * dong ho may khach, dung tinh than voi moi cho kiem tra gio/ngay khac trong he thong) - "Hôm nay"
 * = ngay thuc te hom nay, "Ngày mai" = ngay thuc te ngay mai (dung 2 gia tri nay de so khop TRUC
 * TIEP voi cot `tickets.day` da luu san trong CSDL luc cap so - CHU Y: day la ngay THUC TE, KHONG
 * PHAI "ngay hieu luc" cua getEffectiveDay()/muc 97 - vi tickets.day luu lai CHINH XAC gia tri
 * ngay hieu luc TAI THOI DIEM ve do duoc cap, co the la ngay thuc te hom nay HOAC ngay thuc te
 * ngay mai NEU nhan vien da bam "Mở reset > 16h" truoc do - nen chi can cho nhan vien chon dung 1
 * trong 2 ngay THAT nay la du bao phu moi truong hop, khong can biet gi ve override dang bat/tat).
 */
function resolveReprintDay(dayChoice) {
  return dayChoice === 'tomorrow' ? dayjs().add(1, 'day').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
}

/** "Ưu tiên" = MOI ma khac 'NORMAL' (gop chung, giong cach nhom seriesKey 'U' trong
 * sequenceService.js) - "Đối tượng thường" = dung 'NORMAL'. Dung y het field `number` da luu san
 * trong CSDL (da la gia tri DUNG cua tung nhom du bat/tat SEPARATE_PRIORITY_SEQUENCE), nen chi can
 * loc dung `priority_code` + `day` + khoang `number` la ra dung danh sach can in lai. */
function reprintGroupFilterSql(group) {
  return group === 'PRIORITY' ? `priority_code != 'NORMAL'` : `priority_code = 'NORMAL'`;
}

/**
 * Quy doi `patient_dob` luu trong CSDL sang dang DD/MM/YYYY de IN LAI GIONG HET luc phieu duoc cap
 * lan dau - xem patientInfoForReceipt() trong public/print-receipt.js (ham goc dung luc TAO ve,
 * nhan truc tiep ket qua parse CCCD/BHYT dang cccd.dob='YYYY-MM-DD'/bhyt.ngaySinh='DD/MM/YYYY' RIENG,
 * KHAC voi dang da luu vao cot `tickets.patient_dob` - cot nay LUU LAI y nguyen gia tri `patient.dob`
 * ma client gui len luc tao ve, tuc VAN la 'YYYY-MM-DD' neu nguon la CCCD, hoac da san 'DD/MM/YYYY'
 * neu nguon la BHYT - xem createTicket() trong nguon goc du lieu goi len tu kiosk.js/staff-kiosk.js).
 * Ve cap boi nhan vien (STAFF_MANUAL/STAFF_QUICK_QR) khong co patient_dob (null) - bo qua, tra ve null.
 */
function formatPatientDobForPrint(ticket) {
  if (!ticket.patient_dob) return null;
  if (ticket.patient_source === 'CCCD' && /^\d{4}-\d{2}-\d{2}$/.test(ticket.patient_dob)) {
    const [y, m, d] = ticket.patient_dob.split('-');
    return `${d}/${m}/${y}`;
  }
  return ticket.patient_dob;
}

function getCooldownMinutes() {
  // Doc truc tiep tu process.env moi lan (khong cache) de sua .env + khoi dong lai la ap dung ngay,
  // giong cach lam voi STAFF_PASSWORD.
  const raw = Number(process.env.KIOSK_COOLDOWN_MINUTES);
  return Number.isFinite(raw) && raw >= 0 ? raw : 5;
}

function ticketsRouter(io) {
  const router = express.Router();

  function broadcastSummary() {
    const db = getDB();
    const summary = getDisplaySummary(db, getEffectiveDay(db));
    io.emit('queue:summary', summary);
  }

  /**
   * Buoc 1 (kiosk cong khai): gui noi dung tho vua quet duoc tu QR (CCCD va/hoac BHYT)
   * -> tra ve thong tin da parse + danh sach cac nut uu tien duoc phep hien + trang thai
   * "cooldown" (co dang bi tam khoa vi vua lay so gan day khong) de kiosk canh bao NGAY
   * sau khi quet, truoc khi benh nhan kip chon doi tuong uu tien.
   * Khong luu gi vao DB o buoc nay.
   */
  router.post('/parse-qr', (req, res) => {
    const db = getDB();
    const { cccdRaw, bhytRaw } = req.body || {};
    const cccd = cccdRaw ? parseCCCD(cccdRaw) : null;
    const bhyt = bhytRaw ? parseBHYT(bhytRaw) : null;

    if (cccdRaw && !cccd) return res.status(400).json({ error: 'Không đọc được nội dung QR CCCD' });
    if (bhytRaw && !bhyt) return res.status(400).json({ error: 'Không đọc được nội dung QR BHYT' });

    const options = getEligibleOptions({ cccd, bhyt });
    const idNumber = cccd?.cccd || bhyt?.maThe || null;
    const cooldown = checkCooldown(db, idNumber, getCooldownMinutes());

    res.json({ cccd, bhyt, options, cooldown });
  });

  /**
   * Buoc 2 (kiosk cong khai): benh nhan da chon xong doi tuong uu tien -> tao ve, sinh so,
   * in phieu, bao realtime cho cac man hinh.
   *
   * BAT BUOC phai co giay to (da quet QR CCCD hoac BHYT o buoc 1) - khong cho tao ve "khong
   * giay to" nua o kiosk cong khai (nut da bi an tren giao dien, va o day chan lai o phia
   * server de khong the goi thang API bo qua giao dien). Dong thoi CHONG SPAM: neu so
   * CCCD/BHYT nay vua lay so trong vong KIOSK_COOLDOWN_MINUTES phut gan day -> tu choi.
   */
  router.post('/', async (req, res) => {
    try {
      const db = getDB();
      const { patient, survey } = req.body || {};
      let { priorityCode } = req.body || {};
      let p = patient || {};

      // MUC 112 - cau hoi sang loc: kiosk BAT BUOC gui du cau tra loi (neu tinh nang dang bat) -
      // khong tra loi / tra loi thieu / chon phuong an "dung lai" => KHONG cap so.
      const qConfig = getKioskQuestionsConfig();
      const flow = survey && survey.flow === 'noId' ? 'noId' : 'scan';
      let answers = null;
      if (flow === 'noId' || isFlowActive(qConfig, 'scan')) {
        if (!survey) {
          return res.status(400).json({ error: 'Chưa trả lời câu hỏi - chưa cấp số. Vui lòng tải lại màn hình kiosk.' });
        }
        const result = validateSurvey(qConfig, flow, survey.answers);
        if (!result.ok) return res.status(400).json({ error: result.error });
        answers = result.answers;
        if (flow === 'noId') {
          // BN khong mang giay to: dinh danh = so CCCD tu nhap (van ap dung chong lay so trung),
          // luon la "Doi tuong thuong" vi khong co giay to de xac minh tuoi/uu tien.
          p = { name: null, dob: null, gender: null, id_number: result.cccd, source: 'MANUAL', qr_raw: null, phone: result.phone };
          priorityCode = 'NORMAL';
        } else if (result.phone) {
          p = { ...p, phone: result.phone };
        }
      }

      if (!p.id_number) {
        return res
          .status(400)
          .json({ error: 'Vui lòng quét CCCD hoặc thẻ BHYT trước khi lấy số (kiosk không nhận số không giấy tờ).' });
      }

      const cooldownMinutes = getCooldownMinutes();
      const cooldown = checkCooldown(db, p.id_number, cooldownMinutes);
      if (cooldown.blocked) {
        return res.status(429).json({
          error: `Bạn vừa lấy số cách đây chưa lâu. Vui lòng thử lại sau ${Math.ceil(
            cooldown.remainingSeconds / 60
          )} phút nữa.`,
          cooldown,
        });
      }

      const ticket = createTicket(db, { priorityCode: priorityCode || 'NORMAL', patient: p, answers });
      const printResult = await printTicket(ticket);

      io.emit('queue:changed', { reason: 'new_ticket', number: ticket.number });
      broadcastSummary();

      res.status(201).json({ ticket, print: printResult });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * Danh sach TOAN BO doi tuong uu tien (ke ca "Cấp cứu") cho kiosk-nhan-vien tu chon - kem
   * `hasSecret` (co cau hinh QUICK_QR_CODE_<code> trong .env hay chua) de giao dien biet doi tuong
   * nao nen hien nut "📱 QR" (tao ma QR cap nhanh, xem 2 route ben duoi).
   */
  router.get('/staff-options', requireStaff, (req, res) => {
    res.json(getAllOptionsForStaff().map((o) => ({ ...o, hasSecret: !!getQuickQrSecret(o.code) })));
  });

  /**
   * Tao anh QR "cap nhanh" cho 1 doi tuong - encode san ma bi mat cau hinh trong .env
   * (QUICK_QR_CODE_<code>) danh RIENG cho doi tuong nay, dang "QUICKQR|<code>|<secret>". In ra/dan
   * len 1 the vat ly, sau do quet LAI dung ma nay (o man hinh /staff-kiosk, xem POST /quick ben
   * duoi) se cap so NGAY LAP TUC cho dung doi tuong do, khong can xac minh giay to gi ca.
   */
  router.get('/quick-qr-image/:code', requireStaff, async (req, res) => {
    const code = req.params.code;
    if (!getRuleByCode(code)) return res.status(400).json({ error: 'Đối tượng không hợp lệ' });
    const secret = getQuickQrSecret(code);
    if (!secret) {
      return res.status(400).json({
        error: `Chưa cấu hình mã cấp nhanh cho đối tượng này (QUICK_QR_CODE_${code} trong .env).`,
      });
    }
    try {
      const qr = await QRCode.toDataURL(`QUICKQR|${code}|${secret}`, { margin: 1, width: 280 });
      res.json({ qr });
    } catch (err) {
      console.error('[QR cấp nhanh] Lỗi tạo mã QR:', err.message);
      res.status(500).json({ error: 'Không tạo được mã QR, vui lòng thử lại' });
    }
  });

  /**
   * Cap so NGAY LAP TUC tu 1 ma QR "cap nhanh" da quet duoc (dang "QUICKQR|<code>|<secret>") -
   * KHONG can xac minh CCCD/BHYT, KHONG can thong tin benh nhan gi ca. Chi cap duoc ve neu ma
   * secret quet duoc KHOP CHINH XAC voi cau hinh QUICK_QR_CODE_<code> HIEN TAI trong .env cua DUNG
   * doi tuong do - tranh truong hop 1 QR cu/sai/doan mo lan van cap duoc so linh tinh. Khong ap
   * dung cooldown chong spam (giong /staff, vi day la nhan vien chu dong cap qua QR da duoc xac
   * thuc bang ma bi mat, khong phai benh nhan tu bam).
   */
  router.post('/quick', requireStaff, async (req, res) => {
    try {
      const raw = String(req.body?.raw || '').trim();
      const parts = raw.split('|');
      if (parts.length !== 3 || parts[0] !== 'QUICKQR') {
        return res.status(400).json({ error: 'Mã QR không đúng định dạng cấp nhanh.' });
      }
      const [, code, secretScanned] = parts;
      if (!getRuleByCode(code)) return res.status(400).json({ error: `priorityCode không hợp lệ: ${code}` });
      const secretConfigured = getQuickQrSecret(code);
      if (!secretConfigured || secretScanned !== secretConfigured) {
        return res.status(401).json({ error: 'Mã QR cấp nhanh không đúng hoặc đã hết hiệu lực.' });
      }

      const db = getDB();
      const ticket = createTicket(db, { priorityCode: code, patient: { source: 'STAFF_QUICK_QR' } });
      const printResult = await printTicket(ticket);

      io.emit('queue:changed', { reason: 'new_ticket', number: ticket.number });
      broadcastSummary();

      res.status(201).json({ ticket, print: printResult });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * Kiosk danh cho NHAN VIEN (da dang nhap bang mat khau, xem middleware requireStaff duoi
   * day): duoc cap so cho BAT KY doi tuong uu tien nao (ke ca "Cấp cứu" - muc uu tien cao
   * nhat, mau do) MA KHONG CAN quet QR/xac minh giay to, va KHONG bi gioi han cooldown chong
   * spam (vi day la nhan vien chu dong cap, khong phai benh nhan tu bam).
   *
   * DUNG CHUNG CHO CA "cấp nhiều số" (tinh nang o /staff-kiosk/): TRUOC DAY co 1 route rieng
   * POST /staff-batch tao ca lo ve trong 1 request roi tu in lan luot phia server - theo phan
   * anh cua nguoi dung ("bỏ code in loạt nhiều phiếu đi ... nó vẫn đi theo luồng cấp và in từng
   * phiếu 1 chứ không đi riêng 1 luồng in 1 loạt"), route /staff-batch DA BI XOA - client
   * (autoIssueLoop() trong staff-kiosk.js) gio GOI LAI DUNG route /staff nay N LAN LIEN TIEP
   * (moi lan 1 request, cho tao+in xong 1 ve MOI goi lan tiep theo), y het nhu nhan vien tu tay
   * bam nut "Cấp số ngay" nhieu lan - khong con luong rieng biet nao cho "in hang loat" nua, va
   * nhan vien co the bam "Dừng" giua chung bat ky luc nao (xem stopAutoIssue() o client).
   */
  router.post('/staff', requireStaff, async (req, res) => {
    try {
      const db = getDB();
      const { priorityCode, patient } = req.body || {};
      if (!getRuleByCode(priorityCode || 'NORMAL')) {
        return res.status(400).json({ error: `priorityCode không hợp lệ: ${priorityCode}` });
      }

      const ticket = createTicket(db, {
        priorityCode: priorityCode || 'NORMAL',
        patient: { ...(patient || {}), source: patient?.source || 'STAFF_MANUAL' },
      });
      const printResult = await printTicket(ticket);

      io.emit('queue:changed', { reason: 'new_ticket', number: ticket.number });
      broadcastSummary();

      res.status(201).json({ ticket, print: printResult });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * MUC 96/97 - "Mở reset > 16h": theo dung lam ro cua nguoi dung o muc 97 ("Mở reset > 16h ở màn
   * hình staff-kiosk là ngưng cấp số ở ngày hiện tại. bắt đầu cấp số cho ngày tiếp theo đó ạ") -
   * DAY KHONG PHAI la "xoa bo dem cho cap lai tu 1 CUNG NGAY hom nay" (thiet ke ban dau, sai) ma la
   * "CHUYEN SANG NGAY HOM SAU": tu thoi diem bam nut, MOI ve MOI cap (bat ky man hinh nao - kiosk,
   * staff-kiosk, QR cap nhanh...) se duoc tinh la cua NGAY MAI (ca cot `tickets.day` lan bo dem
   * `seq`) - tuc STT se tu bat dau lai tu 1 (vi la ngay/khoa moi, chua tung co) VA khong con ve nao
   * moi duoc gan cho "ngay hom nay" (thuc te) nua - dung y "ngung cap so ngay hien tai, bat dau cap
   * so ngay tiep theo". Xem getEffectiveDay()/setEffectiveDayOverrideToNextDay() trong
   * src/services/sequenceService.js - noi luu/doc "ngay hieu luc" nay (bang `app_state`), duoc DUNG
   * XUYEN SUOT thay the todayKey() o moi cho lien quan cap so/thong ke (createTicket() qua
   * getNextTicketNumber(), broadcastSummary() o day, GET /api/display/summary, cac route
   * /api/counters/*).
   *
   * KIEM TRA GIO O PHIA SERVER (dayjs(), dong ho cua may chu) - KHONG tin dong ho may khach gui
   * len, dung tinh than voi requireStaff/STAFF_PASSWORD deu la cac lop chan phia server: giao dien
   * /staff-kiosk (xem updateResetSequenceBtnUI() trong staff-kiosk.js) CHI dung dong ho may khach
   * de bat/tat nut cho de nhin, khong phai lop bao ve that su - nhan vien khong the "chinh gio may
   * tinh" de bypass, vi route nay se tu choi lai (403) neu server chua qua 16h.
   *
   * LUU Y QUAN TRONG (DA DOI O MUC 99 - da canh bao truoc trong hop thoai xac nhan phia client,
   * xem handleResetSequenceClick() trong staff-kiosk.js): cac ve DA CAP truoc do trong ngay hom nay
   * (con dang o trang thai "waiting" - chua duoc goi) KHONG bi xoa/mat gi ca, NHUNG TU MUC 99 se
   * KHONG CON goi so duoc o quay nua sau khi reset (callNextTicket()/callNextTicketByPriority()
   * trong ticketService.js nay BAT BUOC loc theo `day` = "ngay hieu luc" hien tai - truoc do KHONG
   * loc, gay ra loi "gọi vượt rào" ve ngay khac du man hinh dang bao 0 số đang chờ, xem README muc
   * 99) - cung KHONG CON hien trong so dem "đang chờ"/danh sach o bang tong hop (/counter, /display,
   * /counter-admin), vi cac man hinh do CUNG loc theo "ngay hieu luc" (nay da la ngay mai). Nhan
   * vien can xu ly HET hang cho cua ngay hom nay (goi/hoan tat) TRUOC KHI bam nut nay, vi sau khi
   * reset se KHONG CON CACH NAO goi tiep cac ve con sot lai cua ngay cu qua giao dien /counter nua
   * (chi con quay lai duoc bang cach... doi that den dung ngay do, hoac can thiep CSDL truc tiep).
   */
  router.post('/reset-sequence', requireStaff, (req, res) => {
    const now = dayjs();
    if (now.hour() < 16) {
      return res.status(403).json({
        error: `Chỉ được phép reset STT tiếp nhận sau 16:00 (hiện tại ${now.format('HH:mm')}).`,
      });
    }
    const db = getDB();
    const previousDay = getEffectiveDay(db);
    const stillWaiting = getWaitingCount(db, previousDay);
    const nextDay = setEffectiveDayOverrideToNextDay(db);
    console.log(
      `[Reset ngày tiếp nhận] Nhân viên chuyển "ngày hiệu lực" từ ${previousDay} sang ${nextDay} lúc ${now.format(
        'HH:mm:ss DD/MM/YYYY'
      )} (còn ${stillWaiting} số chưa gọi của ${previousDay} tại thời điểm chuyển).`
    );
    broadcastSummary();
    res.json({ ok: true, previousDay, nextDay, stillWaiting, resetAt: now.toISOString() });
  });

  /**
   * MUC 98 - man hinh moi `/staff-printer/`: tra ve "STT tối đa hiện có" cho ĐÚNG 1 lựa chọn
   * (ngày + nhóm ưu tiên/thường) - dung de HIEN THI NGAY tren giao dien khi nhan vien doi lua chon
   * (truoc khi ho nhap khoang STT tu-den), giup biet gioi han hop le MA KHONG can doi den luc bam
   * "Bắt đầu in" moi bao loi. KHONG phai lop kiem tra chinh (lop chinh nam o GET /reprint-list ben
   * duoi, luon tu kiem tra lai truoc khi tra du lieu that).
   */
  router.get('/reprint-info', requireStaff, (req, res) => {
    const db = getDB();
    const day = resolveReprintDay(req.query.dayChoice);
    const group = req.query.group === 'PRIORITY' ? 'PRIORITY' : 'NORMAL';
    const row = db
      .prepare(`SELECT number, number_prefix FROM tickets WHERE day = ? AND ${reprintGroupFilterSql(group)} ORDER BY number DESC LIMIT 1`)
      .get(day);
    res.json({ day, group, maxNumber: row ? row.number : 0, numberPrefix: row ? row.number_prefix || null : null });
  });

  /**
   * MUC 98 - "staff-printer": lay DANH SACH cac ve DA CAP TRUOC DO (KHONG tao ve moi, KHONG sinh
   * so moi - chi doc lai dung nguyen du lieu da luu) trong đúng 1 khoảng STT (`from`-`to`), thuộc
   * đúng 1 ngày ("Hôm nay"/"Ngày mai", quy đổi ở resolveReprintDay()) và đúng 1 nhóm ("Ưu tiên"/
   * "Đối tượng thường", xem reprintGroupFilterSql()) - theo dung yeu cau nguoi dung: "nhập stt từ -
   * stt đến, ngày hôm nay/ngày mai và ưu tiên/thường để in tuần tự từng phiếu lại ... chỉ là ko cấp
   * số lại thôi. stt in lại phải nằm trong giới hạn stt max của ngày hôm nay/ngày mai và ưu tiên.
   * hoặc là của ngày hôm nay/ngày mai và thường".
   *
   * KIEM TRA LAI O SERVER (khong chi tin gia tri "STT tối đa" da hien o giao dien tu GET
   * /reprint-info truoc do, vi client co the da cu/bi sua): tu choi (400) neu `from`/`to` khong
   * phai so nguyen hop le, `from` < 1, `from` > `to`, CHUA CO so nao duoc cap cho lua chon nay
   * (maxNumber = 0), hoac `to` VUOT QUA so toi da hien co cua đúng lựa chọn (ngày + nhóm) đó - dung
   * tinh than "chan o server" giong moi kiem tra khac trong he thong (STAFF_PASSWORD, gio 16h...).
   *
   * Tra ve MOI ve tim thay trong khoang (sap theo `number` tang dan - THU TU IN, dung "tuần tự"
   * theo dung yeu cau) kem du lieu can de IN LAI y het luc cap dau (xem formatPatientDobForPrint()
   * o tren) - client (`public/staff-printer/staff-printer.js`) se LAP QUA TUNG PHAN TU, goi
   * `printReceipt()` (dung chung ham voi kiosk.js/staff-kiosk.js) cho tung ve MOT, co dem thoi gian
   * nghi giua 2 lan in (giong het nhip do cua "cấp nhiều số" o staff-kiosk - xem
   * AUTO_ISSUE_CONTINUE_DELAY_MS trong staff-kiosk.js) va co the bam "Dừng" giua chung - dam bao
   * KHONG bao gio 2 lenh in chay chong cheo (tranh dung lai loi treo ung dung da sua o muc 95).
   */
  router.get('/reprint-list', requireStaff, (req, res) => {
    const db = getDB();
    const day = resolveReprintDay(req.query.dayChoice);
    const group = req.query.group === 'PRIORITY' ? 'PRIORITY' : 'NORMAL';
    const filterSql = reprintGroupFilterSql(group);
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
      return res.status(400).json({ error: 'STT "từ"/"đến" không hợp lệ (phải là số nguyên, "từ" ≥ 1 và ≤ "đến").' });
    }
    const maxRow = db.prepare(`SELECT MAX(number) AS maxNumber FROM tickets WHERE day = ? AND ${filterSql}`).get(day);
    const maxNumber = (maxRow && maxRow.maxNumber) || 0;
    if (maxNumber === 0) {
      return res.status(400).json({ error: `Chưa có số nào được cấp cho lựa chọn này (ngày ${day}).` });
    }
    if (to > maxNumber) {
      return res.status(400).json({
        error: `STT "đến" (${to}) vượt quá số tối đa hiện có (${maxNumber}) của lựa chọn này (ngày ${day}).`,
      });
    }
    const rows = db
      .prepare(`SELECT * FROM tickets WHERE day = ? AND ${filterSql} AND number BETWEEN ? AND ? ORDER BY number ASC`)
      .all(day, from, to);
    const tickets = rows.map((t) => ({
      number: t.number,
      numberPrefix: t.number_prefix || null,
      priorityCode: t.priority_code,
      createdAt: t.created_at,
      patientName: t.patient_name || null,
      patientDobDisplay: formatPatientDobForPrint(t),
      // MUC 112: in lai ca cac dong tra loi cau hoi sang loc (giong phieu in luc cap so)
      answerLines: answerLinesFromJson(t.kiosk_answers),
    }));
    res.json({ day, group, maxNumber, tickets });
  });

  return router;
}

/** MUC 112: [{label,text}] -> ["label: text"] (bo cac dong khong co label). */
function answerLinesFromJson(text) {
  if (!text) return [];
  try {
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr.filter((a) => a && a.label).map((a) => `${a.label}: ${a.text}`) : [];
  } catch {
    return [];
  }
}

/** Chan cac route chi danh cho nhan vien (kiosk-nhan-vien) - dung chung 1 cookie dang nhap voi /counter. */
function requireStaff(req, res, next) {
  if (!isValidSession(req.cookies?.staff_token)) {
    return res.status(401).json({ error: 'Chưa đăng nhập nhân viên' });
  }
  next();
}

module.exports = ticketsRouter;
