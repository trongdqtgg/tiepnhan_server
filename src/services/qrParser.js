const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const { MERIT_BHYT_PREFIXES } = require('../config/priorityRules');

/** Doi chuoi hex (byte UTF-8 khong co dau '%') thanh text co dau tieng Viet. */
function decodeHexUtf8(hex) {
  if (!hex) return '';
  try {
    return Buffer.from(hex, 'hex').toString('utf8');
  } catch {
    return hex;
  }
}

/**
 * Parse noi dung QR CCCD gan chip.
 * Dinh dang: soCCCD|soCMNDcu|hoTen|ngaySinh(DDMMYYYY)|gioiTinh|diaChi|ngayCap
 */
function parseCCCD(raw) {
  const parts = (raw || '').split('|');
  if (parts.length < 6) return null;
  const [cccd, cmndCu, hoTen, ngaySinhRaw, gioiTinh, diaChi, ngayCap] = parts;
  const dob = dayjs(ngaySinhRaw, 'DDMMYYYY');
  const age = dob.isValid() ? dayjs().diff(dob, 'year') : null;
  return {
    cccd,
    cmndCu,
    hoTen,
    diaChi,
    ngayCap,
    dob: dob.isValid() ? dob.format('YYYY-MM-DD') : null,
    age,
    gender: gioiTinh === 'Nam' ? 'M' : gioiTinh === 'Nữ' ? 'F' : null,
  };
}

/**
 * Parse noi dung QR the BHYT (ca 2 kieu: ma so BHXH 10 so, hoac ma the day du 15 ky tu co tien to).
 * Field dau tien (p[0]) quyet dinh loai the:
 *  - Neu khop /^[A-Z]{2}\d{10,}$/ -> the day du, 2 ky tu dau la ma doi tuong (VD: DN, CC, TC...)
 *  - Neu chi la so -> the chi co ma so BHXH, KHONG xac dinh duoc doi tuong qua QR
 *
 * LUU Y: KHONG con doc/tra ve ho ten tu QR BHYT nua (p[1]) - field nay tren thuc te la chuoi da
 * ma hoa/dinh dang rieng cua he thong BHXH (khong don gian la hex-UTF8 nhu tung gia dinh truoc
 * day), giai ma sai se ra ten sai/loi ma khong co cach nao tu kiem tra duoc. De tranh hien thi/luu
 * nham 1 cai ten sai lech, kiosk/staff-kiosk chi lay ten tu CCCD gan chip (dang van ban ro, dang
 * tin cay duoc) - neu benh nhan chi co the BHYT (khong co CCCD) thi phieu se de trong ten.
 */
function parseBHYT(raw) {
  const parts = (raw || '').split('|');
  if (parts.length < 4) return null;
  const maThe = parts[0];
  const ngaySinh = parts[2]; // dd/mm/yyyy
  const gioiTinhCode = parts[3];

  const isFullCode = /^[A-Z]{2}\d{10,}$/.test(maThe);
  let maDoiTuong = null;
  let congCachMangAuto = false;
  if (isFullCode) {
    maDoiTuong = maThe.slice(0, 2);
    congCachMangAuto = MERIT_BHYT_PREFIXES.includes(maDoiTuong);
  }

  return { maThe, ngaySinh, gioiTinhCode, isFullCode, maDoiTuong, congCachMangAuto };
}

module.exports = { parseCCCD, parseBHYT, decodeHexUtf8 };
