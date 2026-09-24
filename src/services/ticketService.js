const { runInTransaction } = require('../config/db');
const { getNextTicketNumber, peekNextTicketNumber, getEffectiveDay } = require('./sequenceService');
const { getRuleByCode, getAllOptionsForStaff } = require('../config/priorityRules');

function parseAnswers(text) {
  if (!text) return null;
  try {
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function rowToTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    // Tien to hien thi ("U"/"T"...) - null tru khi tao ra luc SEPARATE_PRIORITY_SEQUENCE=true (xem
    // getSequenceConfig()/createTicket() ben duoi va cot moi tickets.number_prefix trong
    // src/config/db.js). Client ghep truoc so khi hien thi: (number_prefix || '') + so co dem 0.
    number_prefix: row.number_prefix || null,
    day: row.day,
    priority_code: row.priority_code,
    priority_rank: row.priority_rank,
    patient: {
      name: row.patient_name,
      dob: row.patient_dob,
      gender: row.patient_gender,
      id_number: row.patient_id_number,
      source: row.patient_source,
      qr_raw: row.patient_qr_raw,
      phone: row.patient_phone || null,
    },
    // MUC 112: cau tra loi sang loc tai kiosk [{id,label,value,text}] (null neu khong co)
    answers: parseAnswers(row.kiosk_answers),
    status: row.status,
    counter_id: row.counter_id,
    skip_count: row.skip_count,
    created_at: row.created_at,
    called_at: row.called_at,
    done_at: row.done_at,
  };
}

/**
 * SEPARATE_PRIORITY_SEQUENCE (.env) - doc "tuoi" moi lan goi (khong cache), giong cach lam voi
 * STAFF_KIOSK_SKIP_VERIFY/KIOSK_COOLDOWN_MINUTES, de sua .env + khoi dong lai server la ap dung
 * ngay. Mac dinh false: giu nguyen hanh vi cu (1 day so DUY NHAT, tang dan lien tuc, khong phan
 * biet doi tuong uu tien/thuong).
 *
 * true = tach thanh 2 DAY SO DOC LAP, cung tang dan tu 1 trong ngay: 1 day cho MOI ve co
 * priority_code khac 'NORMAL' (goi la "uu tien", tien to mac dinh "U" - PRIORITY_SEQ_PREFIX) va 1
 * day rieng cho ve 'NORMAL' (tien to mac dinh "T" - NORMAL_SEQ_PREFIX). Vi du: ve uu tien dau
 * tien trong ngay la U001, ve thuong dau tien la T001; ve uu tien tiep theo la U002 CHO DU o giua
 * da co bao nhieu ve T duoc cap - 2 day so khong anh huong lan nhau.
 */
function getSequenceConfig() {
  const raw = (process.env.SEPARATE_PRIORITY_SEQUENCE || '').trim().toLowerCase();
  return {
    enabled: raw === 'true' || raw === '1',
    priorityPrefix: (process.env.PRIORITY_SEQ_PREFIX || 'U').trim() || 'U',
    normalPrefix: (process.env.NORMAL_SEQ_PREFIX || 'T').trim() || 'T',
  };
}

/**
 * MUC 100 - "Điều chỉnh ràng buộc chức năng cấp số ưu tiên" (áp dụng cho CẢ /kiosk (quét QR) LẪN
 * /staff-kiosk (nút bấm/QR cấp nhanh), vì đều đi qua CHUNG createTicket() bên dưới - xem
 * checkPriorityIssueGate()). Đọc "tươi" từ .env moi lan goi (khong cache), giong cach lam voi
 * SEPARATE_PRIORITY_SEQUENCE/KIOSK_COOLDOWN_MINUTES - sua .env + khoi dong lai server la ap dung
 * ngay. Mac dinh 16 (dung gia tri nguoi dung da neu, khi chua cau hinh hoac cau hinh sai).
 */
function getPriorityIssueGateThreshold() {
  const raw = Number(process.env.PRIORITY_ISSUE_GATE_THRESHOLD);
  return Number.isFinite(raw) && raw >= 0 ? raw : 16;
}

