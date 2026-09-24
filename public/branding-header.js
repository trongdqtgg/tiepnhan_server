/**
 * Dung chung cho cac man hinh CHI XEM (khong thao tac, khong yeu cau dang nhap) nhu
 * /waiting-screen va /patient-screen: doc thong tin don vi tu .env qua API /api/branding roi dien
 * logo/ten don vi vao header va dong chan trang thu 2 vao footer - dung CHUNG 1 bo id co dinh
 * tren trang HTML goi script nay (xem class .app-header/.app-footer trong common.css va cach dat
 * id trong waiting-screen/index.html, patient-screen/index.html):
 *   #appBrandIcon    - icon mac dinh (chu thap y te), an di khi co logo that
 *   #appLogoImg      - the <img> logo that (KIOSK_LOGO_IMAGE trong .env)
 *   #appClinicName   - ten don vi (CLINIC_NAME)
 *   #appFooterText   - dong chan trang 1 (CLINIC_FOOTER_TEXT)
 *   #appFooterText2  - dong chan trang 2, chu to + mau xanh (CLINIC_FOOTER_TEXT_2)
 * Trang nao thieu 1/vai id tren thi phan tuong ung don gian bi bo qua (co kiem tra ton tai truoc
 * khi dung), khong gay loi.
 *
 * Sau khi tai xong, PHAT (dispatch) 1 su kien tuy chinh "branding:loaded" kem toan bo du lieu tra
 * ve tu /api/branding trong `event.detail` - de cac trang CAN THEM du lieu rieng khong co trong bo
 * id co dinh o tren (vi du /patient-screen can `patientScreenTheme`/`patientScreenNumberFontScale`
 * de trang tri sidebar/phong to chu so) co the tu lang nghe va xu ly TIEP, ma KHONG can goi lai
 * /api/branding lan thu 2 (dung chung 1 lan goi API duy nhat).
 *
 * QUAN TRONG (tranh loi "hen gio" - race condition): script nay duoc nap TRUOC cac script rieng
 * cua tung trang (vi du inline script trong patient-screen/index.html) trong the <head>/<body>, nen
 * ve nguyen tac fetch() o day co the tra ve VA phat xong su kien "branding:loaded" TRUOC KHI trang
 * kip chay toi dong dang ky window.addEventListener('branding:loaded', ...) - luc do trang se KHONG
 * BAO GIO nhan duoc su kien (bo lo hoan toan), du van con thay do vi thuc te da tung dung 1 lan cho
 * doi mang cham hon. De trang lang nghe SAU luon lay duoc du lieu du gia hay muon, luu lai ket qua
 * vao `window.__brandingData` NGAY KHI co - trang nao dang ky listener tre hon fetch() vẫn co the tu
 * kiem tra bien nay sau khi dang ky (xem vi du trong patient-screen/index.html).
 */
(async function applyBrandingHeaderFooter() {
  const iconEl = document.getElementById('appBrandIcon');
  const logoEl = document.getElementById('appLogoImg');
  const nameEl = document.getElementById('appClinicName');
  const footerEl = document.getElementById('appFooterText');
  const footer2El = document.getElementById('appFooterText2');
  try {
    const res = await fetch('/api/branding');
    const data = await res.json();
    if (nameEl) nameEl.textContent = data.clinicName || 'Hệ thống bắt số';
    if (data.kioskLogoImage && logoEl && iconEl) {
      logoEl.src = data.kioskLogoImage;
      logoEl.style.display = '';
      iconEl.style.display = 'none';
    }
    if (footerEl) footerEl.textContent = data.footerText || '';
    if (footer2El) {
      footer2El.textContent = data.footerText2 || '';
      footer2El.style.display = data.footerText2 ? '' : 'none';
    }
    window.__brandingData = data;
    window.dispatchEvent(new CustomEvent('branding:loaded', { detail: data }));
  } catch {
    // Khong lay duoc (vi du mat mang tam thoi) -> giu nguyen text mac dinh co san trong HTML.
    // KHONG phat su kien "branding:loaded" trong truong hop nay - cac trang lang nghe (vi du
    // /patient-screen) se tu giu nguyen mau/co chu mac dinh, khong co gi de ap dung ca.
  }
})();
