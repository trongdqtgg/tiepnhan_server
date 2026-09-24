/**
 * Service Worker TOI GIAN cho /staff-kiosk - CHI de trang du dieu kien "cai vao man hinh chinh"
 * (installable PWA) tren Android/Chrome, KHONG cache bat cu file nao ca (moi request van di thang
 * qua mang nhu binh thuong). Ly do CHU DONG khong cache: day la he thong quan ly hang cho THOI
 * GIAN THUC (so lieu, danh sach uu tien... thay doi lien tuc) - neu cache file HTML/JS cu se rat
 * nguy hiem (nhan vien mo app da "cai" ra co the bi ket o phien ban CU sau khi ban cap nhat may
 * chu, ma khong biet vi sao). Vi vay o day CHI dang ky "fetch" handler rong (bat buoc phai co de
 * duoc tinh la PWA hop le) roi luon nhuong lai cho mang (network) xu ly binh thuong.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Khong can respondWith() gi ca - de trinh duyet tu xu ly nhu khong co service worker (luon lay
  // du lieu MOI NHAT tu may chu, khong bao gio dung ban cache cu).
});
