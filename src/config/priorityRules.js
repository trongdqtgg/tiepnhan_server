/**
 * Cau hinh cac doi tuong uu tien va thu hang goi so.
 * rank cang nho thi cang duoc goi truoc (0 = binh thuong, uu tien thap nhat).
 * Thu tu ranking nay chinh la thu tu ma nguoi dung da chot trong qua trinh thiet ke.
 *
 * Muon doi thu tu uu tien sau nay -> chi can sua so "rank" o day,
 * KHONG can dong vao logic goi so trong ticketService.js
 */

const MERIT_BHYT_PREFIXES = ['CC', 'CK', 'CB', 'KC', 'TC', 'TD'];

/**
 * BIEN MOI: PRIORITY_MODE (doc tu .env, xem .env.example) - cho phep chuyen ca he thong giua 2
 * "bo quy tac" doi tuong uu tien khac nhau ma KHONG can sua code o bat ky noi nao khac, vi TOAN
 * BO phan con lai cua he thong (server: ticketService.js, routes/tickets.js, routes/counters.js;
 * client: kiosk.js, staff-kiosk.js, counter.js, public/counter/widget/widget.js,
 * patient-screen/waiting-screen) deu da duoc thiet ke tu truoc de doc DANH SACH doi tuong uu tien
 * HOAN TOAN dong (qua API /api/priority-rules, /api/tickets/staff-options...) thay vi hardcode
 * cung 1 danh sach 7 loai co dinh - nen chi can doi GIA TRI cua PRIORITY_RULES o ngay duoi day la
 * moi noi khac tu dong "an theo" ca ve so luong nut/mau/nhan hien thi lan logic xep hang goi so.
 *
 *   PRIORITY_MODE=full  (mac dinh, khong dat gi hoac dat sai gia tri cung roi ve full) - GIU
 *     NGUYEN 7 loai doi tuong uu tien chi tiet nhu tu truoc den nay (Cấp cứu, ≥75 tuổi, Trẻ em
 *     dưới 6 tuổi, Phụ nữ có thai, Khuyết tật đặc biệt nặng, Khuyết tật nặng, Có công với cách
 *     mạng) + Đối tượng thường.
 *   PRIORITY_MODE=basic - GOP CA 7 loai tren THANH 1 MA DUY NHAT "PRIORITY" ("Ưu tiên") - danh
 *     cho phong kham/don vi khong can phan loai chi tiet ly do uu tien, chi can phan biet 2 luong
 *     don gian: "Ưu tiên" / "Đối tượng thường" o TAT CA man hinh (kiosk boc so cho benh nhan,
 *     kiosk cap so cho nhan vien, man hinh quay goi so, widget sieu nho, man hinh cho/man hinh
 *     benh nhan).
 *
 * Doi gia tri: sua .env roi KHOI DONG LAI server ("npm start") de ap dung (doc process.env 1 LAN
 * DUY NHAT luc module nay duoc require lan dau, giong cach PORT/SQLITE_FILE... duoc doc trong
 * server.js - khac voi vai bien khac trong file nay nhu STAFF_PASSWORD duoc doc lai moi lan goi
 * ham, vi PRIORITY_MODE anh huong ca hinh dang cua PRIORITY_RULES - 1 hang so duoc du 1 modun
 * khac import truc tiep gia tri (khong phai qua ham), khong the "doc lai" giua chung duoc).
 */
const PRIORITY_MODE = (process.env.PRIORITY_MODE || 'full').trim().toLowerCase() === 'basic' ? 'basic' : 'full';

