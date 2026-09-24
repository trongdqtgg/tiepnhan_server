/**
 * IN PHIEU SO THU TU O PHIA TRINH DUYET (client-side), thay vi phia server nhu truoc.
 *
 * LY DO: truoc day viec in duoc thuc hien o SERVER (src/services/printerService.js, thu vien
 * node-thermal-printer) - cach nay CHI hoat dong neu may in duoc gan TRUC TIEP vao dung chiec may
 * dang chay lenh "npm start" (server Node.js), trong khi he thong nay chay theo kieu nhieu man
 * hinh/nhieu may cung ket noi qua mang LAN (kiosk, quay tiep nhan...) - hau het cac may do KHONG
 * PHAI la may chay server, nen may in gan vao may nao thi CHI may do in duoc, cac may kia khong
 * in duoc gi ca. Day la loi kien truc, khong phai loi cau hinh.
 *
 * CHUYEN SANG IN O TRINH DUYET (window.print()) giai quyet dung van de tren: hop thoai in cua
 * trinh duyet luon nhan dien may in da duoc CAI DAT O CAP HE DIEU HANH cua CHINH MAY DANG MO
 * TRANG WEB (khong lien quan gi may chay server), phu hop ca 2 kieu ket noi thuc te:
 *  - May tinh/laptop tai quay tiep nhan hoac kiosk, may in nhiet (vi du Epson TM-...) noi qua
 *    cong USB va da cai driver -> he dieu hanh nhan la 1 may in binh thuong, hop thoai in cua
 *    trinh duyet se thay va chon duoc ngay.
 *  - Dien thoai/may tinh bang, may in nhiet ket noi qua BLUETOOTH va da ghep doi + cai dat dich vu
 *    in (vi du qua ung dung/dich vu in cua hang may in, hoac dich vu in tich hop san cua he dieu
 *    hanh) -> cung hien ra trong hop thoai in cua trinh duyet nhu 1 may in binh thuong.
 *
 * Khi khong co may in nao duoc cai dat (dang test, hoac chua lap may in that), nguoi dung chi can
 * dong hop thoai in lai (bam "Hủy") - he thong van hoat dong binh thuong, khong bat buoc phai in
 * moi tao duoc so.
 */
/**
 * (opts.idQrRaw) MA QR CUA CCCD/BHYT VUA QUET - truoc day dung de IN LAI mot ma QR rieng len phieu
 * giay, nhung tinh nang nay DA BO THEO YEU CAU (phieu in khong con hien mã QR nua). Tham so nay
 * van duoc cac noi goi printReceipt() (kiosk.js, staff-kiosk.js, print-ticket-frame.js) truyen
 * vao nhu cu de tranh sua nhieu noi, nhung printReceipt() KHONG con dung no de ve gi tren phieu.
 *
 * (opts.patientName, opts.patientDob) HO TEN va NGAY SINH cua benh nhan (lay tu ket qua parse QR
 * CCCD/BHYT o buoc quet - xem parseCCCD()/parseBHYT() trong src/services/qrParser.js va cho goi
 * printReceipt() o kiosk.js/staff-kiosk.js) - in ro tren phieu de nhan vien/benh nhan de doi chieu.
 * Neu khong quet giay to (cap so thu cong) thi ca 2 deu rong, 2 dong nay tu dong bo qua.
 *
 * (opts.logoImage) DUONG DAN anh LOGO in o DAU PHIEU, phia tren ten don vi (cau hinh qua
 * PRINT_LOGO_IMAGE trong .env, xem src/routes/branding.js va kiosk.js/staff-kiosk.js noi doc gia
 * tri nay tu API /api/branding roi truyen vao day). De trong/khong co = phieu KHONG co logo (nhu
 * cu). CHO ANH TAI XONG (load/error) TRUOC KHI do chieu cao phieu de in (xem requestAnimationFrame
 * ben duoi) - neu khong, luc do chieu cao se sai (do truoc khi anh kip hien, giong loi da gap voi
 * mã QR truoc day) khien kho giay in tinh thieu, cat mat phan cuoi phieu.
 *
 * (opts.extraLines) MUC 112 - mang cac dong chu in them duoi thong tin benh nhan (vd cau tra loi
 * sang loc tai kiosk: "Hình thức khám: BẢO HIỂM Y TẾ"). De trong/khong truyen = khong in.
 *
 * (opts.footerText2) DONG CHAN TRANG THU 2 (tuy chon, cau hinh qua CLINIC_FOOTER_TEXT_2 trong
 * .env) - in THEM 1 dong ngay duoi opts.footerText. De trong = khong in dong nay (chi con 1 dong
 * chan trang nhu cu).
 */
