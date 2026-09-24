const express = require('express');
const { publicKioskQuestions } = require('../config/kioskQuestions');

/**
 * Doc so giay tu-dong-xac-nhan cua KIOSK CONG KHAI tu bien moi truong, doc "tuoi" moi lan goi
 * (khong cache) de neu sua .env va khoi dong lai server thi ap dung ngay - giong cach lam voi
 * KIOSK_COOLDOWN_MINUTES trong src/routes/tickets.js. Mac dinh 5 giay neu khong cau hinh/gia
 * tri khong hop le.
 */
function getAutoConfirmSeconds() {
  const raw = Number(process.env.KIOSK_AUTO_CONFIRM_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 5;
}

/**
 * STAFF_KIOSK_SKIP_VERIFY (moi) - doc "tuoi" moi lan goi (khong cache), giong cach lam voi
 * KIOSK_AUTO_CONFIRM_SECONDS o tren, de sua .env + khoi dong lai server la ap dung ngay. Mac dinh
 * false (giu nguyen hanh vi cu: bam chon 1 doi tuong o /staff-kiosk/ se chuyen sang man hinh
 * "Sẵn sàng quét" cho nhan vien tu quyet dinh quet xac minh hay bam "Cấp số ngay - bỏ qua xác
 * minh"). Bat = true de BO HAN man hinh trung gian do - bam chon doi tuong la CAP SO NGAY LAP
 * TUC (giong het nhu da bam san "Cấp số ngay") - xem giai thich ly do (chong 1 luot quet cua
 * benh nhan KHAC lot vao dung luc man hinh "Sẵn sàng quét" con dang mo cho xac minh, gay gan
 * nham thong tin) trong .env.example va startVerify()/issuePriorityImmediately() trong
 * public/staff-kiosk/staff-kiosk.js.
 */
function getStaffKioskSkipVerify() {
  const raw = (process.env.STAFF_KIOSK_SKIP_VERIFY || '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

/**
 * STAFF_BATCH_MAX_QUANTITY - gioi han SO LUONG toi da cho 1 lan "cấp nhiều số" (tu dong lap lai)
 * o /staff-kiosk. TRUOC DAY co 1 route rieng POST /api/tickets/staff-batch tao ca lo trong 1
 * request va kiem tra/chan gia tri nay o phia SERVER - route do DA BI XOA (theo yeu cau nguoi
 * dung: bo luong "in hang loat" rieng, chi con lap lai DUNG route /api/tickets/staff nhieu lan
 * o phia client - xem autoIssueLoop() trong public/staff-kiosk/staff-kiosk.js). Gia tri nay gio
 * CHI con dung o PHIA CLIENT (client tu doc qua GET /api/kiosk-config o duoi, tu gioi han o nhap
 * "Số lượng cần cấp" + canh bao truoc khi bat dau vong lap tu dong) - KHONG con noi nao o server
 * chu dong tu choi 1 request neu client co bo qua gioi han nay (vi moi request /staff van chi
 * tao dung 1 ve, khong co khai niem "1 lo" o tang server nua de kiem tra). Doc "tuoi" moi lan
 * goi, khong cache. Mac dinh 50 neu khong cau hinh/gia tri khong hop le.
 */
function getStaffBatchMaxQuantity() {
  const raw = Number(process.env.STAFF_BATCH_MAX_QUANTITY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 50;
}

/**
 * Endpoint cong khai (khong can dang nhap) - kiosk.js (man hinh benh nhan) goi de biet dem
 * nguoc bao nhieu giay truoc khi tu dong xac nhan buoc hien tai (benh nhan khong duoc dung
 * ban phim/chuot, chi thao tac qua may quet); staff-kiosk.js goi de biet co bo qua man hinh
 * "Sẵn sàng quét" hay khong (STAFF_KIOSK_SKIP_VERIFY), va gioi han so luong toi da cho vong lap
 * "cấp nhiều số" tu dong (STAFF_BATCH_MAX_QUANTITY - gioi han nay CHI con duoc client tu ap
 * dung, khong con route server rieng nao kiem tra lai - xem ghi chu chi tiet o ham
 * getStaffBatchMaxQuantity() o tren).
 */
function kioskConfigRouter() {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({
      autoConfirmSeconds: getAutoConfirmSeconds(),
      staffKioskSkipVerify: getStaffKioskSkipVerify(),
      staffBatchMaxQuantity: getStaffBatchMaxQuantity(),
      // MUC 112: cau hoi sang loc cho /kiosk (doc tu kiosk-questions.json, tu nap lai khi sua file)
      questions: publicKioskQuestions(),
    });
  });
  return router;
}

module.exports = kioskConfigRouter;
module.exports.getStaffBatchMaxQuantity = getStaffBatchMaxQuantity;
