const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // co san trong Node.js, KHONG can cai dat gi them,
// khong bien dich native module nen khong gap loi thieu Python/Visual Studio nhu better-sqlite3.
const { getAppRoot } = require('./appRoot');

let db;

function connectDB() {
  const file = process.env.SQLITE_FILE || './data/queue.db';
  // Tinh duong dan TUONG DOI tu goc ung dung (xem appRoot.js), KHONG PHAI tu process.cwd() nhu
  // truoc - 2 cai co the KHAC NHAU khi chay tu 1 file .exe duoc mo bang shortcut/tac vu dinh ky
  // (Task Scheduler) co "Start in" khac thu muc chua .exe, dan toi tao nham file database o noi
  // khac moi lan chay. Duong dan TUYET DOI (SQLITE_FILE bat dau bang "/" hoac "C:\...") van duoc
  // giu nguyen, khong bi anh huong (path.resolve bo qua doi so goc neu "file" da la duong dan
  // tuyet doi).
  const absPath = path.resolve(getAppRoot(), file);

  /**
   * Theo phan anh: "cài trên máy khách hàng nó báo lỗi IO" - hoa ra loi xay ra SAU khi server da
   * chay (luc vao trang /counter/, khong phai luc khoi dong) - xem middleware xu ly loi chung moi
   * them trong server.js de biet chi tiet trieu chung/nguyen nhan. NHUNG buoc MO/TAO file database
   * lan dau nay (mkdirSync + new DatabaseSync + exec dau tien) CUNG la 1 thao tac GHI DIA, CO THE
   * that bai vi CUNG 1 nhom nguyen nhan (quyen thu muc/antivirus) ngay tu luc KHOI DONG - boc trong
   * try/catch de neu that bai NGAY TU DAU, in ra ngay 1 thong bao TIENG VIET RO RANG, DE HANH DONG
   * (thay vi de loi ky thuat kho hieu cua node:sqlite troi len tan main().catch() o server.js roi
   * dung lai voi dong "[FATAL] Không khởi động được server" chung chung, khong goi y duoc gi ca).
   */
  try {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    db = new DatabaseSync(absPath);
    db.exec('PRAGMA journal_mode = WAL'); // cho phep doc/ghi dong thoi tot hon, phu hop nhieu quay cung dung
  } catch (err) {
    console.error(
      `\n[LỖI] Không mở/tạo được file cơ sở dữ liệu tại: ${absPath}\n` +
        `  Chi tiết kỹ thuật: ${err && err.message}\n` +
        '  Nguyên nhân THƯỜNG GẶP NHẤT (đặc biệt nếu chỉ xảy ra ở máy này, không xảy ra ở máy khác):\n' +
        '    1) Phần mềm diệt virus / Windows Defender ("Kiểm soát truy cập thư mục được kiểm soát")\n' +
        '       đang CHẶN chương trình ghi vào thư mục cài đặt - thêm ngoại lệ cho thư mục cài đặt.\n' +
        '    2) Thư mục cài đặt/thư mục "data" thiếu quyền ghi cho tài khoản Windows đang đăng nhập -\n' +
        '       nên gỡ và cài lại ĐÚNG bằng trình cài đặt HeThongBatSo-Setup-....exe (tự cấp quyền ghi\n' +
        '       cho thư mục cài đặt), không copy tay thư mục sang.\n' +
        '    3) Thư mục cài đặt nằm trong thư mục đang đồng bộ đám mây (OneDrive/Google Drive...) - nên\n' +
        '       cài vào ổ đĩa cục bộ thông thường.\n'
    );
    throw err;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL,
      day TEXT NOT NULL,
      priority_code TEXT NOT NULL,
      priority_rank INTEGER NOT NULL,
      patient_name TEXT,
      patient_dob TEXT,
      patient_gender TEXT,
      patient_id_number TEXT,
      patient_source TEXT,
      patient_qr_raw TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      counter_id INTEGER,
      skip_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      called_at TEXT,
      done_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_call_order ON tickets (status, priority_rank, number);
    CREATE INDEX IF NOT EXISTS idx_tickets_day ON tickets (day);
    CREATE INDEX IF NOT EXISTS idx_tickets_patient_id ON tickets (patient_id_number);

    CREATE TABLE IF NOT EXISTS counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'idle',
      current_ticket_id INTEGER,
      session_token TEXT,
      session_started_at TEXT,
      custom_priority_order TEXT
    );

    CREATE TABLE IF NOT EXISTS seq (
      day TEXT PRIMARY KEY,
      seq INTEGER NOT NULL DEFAULT 0
    );

    -- Bang cau hinh/trang thai chung, dang "key -> value" don gian - hien chi dung 1 khoa duy nhat
    -- ("effective_day_override", xem getEffectiveDay()/setEffectiveDayOverrideToNextDay() trong
    -- src/services/sequenceService.js) de nho lai viec nhan vien da bam "Mở reset > 16h" hay chua
    -- (chuyen "ngay hieu luc" dung de cap so/thong ke sang ngay mai som hon binh thuong). Thiet ke
    -- dang key-value de sau nay co the tai su dung cho cac co/cau hinh nho khac ma khong can them
    -- bang/migrate them cot moi.
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migrate: neu database da tao tu truoc (chua co cot session_token/session_started_at)
  // thi tu them cot vao, khong lam mat du lieu cu.
  ensureColumn(db, 'counters', 'session_token', 'TEXT');
  ensureColumn(db, 'counters', 'session_started_at', 'TEXT');
  // "Nhip song" (heartbeat) - client /counter tu dong bao con hoat dong moi 20s. Dung de phat
  // hien quay bi "ket lai" do trinh duyet/may tat dot ngot (khong kip goi exit-session) - xem
  // isSessionStale()/sweepStaleCounterSessions() trong ticketService.js.
  ensureColumn(db, 'counters', 'session_heartbeat_at', 'TEXT');
  ensureColumn(db, 'tickets', 'patient_qr_raw', 'TEXT');
  ensureColumn(db, 'counters', 'custom_priority_order', 'TEXT');
  // Tien to hien thi ("U"/"T"...) khi bat SEPARATE_PRIORITY_SEQUENCE (xem .env.example va
  // src/services/sequenceService.js/ticketService.js) - LUU LAI theo TUNG VE tai thoi diem tao,
  // KHONG tinh lai theo priority_code luc hien thi, de ve cu (tao truoc khi bat/tat tinh nang nay)
  // luon hien dung nhu luc no duoc cap, khong bi "nhay" tien to neu sau nay doi cau hinh .env.
  ensureColumn(db, 'tickets', 'number_prefix', 'TEXT');
  // MUC 112 - cau hoi sang loc tai kiosk: SDT (luong BN khong mang giay to) + cau tra loi (JSON
  // [{id,label,value,text}]) - xem src/config/kioskQuestions.js.
  ensureColumn(db, 'tickets', 'patient_phone', 'TEXT');
  ensureColumn(db, 'tickets', 'kiosk_answers', 'TEXT');

  console.log(`[DB] Đã mở SQLite (node:sqlite, built-in) tại: ${absPath}`);
  return db;
}

function ensureColumn(database, table, column, type) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

/**
 * node:sqlite (DatabaseSync) khong co san ham db.transaction() nhu better-sqlite3,
 * nen tu bao BEGIN/COMMIT/ROLLBACK bang tay. Vi DatabaseSync la dong bo (synchronous)
 * va Node.js don luong, cac lenh giua BEGIN va COMMIT khong the bi xen ngang boi
 * request khac -> van dam bao tuyet doi khong goi trung ve du nhieu quay bam cung luc.
 */
function runInTransaction(database, fn) {
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

function getDB() {
  if (!db) throw new Error('DB chưa được kết nối. Gọi connectDB() trước.');
  return db;
}

module.exports = { connectDB, getDB, runInTransaction };