/**
 * MUC 100/101 - Ràng buộc mới cho việc CẤP (không phải GỌI) 1 vé ƯU TIÊN (bất kỳ mã nào khác
 * 'NORMAL', ÁP DỤNG CHO CẢ "Cấp cứu" - theo đúng lựa chọn của người dùng, không miễn trừ mã nào),
 * theo đúng yêu cầu nguyên văn (mục 100 + làm rõ lại ở mục 101): "stt ưu tiên chỉ được phép cấp
 * STT U001 khi STT thường đã gọi số/bỏ qua ở các quầy đến stt thứ 16 ... Số stt ưu tiên
 * PRIORITY_ISSUE_GATE_THRESHOLD từ số tt 16 trở đi không được phép cấp stt ưu tiên nào LỚN HƠN số
 * stt max của STT thường đã gọi/bỏ qua" - và làm rõ thêm khi hỏi lại ở mục 100: "16 vé đầu tiên bắt
 * buộc phải là vé thường".
 *
 * CÔNG THỨC (gộp cả 2 vế yêu cầu thành 1 điều kiện nhất quán - biên so sánh đã ĐỔI LẠI ở mục 102,
 * xem ghi chú "SUA O MUC 102" bên dưới; mục 101 trước đó đã đổi theo hướng ngược lại rồi bị người
 * dùng yêu cầu đảo lại đúng như hành vi gốc của mục 100):
 *   Cho phép cấp vé ưu tiên (số sắp cấp là `nextPriorityNumber`) KHI VÀ CHỈ KHI:
 *     maxNormalProcessed >= threshold           (đã có ĐỦ ít nhất `threshold` số THƯỜNG được gọi/
 *                                                bỏ qua tại quầy - chặn TOÀN BỘ vé ưu tiên, kể cả
 *                                                U001, cho tới khi đạt mốc này)
 *     VÀ nextPriorityNumber < maxNormalProcessed  (SUA O MUC 102: quay lai dung "<" - CHAN CA KHI
 *                                                BANG NHAU - theo dung yeu cau moi nhat "chặn khi STT
 *                                                ưu tiên sắp cấp ≥ STT thường đã xử lý (nghĩa là bằng
 *                                                nhau cũng bị chặn)". Vi du threshold=16,
 *                                                maxNormalProcessed=16: U016 (nextPriority=16) BI
 *                                                CHAN vi 16 khong < 16 - phai doi maxNormalProcessed
 *                                                len 17 thi U016 moi duoc cap.
 *   "Đã gọi/bỏ qua tại quầy" = trạng thái vé KHÁC 'waiting' (tức 'called', 'done', hoặc 'skipped' -
 *   suy luận hợp lý từ câu chữ, vì "waiting" rõ ràng chưa hề được xử lý gì ở quầy).
 *
 * CHỈ ÁP DỤNG KHI BẬT `SEPARATE_PRIORITY_SEQUENCE=true` (seriesKey khác null): nếu KHÔNG bật,
 * "Ưu tiên" và "Thường" dùng CHUNG 1 dãy số liên tục - khi đó biểu thức trên sẽ KHÔNG BAO GIỜ thoả
 * được (STT sắp cấp cho BẤT KỲ ai, kể cả ưu tiên, luôn đúng bằng "tổng số vé đã cấp + 1", tức LUÔN
 * LỚN HƠN mọi số đã xử lý trước đó của MỌI đối tượng, kể cả "thường") - nghĩa là bật ràng buộc này ở
 * chế độ dùng chung dãy số sẽ CHẶN VĨNH VIỄN mọi vé ưu tiên, không phải hành vi mong muốn. Vì vậy
 * NẾU không bật `SEPARATE_PRIORITY_SEQUENCE`, bỏ qua ràng buộc này hoàn toàn (giữ nguyên hành vi cũ)
 * - tính năng này về bản chất CHỈ có ý nghĩa khi 2 dãy số ưu tiên/thường độc lập với nhau.
 *
 * Nem loi (Error) neu KHONG dat dieu kien - noi goi (createTicket()) se de loi nay "troi" len tan
 * cac route (routes/tickets.js) dang wrap san trong try/catch va tra ve 400 kem `err.message`,
 * GIONG HET cach xu ly loi "priorityCode không hợp lệ"/cooldown da co san tu truoc - khong can sua
 * gi them o tung route rieng le.
 */
function checkPriorityIssueGate(db, day, seqConfig) {
  const threshold = getPriorityIssueGateThreshold();
  const nextPriority = peekNextTicketNumber(db, seqConfig.enabled ? 'U' : null).number;
  const maxNormalRow = db
    .prepare(`SELECT MAX(number) AS maxNum FROM tickets WHERE day = ? AND priority_code = 'NORMAL' AND status != 'waiting'`)
    .get(day);
  const maxNormalProcessed = (maxNormalRow && maxNormalRow.maxNum) || 0;

  if (maxNormalProcessed < threshold) {
    throw new Error(
      `Chưa đủ điều kiện cấp số ưu tiên: cần STT thường đã được gọi/bỏ qua tại quầy đạt tối thiểu ${threshold} (hiện mới đến STT thường ${maxNormalProcessed}).`
    );
  }
  // MUC 102: doi lai bien so sanh tu "<=" (mục 101) VE "<" - CHAN CA KHI BANG NHAU - theo dung yeu
  // cau moi nhat "chặn khi STT ưu tiên sắp cấp ≥ STT thường đã xử lý (bằng nhau cũng bị chặn)".
  if (nextPriority >= maxNormalProcessed) {
    throw new Error(
      `Chưa thể cấp thêm số ưu tiên: STT ưu tiên tiếp theo là ${nextPriority}, cần STT thường đã được gọi/bỏ qua tại quầy lớn hơn số này (hiện mới đến STT thường ${maxNormalProcessed}).`
    );
  }
}

