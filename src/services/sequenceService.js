const dayjs = require('dayjs');

/** Ma ngay THUC TE hom nay theo dong ho may chu - dung lam khoa bo dem, giup STT tu dong bat dau
 * lai tu 1 moi ngay (KHI KHONG co override, xem getEffectiveDay() ben duoi). */
function todayKey() {
  return dayjs().format('YYYY-MM-DD');
}

const EFFECTIVE_DAY_OVERRIDE_KEY = 'effective_day_override';

/**
 * MUC 96/97 - "Mở reset > 16h": "Ngày hiệu lực" (effective day) dung cho MOI thao tac cap so MOI
 * (getNextTicketNumber() ben duoi) VA moi truy van thong ke/hang cho theo ngay (getDisplaySummary,
 * getSkippedTickets, getCalledTickets, getWaitingCount... trong ticketService.js) - THAY THE hoan
 * toan todayKey() o cac noi do.
 *
 * Binh thuong (chua bam nut) tra ve DUNG ngay thuc te hom nay (todayKey()), KHONG khac gi truoc
 * day. Sau khi nhan vien bam "Mở reset > 16h" (xem setEffectiveDayOverrideToNextDay() ben duoi va
 * route POST /api/tickets/reset-sequence trong src/routes/tickets.js) - luu 1 "ngay override" (=
 * ngay mai tai thoi diem bam) vao bang `app_state` - ham nay se tra ve NGAY OVERRIDE do THAY VI
 * ngay thuc te, khien: (1) ve MOI cap tu luc do se duoc ghi nhan (cot `tickets.day`) va DANH SO
 * (bang `seq`) THEO NGAY MAI - tuc "ngung cap so cho ngay hom nay, bat dau cap so cho ngay tiep
 * theo" dung theo yeu cau nguoi dung; (2) cac man hinh thong ke/hang cho (/counter, /display,
 * /counter-admin) cung chuyen sang hien thi theo ngay moi nay.
 *
 * Override TU DONG HET HIEU LUC (tu don dep, khong can nhan vien lam gi them) ngay khi dong ho
 * THAT SU "bat kip" (hoac vuot qua) ngay override - nghia la den nua dem THAT thi moi thu tro lai
 * hoan toan binh thuong (khong con "override" nao ca, ngay hieu luc = ngay thuc te = ngay override
 * cu, khop nhau tu nhien - KHONG bi nhay thêm 1 ngay nua).
 *
 * LUU Y (DA SUA O MUC 99): cac ve DA CAP truoc do (con "waiting", chua duoc goi) van con nguyen
 * trong CSDL voi `day` cu (ngay thuc te luc cap) - TRUOC MUC 99, callNextTicket()/
 * callNextTicketByPriority() trong ticketService.js KHONG loc theo `day` nen VAN goi duoc cac ve
 * "ngay cu" nay du man hinh /counter dang bao "0 số đang chờ" (gay nham lan, xem phan anh loi cua
 * nguoi dung o muc 99) - NAY DA SUA: 2 ham do bat buoc nhan them tham so `day` (goi tu
 * getEffectiveDay(db) o noi goi, xem src/routes/counters.js) va LOC DUNG theo `day` do khi chon ve
 * de goi, dong bo hoan toan voi thong ke/hien thi. Nghia la sau khi dung "Mở reset > 16h", cac ve
 * "waiting" cua ngay cu se KHONG con goi duoc o quay nua CHO DEN KHI "ngay hieu luc" quay lai dung
 * ngay do (dem that den, override tu het han - xem o tren) - day la HANH VI CHU DICH MOI, dam bao
 * "gọi số" va "đang chờ hiển thị" luon khop nhau tuyet doi.
 */
function getEffectiveDay(db) {
  const real = todayKey();
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(EFFECTIVE_DAY_OVERRIDE_KEY);
  const override = row && row.value;
  if (!override) return real;
  if (override <= real) {
    // Dong ho that da "bat kip" (hoac di qua) ngay override - don dep, tro ve hanh vi binh thuong.
    db.prepare('DELETE FROM app_state WHERE key = ?').run(EFFECTIVE_DAY_OVERRIDE_KEY);
    return real;
  }
  return override;
}

