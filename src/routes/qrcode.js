const express = require('express');
const QRCode = require('qrcode');

/**
 * API DUNG CHUNG de sinh anh QR tu 1 chuoi bat ky, tra ve dang "data URL" (anh PNG ma hoa base64,
 * nhung thang trong JSON) - dung boi public/print-receipt.js de IN LAI CHINH MA QR CUA CCCD/BHYT
 * vua quet duoc len phieu giay (xem ghi chu opts.idQrRaw trong print-receipt.js).
 *
 * Cong khai (khong yeu cau dang nhap), giong nhu /api/tickets/parse-qr - kiosk cong khai (benh
 * nhan tu quet) cung can goi duoc API nay khi in phieu, khong the bat dang nhap nhan vien o day.
 * Chi lam 1 viec DON GIAN va IT RUI RO: ma hoa lai 1 chuoi thanh anh QR, khong doc/ghi gi vao CSDL,
 * khong tra ve thong tin gi khac ngoai chinh du lieu nguoi goi da gui len.
 *
 * DUNG POST (voi data trong JSON body), KHONG dung GET (voi data trong query string ?data=...)
 * nhu ban dau: noi dung QR CCCD/BHYT that co the kha dai (dac biet BHYT - ho ten trong do dang
 * MA HOA HEX, dai gap ~4-6 lan ten that vi moi ky tu tieng Viet co dau chiem 2-3 byte UTF-8, moi
 * byte lai thanh 2 ky tu hex), roi con bi encodeURIComponent() lam PHINH THEM lan nua truoc khi
 * nhet vao URL - cong don lai co the cham/vuot cac gioi han ngam cua trinh duyet/may chu danh cho
 * DO DAI 1 DUONG DAN URL (thuong quanh 8-16KB, nhung mot so cau hinh/proxy gioi han thap hon
 * nhieu), khien du lieu bi CAT MAT 1 PHAN ma khong bao loi ro rang - JSON body (qua express.json()
 * da bat san trong src/server.js, gioi han mac dinh 100kb) khong co gioi han nay.
 */
function qrcodeRouter() {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const data = typeof req.body?.data === 'string' ? req.body.data.trim() : '';
    if (!data) return res.status(400).json({ error: 'Thiếu tham số "data"' });
    // Gioi han do dai hop ly - QR code CCCD/BHYT thuc te chi khoang vai tram ky tu, chan cac gia
    // tri bat thuong/qua lon (lam phi lang trinh may chu hoac tao anh QR khong doc duoc). 4000 ky
    // tu da RONG HON kha nang chua toi da cua 1 ma QR (~2953 byte o cap do sua loi thap nhat) nen
    // gioi han nay khong phai nguyen nhan cat bot du lieu thuc te - chi la 1 luoi an toan.
    if (data.length > 4000) return res.status(400).json({ error: 'Dữ liệu quá dài để tạo mã QR' });
    try {
      const dataUrl = await QRCode.toDataURL(data, { margin: 1, width: 240 });
      res.json({ dataUrl });
    } catch (err) {
      res.status(500).json({ error: 'Không tạo được mã QR: ' + err.message });
    }
  });

  return router;
}

module.exports = qrcodeRouter;
