const express = require('express');

/**
 * manifest.json RIENG cho /patient-screen - phai la route DONG (khong phai file tinh nhu cac
 * man hinh khac) vi trang nay BAT BUOC can tham so ?counter=ID tren URL de biet dang hien thi
 * quay nao (khong co tham so nay se bao loi "Khong tim thay quay" - xem public/patient-screen/
 * index.html). Neu dung 1 file manifest.json tinh chung cho moi quay, "start_url" se KHONG the
 * mang theo ?counter=ID rieng cua tung quay, dan toi ung dung "cai vao man hinh chinh" tu 1 quay
 * cu the se mo LAI SAI/RONG khi bam icon tren man hinh chinh.
 *
 * Cach hoat dong: public/patient-screen/index.html tu dong noi them "location.search" (chinh la
 * "?counter=ID" dang co tren URL hien tai) vao sau duong dan manifest.json truoc khi trinh duyet
 * doc file nay (xem script nho ngay sau the <link rel="manifest">) - vi vay route nay chi can doc
 * lai query "counter" tu chinh request toi no de dung dung vao "start_url" tra ve.
 */
function patientScreenManifestRouter() {
  const router = express.Router();
  router.get('/manifest.json', (req, res) => {
    const counterId = req.query.counter ? String(req.query.counter).trim() : '';
    const startUrl = counterId ? `/patient-screen/?counter=${encodeURIComponent(counterId)}` : '/patient-screen/';
    res.json({
      name: 'Màn hình bệnh nhân - Quầy',
      short_name: 'Màn hình quầy',
      start_url: startUrl,
      scope: '/patient-screen/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#f3f6fb',
      theme_color: '#f3f6fb',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    });
  });
  return router;
}

module.exports = patientScreenManifestRouter;
