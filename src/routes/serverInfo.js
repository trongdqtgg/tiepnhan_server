const express = require('express');
const os = require('os');
const QRCode = require('qrcode');
const { isValidSession } = require('../services/authService');

/**
 * Tra ve dia chi IP mang LAN cua may chu (khong tinh 127.0.0.1/loopback) - dung de hien thi
 * cho nhan vien tren trang chu, giup ho biet dia chi de go tren cac may khac trong cung mang,
 * hoac quet QR bang dien thoai ca nhan de mo nhanh. Mot may co the co nhieu card mang (Wi-Fi +
 * day mang) nen tra ve TAT CA dia chi IPv4 khong phai loopback tim duoc.
 */
function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

function serverInfoRouter() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    // Dia chi mang LAN cua may chu la thong tin nhay cam (lo ra ngoai co the bi nguoi la truy cap
    // he thong) - CHI cho xem sau khi da dang nhap nhan vien, khong con la API cong khai nua.
    if (!isValidSession(req.cookies?.staff_token)) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập trước khi xem địa chỉ mạng' });
    }
    const port = process.env.PORT || 4000;
    const addresses = getLanAddresses();
    const urls = addresses.map((ip) => `http://${ip}:${port}`);

    let qr = null;
    if (urls[0]) {
      try {
        // Tao QR dang data URL (base64 PNG) ngay tren server - client chi can hien <img>,
        // khong can thu vien QR o phia trinh duyet.
        qr = await QRCode.toDataURL(urls[0], { margin: 1, width: 240 });
      } catch (err) {
        console.error('[QR] Lỗi tạo mã QR địa chỉ mạng:', err.message);
      }
    }

    res.json({ port, addresses, urls, qr });
  });

  return router;
}

module.exports = serverInfoRouter;