// Mau sac rieng cho tung doi tuong, dung thong nhat o man hinh quay va man hinh benh nhan
// de nhan dien nhanh loai uu tien bang mau so, kem chu thich ro rang o ca 2 man hinh.
// `shortLabel` (nhan viet tat 2 chu cai) dung cho cac cho giao dien qua nho khong the hien ca
// cum tu day du (vi du 8 nut "Cấp số nhanh" tren widget sieu nho, xem
// public/counter/widget/widget.js) - CHUYEN tu HTML tinh (truoc day) sang cau hinh o day, giup
// widget tu ve dung so nut/nhan theo dung PRIORITY_MODE ma khong can sua rieng file HTML/JS nao.
const FULL_PRIORITY_RULES = [
  {
    code: 'EMERGENCY',
    rank: 0,
    label: 'Cấp cứu',
    shortLabel: 'CC',
    color: '#dc2626', // do dam - cao nhat, tren ca AGE75
    // KHONG bao gio hien cho benh nhan tu chon o kiosk cong khai (eligible luon false) -
    // chi Nhan vien moi duoc cap qua kiosk-nhan-vien (xem getAllOptionsForStaff), khong can
    // xac minh qua QR.
    eligible: () => false,
    selfDeclare: false,
    staffOnly: true,
  },
  {
    code: 'AGE75',
    rank: 1,
    label: '≥ 75 tuổi',
    shortLabel: 'NG',
    color: '#f97316', // cam
    // p = { cccd, bhyt } da duoc parse tu QR (co the null neu khong quet)
    eligible: (p) => p.cccd?.age != null && p.cccd.age >= 75,
    selfDeclare: false,
  },
  {
    code: 'CHILD6',
    rank: 2,
    label: 'Trẻ em dưới 06 tuổi',
    shortLabel: 'TE',
    color: '#38bdf8', // xanh duong nhat
    eligible: (p) => p.cccd?.age != null && p.cccd.age < 6,
    selfDeclare: false,
  },
  {
    code: 'PREGNANT',
    rank: 3,
    label: 'Phụ nữ có thai',
    shortLabel: 'PN',
    color: '#f472b6', // hong
    // chi hien nut neu gioi tinh la nu (tu CCCD hoac BHYT), con viec co thai hay khong la tu khai
    eligible: (p) => p.cccd?.gender === 'F' || p.bhyt?.gioiTinhCode === '2',
    selfDeclare: true,
  },
  {
    code: 'DISAB_EXTREME',
    rank: 4,
    label: 'Người khuyết tật đặc biệt nặng',
    shortLabel: 'KĐ',
    color: '#fb7185', // hong do (khac voi do cua Cap cuu #dc2626 de khong nham lan)
    eligible: () => true, // luon hien, tu khai, nhan vien doi chieu giay to
    selfDeclare: true,
  },
  {
    code: 'DISAB_SEVERE',
    rank: 5,
    label: 'Người khuyết tật nặng',
    shortLabel: 'KT',
    color: '#eab308', // vang gold
    eligible: () => true,
    selfDeclare: true,
  },
  {
    code: 'MERIT_BHYT',
    rank: 6,
    label: 'Người có công với cách mạng',
    shortLabel: 'CM',
    color: '#a78bfa', // tim
    eligible: (p) => {
      if (!p.bhyt) return false;
      if (p.bhyt.isFullCode) return p.bhyt.congCachMangAuto; // xac dinh chac chan qua tien to the
      return true; // the chi co ma so 10 so -> khong xac dinh duoc -> van cho tu khai
    },
    selfDeclare: (p) => !p.bhyt?.isFullCode,
  },
];

/**
 * Bo quy tac RUT GON (PRIORITY_MODE=basic) - GOP CA 7 loai o FULL_PRIORITY_RULES tren thanh 1 ma
 * "PRIORITY" duy nhat. `eligible()` o day HOP tat ca dieu kien co the TU DONG xac dinh duoc qua
 * tuoi tren CCCD (≥75 tuoi hoac <6 tuoi) - dung DE Y NGHIA GIONG HET truoc day tai Kiosk cong khai
 * (/kiosk): trang do KHONG hien man hinh cho benh nhan tu chon/tu khai (xem goToPriorityStep()
 * trong public/kiosk/kiosk.js), CHI tu dong xep vao dien uu tien qua tuoi - cac ly do "tu khai"
 * khac cua ban FULL (mang thai, khuyet tat, co cong, cap cuu) KHONG tu dong duoc, van CHI danh
 * cho Nhan vien tu quyet dinh/chon o Kiosk cap so - Nhan vien (/staff-kiosk), noi
 * getAllOptionsForStaff() ben duoi LUON tra ve du ca "PRIORITY" (KHONG loc theo eligible()) de
 * nhan vien co the cap nhanh cho BAT KY ly do uu tien nao (kha ca cap cuu) chi voi 1 nut duy
 * nhat, dung tinh than "chỉ có ưu tiên và không ưu tiên" theo yeu cau.
 */