/** Tao ve moi: sinh so lien tuc + gan hang uu tien, luu vao SQLite. */
function createTicket(db, { priorityCode, patient, answers }) {
  const rule = getRuleByCode(priorityCode || 'NORMAL');
  if (!rule) throw new Error(`priorityCode không hợp lệ: ${priorityCode}`);

  const seqConfig = getSequenceConfig();
  const isNormal = rule.code === 'NORMAL';
  // seriesKey 'U'/'T' CO DINH (khong phai theo tung ma uu tien chi tiet AGE75/EMERGENCY/...) - MOI
  // ve co priority_code khac 'NORMAL' (du la che do PRIORITY_MODE full hay basic - xem
  // src/config/priorityRules.js) deu dung CHUNG 1 day so "uu tien" duy nhat, dam bao thu tu
  // number van la moc THOI GIAN TAO hop le de sap xep/goi so trong CUNG 1 hang uu tien (xem
  // callNextTicketByPriority() ben duoi, ORDER BY number ASC).
  const seriesKey = seqConfig.enabled ? (isNormal ? 'T' : 'U') : null;
  const numberPrefix = seqConfig.enabled ? (isNormal ? seqConfig.normalPrefix : seqConfig.priorityPrefix) : null;

  // MUC 100 - kiem tra ràng buộc TRUOC KHI tieu thu 1 so tu bo dem (xem checkPriorityIssueGate() o
  // tren ve ly do CHI ap dung khi bat SEPARATE_PRIORITY_SEQUENCE) - nem loi ngay, KHONG goi
  // getNextTicketNumber() ben duoi neu bi tu choi, tranh "mat" 1 so oan uong.
  if (!isNormal && seqConfig.enabled) {
    checkPriorityIssueGate(db, getEffectiveDay(db), seqConfig);
  }

  const { number, day } = getNextTicketNumber(db, seriesKey);
  const created_at = new Date().toISOString();
  const p = patient || {};

  const info = db
    .prepare(
      `INSERT INTO tickets
       (number, number_prefix, day, priority_code, priority_rank, patient_name, patient_dob, patient_gender, patient_id_number, patient_source, patient_qr_raw, patient_phone, kiosk_answers, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`
    )
    .run(
      number,
      numberPrefix,
      day,
      rule.code,
      rule.rank,
      p.name || null,
      p.dob || null,
      p.gender || null,
      p.id_number || null,
      p.source || 'NONE',
      p.qr_raw || null,
      p.phone || null,
      Array.isArray(answers) && answers.length ? JSON.stringify(answers) : null,
      created_at
    );

  const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid);
  return rowToTicket(row);
}

/**
 * Quay "goi so tiep theo".
 * DIEM MAU CHOT: bao trong 1 TRANSACTION duy nhat (BEGIN...COMMIT) de vua CHON vua KHOA
 * ve dang cho co rank/uu tien cao nhat + so nho nhat. node:sqlite thuc thi dong bo
 * (khong co diem await xen ngang) nen 2 quay bam "goi so tiep theo" cung luc TUYET DOI
 * khong the lay trung 1 ve.
 *
 * "Goi so tiep theo" duoc hieu la DA HOAN TAT ve dang phuc vu (neu co) roi moi goi ve moi -
 * nhan vien khong can bam rieng nut "Hoan tat" nua, bam "Goi so tiep theo" la du cho 1 luot
 * benh nhan xong viec.
 */
function callNextTicket(db, counterId, day) {
  const ticket = runInTransaction(db, () => {
    const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);

    // Neu quay dang phuc vu 1 ve (status 'called') thi tu dong xem nhu da hoan tat truoc
    // khi goi so moi, khong can nhan vien bam them nut "Hoan tat" rieng.
    if (counter && counter.current_ticket_id) {
      const current = db.prepare('SELECT * FROM tickets WHERE id = ?').get(counter.current_ticket_id);
      if (current && current.status === 'called') {
        db.prepare(`UPDATE tickets SET status = 'done', done_at = ? WHERE id = ?`).run(
          new Date().toISOString(),
          current.id
        );
      }
    }

    // Neu quay nay dang dung THU TU UU TIEN TUY CHINH (nhan vien tu keo tha - xem
    // setCounterPriorityOrder) thi chon ve tiep theo theo dung thu tu do thay vi priority_rank
    // mac dinh cua he thong. Thu tu tuy chinh CHI anh huong toi quay nay, khong anh huong cac
    // quay khac dang dung mac dinh.
    let customOrder = null;
    if (counter?.custom_priority_order) {
      try {
        customOrder = JSON.parse(counter.custom_priority_order);
      } catch {
        customOrder = null;
      }
    }

    // MUC 99 - THEM dieu kien "AND day = ?" (bat buoc phai co `day`, truyen tu getEffectiveDay(db)
    // o noi goi - xem routes/counters.js): TRUOC DAY ham nay chon ve "waiting" BAT KY NGAY NAO,
    // khong loc theo `day` - gay ra loi da phan anh: man hinh /counter bao "0 số đang chờ" (thong
    // ke da loc theo "ngay hieu luc" tu muc 96/97) NHUNG bam "Gọi tiếp theo" van goi duoc 1 so
    // "waiting" CON SOT LAI cua NGAY KHAC (vi du con ve chua goi tu truoc khi dung "Mở reset >
    // 16h" chuyen sang ngay moi) - khong nam trong danh sach dang ky CUA DUNG NGAY HOM NAY dang
    // hien thi. Sua lai: CHI chon trong dung `day` hien tai, dong bo voi moi thong ke/hien thi khac
    // (getWaitingCount(), getDisplaySummary()...) - khong con "gọi vượt rào" duoc ve ngay khac nua.
    let row;
    if (Array.isArray(customOrder) && customOrder.length > 0) {
      const whens = customOrder.map(() => 'WHEN ? THEN ?').join(' ');
      const params = [];
      customOrder.forEach((code, idx) => params.push(code, idx));
      row = db
        .prepare(
          `SELECT * FROM tickets WHERE status = 'waiting' AND day = ?
           ORDER BY CASE priority_code ${whens} ELSE 999 END ASC, number ASC LIMIT 1`
        )
        .get(day, ...params);
    } else {
      row = db
        .prepare(`SELECT * FROM tickets WHERE status = 'waiting' AND day = ? ORDER BY priority_rank ASC, number ASC LIMIT 1`)
        .get(day);
    }
    if (!row) {
      // Khong con so nao de goi, nhung ve cu (neu co) da duoc hoan tat o tren -> tra quay ve idle
      db.prepare(`UPDATE counters SET current_ticket_id = NULL, status = 'idle' WHERE id = ?`).run(counterId);
      return null;
    }

    const called_at = new Date().toISOString();
    db.prepare(`UPDATE tickets SET status = 'called', counter_id = ?, called_at = ? WHERE id = ?`).run(
      counterId,
      called_at,
      row.id
    );
    db.prepare(`UPDATE counters SET current_ticket_id = ?, status = 'serving' WHERE id = ?`).run(row.id, counterId);

    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(row.id);
  });

  return rowToTicket(ticket);
}

