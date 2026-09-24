/**
 * Module dung chung: mo APP CAMERA GOC cua dien thoai/may tinh bang (qua the <input type="file"
 * capture>, KHONG dung navigator.mediaDevices.getUserMedia) de nhan vien CHUP 1 TAM ANH chua ma
 * QR CCCD/BHYT, roi tu doc ma QR tu tam anh do bang thu vien jsQR (public/vendor/jsQR.min.js -
 * phai duoc nap TRUOC file nay).
 *
 * VI SAO CHON CACH NAY (thay vi xem camera truc tiep lien tuc): xem camera truc tiep can goi
 * navigator.mediaDevices.getUserMedia(), API nay CHI hoat dong khi trang chay qua HTTPS hoac dung
 * "localhost" tren chinh thiet bi (quy dinh bao mat chuan cua moi trinh duyet, khong co ngoai le
 * cho dia chi IP mang LAN thuong nhu http://192.168.x.x). Con <input type="file" capture> la
 * CHUYEN GIAO SANG APP CAMERA CO SAN CUA HE DIEU HANH (khong phai xem video ngay trong trang) nen
 * KHONG bi rang buoc nay - chay binh thuong tren http:// thuong, khong can cau hinh HTTPS/chung
 * chi gi ca. Doi lai: nhan vien phai BAM CHUP 1 lan cho moi lan quet (khong tu dong do lien tuc
 * nhu xem truc tiep), nhung doi lai don gian hoa toi da, dung duoc ngay tren moi thiet bi.
 *
 * Cach dung:
 *   CameraScan.open({
 *     onStatus: (text) => { ... cap nhat dong trang thai (vi du "Đang đọc mã QR từ ảnh...") ... },
 *     onResult: (text) => { ... xu ly noi dung QR vua doc duoc tu anh ... },
 *     onCancel: () => { ... nguoi dung bam Huỷ trong app Camera, khong chup gi ... },
 *     onError: (reason, err) => { ... khong doc duoc QR tu anh (reason: 'not_found' | 'unsupported' | 'other') ... },
 *   });
 */