/**
 * Rut ra ho ten + ngay sinh (dang DD/MM/YYYY, quen thuoc voi nguoi Viet) tu ket qua da PARSE SAN
 * cua CCCD/BHYT (doi tuong `cccd`/`bhyt` tra ve tu POST /api/tickets/parse-qr - xem
 * parseCCCD()/parseBHYT() trong src/services/qrParser.js) - uu tien CCCD neu benh nhan quet ca 2.
 * Dung chung cho kiosk.js va staff-kiosk.js truoc khi goi printReceipt(), tranh lap code o 2 noi.
 */
function patientInfoForReceipt(cccd, bhyt) {
  // CHI lay ten tu CCCD (van ban ro, dang tin cay) - KHONG con lay ten tu QR BHYT nua (xem ghi chu
  // trong parseBHYT() o src/services/qrParser.js), tranh in nham ten sai/loi do giai ma nham.
  const name = cccd?.hoTen || null;
  let dob = null;
  if (cccd?.dob) {
    // cccd.dob dang ISO 'YYYY-MM-DD' (xem qrParser.js) - doi sang DD/MM/YYYY de in.
    const [y, m, d] = cccd.dob.split('-');
    if (y && m && d) dob = `${d}/${m}/${y}`;
  } else if (bhyt?.ngaySinh) {
    dob = bhyt.ngaySinh; // qrParser.js da tra ve san dang dd/mm/yyyy
  }
  return { name, dob };
}

