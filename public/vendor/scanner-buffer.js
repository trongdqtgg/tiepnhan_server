/**
 * Bo dem CHONG NHIEU cho may quet QR/mã vạch kieu ban phim (keyboard wedge - may quet gia lam ban
 * phim, "go" thang noi dung vao 1 o input an, khong can driver rieng).
 *
 * VAN DE THUC TE (nguyen nhan yeu cau sua module nay): mot so may quet, do loi cau hinh/firmware/
 * dut quang giua chung, co TY LE gui NHAM 1 phim Enter (hoac Tab) NGAY GIUA noi dung dang quet -
 * TRUOC KHI het chuoi. Code cu (chi lang nghe "Enter roi xu ly ngay gia tri hien co cua input")
 * se tuong scan da xong va xu ly luon 1 chuoi BI CAT CUT giua chung. Voi QR CCCD/BHYT (dang
 * "p1|p2|p3|..."), neu bi cat dung trong doan chua so CCCD/ma the BHYT (truong dung de DOI CHIEU
 * TRUNG - chong cap so trung lap), so bi cat ngan se KHONG con khop voi lich su that, khien co che
 * chong trung hoan toan mat tac dung ma khong bao loi gi ca - rat nguy hiem vi im lang sai.
 *
 * BAI HOC TU THUC TE (the BHYT thuc, dang co RAT NHIEU truong ngan cach boi "|" - 15-16 truong
 * hoac hon, khong chi 4 truong don gian nhu gia dinh ban dau): 1 ham `isComplete(text)` chi dua
 * vao SO LUONG dau "|" toi thieu (vi du ">=4") la KHONG DU TIN CAY de quyet dinh flush NGAY LAP
 * TUC va XOA SACH o input. Neu Enter nhieu roi dung vao dung luc noi dung MOI go da "trong co ve
 * du" (vi du moi go xong 4/16 truong) nhung THUC TE may quet se con go tiep, flush ngay se:
 *   - Xu ly 1 gia tri THIEU (chi co 1 phan dau cua QR that).
 *   - XOA SACH o input -> phan con lai (vi du 12 truong sau) bi go tiep vao 1 o TRONG MOI, tro
 *     thanh 1 "lan quet" RIENG BIET, khong lien quan gi den lan dau - khi lan nay den luot no cung
 *     trong "co ve du" (vi du lai du >=4 phan), no SE DUOC XU LY NHU 1 MA QR THAT SU KHAC, voi
 *     `parts[0]` la 1 doan GIUA CHUNG cua chuoi that (khong phai ma the/so CCCD that) -> id_number
 *     rac -> DOI CHIEU TRUNG SAI HOAN TOAN cho ca lan quet nay LAN nhung lan quet that tiep theo.
 * Noi cach khac: van de khong chi la "Enter den som co the bi coi la du" (da xu ly o ban dau) - ma
 * la HANH DONG FLUSH+XOA NGAY LAP TUC ngay khi "co ve du" moi thuc su nguy hiem, vi no CAT DOI du
 * lieu that thanh 2 manh roi lam ban ca 2.
 *
 * CACH KHAC PHUC (khong doi phan cung may quet, chi sua cach dien giai o phia phan mem):
 *  1. Enter (du "co ve du" theo `isComplete()` hay chua) KHONG BAO GIO flush NGAY LAP TUC nua.
 *     Enter chi la 1 "tin hieu goi y", luon can THEM 1 khoang thoi gian "xac nhan" khong co ky tu
 *     moi nao nua (`confirmMs` neu noi dung da "co ve du", hoac `idleMs` day du neu chua) truoc khi
 *     THUC SU flush. Neu may quet go tiep ngay sau Enter (dang go 1 phim < 20ms/ky tu) - ky tu moi
 *     do se TU DONG huy lich flush dang cho (vi lich duoc dat lai tu dau moi lan co ky tu moi) va
 *     noi tiep thang vao CUNG 1 o input dang co - KHONG bi tach doi/mat du lieu nhu truoc.
 *  2. Du phong bang THOI GIAN cho ca chieu nguoc lai: may quet go ky tu RAT NHANH (thuong duoi
 *     ~15-20ms giua 2 ky tu lien tiep), khac han nguoi go tay (thuong tren 30-50ms). Neu KHONG co
 *     ky tu moi nao trong `idleMs` (mac dinh 150ms) ke tu ky tu/Enter cuoi cung VA o input dang co
 *     noi dung -> TU DONG coi nhu da quet xong (dung cho truong hop may quet khong gui Enter cuoi,
 *     hoac dung Enter cuoi cung do chinh no cung bi mat/nhieu).
 *  3. Don rac: neu o input "dung im" (khong co ky tu moi) qua lau (`resetMs`, mac dinh 3s) MA VAN
 *     chua du dieu kien hop le - tu xoa sach o input, tranh phan con sot lai tu 1 lan quet loi/dut
 *     giua chung bi noi nham vao lan quet ke tiep cua nguoi khac.
 *
 * Cach dung (thay cho `inputEl.addEventListener('keydown', ...)` truoc day):
 *   ScannerBuffer.attach(scanInput, {
 *     onComplete: (text) => { ... xu ly y het truoc day, `text` la noi dung DA XAC NHAN day du ... },
 *     isComplete: (text) => text.split('|').length >= 4, // tuy dinh dang, mac dinh luon coi la du
 *   });
 */
