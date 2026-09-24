const express = require('express');
const fs = require('fs');
const path = require('path');
const { getAppRoot } = require('../config/appRoot');

/**
 * Endpoint CONG KHAI (khong can dang nhap) tra ve thong tin hien thi chung (ten don vi, dong
 * chan trang) doc TU .env - dung cho man hinh Kiosk boc so (/kiosk) hien o header/footer thay vi
 * hard-code cung code, de moi don vi trien khai tu doi ten/dong chu ma khong can sua code.
 *
 * Doc "tuoi" moi lan goi (khong cache trong bo nho), giong cach lam voi kioskConfig.js - neu sua
 * .env roi khoi dong lai server thi ap dung ngay, khong can build lai gi ca.
 */

/**
 * Chuan hoa duong dan anh nguoi dung khai trong .env: neu quen go dau "/" (vi du go
 * "kiosk/assets/logo.png" thay vi "/kiosk/assets/logo.png") thi TU DONG THEM VAO, tranh loi
 * duong dan sai khien anh khong tai duoc (404 lang le, khong bao loi ro rang) chi vi thieu 1 ky
 * tu "/" - loi rat de mac phai va kho nhan ra khi tu cau hinh. Giu nguyen neu la URL tuyet doi
 * (http(s)://...), phong truong hop dat anh o noi khac ngoai thu muc public/ cua du an.
 */
function normalizeImagePath(rawValue) {
  const v = rawValue?.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return v.startsWith('/') ? v : `/${v}`;
}

// Ghi nho CAC duong dan da canh bao ROI (theo tien trinh server, mat khi khoi dong lai) - tranh
// spam console moi lan trinh duyet goi /api/branding (kiosk tu goi lai khi tai trang), chi canh
// bao 1 LAN cho moi gia tri duong dan sai khac nhau.
const warnedMissingPaths = new Set();

/**
 * Kiem tra file anh THAT SU co ton tai trong thu muc public/ khong - neu KHONG, in canh bao ra
 * console cua server (KHONG lam loi request, kiosk van chay binh thuong, chi la thieu anh) - giup
 * nguoi quan tri PHAT HIEN NGAY loi cau hinh (sai duong dan/quen bo file vao) thay vi phai doan mo
 * qua trieu chung "logo khong hien tren man hinh/khong in ra" ma khong ro nguyen nhan.
 */
function warnIfImageMissing(publicPath, envVarName) {
  if (!publicPath || /^https?:\/\//i.test(publicPath) || warnedMissingPaths.has(publicPath)) return;
  const filePath = path.join(getAppRoot(), 'public', publicPath.replace(/^\/+/, ''));
  if (!fs.existsSync(filePath)) {
    warnedMissingPaths.add(publicPath);
    console.warn(
      `[branding] CẢNH BÁO: ${envVarName}="${publicPath}" trong .env nhưng KHÔNG TÌM THẤY file tại ` +
      `"${filePath}". Ảnh sẽ KHÔNG hiển thị trên màn hình/phiếu in. Kiểm tra lại đường dẫn và đảm bảo ` +
      `đã đặt đúng file ảnh vào thư mục public/ của dự án.`
    );
  }
}

// Danh sach ma "mau man hinh" hop le cho /patient-screen (PATIENT_SCREEN_THEME trong .env) - xem
// applyPatientScreenTheme() trong public/patient-screen/index.html de biet noi dung tung mau.
// 'default' = khong trang tri gi them (giao dien gon nhu cu, sidebar 2 ben an di).
const VALID_PATIENT_SCREEN_THEMES = new Set([
  'default',
  'tet',
  'doctors_day',
  'national_day',
  'apr30_may1',
  'hung_king',
]);

/**
 * PATIENT_SCREEN_NUMBER_FONT_SCALE: % phong to chu so thu tu tren /patient-screen so voi mac dinh
 * (100 = giu nguyen, 130 = to hon 30%...). Chi chap nhan so nguyen/thap phan DUONG trong khoang
 * hop ly (50-300%) - gia tri ngoai khoang hoac khong phai so se BI BO QUA (dung mac dinh 100%)
 * kem canh bao console, tranh 1 gia tri sai (vi du go nham chu) lam vo giao dien (chu qua to tran
 * man hinh, hoac qua nho khong doc duoc).
 */
function parseNumberFontScalePercent(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) return 100;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 50 || n > 300) {
    console.warn(
      `[branding] CẢNH BÁO: PATIENT_SCREEN_NUMBER_FONT_SCALE="${trimmed}" không hợp lệ (cần là số ` +
      `từ 50 đến 300, đơn vị %) - dùng giá trị mặc định 100% thay thế.`
    );
    return 100;
  }
  return n;
}

