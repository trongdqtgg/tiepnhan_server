/**
 * Trang AN, KHONG danh cho nguoi dung xem - chi de CHINH ung dung Electron (electron-widget) tu mo
 * trong 1 cua so an (xem startLocalPrintServer()/openPrintFrameWindow() trong
 * electron-widget/main.js) khi nhan duoc yeu cau in tu 1 trang WEB THUONG (khong phai /kiosk hay
 * /staff-kiosk mo truc tiep qua Electron) - nho vay, MOI trang trong he thong dung chung
 * printReceipt() (khong chi rieng 2 man hinh kiosk) deu co the in LANG LE qua may in nhiet, mien la
 * widget dang chay tren cung 1 may.
 *
 * Doc du lieu phieu tu QUERY STRING (do electron-widget/main.js tu dien vao khi mo trang nay), dung
 * lai printReceipt() (public/print-receipt.js) y het cac trang kiosk, roi tu in ngay khi vua tai
 * xong - trang nay khong co giao dien gi khac ngoai div phieu (an, chi hien luc @media print).
 */
(async function () {
  const params = new URLSearchParams(window.location.search);
  // FIX (nguoi dung phan anh: "quét qua nhiều số nhưng sao nó k gọi in từng số đợi in xong rồi hay
  // qua số tiếp theo" khi dung tinh nang "cấp nhiều số" tu dong): TRUOC DAY trang an nay chi GOI
  // printReceipt() ROI THOI, khong bao gio cho biet KHI NAO in xong - electron-widget/main.js (xem
  // startLocalPrintServer()) lai tra loi "200 OK" cho trinh duyet NGAY LUC VUA MO trang an nay
  // (truoc ca khi trang kip chay xong dong code duoi day), khien phia trinh duyet (vong lap tu dong
  // cap nhieu so trong staff-kiosk.js) tuong nhu da in xong va lap tuc cap so tiep theo, trong khi
  // lenh in THAT SU van con dang chay ngam trong chinh cua so an nay. Chi xay ra khi /staff-kiosk
  // (hoac /kiosk) duoc mo bang trinh duyet THUONG (Chrome/Edge, khong qua dung cua so cua widget) -
  // luc do print-receipt.js phai nho widget in HO qua "cau noi" HTTP cuc bo nay (tryLocalPrintBridge()
  // trong print-receipt.js) thay vi goi thang window.electronPrint.print() nhu khi mo qua widget.
  //
  // SUA: CHO (await) ket qua THAT SU cua printReceipt() (tra ve { success, message } khi trang nay
  // dang chay trong Electron - luon dung, vi trang an nay CUNG duoc gan preload.js) roi moi goi
  // window.electronPrint.reportFrameDone() de BAO NGUOC LAI cho main.js - main.js gio se CHO tin
  // nay roi moi thuc su tra loi request HTTP dang cho cua trinh duyet (xem ipcMain.on('print-frame-done')
  // va startLocalPrintServer() trong electron-widget/main.js).
  const requestId = params.get('__printReqId') || '';
  let result;
  try {
    result = await printReceipt({
      clinicName: params.get('clinicName') || undefined,
      number: params.get('number') || '',
      priorityLabel: params.get('priorityLabel') || '',
      time: params.get('time') || '',
      footerText: params.get('footerText') || undefined,
      footerText2: params.get('footerText2') || undefined,
      logoImage: params.get('logoImage') || undefined,
      idQrRaw: params.get('idQrRaw') || null,
      patientName: params.get('patientName') || null,
      patientDob: params.get('patientDob') || null,
    });
  } catch (err) {
    result = { success: false, message: err && err.message ? err.message : String(err) };
  }
  if (requestId && window.electronPrint && typeof window.electronPrint.reportFrameDone === 'function') {
    window.electronPrint.reportFrameDone(requestId, result || { success: true });
  }
})();
