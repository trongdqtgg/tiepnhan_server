const express = require('express');
const { getDB } = require('../config/db');
const {
  callNextTicket,
  callNextTicketByPriority,
  skipTicket,
  recallTicketToCounter,
  completeTicket,
  enterCounterSession,
  exitCounterSession,
  forceExitCounterSession,
  heartbeatCounterSession,
  sweepStaleCounterSessions,
  getCounterCurrentTicket,
  getCounterPriorityOrder,
  setCounterPriorityOrder,
  getSkippedTickets,
  getCalledTickets,
  getDisplaySummary,
  createCounter,
  updateCounter,
  setCounterActive,
} = require('../services/ticketService');
const { getEffectiveDay } = require('../services/sequenceService');
const { getRuleByCode, getAllOptionsForStaff } = require('../config/priorityRules');

function countersRouter(io) {
  const router = express.Router();

  function broadcastSummary() {
    const db = getDB();
    const summary = getDisplaySummary(db, getEffectiveDay(db));
    io.emit('queue:summary', summary);
  }

  // Quet dinh ky de tu dong giai phong cac quay bi "ket lai" do thiet bi tat dot ngot (khong kip
  // goi exit-session) - xem sweepStaleCounterSessions()/SESSION_STALE_MS trong ticketService.js.
  // Chay ngay ca khi khong co ai dang co gang vao lai quay do, de danh sach quay (in_use) luon
  // phan anh dung thuc te tren man hinh chon quay.
  setInterval(() => {
    try {
      const db = getDB();
      const released = sweepStaleCounterSessions(db);
      if (released.length > 0) {
        console.log(`[Counters] Tu dong giai phong ${released.length} quay do mat ket noi (het han heartbeat): ${released.join(', ')}`);
        broadcastSummary();
      }
    } catch (err) {
      console.error('[Counters] Loi khi quet phien quay het han:', err);
    }
  }, 20 * 1000).unref();

  router.get('/', (req, res) => {
    const db = getDB();
    const counters = db.prepare('SELECT * FROM counters ORDER BY code ASC').all();
    // Khong tra ve session_token that ra ngoai (chi la bi mat cua thiet bi dang giu quay),
    // chi bao cho client biet quay nao dang co nguoi dung de hien thi canh bao som.
    const safe = counters.map(({ session_token, ...rest }) => ({ ...rest, in_use: !!session_token }));
    res.json(safe);
  });

  /**
   * Danh sach TOAN BO cac ve dang bi bo qua (vang mat) trong ngay, khong phan biet quay nao
   * da bo qua - dung cho modal "Xem DS bỏ qua" o man hinh quay, de bat ky nhan vien quay nao
   * cung co the goi lai benh nhan da bi bo qua truoc do (ke ca boi quay khac).
   */
  router.get('/skipped-list', (req, res) => {
    const db = getDB();
    const tickets = getSkippedTickets(db, getEffectiveDay(db));
    const counters = db.prepare('SELECT id, code, name FROM counters').all();
    const counterMap = Object.fromEntries(counters.map((c) => [c.id, c]));
    const result = tickets.map((t) => ({
      ...t,
      counterCode: t.counter_id ? counterMap[t.counter_id]?.code ?? null : null,
      counterName: t.counter_id ? counterMap[t.counter_id]?.name ?? null : null,
    }));
    res.json(result);
  });

  /**
   * Danh sach TOAN BO cac so DA TUNG DUOC GOI trong ngay, cua TAT CA cac quay, moi goi gan nhat
   * len dau - dung cho modal "Xem số đã gọi" moi o man hinh /counter/ (xem openCalledModal()/
   * loadCalledModal() trong public/counter/counter.js). Kem theo ma/ten quay DA GOI so do VA quay
   * DANG GIU so do hien tai (co the khac nhau neu so do da duoc quay khac "Gọi lại" ve minh sau -
   * xem recallTicketToCounter() - luc do counter_id da doi sang quay moi nhung day van la lich su
   * dung cua lan goi gan nhat).
   */
  router.get('/called-list', (req, res) => {
    const db = getDB();
    const tickets = getCalledTickets(db, getEffectiveDay(db));
    const counters = db.prepare('SELECT id, code, name FROM counters').all();
    const counterMap = Object.fromEntries(counters.map((c) => [c.id, c]));
    const result = tickets.map((t) => ({
      ...t,
      counterCode: t.counter_id ? counterMap[t.counter_id]?.code ?? null : null,
      counterName: t.counter_id ? counterMap[t.counter_id]?.name ?? null : null,
    }));
    res.json(result);
  });

  /**
   * ==== Quan ly DANH MUC quay tiep nhan (man hinh /counter-admin) ====
   * Them / sua ten / tam ngung-kich hoat lai quay - danh cho quan tri vien, KHAC voi cac API vao/
   * thoat phien lam viec hang ngay o ben duoi (dung boi nhan vien truc quay).
   */

  /** Them 1 quay moi. Body: { code, name }. Tra ve 409 kem thong bao ro rang neu ma/ten bi trung
   * voi quay da co (xem createCounter()/findDuplicateCounter() trong ticketService.js). */
  router.post('/', (req, res) => {
    try {
      const db = getDB();
      const { code, name } = req.body || {};
      const counter = createCounter(db, { code, name });
      broadcastSummary();
      res.status(201).json(counter);
    } catch (err) {
      if (err.code === 'DUPLICATE') {
        return res.status(409).json({ error: 'DUPLICATE', field: err.field, message: err.message });
      }
      res.status(400).json({ error: err.message });
    }
  });

  /** Sua ma/ten 1 quay da co. Body: { code, name }. Cung kiem tra trung nhu them moi, tru chinh
   * quay dang sua. */
  router.put('/:id', (req, res) => {
    try {
      const db = getDB();
      const { code, name } = req.body || {};
      const counter = updateCounter(db, req.params.id, { code, name });
      broadcastSummary();
      res.json(counter);
    } catch (err) {
      if (err.code === 'DUPLICATE') {
        return res.status(409).json({ error: 'DUPLICATE', field: err.field, message: err.message });
      }
      if (err.message === 'Không tìm thấy quầy') {
        return res.status(404).json({ error: err.message });
      }
      res.status(400).json({ error: err.message });
    }
  });

  /** Tam ngung 1 quay - quay se an khoi danh sach chon o man hinh /counter va man hinh cho chung,
   * dong thoi TU DONG dang xuat nguoi dang dung quay do (neu co) - xem setCounterActive() trong
   * ticketService.js. */
  router.post('/:id/pause', (req, res) => {
    try {
      const db = getDB();
      const counter = setCounterActive(db, req.params.id, false);
      broadcastSummary();
      io.emit('counter:paused', { counterId: req.params.id });
      res.json(counter);
    } catch (err) {
      if (err.message === 'Không tìm thấy quầy') return res.status(404).json({ error: err.message });
      res.status(400).json({ error: err.message });
    }
  });

  /** Kich hoat lai 1 quay dang tam ngung. */
  router.post('/:id/resume', (req, res) => {
    try {
      const db = getDB();
      const counter = setCounterActive(db, req.params.id, true);
      broadcastSummary();
      res.json(counter);
    } catch (err) {
      if (err.message === 'Không tìm thấy quầy') return res.status(404).json({ error: err.message });
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * Nhan vien "vao phien" 1 quay. Neu quay dang co nguoi khac (thiet bi khac) su dung,
   * TU CHOI voi 409 va thong bao ro rang - dung yeu cau cua nghiep vu: "quay nao da vao
   * phien thi canh bao va khong duoc phep vao quay do, vui long chon quay khac".
   */
  router.post('/:id/enter-session', (req, res) => {
    const db = getDB();
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Thiếu thông tin phiên làm việc' });

    const result = enterCounterSession(db, req.params.id, token);
    if (!result.ok) {
      if (result.error === 'LOCKED') {
        return res.status(409).json({
          error: 'LOCKED',
          message: 'Quầy này đang có người sử dụng, vui lòng chọn quầy khác.',
        });
      }
      if (result.error === 'INACTIVE') {
        return res.status(409).json({
          error: 'INACTIVE',
          message: 'Quầy này đang tạm ngưng hoạt động, vui lòng chọn quầy khác hoặc liên hệ quản trị viên.',
        });
      }
      return res.status(404).json({ error: 'Không tìm thấy quầy' });
    }
    broadcastSummary();
    res.json({ ok: true });
  });

  /** Nhan vien "thoat phien" -> quay duoc mo lai cho nguoi khac vao. */
  router.post('/:id/exit-session', (req, res) => {
    const db = getDB();
    const { token } = req.body || {};
    const result = exitCounterSession(db, req.params.id, token);
    if (!result.ok) {
      if (result.error === 'NOT_OWNER') {
        return res.status(403).json({ error: 'Không có quyền thoát phiên do người khác đang giữ quầy này' });
      }
      return res.status(404).json({ error: 'Không tìm thấy quầy' });
    }
    broadcastSummary();
    res.json({ ok: true });
  });

  /**
   * "Nhip song" - man hinh /counter goi dinh ky (moi ~20s) trong luc dang giu 1 phien quay, de
   * bao con dang hoat dong. Neu khong nhan duoc heartbeat trong SESSION_STALE_MS (xem
   * ticketService.js), quay se TU DONG duoc giai phong (khong con bi khoa mai mai khi thiet bi
   * tat dot ngot / rot mang ma khong kip goi exit-session) - day la fix cho loi "quay bi giu
   * phien mai du da tat het trinh duyet".
   */
  router.post('/:id/heartbeat', (req, res) => {
    const db = getDB();
    const { token } = req.body || {};
    const result = heartbeatCounterSession(db, req.params.id, token);
    if (!result.ok) {
      // NOT_OWNER (quay da duoc thiet bi khac chiem lai vi minh bi coi la stale truoc do) hoac
      // NOT_FOUND deu tra ve 200 kem ok:false - khong phai loi nghiem trong, client se tu xu ly
      // (vi du dua ve man hinh chon quay) thay vi bao loi mang chung chung.
      return res.json({ ok: false, error: result.error });
    }
    res.json({ ok: true });
  });

  /**
   * CHI DUNG KHI SU CO: may nhan vien hong / mat ket noi khong the tu thoat phien duoc,
   * khien quay bi "khoa" mai. Khong co nut tren giao dien, chi goi truc tiep qua API khi
   * that su can, xem huong dan trong README.
   */
  router.post('/:id/force-exit-session', (req, res) => {
    const db = getDB();
    forceExitCounterSession(db, req.params.id);
    broadcastSummary();
    res.json({ ok: true });
  });

  /**
   * Lay thu tu uu tien HIEN TAI cua 1 quay - neu quay chua tuy chinh gi thi tra ve thu tu MAC
   * DINH cua he thong (isCustom: false) de man hinh /counter co du lieu khoi tao cho danh sach
   * keo-tha, dong thoi biet duoc dang dung mac dinh hay tuy chinh de hien thi trang thai.
   */
  router.get('/:id/priority-order', (req, res) => {
    const db = getDB();
    const counter = db.prepare('SELECT id FROM counters WHERE id = ?').get(req.params.id);
    if (!counter) return res.status(404).json({ error: 'Không tìm thấy quầy' });

    const defaultOrder = getAllOptionsForStaff().map((o) => o.code);
    const custom = getCounterPriorityOrder(db, req.params.id);
    res.json({ order: custom || defaultOrder, isCustom: !!custom, defaultOrder });
  });

  /**
   * Nhan vien luu thu tu uu tien TUY CHINH (keo tha) cho quay dang thao tac - CHI ap dung cho
   * quay nay, CHI trong phien lam viec hien tai (tu dong reset ve mac dinh khi thoat phien -
   * xem exitCounterSession/forceExitCounterSession trong ticketService.js).
   */
  router.post('/:id/priority-order', (req, res) => {
    try {
      const db = getDB();
      const { order } = req.body || {};
      setCounterPriorityOrder(db, req.params.id, order);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /** Dua thu tu uu tien cua quay ve lai mac dinh he thong ngay lap tuc (khong can thoat phien). */
  router.post('/:id/priority-order/reset', (req, res) => {
    const db = getDB();
    setCounterPriorityOrder(db, req.params.id, null);
    res.json({ ok: true });
  });

  // Man hinh nhan vien goi khi vao ca truc de biet dang phuc vu ve nao (neu co)
  router.get('/:id/current', (req, res) => {
    const db = getDB();
    const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(req.params.id);
    if (!counter) return res.status(404).json({ error: 'Không tìm thấy quầy' });

    let ticket = null;
    if (counter.current_ticket_id) {
      const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(counter.current_ticket_id);
      ticket = row
        ? {
            id: row.id,
            number: row.number,
            // Ghep tien to hien thi ("U"/"T"...) NEU CO - xem SEPARATE_PRIORITY_SEQUENCE trong
            // .env.example. Endpoint nay TU XAY dung object ticket rieng (khong di qua
            // rowToTicket() trong ticketService.js) nen phai lay tay them cot number_prefix,
            // neu khong widget quay/refreshCounter() se hien thieu tien to khi tai lai trang.
            number_prefix: row.number_prefix || null,
            priority_code: row.priority_code,
            patient: { name: row.patient_name, phone: row.patient_phone || null },
            // MUC 112: cau tra loi sang loc tai kiosk - de man hinh quay hien lai sau khi tai trang
            answers: (() => { try { const a = JSON.parse(row.kiosk_answers || 'null'); return Array.isArray(a) ? a : null; } catch { return null; } })(),
          }
        : null;
    }
    res.json({ counter, ticket, ticketLabel: ticket ? getRuleByCode(ticket.priority_code)?.label ?? '' : null });
  });

  router.post('/:id/call-next', (req, res) => {
    try {
      const db = getDB();
      const ticket = callNextTicket(db, req.params.id, getEffectiveDay(db));
      broadcastSummary();
      io.emit('counter:called', { counterId: req.params.id, ticket });
      if (!ticket) return res.json({ ticket: null, message: 'Không còn số nào đang chờ' });
      res.json({ ticket, label: getRuleByCode(ticket.priority_code)?.label });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * "Gọi tiếp theo" nhưng CHỈ trong phạm vi 1 đối tượng ưu tiên cụ thể (bỏ qua thứ tự ưu tiên
   * bình thường của quầy) - dùng cho 8 nút mới (7 mức ưu tiên + "Đối tượng thường") ở màn hình
   * /counter và widget, đứng CẠNH nút "Gọi tiếp theo" mặc định (vẫn giữ nguyên, không đổi gì).
   * `priorityCode` gửi qua body, ví dụ {"priorityCode":"EMERGENCY"}.
   */
  router.post('/:id/call-next-priority', (req, res) => {
    try {
      const db = getDB();
      const { priorityCode } = req.body || {};
      if (!getRuleByCode(priorityCode)) {
        return res.status(400).json({ error: `priorityCode không hợp lệ: ${priorityCode}` });
      }
      const ticket = callNextTicketByPriority(db, req.params.id, priorityCode, getEffectiveDay(db));
      broadcastSummary();
      io.emit('counter:called', { counterId: req.params.id, ticket });
      if (!ticket) {
        return res.json({
          ticket: null,
          message: `Không còn số nào của "${getRuleByCode(priorityCode).label}" đang chờ`,
        });
      }
      res.json({ ticket, label: getRuleByCode(ticket.priority_code)?.label });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * "Goi lai" so DANG PHUC VU hien tai cua quay (khong lay so moi, khong doi trang thai gi
   * trong DB) - dung khi benh nhan khong nghe/khong de y luc goi lan dau. Chi phat lai tin
   * hieu qua Socket.io de man hinh benh nhan lam noi bat lai so dang hien.
   */
  router.post('/:id/reannounce', (req, res) => {
    try {
      const db = getDB();
      const ticket = getCounterCurrentTicket(db, req.params.id);
      if (!ticket) {
        return res.status(400).json({ error: 'Quầy chưa có số nào đang phục vụ để gọi lại' });
      }
      io.emit('counter:reannounce', { counterId: req.params.id, ticket });
      res.json({ ticket, label: getRuleByCode(ticket.priority_code)?.label });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/:id/skip', (req, res) => {
    try {
      const db = getDB();
      const { ticketId } = req.body;
      const ticket = skipTicket(db, ticketId);
      db.prepare(`UPDATE counters SET current_ticket_id = NULL, status = 'idle' WHERE id = ?`).run(req.params.id);
      broadcastSummary();
      io.emit('counter:skipped', { counterId: req.params.id, ticket });
      res.json({ ticket });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * "Goi lai" 1 so dang nam trong DS bo qua (goi tu modal "Xem DS bỏ qua" o man hinh quay):
   * goi THANG so do ve quay dang thao tac (req.params.id) NGAY BAY GIO - giong het "Goi so
   * tiep theo" nhung chon dung so nay - nen se hien thi/nhap nhay ngay tren man hinh benh
   * nhan cua quay do (khong con am tham quay ve hang cho nhu truoc).
   */
  router.post('/:id/recall', (req, res) => {
    try {
      const db = getDB();
      const { ticketId } = req.body;
      const ticket = recallTicketToCounter(db, req.params.id, ticketId);
      broadcastSummary();
      io.emit('counter:called', { counterId: req.params.id, ticket });
      res.json({ ticket, label: getRuleByCode(ticket.priority_code)?.label });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/:id/complete', (req, res) => {
    try {
      const db = getDB();
      const { ticketId } = req.body;
      const ticket = completeTicket(db, ticketId, req.params.id);
      broadcastSummary();
      io.emit('counter:completed', { counterId: req.params.id, ticket });
      res.json({ ticket });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = countersRouter;