(function () {
  let inputEl = null; // input "chup anh" - uu tien mo camera tren dien thoai/may tinh bang
  let galleryInputEl = null; // input "chon anh co san" - KHONG goi y camera, luon mo hop thoai chon file
  let currentOpts = null;

  function isSupported() {
    return typeof document !== 'undefined' && typeof window.File !== 'undefined' && typeof window.FileReader !== 'undefined';
  }

  function createFileInput(withCapture) {
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = 'image/*';
    if (withCapture) {
      // "environment" = uu tien camera SAU (mat sau may) - phu hop chup giay to/the truoc mat,
      // thay vi camera truoc (selfie). Tren desktop khong co camera/khong ho tro capture, trinh
      // duyet se tu dong bo qua thuoc tinh nay va mo hop thoai chon FILE co san nhu binh thuong.
      el.setAttribute('capture', 'environment');
    }
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.addEventListener('change', handleChange);
    return el;
  }

  function ensureInput() {
    if (!inputEl) inputEl = createFileInput(true);
    return inputEl;
  }

  /**
   * Input "Tải ảnh QR lên" - danh cho truong hop nhan vien DA CO SAN 1 tam anh chua ma QR (vi du
   * anh chup man hinh, anh nhan qua Zalo/tin nhan...) thay vi phai chup moi. KHONG dat thuoc tinh
   * "capture" de tren dien thoai/may tinh bang trinh duyet mo THU VIEN ANH (gallery) thay vi nhay
   * thang vao app Camera - tren desktop ca 2 input deu mo cung 1 hop thoai chon file nhu nhau.
   */
  function ensureGalleryInput() {
    if (!galleryInputEl) galleryInputEl = createFileInput(false);
    return galleryInputEl;
  }

  /**
   * ===== CHIEN LUOC DOC MA QR TU ANH CHUP THUC TE (da kiem chung tren nhieu anh that) =====
   *
   * Anh chup TRUC TIEP tu the/giay (CCCD that) thuong doc duoc ngay o do phan giai goc. Nhung co
   * 3 kieu anh KHO doc hon rat hay gap trong thuc te, moi kieu can 1 cach xu ly khac nhau:
   *
   * 1) Anh chup LAI 1 man hinh khac dang HIEN QR (vi du chup man hinh dien thoai dang mo app VNeID,
   *    hoac chup lai the BHYT dang hien tren man hinh may tinh): luoi diem anh cua man hinh kia
   *    chong len ma QR tao ra HOA VAN MOIRE, pha vo buoc "nhi phan hoa" (phan biet den/trang) cua
   *    jsQR. Cach khac: THU LAI o NHIEU DO PHAN GIAI THU NHO DAN (thu nho = loc thong thap tu
   *    nhien, xoa hoa van moire tan so cao, giu lai hoa tiet QR tan so thap hon), hoac lam MO
   *    (blur) nhe truoc/trong luc thu nho de xoa hoa van moire manh hon.
   *
   * 2) The CCCD that nhung mat the co hoa tiet nen/hoa van bao mat (van tay, hinh nen mo) chay
   *    NGANG QUA vung ma QR - hoa tiet nen nay lam nhieu "nen" (background noise) khien buoc nhi
   *    phan hoa tu dong (adaptive) cua jsQR bi lech. Cach khac: chuyen anh ve XAM (grayscale),
   *    KEO DAN TUONG PHAN (normalize/contrast-stretch) roi AP NGUONG CO DINH (fixed threshold) o
   *    nhieu muc khac nhau de "ep" hoa tiet nen mo di, chi giu lai hoa tiet QR (den/trang ro net).
   *
   * 3) Ma QR chi la 1 PHAN NHO trong khung hinh lon (vi du chup ca tam the/dien thoai, ma QR chi
   *    chiem 1 goc) - khi thu nho ca anh lon ve kich thuoc du de xu ly nhanh, vung ma QR tro nen
   *    QUA NHO (mat chi tiet cac o vuong), hoac cac buoc xu ly TREN TOAN ANH (normalize/threshold
   *    tinh theo do sang/toi CUA CA KHUNG HINH) bi anh huong boi cac vung khac xa ma QR (nen sang/
   *    toi khac nhau trong cung 1 anh do anh sang khong deu). Cach khac: chia anh thanh NHIEU
   *    VUNG NHO CHONG LAN NHAU (vi du luoi 3x3, moi vung chong khoang 50% vung ben canh de khong
   *    bao gio "cat" dung giua ma QR), roi xu ly rieng TUNG VUNG - lam cho ma QR trong vung do
   *    chiem ty le lon hon va tranh bi anh huong boi anh sang/hoa tiet o xa.
   *
   * Vi ca 3 van de tren co the xay ra DONG THOI tren cung 1 anh (vi du: anh chup man hinh dien
   * thoai, ma QR chi chiem 1 goc, VA bi moire) nen thuat toan duoi day KET HOP CA 3: chia vung ->
   * moi vung thu lan luot 3 "tang" xu ly (thu nho don gian -> nguong sau khi keo tuong phan ->
   * lam mo). De uu tien TOC DO cho truong hop de (da so anh thuc te), thu tang 1 (nhanh nhat) tren
   * TAT CA cac vung TRUOC, chi khi khong vung nao thanh cong moi chuyen sang tang 2 roi tang 3
   * tren tat ca cac vung (uu tien "de truoc, kho sau" thay vi "vung nay lam het 3 tang roi moi
   * qua vung khac", giup tra ket qua nhanh nhat co the cho da so truong hop).
   */

  // QUAN TRONG VE TOC DO: da do dac thuc te - thoi gian jsQR xu ly 1 anh KHONG ti le tuyen tinh
  // voi so diem anh, ma TANG VOT o cac kich thuoc lon (vi du ~30ms o 600px nhung ~550ms o 900px,
  // dac biet khi KHONG co QR trong vung dang xu ly - truong hop pho bien nhat vi da so vung/tang
  // thu se khong chua QR). Vi thuat toan duyet nhieu vung x nhieu tang, moi "kich thuoc lon" them
  // vao se nhan len rat nhieu lan tren toan bo qua trinh - nen CHU DONG GIOI HAN kich thuoc toi
  // da o muc vua du (~600-700px), KHONG dung 900px+ tru truong hop that su can thiet.

  // Tang 1 (nhanh): chi thu nho don gian, khong xu ly them.
  const TIER1_MAX_DIMENSIONS = [600, 400];
  // Tang 2 (trung binh): xam + keo tuong phan + nguong co dinh, o vai do phan giai va vai muc nguong.
  // (110 la muc hay thanh cong nhat tren thuc te - dat dau tien de tra ket qua nhanh hon o da so
  // truong hop, nhung van giu them 1 muc du phong cho anh sang/toi khac nhau).
  const TIER2_MAX_DIMENSIONS = [600, 500];
  const TIER2_THRESHOLDS = [110, 150];
  // Tang 3 (cham nhat, cho truong hop moire nang): lam mo nhe truoc khi doc. Chi dung 700px (KHONG
  // dung 900px vi qua cham - xem giai thich o tren) - da kiem chung 700px van du de xu ly cac
  // truong hop moire nang thuc te.
  const TIER3_MAX_DIMENSIONS = [700];
  const TIER3_BLUR_PX = [1.5, 2];

  /** Chia anh thanh: ca anh + luoi 3x3 cac vung chong lan ~50%, uu tien vung giua/goc pho bien. */
  function buildRegions(imgW, imgH) {
    const regions = [{ left: 0, top: 0, width: imgW, height: imgH }];
    const cols = 3, rows = 3;
    const tileW = Math.ceil((imgW / cols) * 1.5);
    const tileH = Math.ceil((imgH / rows) * 1.5);
    const stepX = imgW / cols;
    const stepY = imgH / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * stepX;
        const cy = (r + 0.5) * stepY;
        const left = Math.max(0, Math.min(imgW - 1, Math.round(cx - tileW / 2)));
        const top = Math.max(0, Math.min(imgH - 1, Math.round(cy - tileH / 2)));
        const width = Math.min(tileW, imgW - left);
        const height = Math.min(tileH, imgH - top);
        if (width > 20 && height > 20) regions.push({ left, top, width, height });
      }
    }
    return regions;
  }

  /**
   * Thu nho anh ve maxDim, dung ky thuat "mipmap" (giam dan tung buoc ~50% thay vi 1 buoc lon tu
   * kich thuoc goc xuong thang kich thuoc dich). LY DO: khi ty le thu nho rat lon (vi du anh chup
   * 1920x2560 thu ve 350px), thuat toan resize 1-buoc mac dinh cua trinh duyet (drawImage) loc
   * tan so cao KEM HON NHIEU so voi thu vien xu ly anh chuyen dung (vi du sharp/libvips dung
   * Lanczos) - da kiem chung thuc te: cung 1 anh, cung kich thuoc dich, ban resize 1-buoc cua
   * canvas VAN CON SOT lai hoa van moire ro, trong khi ban resize nhieu-buoc (moi buoc giam ~50%,
   * co bat imageSmoothingQuality='high') cho ket qua sach hon han, du de doc duoc ma QR ma ban
   * 1-buoc khong doc duoc.
   */
  function drawRegionScaled(img, region, maxDim, blurPx) {
    // Buoc dau: CAT vung can dung ra 1 canvas rieng o DUNG kich thuoc goc (khong thu nho gi ca) -
    // lam vay thay vi vua cat vua thu nho trong 1 lan drawImage() tu <img> goc, vi da kiem chung
    // thuc te: cat truoc roi moi thu nho dan tung buoc cho ket qua ON DINH/SACH HON (it hoa van
    // moire con sot) so voi cat+thu nho gop chung trong cung 1 buoc dau tien.
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = region.width;
    cropCanvas.height = region.height;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(img, region.left, region.top, region.width, region.height, 0, 0, region.width, region.height);
    let cur = cropCanvas;
    let sx = 0, sy = 0, sw = region.width, sh = region.height;
    // Giam dan tung buoc ~50% cho toi khi con gap doi kich thuoc dich, sau do buoc cuoi resize
    // thang ve dung maxDim (tranh lam tron sai so qua nhieu buoc nho).
    while (Math.max(sw, sh) > maxDim * 2) {
      const nw = Math.max(1, Math.round(sw / 2));
      const nh = Math.max(1, Math.round(sh / 2));
      const step = document.createElement('canvas');
      step.width = nw;
      step.height = nh;
      const stepCtx = step.getContext('2d');
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(cur, sx, sy, sw, sh, 0, 0, nw, nh);
      cur = step;
      sx = 0;
      sy = 0;
      sw = nw;
      sh = nh;
    }
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (blurPx) ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(cur, sx, sy, sw, sh, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  /** Xam hoa + keo dan tuong phan (min-max normalize) + ap nguong co dinh -> anh nhi phan den/trang. */
  function binarize(imageData, threshold) {
    const { data, width, height } = imageData;
    const n = width * height;
    const lum = new Float32Array(n);
    let min = 255;
    let max = 0;
    for (let i = 0, p = 0; p < n; i += 4, p++) {
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      lum[p] = l;
      if (l < min) min = l;
      if (l > max) max = l;
    }
    const range = Math.max(1, max - min);
    const out = new Uint8ClampedArray(data.length);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const norm = ((lum[p] - min) / range) * 255;
      const v = norm >= threshold ? 255 : 0;
      out[i] = v;
      out[i + 1] = v;
      out[i + 2] = v;
      out[i + 3] = 255;
    }
    return new ImageData(out, width, height);
  }

  function runJsQr(imageData) {
    if (!window.jsQR) return null;
    return window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  }

  function decodeRegionTier1(img, region) {
    for (const maxDim of TIER1_MAX_DIMENSIONS) {
      const code = runJsQr(drawRegionScaled(img, region, maxDim, 0));
      if (code && code.data) return code.data;
    }
    return null;
  }

  function decodeRegionTier2(img, region) {
    for (const maxDim of TIER2_MAX_DIMENSIONS) {
      const imageData = drawRegionScaled(img, region, maxDim, 0);
      for (const thresh of TIER2_THRESHOLDS) {
        const code = runJsQr(binarize(imageData, thresh));
        if (code && code.data) return code.data;
      }
    }
    return null;
  }

  function decodeRegionTier3(img, region) {
    for (const maxDim of TIER3_MAX_DIMENSIONS) {
      for (const blurPx of TIER3_BLUR_PX) {
        const code = runJsQr(drawRegionScaled(img, region, maxDim, blurPx));
        if (code && code.data) return code.data;
      }
    }
    return null;
  }

  function decodeQrFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          if (!window.jsQR) {
            resolve(null);
            return;
          }
          const regions = buildRegions(img.naturalWidth, img.naturalHeight);
          // "De truoc, kho sau": chay tang 1 (nhanh) tren TAT CA vung truoc, roi moi den tang 2,
          // roi tang 3 - de tra ket qua nhanh nhat co the cho da so anh (chi anh thuc su kho moi
          // phai cham den cac tang xu ly nang hon).
          for (const region of regions) {
            const text = decodeRegionTier1(img, region);
            if (text) { resolve(text); return; }
          }
          for (const region of regions) {
            const text = decodeRegionTier2(img, region);
            if (text) { resolve(text); return; }
          }
          for (const region of regions) {
            const text = decodeRegionTier3(img, region);
            if (text) { resolve(text); return; }
          }
          resolve(null); // thu het van khong doc duoc - that su khong co/khong ro QR trong anh
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  async function handleChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // reset de lan sau chon/chup LAI CUNG 1 anh van kich hoat duoc 'change'
    const opts = currentOpts;
    currentOpts = null;
    if (!opts) return;

    if (!file) {
      opts.onCancel && opts.onCancel(); // nhan vien bam Huỷ trong app Camera, khong chup gi
      return;
    }

    opts.onStatus && opts.onStatus('Đang đọc mã QR từ ảnh vừa chụp...');
    try {
      const text = await decodeQrFromFile(file);
      if (text) {
        opts.onResult && opts.onResult(text);
      } else {
        opts.onError && opts.onError('not_found');
      }
    } catch (err) {
      opts.onError && opts.onError('other', err);
    }
  }

  function open(opts) {
    if (!isSupported()) {
      opts && opts.onError && opts.onError('unsupported');
      return;
    }
    currentOpts = opts || {};
    // opts.gallery = true -> mo hop thoai "chon anh co san" (khong goi y camera) - xem
    // ensureGalleryInput() o tren. Mac dinh (khong truyen, hoac false) van la mo camera nhu cu.
    const input = opts && opts.gallery ? ensureGalleryInput() : ensureInput();
    input.click();
  }

  function close() {
    // Khong co modal/stream nao dang chay de don dep (chi la 1 hop thoai he dieu hanh) - giu ham
    // nay de tuong thich API, phong khi ma goi phia tren co goi close() 1 cach an toan.
  }

  window.CameraScan = { isSupported, open, close };
})();