async function printReceipt(opts) {
  let el = document.getElementById('printReceipt');
  if (!el) {
    el = document.createElement('div');
    el.id = 'printReceipt';
    document.body.appendChild(el);
  }
  const esc = (s) => (s == null ? '' : String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])));

  // Logo dau phieu (tuy chon, xem ghi chu opts.logoImage o tren) - gioi han chieu cao toi da
  // (40px) va de rong tu dieu chinh theo ty le anh that (khong ep vuong nhu logo tren kiosk),
  // tranh logo qua kho vao 1 phieu giay nho 80mm.
  const logoImgHtml = opts.logoImage
    ? `<div style="text-align:center; margin-bottom:6px;"><img src="${esc(opts.logoImage)}" alt="" style="max-height:40px; max-width:100%;" /></div>`
    : '';

  el.innerHTML = `
    ${logoImgHtml}
    <div style="text-align:center; font-weight:800; font-size:15px;">${esc(opts.clinicName || 'PHÒNG KHÁM')}</div>
    <div style="text-align:center; font-size:11px; margin:6px 0;">--------------------------------</div>
    <div style="text-align:center; font-size:12px;">SỐ THỨ TỰ</div>
    <div style="text-align:center; font-size:46px; font-weight:800; line-height:1.15; margin:4px 0;">${esc(opts.number)}</div>
    ${opts.priorityLabel ? `<div style="text-align:center; font-size:13px; font-weight:600;">${esc(opts.priorityLabel)}</div>` : ''}
    ${opts.patientName ? `<div style="text-align:center; font-size:13px; font-weight:600; margin-top:4px;">${esc(opts.patientName)}</div>` : ''}
    ${opts.patientDob ? `<div style="text-align:center; font-size:12px;">Ngày sinh: ${esc(opts.patientDob)}</div>` : ''}
    ${Array.isArray(opts.extraLines) && opts.extraLines.length ? `<div style="font-size:12px; margin-top:6px; border-top:1px dashed #000; padding-top:4px;">${opts.extraLines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
    <div style="text-align:center; font-size:11px; margin-top:6px;">${esc(opts.time)}</div>
    <div style="text-align:center; font-size:11px; margin:6px 0;">--------------------------------</div>
    <div style="text-align:center; font-size:11px;">${esc(opts.footerText || 'Vui lòng theo dõi màn hình gọi số')}</div>
    ${opts.footerText2 ? `<div style="text-align:center; font-size:11px;">${esc(opts.footerText2)}</div>` : ''}
  `;

  // Neu co logo, CHO ANH GIAI MA XONG truoc khi do chieu cao phieu/in - dung imgEl.decode() thay
  // vi chi cho su kien 'load': 'load' chi bao anh da TAI XONG (nhan du du lieu tu server), NHUNG
  // CHUA CHAC da GIAI MA/SAN SANG VE len man hinh - decode() la API chuan (ho tro ca anh DA load
  // roi lan anh dang tai), dam bao chac chan anh da san sang truoc khi do kich thuoc/in, tranh lap
  // lai kieu loi "do thieu chieu cao/thieu noi dung vi chua kip hien" tung gap voi mã QR truoc day.
  if (opts.logoImage) {
    const imgEl = el.querySelector('img');
    if (imgEl) {
      try {
        await imgEl.decode();
      } catch {
        // Anh loi/khong giai ma duoc (duong dan sai, file hong...) - BO QUA, KHONG chan luong in
        // phieu chi vi thieu 1 logo (van con so thu tu la thong tin quan trong nhat).
      }
    }
  }

  // Cho THEM 2 nhip ve (requestAnimationFrame) truoc khi in, thay vi chi 1 nhip nhu truoc: ngay
  // sau khi anh logo GIAI MA xong (buoc tren), trinh duyet van can it nhat 1-2 chu ky VE (paint/
  // composite) de THAT SU hien anh len khung hinh truoc khi Chromium chup lai noi dung thanh PDF
  // (webContents.printToPDF() trong electron-widget/main.js) - thieu buoc cho nay la nguyen nhan
  // gay ra loi "co cau hinh PRINT_LOGO_IMAGE nhung logo khong in ra" (giai ma xong khong dong
  // nghia da VE xong, PDF chup ngay sau do co the vAN chup truoc khi anh kip len khung hinh).
  const waitFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  await waitFrame();
  await waitFrame();

  // Neu trang nay dang chay BEN TRONG ung dung desktop Electron di kem (thu muc electron-widget/,
  // xem preload.js) thi dung duong day rieng do de in LANG LE - KHONG hien hop thoai/xem truoc nao
  // ca, in thang ra may in nhiet da chon (hoac may in mac dinh cua he dieu hanh neu chua chon
  // rieng). Gui kem CHIEU CAO THUC TE (px) cua phieu vua render de main.js dat kho giay in dung
  // bang do dai noi dung, tranh thua giay trang.
  if (window.electronPrint && typeof window.electronPrint.print === 'function') {
    // FIX (in hang loat chi ra 1 lenh in): TRUOC DAY goi ham nay xong `return` NGAY (khong doi ket
    // qua) - du preload.js/main.js da doi sang ipcRenderer.invoke()/ipcMain.handle() (co Promise
    // that su), neu KHONG `return`/`await` Promise do o day thi ham printReceipt() (dang la `async
    // function`) van se ket thuc/resolve NGAY LAP TUC nhu cu, khien vong lap `await
    // printTicketReceipt(...)` trong issueBatch() (staff-kiosk.js) van cho SAI (khong that su doi
    // lenh in xong). SUA: `return` thang Promise cua invoke() de loi goi ben ngoai (printReceipt())
    // THAT SU cho den khi main.js in xong (hoac loi) roi moi tiep tuc phieu tiep theo.
    return window.electronPrint.print(el.getBoundingClientRect().height);
  }
  // Trang nay dang chay trong TRINH DUYET THUONG (khong phai Electron) - thu goi xuong "cau noi
  // in" cua ung dung widget Electron (neu widget dang chay tren CHINH MAY NAY, xem
  // startLocalPrintServer() trong electron-widget/main.js) TRUOC KHI roi ve window.print(): nho
  // vay, ke ca khi nhan vien mo /kiosk hoac /staff-kiosk bang Chrome/Edge binh thuong (khong qua
  // menu tray cua widget) van co the in LANG LE duoc, mien la widget co cai va dang chay tren may
  // do. Neu widget khong chay tren may nay (vi du dang mo tu dien thoai, hoac chua cai widget),
  // yeu cau se THAT BAI NHANH (tu choi ket noi toi localhost) va tu dong roi ve window.print()
  // nhu binh thuong - khong lam gian doan luong cap so cua nguoi dung.
  //
  // FIX (nguoi dung phan anh: "cấp nhiều số tự động không đợi in xong đã sang số tiếp theo" khi mo
  // /staff-kiosk bang trinh duyet thuong thay vi qua dung cua so cua widget): TRUOC DAY ham nay chi
  // tra ve true/false (co goi duoc widget hay khong) - KHONG PHAI ket qua in THAT SU, va electron-
  // widget/main.js cung tra loi "200 OK" NGAY KHI VUA RA LENH MO cua so in an (chua in xong) - ca 2
  // cho nay da duoc sua (xem waitForFramePrintDone()/ipcMain.on('print-frame-done') trong main.js
  // va print-ticket-frame.js). O day, doi ten thanh tryLocalPrintBridge() TRA VE dung { success,
  // message } (hoac null neu khong goi duoc widget) THAY VI true/false, de printReceipt() co the
  // return dung ket qua nay cho noi goi cap tren (issuePriorityImmediately()/createStaffTicket()
  // voi awaitPrint:true) biet CHINH XAC in thanh cong hay that bai, giong het nhu khi chay truc
  // tiep trong cua so cua widget.
  const bridgeResult = await tryLocalPrintBridge(opts);
  if (bridgeResult == null) {
    // Khong goi duoc widget (khong cai/khong chay tren may nay, hoac ket noi that bai) - roi ve
    // window.print() nhu cu. KHONG co object ket qua ro rang de tra ve trong truong hop nay (giu
    // dung hanh vi cu, coi nhu "khong biet", noi goi awaitPrint se tu coi la thanh cong).
    fallbackToWindowPrint();
    return undefined;
  }
  return bridgeResult;
}