/**
 * Quay "goi so tiep theo CUA RIENG 1 DOI TUONG" - giu nguyen nut "Gọi tiếp theo" mac dinh (van
 * goi theo dung thu tu uu tien/thu tu tuy chinh cua quay, xem callNextTicket() o tren) VA bo
 * sung 8 nut moi (7 uu tien + "Đối tượng thường") de nhan vien chu dong CHON DUNG 1 LOAI can goi
 * ngay, bo qua thu tu uu tien binh thuong - vi du quay dang co rat nhieu ve "Cấp cứu" cho o quay
 * khac nhung quay nay muon uu tien goi mot nguoi "Đối tượng thường" da cho qua lau. Logic HOAN
 * TAT ve dang phuc vu (neu co) truoc khi goi ve moi GIONG HET callNextTicket() - chi khac o buoc
 * CHON ve: LOC THEM dieu kien priority_code = doi tuong duoc chon, van sap theo so thu tu (number)
 * tang dan trong pham vi doi tuong do (KHONG dung thu tu uu tien tuy chinh cua quay, vi nhan vien
 * da tu chon RO RANG dung 1 doi tuong roi nen khong can ap dung thu tu do nua).
 */
function callNextTicketByPriority(db, counterId, priorityCode, day) {
  const ticket = runInTransaction(db, () => {
    const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);

    if (counter && counter.current_ticket_id) {
      const current = db.prepare('SELECT * FROM tickets WHERE id = ?').get(counter.current_ticket_id);
      if (current && current.status === 'called') {
        db.prepare(`UPDATE tickets SET status = 'done', done_at = ? WHERE id = ?`).run(
          new Date().toISOString(),
          current.id
        );
      }
    }

    // MUC 99 - THEM "AND day = ?" (cung ly do voi callNextTicket() o tren - khong con "gọi vượt
    // rào" duoc ve waiting cua ngay khac nua, dong bo voi thong ke hien thi theo "ngay hieu luc").
    const row = db
      .prepare(`SELECT * FROM tickets WHERE status = 'waiting' AND priority_code = ? AND day = ? ORDER BY number ASC LIMIT 1`)
      .get(priorityCode, day);

    if (!row) {
      // Khong con so nao CUA DOI TUONG NAY de goi (van co the con so cua doi tuong khac dang cho) -
      // ve cu (neu co) da duoc hoan tat o tren -> tra quay ve idle, giong y het callNextTicket().
      db.prepare(`UPDATE counters SET current_ticket_id = NULL, status = 'idle' WHERE id = ?`).run(counterId);
      return null;
    }

    const called_at = new Date().toISOString();
    db.prepare(`UPDATE tickets SET status = 'called', counter_id = ?, called_at = ? WHERE id = ?`).run(
      counterId,
      called_at,
      row.id
    );
    db.prepare(`UPDATE counters SET current_ticket_id = ?, status = 'serving' WHERE id = ?`).run(row.id, counterId);

    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(row.id);
  });

  return rowToTicket(ticket);
}

/**
 * Chong spam lay so o kiosk cong khai (khong ap dung cho kiosk nhan vien): kiem tra xem
 * so CCCD/BHYT (id_number) nay da lay so gan day nhat luc nao. Neu con trong khoang
 * "cooldownMinutes" ke tu lan lay truoc -> tra ve blocked + so giay con phai cho.
 * Dung SO CCCD/MA THE DA PARSE (khong dung chuoi QR tho) de doi chieu, vi day la dinh danh
 * on dinh nhat cua 1 nguoi, khong phu thuoc kieu quet.
 */
function checkCooldown(db, idNumber, cooldownMinutes) {
  if (!idNumber) return { blocked: false };
  const row = db
    .prepare(`SELECT created_at FROM tickets WHERE patient_id_number = ? ORDER BY created_at DESC LIMIT 1`)
    .get(idNumber);
  if (!row) return { blocked: false };

  const lastMs = new Date(row.created_at).getTime();
  const nowMs = Date.now();
  const elapsedSeconds = Math.floor((nowMs - lastMs) / 1000);
  const cooldownSeconds = Math.round(cooldownMinutes * 60);
  if (elapsedSeconds >= cooldownSeconds) return { blocked: false };

  return {
    blocked: true,
    remainingSeconds: cooldownSeconds - elapsedSeconds,
    lastCreatedAt: row.created_at,
  };
}

function skipTicket(db, ticketId) {
  const ticket = runInTransaction(db, () => {
    db.prepare(`UPDATE tickets SET status = 'skipped', skip_count = skip_count + 1 WHERE id = ?`).run(ticketId);
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  });
  return rowToTicket(ticket);
}

/** Nhan vien goi lai 1 so da bi bo qua truoc do -> dua ve lai hang cho, giu nguyen thu hang cu. */
function recallTicket(db, ticketId) {
  const ticket = runInTransaction(db, () => {
    db.prepare(`UPDATE tickets SET status = 'waiting', counter_id = NULL WHERE id = ? AND status = 'skipped'`).run(
      ticketId
    );
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  });
  return rowToTicket(ticket);
}