function brandingRouter() {
  const router = express.Router();
  router.get('/', (req, res) => {
    const kioskBackgroundImage = normalizeImagePath(process.env.KIOSK_BACKGROUND_IMAGE);
    const kioskLogoImage = normalizeImagePath(process.env.KIOSK_LOGO_IMAGE);
    const printLogoImage = normalizeImagePath(process.env.PRINT_LOGO_IMAGE);
    warnIfImageMissing(kioskBackgroundImage, 'KIOSK_BACKGROUND_IMAGE');
    warnIfImageMissing(kioskLogoImage, 'KIOSK_LOGO_IMAGE');
    warnIfImageMissing(printLogoImage, 'PRINT_LOGO_IMAGE');

    const rawTheme = process.env.PATIENT_SCREEN_THEME?.trim() || 'default';
    if (!VALID_PATIENT_SCREEN_THEMES.has(rawTheme)) {
      console.warn(
        `[branding] CẢNH BÁO: PATIENT_SCREEN_THEME="${rawTheme}" không hợp lệ (các giá trị hợp ` +
        `lệ: ${[...VALID_PATIENT_SCREEN_THEMES].join(', ')}) - dùng "default" thay thế.`
      );
    }
    const patientScreenTheme = VALID_PATIENT_SCREEN_THEMES.has(rawTheme) ? rawTheme : 'default';
    const patientScreenNumberFontScale = parseNumberFontScalePercent(process.env.PATIENT_SCREEN_NUMBER_FONT_SCALE);

    res.json({
      clinicName: process.env.CLINIC_NAME?.trim() || 'Hệ thống bắt số',
      footerText: process.env.CLINIC_FOOTER_TEXT?.trim() || '',
      // Dong chan trang THU 2 (tuy chon) - hien them 1 dong duoi dong CLINIC_FOOTER_TEXT o tren,
      // tren man hinh Kiosk boc so (/kiosk) VA tren phieu in (xem CLINIC_FOOTER_TEXT_2 trong
      // .env.example). De trong neu khong can dong thu 2.
      footerText2: process.env.CLINIC_FOOTER_TEXT_2?.trim() || '',
      // Duong dan (tinh tu thu muc public/) toi anh nen man hinh Kiosk boc so - de trong neu
      // khong cau hinh (kiosk se dung nen mau toi mac dinh nhu cu). File anh thuc te dat trong
      // public/ (xem KIOSK_BACKGROUND_IMAGE trong .env.example) de trinh duyet tai duoc truc tiep.
      kioskBackgroundImage,
      // Duong dan (tinh tu thu muc public/) toi anh LOGO cua don vi, hien o header man hinh
      // Kiosk boc so (/kiosk), thay cho icon "chu thap y te" mac dinh - de trong neu khong cau
      // hinh (dung icon mac dinh nhu cu). Xem KIOSK_LOGO_IMAGE trong .env.example.
      kioskLogoImage,
      // Duong dan (tinh tu thu muc public/) toi anh LOGO in tren MAU PHIEU IN so thu tu (dau
      // phieu, phia tren ten don vi) - de trong neu khong cau hinh (phieu in khong co logo, nhu
      // cu). Xem PRINT_LOGO_IMAGE trong .env.example.
      printLogoImage,
      // % phong to chu SO THU TU tren /patient-screen (100 = mac dinh, khong doi). Xem
      // PATIENT_SCREEN_NUMBER_FONT_SCALE trong .env.example va bien CSS --number-font-scale trong
      // public/patient-screen/index.html.
      patientScreenNumberFontScale,
      // Mau trang tri sidebar 2 ben cua /patient-screen (mac dinh 'default' = khong trang tri,
      // giu nguyen giao dien gon nhu cu). Xem PATIENT_SCREEN_THEME trong .env.example va
      // applyPatientScreenTheme() trong public/patient-screen/index.html.
      patientScreenTheme,
    });
  });
  return router;
}

module.exports = brandingRouter;