const BASIC_PRIORITY_RULES = [
  {
    code: 'PRIORITY',
    rank: 1,
    label: 'Ưu tiên',
    shortLabel: 'ƯT',
    color: '#dc2626', // do dam - dung mau noi bat GIONG EMERGENCY cu, vi gio la ma "uu tien" chung duy nhat
    eligible: (p) => p.cccd?.age != null && (p.cccd.age >= 75 || p.cccd.age < 6),
    selfDeclare: true,
  },
];

const PRIORITY_RULES = PRIORITY_MODE === 'basic' ? BASIC_PRIORITY_RULES : FULL_PRIORITY_RULES;

// Rank cua doi tuong thuong phai LON HON tat ca rank uu tien (1..6) de khi sort tang dan
// theo priority_rank, cac ve uu tien luon duoc xep truoc, ve thuong bi day xuong cuoi hang doi.
const NORMAL_RULE = { code: 'NORMAL', rank: 999, label: 'Đối tượng thường', shortLabel: 'TT', color: '#4b5563' }; // den nhat (xam dam), thay cho trang xam truoc day de de phan biet hon

/**
 * Tra ve danh sach cac lua chon uu tien ma benh nhan DUOC PHEP chon,
 * dua tren du lieu da quet (p.cccd, p.bhyt co the null neu khong quet giay to nao).
 */
function getEligibleOptions(p) {
  return PRIORITY_RULES.filter((rule) => rule.eligible(p)).map((rule) => ({
    code: rule.code,
    rank: rule.rank,
    label: rule.label,
    selfDeclare: typeof rule.selfDeclare === 'function' ? rule.selfDeclare(p) : !!rule.selfDeclare,
  }));
}

function getRuleByCode(code) {
  if (code === 'NORMAL') return NORMAL_RULE;
  return PRIORITY_RULES.find((r) => r.code === code) || null;
}

/**
 * Danh sach TOAN BO doi tuong (ke ca "Cấp cứu") de Nhan vien tu chon o kiosk-nhan-vien,
 * KHONG loc theo eligible()/QR - nhan vien duoc quyen cap bat ky loai uu tien nao ma khong
 * can xac minh giay to. Sap xep theo rank (uu tien truoc, doi tuong thuong cuoi cung).
 */
function getAllOptionsForStaff() {
  return [...PRIORITY_RULES, NORMAL_RULE]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({ code: r.code, label: r.label, shortLabel: r.shortLabel, color: r.color }));
}

/**
 * Danh sach {code, label, shortLabel, color} rut gon dung de gui cho frontend (qua API), phuc vu
 * ve mau so va hien chu thich (legend) mau sac o man hinh quay / man hinh benh nhan, VA ve dong
 * cac nut "Cấp số nhanh" tren widget sieu nho (public/counter/widget/widget.js, dung shortLabel
 * lam noi dung nut). Xep theo rank (uu tien truoc), doi tuong thuong xep cuoi cung.
 */
function getDisplayRules() {
  return [...PRIORITY_RULES, NORMAL_RULE]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({ code: r.code, label: r.label, shortLabel: r.shortLabel, color: r.color }));
}

/**
 * Doc ma "code" bi mat rieng cho 1 doi tuong (QUICK_QR_CODE_<code> trong .env) dung de tao/xac
 * thuc QR "cap nhanh" o man hinh /staff-kiosk (xem POST /api/tickets/quick trong
 * src/routes/tickets.js) - doc truc tiep tu process.env MOI LAN GOI (khong cache) giong cach lam
 * voi STAFF_PASSWORD/KIOSK_COOLDOWN_MINUTES, de sua .env + khoi dong lai server la ap dung ngay.
 * Tra ve null neu chua cau hinh (rong) - coi nhu TAT tinh nang cap nhanh cho doi tuong do.
 */
function getQuickQrSecret(code) {
  if (!code) return null;
  const raw = process.env[`QUICK_QR_CODE_${code}`];
  return raw && raw.trim() ? raw.trim() : null;
}

module.exports = {
  PRIORITY_MODE,
  PRIORITY_RULES,
  NORMAL_RULE,
  MERIT_BHYT_PREFIXES,
  getEligibleOptions,
  getRuleByCode,
  getDisplayRules,
  getAllOptionsForStaff,
  getQuickQrSecret,
};