(function () {
  function attach(inputEl, opts) {
    if (!inputEl) return { detach() {} };
    const onComplete = (opts && opts.onComplete) || function () {};
    const isComplete = (opts && opts.isComplete) || function () { return true; };
    const idleMs = (opts && opts.idleMs) || 150;
    // Khoang "xac nhan" ngan hon, danh rieng cho truong hop Enter den kem noi dung DA "co ve du"
    // (isComplete() == true) - van phai cho THEM mot chut de chac chan may quet khong go tiep,
    // nhung khong can cho lau bang idleMs day du vi da co tin hieu Enter ho tro. Mac dinh lay
    // nho hon giua 80ms va idleMs, dam bao khong bao gio lon hon idleMs du goi tuy chinh sai.
    const confirmMs = Math.min((opts && opts.confirmMs) || 80, idleMs);
    const resetMs = (opts && opts.resetMs) || 3000;

    let idleTimer = null;
    let resetTimer = null;

    function clearTimers() {
      clearTimeout(idleTimer);
      idleTimer = null;
      clearTimeout(resetTimer);
      resetTimer = null;
    }

    function flush() {
      clearTimers();
      const text = inputEl.value.trim();
      inputEl.value = '';
      if (text) onComplete(text);
    }

    // Dat lai lich "flush neu dung im du lau" - goi lai MOI khi co ky tu/Enter moi (huy lich cu),
    // nen chi thuc su flush khi KHONG co gi moi trong dung `delayMs` lien tiep. Day la NOI DUY
    // NHAT flush() duoc goi - Enter khong bao gio flush truc tiep/dong bo nua (xem chu thich dau
    // file - do la nguyen nhan goc cua loi "cat doi du lieu" khi Enter nhieu dung vao luc noi dung
    // moi "co ve du").
    function scheduleFlush(delayMs) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (inputEl.value) flush();
      }, delayMs);
    }

    // Don rac neu bo dem dung im qua lau ma van chua "hop le" - tranh noi rac vao lan quet sau.
    function scheduleReset() {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        inputEl.value = '';
        clearTimers();
      }, resetMs);
    }

    function handleKeydown(e) {
      if (e.key === 'Enter') {
        // Ngan hanh vi mac dinh (vi du submit form neu input nam trong 1 form nao do) - o quet nay
        // luon la input doc lap, khong can Enter lam gi khac ngoai bao hieu ket thuc.
        e.preventDefault && e.preventDefault();
        const current = inputEl.value;
        // QUAN TRONG: du `isComplete(current)` tra ve true hay false, TUYET DOI KHONG flush ngay -
        // chi dat lich cho "xac nhan im lang" (ngan hon neu da co ve du, day du neu chua). Neu day
        // la Enter that (cuoi chuoi that), se khong co ky tu nao them -> lich nay se tu chay va
        // flush dung luc. Neu day la Enter NHIEU giua chung (kha nang cao voi the BHYT nhieu
        // truong), may quet se go tiep ngay lap tuc (<20ms sau) -> ky tu tiep theo se huy lich nay
        // (xem nhanh khong-phai-Enter ben duoi, cung goi scheduleFlush) va noi tiep vao dung 1 o
        // input, khong bi cat doi du lieu.
        scheduleFlush(isComplete(current) ? confirmMs : idleMs);
        scheduleReset();
        return;
      }
      // Ky tu thuong - ban than input da tu dien gia tri, chi can lich lai bo dem thoi gian (huy
      // moi lich flush dang cho tu 1 Enter nhieu truoc do, neu co).
      scheduleFlush(idleMs);
      scheduleReset();
    }

    inputEl.addEventListener('keydown', handleKeydown);

    return {
      detach() {
        inputEl.removeEventListener('keydown', handleKeydown);
        clearTimers();
      },
    };
  }

  window.ScannerBuffer = { attach };
})();