/** Bat override "ngay hieu luc" = ngay mai (tinh tu THOI DIEM GOI HAM, theo dong ho may chu). */
function setEffectiveDayOverrideToNextDay(db) {
  const nextDay = dayjs().add(1, 'day').format('YYYY-MM-DD');
  db.prepare(
    `INSERT INTO app_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(EFFECTIVE_DAY_OVERRIDE_KEY, nextDay);
  return nextDay;
}

/**
 * Sinh so thu tu tiep theo, TANG DAN LIEN TUC trong "ngay hieu luc" (getEffectiveDay() o tren -
 * TRUOC MUC 97 la todayKey() thuc te, nay uu tien override neu co). Mac dinh (khong truyen
 * `seriesKey`) dung CHUNG 1 day so, khong phan biet doi tuong - giu nguyen hanh vi tu truoc den nay.
 *
 * `seriesKey` (tuy chon, vi du 'U'/'T') - dung khi bat SEPARATE_PRIORITY_SEQUENCE trong .env (xem
 * getSequenceConfig() trong src/services/ticketService.js): moi seriesKey KHAC NHAU se co 1 day
 * so RIENG, tu tang dan doc lap voi nhau (vi du day "U" va day "T" cung bat dau tu 1 trong ngay).
 * Ky thuat: TAI SU DUNG dung 1 bang `seq` san co (khong doi schema/khong can migrate them cot
 * moi) - chi ghep them seriesKey vao CHINH khoa chinh (cot `day`) cua bang do lam khoa dem RIENG
 * (vi du "2026-09-03::U"), TRONG KHI gia tri `day` THAT SU tra ve cho ben goi van la ngay "sach"
 * (khong dinh seriesKey) - vi gia tri `day` nay con duoc dung de LUU vao cot `tickets.day` va loc
 * theo ngay o nhieu noi khac (thong ke, don dep du lieu cu...), khong duoc phep bi "nhiem" chuoi
 * seriesKey vao do.
 * Dung 1 cau lenh SQL duy nhat (INSERT ... ON CONFLICT ... RETURNING) de dam bao nguyen tu:
 * better-sqlite3 chay dong bo (synchronous) va Node.js don luong nen 2 request "cung luc"
 * vao ham nay van thuc thi lan luot, khong bao gio sinh trung so (ke ca giua 2 seriesKey khac
 * nhau, vi cung chung 1 bang/1 tien trinh).
 */
function getNextTicketNumber(db, seriesKey) {
  const day = getEffectiveDay(db);
  const seqKey = seriesKey ? `${day}::${seriesKey}` : day;
  const row = db
    .prepare(
      `INSERT INTO seq (day, seq) VALUES (?, 1)
       ON CONFLICT(day) DO UPDATE SET seq = seq + 1
       RETURNING seq`
    )
    .get(seqKey);
  return { number: row.seq, day };
}

/**
 * MUC 100 - "ràng buộc cấp số ưu tiên": phien ban CHI DOC (khong INSERT/UPDATE gi ca) cua
 * getNextTicketNumber() o tren - dung de "dòm trước" (peek) STT SE ĐƯỢC CẤP TIẾP THEO cho 1
 * seriesKey ma KHONG thuc su sinh/tieu thu so do (giu nguyen bo dem `seq`) - dung trong
 * createTicket() de KIEM TRA DIEU KIEN (xem checkPriorityIssueGate() trong file nay) TRUOC KHI
 * quyet dinh co cho phep cap ve uu tien nay hay khong, ma KHONG lam "mat" 1 so neu bi tu choi (neu
 * dung getNextTicketNumber() de kiem tra roi huy bo khi khong dat dieu kien, so do se bi "nhay
 * cóc" vi bo dem da tang, khong the "tra lai" duoc).
 */
function peekNextTicketNumber(db, seriesKey) {
  const day = getEffectiveDay(db);
  const seqKey = seriesKey ? `${day}::${seriesKey}` : day;
  const row = db.prepare('SELECT seq FROM seq WHERE day = ?').get(seqKey);
  const current = row ? row.seq : 0;
  return { number: current + 1, day };
}

module.exports = {
  getNextTicketNumber,
  peekNextTicketNumber,
  todayKey,
  getEffectiveDay,
  setEffectiveDayOverrideToNextDay,
};
