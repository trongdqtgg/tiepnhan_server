const crypto = require('crypto');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 gio
const sessions = new Map(); // token -> thoi diem het han

// Danh sach cac phien dang "cho dang xuat mem" (soft logout) - xem scheduleSoftLogout() ben duoi.
// token -> Timeout handle.
const pendingSoftLogouts = new Map();

function getStaffPassword() {
  // Doc truc tiep tu process.env moi lan goi (khong cache) de neu ai sua .env va khoi dong
  // lai server thi mat khau moi co hieu luc ngay, khong can sua code.
  return process.env.STAFF_PASSWORD || 'His4@123';
}

function checkPassword(password) {
  return typeof password === 'string' && password === getStaffPassword();
}

function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    sessions.delete(token);
    return false;
  }
  // Bat ky yeu cau nao dung phien nay THANH CONG deu la bang chung phien "van dang song" - huy
  // moi lenh "dang xuat mem" dang cho (xem scheduleSoftLogout()). Quan trong nhat cho truong hop
  // TAI LAI TRANG (F5/reload): trang cu goi dang xuat mem luc pagehide, nhung trang moi (cung
  // token, cung tab) load lai gan nhu ngay lap tuc va se goi ngay 1 API can dang nhap (vi du
  // /api/kiosk-config) - request do di qua day, huy lenh dang xuat mem truoc khi no kip xoa phien.
  cancelSoftLogout(token);
  return true;
}

function destroySession(token) {
  if (token) {
    sessions.delete(token);
    cancelSoftLogout(token);
  }
}

/**
 * "Dang xuat MEM" - danh cho tin hieu tu `pagehide` (xem kiosk.js/counter.js): mot so man hinh
 * dang kiosk/TV muon TU DONG dang xuat khi trang THAT SU bi dong/roi khoi (dong tab, dieu huong
 * sang URL khac...) de dam bao lan sau phai dang nhap lai - nhung `pagehide` CUNG chay khi trang
 * chi don gian duoc TAI LAI (F5/reload), ma reload thi KHONG nen bi dang xuat (nguoi dung/nhan
 * vien khong lam gi sai, chi dang F5 lai man hinh dang dung).
 *
 * Vi phia trinh duyet (trang SAP roi/dang dong) khong co cach nao biet chac chan day la reload
 * hay dong that su, ta chuyen quyet dinh nay sang phia SERVER bang 1 khoang "an" ngan: thay vi xoa
 * phien NGAY LAP TUC luc nhan tin hieu pagehide, chi LEN LICH xoa sau `graceMs`. Neu day THAT SU
 * la 1 lan reload, trang MOI (cung token, cung tab) se load lai gan nhu ngay lap tuc va tu no se
 * goi it nhat 1 API can dang nhap trong vong vai chuc/vai tram ms - di qua isValidSession() o tren
 * va TU HUY lenh xoa dang cho, nen phien van con nguyen. Neu THAT SU dong tab/roi han, khong con
 * request nao den nua -> het `graceMs` phien se bi xoa that, dung nhu mong muon ban dau.
 */
function scheduleSoftLogout(token, graceMs = 2000) {
  if (!token) return;
  cancelSoftLogout(token);
  const timer = setTimeout(() => {
    pendingSoftLogouts.delete(token);
    sessions.delete(token);
  }, graceMs);
  timer.unref?.();
  pendingSoftLogouts.set(token, timer);
}

function cancelSoftLogout(token) {
  const timer = pendingSoftLogouts.get(token);
  if (timer) {
    clearTimeout(timer);
    pendingSoftLogouts.delete(token);
  }
}

// Don rac dinh ky cac phien da het han, tranh Map phinh to neu server chay lau ngay
setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of sessions) {
    if (now > expiresAt) sessions.delete(token);
  }
}, 60 * 60 * 1000).unref();

module.exports = {
  checkPassword,
  createSession,
  isValidSession,
  destroySession,
  scheduleSoftLogout,
  SESSION_TTL_MS,
};
