const express = require('express');
const QRCode = require('qrcode');
const {
  checkPassword,
  createSession,
  isValidSession,
  destroySession,
  scheduleSoftLogout,
  SESSION_TTL_MS,
} = require('../services/authService');

function getStaffPasswordForQr() {
  return process.env.STAFF_PASSWORD?.trim() || 'His4@123';
}

function authRouter() {
  const router = express.Router();

  router.post('/staff-login', (req, res) => {
    const { password } = req.body || {};
    if (!checkPassword(password)) {
      return res.status(401).json({ ok: false, error: 'Sai mật khẩu nhân viên' });
    }
    const token = createSession();
    res.cookie('staff_token', token, {
      httpOnly: true,
      maxAge: SESSION_TTL_MS,
      sameSite: 'lax',
    });
    res.json({ ok: true });
  });

  /**
   * `?soft=1`: dung rieng cho tin hieu `pagehide` (goi qua `navigator.sendBeacon()` khi trang
   * kiosk/quay/TV bi dong/tai lai - xem pagehide trong kiosk.js/counter.js). KHONG xoa phien NGAY
   * (chi len lich xoa sau vai giay - xem scheduleSoftLogout() trong authService.js) VA KHONG xoa
   * cookie o day - ly do: `pagehide` cung chay khi nguoi dung chi don gian TAI LAI trang (F5), ma
   * luc do trang MOI (cung tab) se load lai gan nhu ngay lap tuc va tu huy lenh dang xuat nay (xem
   * isValidSession()) - neu o day xoa cookie/phien NGAY LAP TUC se lam trang bi "dang xuat nham"
   * moi lan F5, day chinh la loi da xay ra truoc khi co co che nay. Neu la dong tab/roi han that
   * su (khong co trang moi nao goi lai), phien se tu bi xoa that sau khoang "an" ngan nhu du dinh
   * ban dau. Goi KHONG kem `?soft=1` (vi du tu 1 nut "Dang xuat" nguoi dung bam thu cong) van xoa
   * NGAY LAP TUC nhu truoc - cho phep tin dung phan hoi cua request do de biet chac da dang xuat.
   */
  router.post('/staff-logout', (req, res) => {
    const token = req.cookies?.staff_token;
    if (req.query?.soft === '1') {
      scheduleSoftLogout(token);
      return res.json({ ok: true, soft: true });
    }
    destroySession(token);
    res.clearCookie('staff_token');
    res.json({ ok: true });
  });

  router.get('/staff-status', (req, res) => {
    res.json({ authenticated: isValidSession(req.cookies?.staff_token) });
  });

  /**
   * Ma QR "dang nhap nhanh" - encode san mat khau nhan vien (STAFF_PASSWORD trong .env) thanh 1
   * anh QR, de nhan vien IN RA / dan len may kiosk khong co ban phim vat ly. Sau do chi can quet
   * ma nay vao o (input an, luon focus san) tren trang dang nhap ("/") la tu dong dang nhap, khong
   * can go tay - xem scanInput trong public/index.html.
   *
   * YEU CAU DA DANG NHAP roi moi xem/in duoc (khong cong khai) - vi day thuc chat la 1 dang khac
   * cua chinh mat khau nhan vien, chi nguoi da biet mat khau (da dang nhap it nhat 1 lan bang cach
   * go tay tren 1 may co ban phim) moi nen tao/in ra duoc de dan len cac may kiosk khac.
   */
  router.get('/login-qr', async (req, res) => {
    if (!isValidSession(req.cookies?.staff_token)) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập trước khi xem mã QR đăng nhập' });
    }
    try {
      const qr = await QRCode.toDataURL(getStaffPasswordForQr(), { margin: 1, width: 280 });
      res.json({ qr });
    } catch (err) {
      console.error('[QR] Lỗi tạo mã QR đăng nhập:', err.message);
      res.status(500).json({ error: 'Không tạo được mã QR, vui lòng thử lại' });
    }
  });

  return router;
}

module.exports = authRouter;