// Cong cua "cau noi in" cuc bo ma electron-widget/main.js mo tren CHINH MAY DANG CHAY WIDGET (chi
// nhan ket noi tu 127.0.0.1, khong lo ra ngoai mang LAN) - phai khop voi
// `config.localPrintServerPort` (mac dinh 58585) trong electron-widget/config.js.
const LOCAL_PRINT_BRIDGE_PORT = 58585;

/**
 * Tra ve { success, message } (ket qua in THAT SU, doc tu phan hoi cua electron-widget/main.js -
 * xem waitForFramePrintDone() trong main.js) neu goi duoc widget, hoac `null` neu KHONG goi duoc
 * (widget khong chay tren may nay, mat mang, timeout ket noi...) - `null` la tin hieu de
 * printReceipt() roi ve window.print() nhu binh thuong.
 */
async function tryLocalPrintBridge(opts) {
  if (!window.fetch || !window.AbortController) return null;
  const controller = new AbortController();
  // FIX: TANG tu 700ms len 30 GIAY - truoc day 700ms la DU vi luc do widget tra loi NGAY KHI VUA
  // RA LENH mo cua so in an (chua thuc su in xong); nay widget CHI tra loi SAU KHI in xong that su
  // (co the mat vai giay, cong them PRINT_JOB_GAP_MS=2s giua cac lenh - xem printTicketSilently()
  // trong electron-widget/main.js), nen phai cho DU LAU hon nhieu de khong bi huy (abort) oan giua
  // chung 1 lenh in dang chay binh thuong. Truong hop KHONG co widget chay tren may (ly do pho
  // bien nhat de roi ve nhanh nay) van THAT BAI NHANH nhu cu (ket noi bi tu choi ngay lap tuc,
  // KHONG phu thuoc vao gia tri timeout nay) - timeout nay chi la luoi an toan cho truong hop hiem
  // (widget treo/khong phan hoi).
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`http://127.0.0.1:${LOCAL_PRINT_BRIDGE_PORT}/print-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    // `data.result` la object { success, message } that su tu widget (xem res.end(JSON.stringify(
    // { ok: true, result })) trong startLocalPrintServer() cua main.js) - neu thieu (ban widget cu
    // hon, chua co fix nay) thi coi nhu thanh cong (giu tuong thich nguoc, tranh dung nham vong lap
    // tu dong chi vi dang dung ban widget cu chua cap nhat).
    return (data && data.result) || { success: true };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function fallbackToWindowPrint() {
  try {
    window.print();
  } catch {
    // Mot so moi truong (vi du webview nhung khong ho tro in) khong co window.print() dung
    // nghia - bo qua, khong lam gian doan luong cap so cua nguoi dung.
  }
}