/**
 * Nhan vien bam "Goi lai" cho 1 so CU THE dang nam trong DS bo qua (modal "Xem DS bỏ qua") -
 * goi THANG so do ve quay minh NGAY, giong het "Goi so tiep theo" nhung chon dung so nay thay
 * vi so dau hang doi theo uu tien. So se hien thi va nhap nhay ngay tren man hinh benh nhan
 * (`/patient-screen`) cua quay do, khong con "am tham" quay ve hang cho nhu truoc nua.
 *
 * Neu quay dang phuc vu 1 so khac (status 'called') thi so do duoc tu dong xem la DA HOAN TAT
 * truoc khi goi so nay - dung nguyen tac "Goi so tiep theo = da hoan tat so cu" da ap dung o
 * callNextTicket.
 */
function recallTicketToCounter(db, counterId, ticketId) {
  const ticket = runInTransaction(db, () => {
    const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
    if (!counter) throw new Error('Không tìm thấy quầy');

    const target = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!target || target.status !== 'skipped') {
      throw new Error('Số này không còn trong danh sách bỏ qua (có thể vừa được quầy khác gọi lại)');
    }

    if (counter.current_ticket_id) {
      const current = db.prepare('SELECT * FROM tickets WHERE id = ?').get(counter.current_ticket_id);
      if (current && current.status === 'called') {
        db.prepare(`UPDATE tickets SET status = 'done', done_at = ? WHERE id = ?`).run(
          new Date().toISOString(),
          current.id
        );
      }
    }

    const called_at = new Date().toISOString();
    db.prepare(`UPDATE tickets SET status = 'called', counter_id = ?, called_at = ? WHERE id = ?`).run(
      counterId,
      called_at,
      ticketId
    );
    db.prepare(`UPDATE counters SET current_ticket_id = ?, status = 'serving' WHERE id = ?`).run(
      ticketId,
      counterId
    );

    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  });

  return rowToTicket(ticket);
}

function completeTicket(db, ticketId, counterId) {
  const ticket = runInTransaction(db, () => {
    const done_at = new Date().toISOString();
    db.prepare(`UPDATE tickets SET status = 'done', done_at = ? WHERE id = ?`).run(done_at, ticketId);
    if (counterId) {
      db.prepare(`UPDATE counters SET current_ticket_id = NULL, status = 'idle' WHERE id = ?`).run(counterId);
    }
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  });
  return rowToTicket(ticket);
}

// Qua thoi gian nay ma khong nhan duoc "nhip song" (heartbeat) tu thiet bi dang giu quay thi
// coi nhu thiet bi do da mat ket noi/tat dot ngot (rot mang, sap nguon, dong ca cua so trinh
// duyet cung luc...) - khong con cach nao goi duoc exit-session binh thuong nua. Client goi
// heartbeat moi 20s (xem counter.js), nen 75s ~ bo lo 3 lan lien tiep moi coi la "mat".
const SESSION_STALE_MS = 75 * 1000;

/** Quay co dang bi "khoa" boi 1 phien da mat ket noi (qua han heartbeat) hay khong. */
function isSessionStale(counter) {
  if (!counter || !counter.session_token) return false;
  const last = counter.session_heartbeat_at || counter.session_started_at;
  if (!last) return true; // co token nhung khong co moc thoi gian nao -> du lieu cu, coi la stale
  return Date.now() - new Date(last).getTime() > SESSION_STALE_MS;
}

/**
 * Nhan vien "vao phien" 1 quay (bam Bat dau ca truc). Neu quay dang co nguoi khac dung
 * (session_token khac va con ton tai) -> tu choi, tra ve LOCKED de client hien canh bao
 * "vui long chon quay khac". Cung 1 token (cung 1 trinh duyet/thiet bi) duoc phep vao lai
 * quay minh dang giu (vi du sau khi tai lai trang), khong bi coi la xung dot.
 *
 * NEU phien cu da qua han heartbeat (thiet bi cu mat ket noi/tat dot ngot, khong kip thoat
 * phien binh thuong) thi TU DONG giai phong quay va cho thiet bi moi vao, thay vi khoa cung
 * mai mai cho den khi co ai do goi force-exit-session thu cong.
 */
function enterCounterSession(db, counterId, token) {
  return runInTransaction(db, () => {
    const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
    if (!counter) return { ok: false, error: 'NOT_FOUND' };
    // Quay dang bi "tam ngung" (is_active = 0, dat tu man hinh /counter-admin) -> khong cho vao
    // phien nua, du truoc do co the da tung vao duoc - chan lai o day (khong chi an di tren dropdown
    // chon quay o client) de an toan ke ca khi client dang dung du lieu cu/chua tai lai danh sach.
    if (!counter.is_active) return { ok: false, error: 'INACTIVE', counter };
    if (counter.session_token && counter.session_token !== token && !isSessionStale(counter)) {
      return { ok: false, error: 'LOCKED', counter };
    }
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE counters SET session_token = ?, session_started_at = ?, session_heartbeat_at = ?,
       custom_priority_order = CASE WHEN session_token = ? THEN custom_priority_order ELSE NULL END
       WHERE id = ?`
    ).run(token, now, now, token, counterId);
    return { ok: true };
  });
}

/**
 * Client dang giu 1 phien quay goi dinh ky (moi ~20s) de "bao con song" - dung de phan biet
 * "dong tab binh thuong" (goi duoc exit-session qua pagehide) voi "tat dot ngot" (khong kip goi
 * gi ca, quay se tu duoc giai phong sau SESSION_STALE_MS neu co thiet bi khac muon vao).
 */
function heartbeatCounterSession(db, counterId, token) {
  const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
  if (!counter) return { ok: false, error: 'NOT_FOUND' };
  if (counter.session_token && counter.session_token !== token) {
    return { ok: false, error: 'NOT_OWNER' };
  }
  db.prepare('UPDATE counters SET session_heartbeat_at = ? WHERE id = ?').run(new Date().toISOString(), counterId);
  return { ok: true };
}

/**
 * Quet dinh ky (goi tu server.js) de giai phong CAC QUAY DANG KHOA MA DA QUA HAN HEARTBEAT,
 * ke ca khi khong co thiet bi nao dang co gang vao lai quay do - giup danh sach quay (in_use)
 * o man hinh chon quay phan anh dung thuc te thay vi phai doi den luc co ai thu vao lai.
 * Tra ve mang id cac quay vua duoc giai phong (rong neu khong co gi thay doi).
 */
function sweepStaleCounterSessions(db) {
  const counters = db.prepare('SELECT * FROM counters WHERE session_token IS NOT NULL').all();
  const released = [];
  for (const counter of counters) {
    if (isSessionStale(counter)) {
      forceExitCounterSession(db, counter.id);
      released.push(counter.id);
    }
  }
  return released;
}

/**
 * Nhan vien "thoat phien" 1 quay -> quay do duoc mo lai cho nguoi khac vao. Dong thoi RESET
 * luon thu tu uu tien tuy chinh (neu co) ve lai mac dinh he thong - dung yeu cau nghiep vu:
 * "thoát phiên thì theo reset lại cấu hình mặc định của hệ thống".
 */
function exitCounterSession(db, counterId, token) {
  return runInTransaction(db, () => {
    const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
    if (!counter) return { ok: false, error: 'NOT_FOUND' };
    if (counter.session_token && counter.session_token !== token) {
      return { ok: false, error: 'NOT_OWNER' };
    }
    db.prepare(
      `UPDATE counters SET session_token = NULL, session_started_at = NULL, custom_priority_order = NULL WHERE id = ?`
    ).run(counterId);
    return { ok: true };
  });
}

/**
 * Chi dung khi that su ket qua (may nhan vien hong, mat trinh duyet...) khong the tu thoat phien.
 * Cung reset thu tu uu tien tuy chinh ve mac dinh, giong het thoat phien binh thuong.
 */
function forceExitCounterSession(db, counterId) {
  db.prepare(
    `UPDATE counters SET session_token = NULL, session_started_at = NULL, custom_priority_order = NULL WHERE id = ?`
  ).run(counterId);
  return { ok: true };
}

/** Lay thu tu uu tien TUY CHINH hien tai cua 1 quay - null neu dang dung mac dinh he thong. */
function getCounterPriorityOrder(db, counterId) {
  const counter = db.prepare('SELECT custom_priority_order FROM counters WHERE id = ?').get(counterId);
  if (!counter || !counter.custom_priority_order) return null;
  try {
    const parsed = JSON.parse(counter.custom_priority_order);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Dat thu tu uu tien TUY CHINH cho 1 quay (nhan vien keo tha o man hinh /counter). Truyen
 * order = null de xoa tuy chinh, tra ve mac dinh he thong ngay lap tuc (khong can thoat phien).
 * Bat buoc order (khi khac null) phai chua DAY DU va KHONG TRUNG cac ma doi tuong cua he thong,
 * tranh truong hop thieu 1 ma khien logic goi so bi sai lech kho phat hien.
 */
function setCounterPriorityOrder(db, counterId, order) {
  const counter = db.prepare('SELECT id FROM counters WHERE id = ?').get(counterId);
  if (!counter) throw new Error('Không tìm thấy quầy');

  if (order === null || order === undefined) {
    db.prepare('UPDATE counters SET custom_priority_order = NULL WHERE id = ?').run(counterId);
    return { ok: true };
  }

  if (!Array.isArray(order) || order.length === 0) {
    throw new Error('Thứ tự ưu tiên không hợp lệ');
  }

  const validCodes = getAllOptionsForStaff().map((o) => o.code);
  const validSet = new Set(validCodes);
  const orderSet = new Set(order);
  const isComplete =
    order.length === validCodes.length && orderSet.size === order.length && [...orderSet].every((c) => validSet.has(c));
  if (!isComplete) {
    throw new Error('Danh sách thứ tự ưu tiên phải chứa đầy đủ, không trùng lặp các đối tượng ưu tiên của hệ thống');
  }

  db.prepare('UPDATE counters SET custom_priority_order = ? WHERE id = ?').run(JSON.stringify(order), counterId);
  return { ok: true };
}

function getSkippedTickets(db, day) {
  return db
    .prepare(`SELECT * FROM tickets WHERE status = 'skipped' AND day = ? ORDER BY number ASC`)
    .all(day)
    .map(rowToTicket);
}

/**
 * Danh sach TOAN BO cac ve DA TUNG DUOC GOI trong ngay (khong phan biet quay nao da goi), sap xep
 * MOI GOI GAN NHAT len dau - dung cho modal "Xem số đã gọi" moi o man hinh /counter/ (theo yeu
 * cau: "bổ sung thêm chức năng xem các số đã gọi của các quầy"). Dieu kien la `called_at IS NOT
 * NULL` (KHONG loc theo status) vi 1 ve sau khi duoc goi ('called') co the chuyen tiep sang 'done'
 * (da xong, bi thay boi lan goi tiep theo cua cung quay) hoac 'skipped' (bo qua sau khi da goi) -
 * ca 2 truong hop nay VAN giu nguyen `called_at` cua lan goi truoc do (xem callNextTicket()/
 * skipTicket() o tren, khong co cho nao xoa cot nay) nen van phai xuat hien trong lich su da goi.
 */
function getCalledTickets(db, day) {
  return db
    .prepare(`SELECT * FROM tickets WHERE day = ? AND called_at IS NOT NULL ORDER BY called_at DESC`)
    .all(day)
    .map(rowToTicket);
}

/** Danh sach so bi BO QUA BOI 1 QUAY CU THE - dung cho man hinh benh nhan cua rieng quay do.
 * Tra ve ca `number_prefix` (khong chi `number`) - khi bat SEPARATE_PRIORITY_SEQUENCE, 2 ve khac
 * doi tuong (1 uu tien 1 thuong) co the co CUNG gia tri number (vi du U007 va T007 - 2 day so doc
 * lap) nen bat buoc phai kem tien to moi phan biet duoc, khong the chi tra ve 1 mang so nhu truoc. */
function getSkippedNumbersForCounter(db, day, counterId) {
  return db
    .prepare(
      `SELECT number, number_prefix FROM tickets WHERE status = 'skipped' AND day = ? AND counter_id = ? ORDER BY number ASC`
    )
    .all(day, counterId)
    .map((r) => ({ number: r.number, prefix: r.number_prefix || null }));
}

/** Lay ve dang duoc phuc vu hien tai cua 1 quay (dung cho nut "Goi lai"). */
function getCounterCurrentTicket(db, counterId) {
  const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
  if (!counter || !counter.current_ticket_id) return null;
  const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(counter.current_ticket_id);
  return rowToTicket(row);
}

function getWaitingCount(db, day) {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE status = 'waiting' AND day = ?`).get(day);
  return row.c;
}

/**
 * So luong ve dang cho, THONG KE THEO TUNG DOI TUONG UU TIEN - dung de hien chi tiet o man hinh
 * quay (thay vi chi hien 1 tong duy nhat), giup nhan vien biet dang co bao nhieu ve cap cuu,
 * bao nhieu ve nguoi gia... dang cho de chu dong sap xep. Chi tra ve cac doi tuong dang CO ve
 * cho (khong tra ve doi tuong co so luong = 0) de gon giao dien.
 */
function getWaitingCountByPriority(db, day) {
  return db
    .prepare(
      `SELECT priority_code, priority_rank, COUNT(*) AS count
       FROM tickets WHERE status = 'waiting' AND day = ?
       GROUP BY priority_code, priority_rank
       ORDER BY priority_rank ASC`
    )
    .all(day)
    .map((r) => ({ code: r.priority_code, count: r.count }));
}

/** Tong hop trang thai tat ca quay + so bi bo qua, dung cho man hinh cho chung. */
function getDisplaySummary(db, day) {
  const counters = db.prepare(`SELECT * FROM counters WHERE is_active = 1 ORDER BY code ASC`).all();

  const counterRows = counters.map((c) => {
    let currentNumber = null;
    let currentNumberPrefix = null;
    let currentPriorityCode = null;
    if (c.current_ticket_id) {
      const t = db.prepare('SELECT number, number_prefix, priority_code FROM tickets WHERE id = ?').get(c.current_ticket_id);
      if (t) {
        currentNumber = t.number;
        currentNumberPrefix = t.number_prefix || null;
        currentPriorityCode = t.priority_code;
      }
    }
    // So bi bo qua RIENG cua quay nay - man hinh benh nhan cua quay do se hien danh sach nay
    const skippedNumbers = getSkippedNumbersForCounter(db, day, c.id);
    return {
      counterId: c.id,
      code: c.code,
      name: c.name,
      status: c.status,
      currentNumber,
      currentNumberPrefix,
      currentPriorityCode,
      skippedNumbers,
    };
  });

  const skipped = getSkippedTickets(db, day);
  const waitingCount = getWaitingCount(db, day);
  const waitingByPriority = getWaitingCountByPriority(db, day);

  return {
    day,
    counters: counterRows,
    // Tra ve kem tien to (khong chi mang so) - cung ly do voi getSkippedNumbersForCounter() o
    // tren: khi bat SEPARATE_PRIORITY_SEQUENCE, 2 ve khac doi tuong co the trung gia tri number.
    skippedNumbers: skipped.map((t) => ({ number: t.number, prefix: t.number_prefix || null })),
    waitingCount,
    waitingByPriority,
  };
}

/**
 * ==== Quan ly DANH MUC quay tiep nhan (them / sua ten / tam ngung / kiem tra trung) ====
 * Dung cho man hinh /counter-admin (public/counter-admin/index.html) - KHAC voi cac ham ben tren
 * (vao/thoat phien lam viec cua 1 ca truc) - day la quan ly "danh sach quay co nhung quay nao",
 * viec cua nguoi QUAN TRI he thong, khong phai nhan vien truc quay hang ngay.
 */

/** Chuan hoa ma/ten quay de so sanh trung: bo khoang trang dau/cuoi, ve chu HOA (chi dung de SO
 * SANH - gia tri LUU vao DB van giu nguyen chu hoa/thuong nguoi dung go, chi trim khoang trang). */
function normalizeForCompare(value) {
  return (value || '').trim().toLowerCase();
}

/**
 * Kiem tra 1 ma/ten quay co bi TRUNG voi quay nao KHAC (ngoai tru chinh no, dung khi SUA) hay
 * khong - tra ve { field: 'code'|'name', counter } cua quay bi trung dau tien tim thay, hoac null
 * neu khong trung gi ca. So sanh khong phan biet HOA/THUONG va bo khoang trang dau/cuoi (vi du
 * "Q01" va " q01 " duoc coi la TRUNG) - tranh truong hop go sai hoa/thuong hoac go du dau cach ma
 * he thong khong phat hien duoc la trung, gay nham lan cho nhan vien quay khi chon quay.
 */
function findDuplicateCounter(db, { code, name, excludeId }) {
  const rows = db.prepare('SELECT id, code, name FROM counters').all();
  const normCode = normalizeForCompare(code);
  const normName = normalizeForCompare(name);
  for (const row of rows) {
    if (excludeId != null && String(row.id) === String(excludeId)) continue;
    if (normCode && normalizeForCompare(row.code) === normCode) return { field: 'code', counter: row };
    if (normName && normalizeForCompare(row.name) === normName) return { field: 'name', counter: row };
  }
  return null;
}

/**
 * Them 1 quay MOI vao danh muc. Bat buoc phai co ma + ten, kiem tra TRUNG (ca ma lan ten, xem
 * findDuplicateCounter) TRUOC KHI ghi vao DB - nem loi ro rang (kem ma quay bi trung) thay vi de
 * loi UNIQUE constraint tho cua SQLite (chi bat trung ma "code", khong bat duoc trung "ten") vong
 * ra ngoai kho hieu.
 */
function createCounter(db, { code, name }) {
  const trimmedCode = (code || '').trim();
  const trimmedName = (name || '').trim();
  if (!trimmedCode || !trimmedName) {
    throw new Error('Vui lòng nhập đầy đủ mã quầy và tên quầy');
  }
  const dup = findDuplicateCounter(db, { code: trimmedCode, name: trimmedName });
  if (dup) {
    const err = new Error(
      dup.field === 'code'
        ? `Mã quầy "${trimmedCode}" đã được dùng cho quầy "${dup.counter.name}" (${dup.counter.code})`
        : `Tên quầy "${trimmedName}" đã được dùng cho quầy khác (${dup.counter.code})`
    );
    err.code = 'DUPLICATE';
    err.field = dup.field;
    throw err;
  }
  const info = db
    .prepare('INSERT INTO counters (code, name, is_active, status) VALUES (?, ?, 1, ?)')
    .run(trimmedCode, trimmedName, 'idle');
  return db.prepare('SELECT * FROM counters WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Sua ma/ten 1 quay DA CO. Cung kiem tra TRUNG nhu createCounter, nhung LOAI TRU chinh quay dang
 * sua (excludeId) - khong the "trung voi chinh minh". Cho phep sua ke ca khi quay dang co phien
 * lam viec (dang co nguoi dung) - id quay khong doi nen khong anh huong gi den phien dang chay,
 * chi doi CHU HIEN THI.
 */
function updateCounter(db, counterId, { code, name }) {
  const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
  if (!counter) throw new Error('Không tìm thấy quầy');

  const trimmedCode = (code || '').trim();
  const trimmedName = (name || '').trim();
  if (!trimmedCode || !trimmedName) {
    throw new Error('Vui lòng nhập đầy đủ mã quầy và tên quầy');
  }
  const dup = findDuplicateCounter(db, { code: trimmedCode, name: trimmedName, excludeId: counterId });
  if (dup) {
    const err = new Error(
      dup.field === 'code'
        ? `Mã quầy "${trimmedCode}" đã được dùng cho quầy "${dup.counter.name}" (${dup.counter.code})`
        : `Tên quầy "${trimmedName}" đã được dùng cho quầy khác (${dup.counter.code})`
    );
    err.code = 'DUPLICATE';
    err.field = dup.field;
    throw err;
  }
  db.prepare('UPDATE counters SET code = ?, name = ? WHERE id = ?').run(trimmedCode, trimmedName, counterId);
  return db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
}

/**
 * Tam ngung / kich hoat lai 1 quay (is_active). Khi TAM NGUNG (active = false): quay se KHONG
 * con hien de chon o man hinh /counter nua (xem loadCounters() trong public/counter/counter.js)
 * va bi loai khoi man hinh cho chung/thong ke (xem is_active = 1 trong getDisplaySummary() o
 * tren) - dong thoi CHU DONG giai phong phien dang giu (giong forceExitCounterSession) neu dang
 * co nguoi dung, vi khong hop ly de 1 quay "tam ngung" ma van con nhan vien dang truc/goi so tai
 * do. Khi KICH HOAT LAI, chi doi co is_active, KHONG tu dong mo lai phien cu (nhan vien can vao
 * lai binh thuong).
 */
function setCounterActive(db, counterId, isActive) {
  const counter = db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
  if (!counter) throw new Error('Không tìm thấy quầy');
  if (isActive) {
    db.prepare('UPDATE counters SET is_active = 1 WHERE id = ?').run(counterId);
  } else {
    db.prepare(
      `UPDATE counters SET is_active = 0, session_token = NULL, session_started_at = NULL,
       session_heartbeat_at = NULL, custom_priority_order = NULL WHERE id = ?`
    ).run(counterId);
  }
  return db.prepare('SELECT * FROM counters WHERE id = ?').get(counterId);
}

module.exports = {
  createTicket,
  checkCooldown,
  callNextTicket,
  callNextTicketByPriority,
  skipTicket,
  recallTicket,
  recallTicketToCounter,
  completeTicket,
  enterCounterSession,
  exitCounterSession,
  forceExitCounterSession,
  heartbeatCounterSession,
  sweepStaleCounterSessions,
  getSkippedTickets,
  getCalledTickets,
  getSkippedNumbersForCounter,
  getCounterCurrentTicket,
  getCounterPriorityOrder,
  setCounterPriorityOrder,
  getWaitingCount,
  getWaitingCountByPriority,
  getDisplaySummary,
  createCounter,
  updateCounter,
  setCounterActive,
  findDuplicateCounter,
};
